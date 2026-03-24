require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { hederaService } = require("./hedera");
const { generateCertificate } = require("./certificate");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

// In-memory session store (fine for MVP/hackathon)
const sessions = {};

// ─────────────────────────────────────────────
// POST /api/session/start
// Creates a new HCS topic for this writing session
// ─────────────────────────────────────────────
app.post("/api/session/start", async (req, res) => {
  try {
    const { documentTitle, authorName } = req.body;
    const sessionId = uuidv4();

    console.log(`[SESSION] Starting session: ${sessionId}`);

    // Create a dedicated HCS topic for this session
    const topicId = await hederaService.createTopic(
      `HumanMark | ${documentTitle} | ${authorName} | ${sessionId}`
    );

    sessions[sessionId] = {
      sessionId,
      documentTitle,
      authorName,
      topicId,
      startTime: Date.now(),
      snapshots: [],
      keystrokeStats: [],
    };

    res.json({
      success: true,
      sessionId,
      topicId,
      message: "Session started. HCS topic created.",
    });
  } catch (err) {
    console.error("[SESSION START ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/session/snapshot
// Submits a behavioral + content hash snapshot to HCS
// ─────────────────────────────────────────────
app.post("/api/session/snapshot", async (req, res) => {
  try {
    const { sessionId, snapshotData } = req.body;
    const session = sessions[sessionId];

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    const snapshotIndex = session.snapshots.length + 1;

    // Build the HCS message payload
    // IMPORTANT: We store hashes only, never raw content
    const hcsMessage = {
      type: "HUMANMARK_SNAPSHOT",
      version: "1.0",
      sessionId,
      snapshotIndex,
      timestamp: new Date().toISOString(),
      contentHash: snapshotData.contentHash,       // SHA-256 of document content
      metadataHash: snapshotData.metadataHash,     // hash of {wordCount, charCount, timestamp}
      keystrokeProfile: {
        avgWPM: snapshotData.avgWPM,
        avgDwell: snapshotData.avgDwell,           // avg key hold duration (ms)
        avgFlight: snapshotData.avgFlight,         // avg time between keystrokes (ms)
        pauseCount: snapshotData.pauseCount,       // pauses > 2s
        burstCount: snapshotData.burstCount,       // typing bursts
        rhythmScore: snapshotData.rhythmScore,     // 0-1, consistency metric
        backspaceRatio: snapshotData.backspaceRatio, // backspaces / total keys (privacy: ratio only)
      },
      // Note: No raw content, no keystroke sequences, no PII
    };

    // Submit to Hedera Consensus Service
    const txResult = await hederaService.submitMessage(
      session.topicId,
      JSON.stringify(hcsMessage)
    );

    const snapshotRecord = {
      ...hcsMessage,
      transactionId: txResult.transactionId,
      hashscanUrl: txResult.hashscanUrl,
    };

    session.snapshots.push(snapshotRecord);
    session.keystrokeStats.push(snapshotData);

    console.log(
      `[SNAPSHOT] Session ${sessionId} | Snapshot #${snapshotIndex} | TX: ${txResult.transactionId}`
    );

    res.json({
      success: true,
      snapshotIndex,
      transactionId: txResult.transactionId,
      hashscanUrl: txResult.hashscanUrl,
    });
  } catch (err) {
    console.error("[SNAPSHOT ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/session/finalize
// Submits final summary + issues certificate
// ─────────────────────────────────────────────
app.post("/api/session/finalize", async (req, res) => {
  try {
    const { sessionId, finalData } = req.body;
    const session = sessions[sessionId];

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    const duration = Date.now() - session.startTime;

    // Compute aggregate keystroke profile over entire session
    const stats = session.keystrokeStats;
    const avg = (key) =>
      stats.length > 0
        ? Math.round(stats.reduce((s, x) => s + (x[key] || 0), 0) / stats.length)
        : 0;

    const aggregateProfile = {
      avgWPM: avg("avgWPM"),
      avgDwell: avg("avgDwell"),
      avgFlight: avg("avgFlight"),
      totalPauses: stats.reduce((s, x) => s + (x.pauseCount || 0), 0),
      totalBursts: stats.reduce((s, x) => s + (x.burstCount || 0), 0),
      avgRhythmScore: (
        stats.reduce((s, x) => s + (x.rhythmScore || 0), 0) / (stats.length || 1)
      ).toFixed(3),
      avgBackspaceRatio: (
        stats.reduce((s, x) => s + (x.backspaceRatio || 0), 0) / (stats.length || 1)
      ).toFixed(3),
    };

    // Submit final record to HCS
    const finalMessage = {
      type: "HUMANMARK_FINAL",
      version: "1.0",
      sessionId,
      documentTitle: session.documentTitle,
      authorName: session.authorName,
      startTime: new Date(session.startTime).toISOString(),
      endTime: new Date().toISOString(),
      durationMs: duration,
      totalSnapshots: session.snapshots.length,
      finalContentHash: finalData.contentHash,
      aggregateKeystrokeProfile: aggregateProfile,
      snapshotTransactionIds: session.snapshots.map((s) => s.transactionId),
    };

    const txResult = await hederaService.submitMessage(
      session.topicId,
      JSON.stringify(finalMessage)
    );

    session.finalTransactionId = txResult.transactionId;
    session.finalHashscanUrl = txResult.hashscanUrl;
    session.aggregateProfile = aggregateProfile;
    session.finalMessage = finalMessage;
    session.finalized = true;

    console.log(
      `[FINALIZE] Session ${sessionId} complete | TX: ${txResult.transactionId}`
    );

    res.json({
      success: true,
      transactionId: txResult.transactionId,
      hashscanUrl: txResult.hashscanUrl,
      topicId: session.topicId,
      totalSnapshots: session.snapshots.length,
      aggregateProfile,
      sessionId,
    });
  } catch (err) {
    console.error("[FINALIZE ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/session/:sessionId/certificate
// Returns a PDF certificate
// ─────────────────────────────────────────────
app.get("/api/session/:sessionId/certificate", async (req, res) => {
  try {
    const session = sessions[req.params.sessionId];
    if (!session || !session.finalized) {
      return res.status(404).json({ success: false, error: "Session not found or not finalized" });
    }

    const pdfBuffer = await generateCertificate(session);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="HumanMark-${session.sessionId.slice(0, 8)}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[CERTIFICATE ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/session/:sessionId
// Returns session details (for verification / display)
// ─────────────────────────────────────────────
app.get("/api/session/:sessionId", (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  // Return safe subset (no raw content)
  res.json({
    success: true,
    sessionId: session.sessionId,
    documentTitle: session.documentTitle,
    authorName: session.authorName,
    topicId: session.topicId,
    startTime: session.startTime,
    finalized: session.finalized || false,
    totalSnapshots: session.snapshots.length,
    snapshots: session.snapshots.map((s) => ({
      index: s.snapshotIndex,
      timestamp: s.timestamp,
      transactionId: s.transactionId,
      hashscanUrl: s.hashscanUrl,
    })),
    aggregateProfile: session.aggregateProfile,
    finalTransactionId: session.finalTransactionId,
    finalHashscanUrl: session.finalHashscanUrl,
  });
});

// Serve frontend for any other route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🔐 HumanMark backend running on http://localhost:${PORT}`);
  console.log(`📋 Demo mode: ${process.env.DEMO_MODE === "true" ? "ON" : "OFF"}`);
  console.log(`🌐 Hedera network: TESTNET\n`);
});
