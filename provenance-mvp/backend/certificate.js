const PDFDocument = require("pdfkit");

/**
 * Generates an Authograph provenance certificate as a PDF buffer.
 */
async function generateCertificate(session) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 60,
      info: {
        Title: `HumanMark Certificate — ${session.documentTitle}`,
        Author: "Authograph Provenance System",
      },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const ACCENT = "#1a1a2e";
    const TEAL = "#0f7173";
    const LIGHT = "#f5f5f0";

    // ── Header bar ──────────────────────────────────────
    doc.rect(0, 0, W, 120).fill(ACCENT);

    doc
      .fillColor("#ffffff")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("Authograph", 60, 35);

    doc
      .fillColor("#aaaacc")
      .fontSize(11)
      .font("Helvetica")
      .text("DOCUMENT PROVENANCE CERTIFICATE", 60, 68);

    doc
      .fillColor("#ffffff")
      .fontSize(9)
      .text(`Certificate ID: ${session.sessionId}`, 60, 90);

    // ── Certificate title ────────────────────────────────
    doc.moveDown(2);
    doc.y = 145;

    doc
      .fillColor(ACCENT)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("CERTIFICATE OF HUMAN ORIGIN", { align: "center" });

    doc.moveDown(0.3);
    doc
      .fillColor("#555555")
      .fontSize(10)
      .font("Helvetica")
      .text(
        "This document certifies that the work described below was created through\n" +
          "continuous human interaction, verified by behavioral biometrics and immutably\n" +
          "recorded on the Hedera public ledger.",
        { align: "center" }
      );

    // ── Document info box ────────────────────────────────
    doc.moveDown(1.5);
    const boxY = doc.y;
    doc.rect(60, boxY, W - 120, 90).fill(LIGHT).stroke("#dddddd");

    doc.fillColor(ACCENT).fontSize(10).font("Helvetica-Bold").text("DOCUMENT", 80, boxY + 12);
    doc
      .fillColor("#111111")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(session.documentTitle || "Untitled", 80, boxY + 26);

    doc.fillColor(ACCENT).fontSize(10).font("Helvetica-Bold").text("AUTHOR", 80, boxY + 52);
    doc
      .fillColor("#111111")
      .fontSize(11)
      .font("Helvetica")
      .text(session.authorName || "Anonymous", 80, boxY + 66);

    // Dates on right side
    const startStr = new Date(session.startTime).toUTCString();
    const endStr = new Date().toUTCString();
    doc.fillColor(ACCENT).fontSize(9).font("Helvetica-Bold").text("SESSION START", W - 220, boxY + 12);
    doc.fillColor("#333333").fontSize(8).font("Helvetica").text(startStr, W - 220, boxY + 24, { width: 150 });
    doc.fillColor(ACCENT).fontSize(9).font("Helvetica-Bold").text("SESSION END", W - 220, boxY + 52);
    doc.fillColor("#333333").fontSize(8).font("Helvetica").text(endStr, W - 220, boxY + 64, { width: 150 });

    // ── Behavioral profile ───────────────────────────────
    doc.y = boxY + 108;
    doc.moveDown(0.5);

    doc
      .fillColor(TEAL)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("BEHAVIORAL BIOMETRIC PROFILE");

    doc.moveDown(0.3);

    const profile = session.aggregateProfile || {};
    const metrics = [
      ["Avg Typing Speed", `${profile.avgWPM || "—"} WPM`],
      ["Avg Key Dwell Time", `${profile.avgDwell || "—"} ms`],
      ["Avg Inter-key Flight", `${profile.avgFlight || "—"} ms`],
      ["Rhythm Consistency Score", profile.avgRhythmScore || "—"],
      ["Backspace Ratio", profile.avgBackspaceRatio || "—"],
      ["Typing Bursts Detected", profile.totalBursts || "—"],
      ["Pause Events (>2s)", profile.totalPauses || "—"],
      ["Total Snapshots Recorded", session.snapshots.length],
    ];

    const colW = (W - 120) / 2;
    let metY = doc.y;
    metrics.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 60 + col * colW;
      const y = metY + row * 26;
      doc.fillColor("#777777").fontSize(8).font("Helvetica").text(label.toUpperCase(), x, y);
      doc.fillColor("#111111").fontSize(11).font("Helvetica-Bold").text(String(value), x, y + 10);
    });

    doc.y = metY + Math.ceil(metrics.length / 2) * 26 + 10;

    // ── Hedera ledger entries ────────────────────────────
    doc.moveDown(0.5);
    doc.fillColor(TEAL).fontSize(11).font("Helvetica-Bold").text("HEDERA LEDGER RECORD");
    doc.moveDown(0.3);

    doc
      .fillColor("#555555")
      .fontSize(9)
      .font("Helvetica")
      .text(`HCS Topic ID: ${session.topicId}`, { continued: false });

    doc.moveDown(0.2);
    doc
      .fillColor("#0000aa")
      .fontSize(8)
      .text(`Verify on Hashscan: ${session.finalHashscanUrl || `https://hashscan.io/testnet/topic/${session.topicId}`}`);

    doc.moveDown(0.5);
    doc.fillColor("#333333").fontSize(9).font("Helvetica-Bold").text("Snapshot Transaction IDs:");
    doc.moveDown(0.2);

    const snapshots = session.snapshots || [];
    snapshots.forEach((snap, i) => {
      doc
        .fillColor("#555555")
        .fontSize(7.5)
        .font("Helvetica")
        .text(`#${i + 1}  ${snap.transactionId}  ·  ${snap.timestamp}`);
    });

    if (session.finalTransactionId) {
      doc.moveDown(0.3);
      doc
        .fillColor("#333333")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(`Final Record TX: ${session.finalTransactionId}`);
    }

    // ── Privacy notice ───────────────────────────────────
    doc.moveDown(1);
    doc.rect(60, doc.y, W - 120, 42).fill("#f0f4f0").stroke("#ccddcc");
    doc
      .fillColor("#336633")
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("PRIVACY STATEMENT", 72, doc.y + 5);
    doc
      .fillColor("#445544")
      .fontSize(7.5)
      .font("Helvetica")
      .text(
        "No document content was stored or transmitted. Only cryptographic hashes and " +
          "aggregate behavioral metadata (ratios, averages) were recorded on the ledger. " +
          "Raw keystroke sequences and document text remain exclusively with the author.",
        72,
        doc.y + 5,
        { width: W - 150 }
      );

    // ── Footer ───────────────────────────────────────────
    doc
      .rect(0, doc.page.height - 40, W, 40)
      .fill(ACCENT);

    doc
      .fillColor("#aaaacc")
      .fontSize(7.5)
      .font("Helvetica")
      .text(
        `HumanMark · Powered by Hedera Consensus Service · ${new Date().toISOString()} · This certificate is independently verifiable at hashscan.io`,
        60,
        doc.page.height - 26,
        { align: "center", width: W - 120 }
      );

    doc.end();
  });
}

module.exports = { generateCertificate };
