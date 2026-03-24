# HumanMark
### Document Provenance via Behavioral Biometrics + Hedera Consensus Service

> *"Not AI detection. Human proof."*

---

## The Problem

AI-generated content has made it nearly impossible to trust whether a document was written by a human. Existing solutions are broken:

- **Turnitin / AI detectors** — stores your work on their servers, invasive, unreliable, easily gamed
- **Google Docs activity tracking** — exposes every backspace, every 3am panic session to your professor
- **AI detectors** — probabilistic, produce false positives, losing arms race against better models

Real example: **Deloitte submitted an AI-generated report riddled with basic errors to the Australian government for hundreds of thousands of dollars.** A simple provenance check would have caught it.

---

## The Solution: Provenance, Not Detection

HumanMark proves **human presence** during writing — not whether the text *looks* human.

### How it works

```
Writer types in HumanMark editor
         │
         ▼
Keystroke dynamics engine (local, in-browser)
  · avg WPM, key dwell, inter-key flight time
  · rhythm consistency score (0–1)
  · burst patterns, pause events
  · backspace ratio (ratio only — not content)
         │
         ▼
Every N minutes: Snapshot
  · SHA-256 of document content (hash only, not content)
  · SHA-256 of metadata (word count, char count, timestamp)
  · Aggregate keystroke stats
  — NOT the document text —
         │
         ▼
Hedera Consensus Service (HCS)
  · Immutable, timestamped, ordered message log
  · ~$0.0001 per message on testnet
  · Finality guaranteed (not probabilistic like blockchain)
         │
         ▼
On completion: Certificate of Human Origin
  · PDF with all Hedera transaction IDs
  · Verifiable by anyone at hashscan.io
  · QR code links to ledger trail
```

### Privacy-first design
- ❌ No document content stored anywhere
- ❌ No raw keystroke sequences recorded
- ❌ No server database of your work
- ✅ Only cryptographic hashes + aggregate stats (averages, ratios)
- ✅ Ledger entries are immutable but contain zero PII

---

## Why Hedera?

| Feature | Hedera HCS | Ethereum | Bitcoin |
|---|---|---|---|
| Finality | **Absolute (3-5s)** | Probabilistic | Probabilistic |
| Cost per message | **~$0.0001** | $0.50–$50 | impractical |
| Throughput | **10,000+ TPS** | ~15 TPS | ~7 TPS |
| Message ordering | **Guaranteed** | Not guaranteed | Not guaranteed |
| Energy | **Carbon negative** | High (PoW era) | High |

HCS (Hedera Consensus Service) is **exactly** the primitive we need: a timestamped, ordered, immutable log. Each session gets its own topic. Every snapshot is a message. The final certificate links to all of them on hashscan.io.

---

## Use Cases

| Scenario | How HumanMark helps |
|---|---|
| Student submitting an essay | Certificate proves continuous human engagement during writing |
| Researcher submitting a paper | Timestamped ledger trail of writing session |
| Consultant billing for written work | Proof of human labor, not AI generation |
| Journalist publishing an investigation | Immutable provenance record for editorial accountability |
| Legal document authorship | Chain of custody for human-authored documents |

---

## MVP Architecture

```
provenance-mvp/
├── backend/
│   ├── server.js        # Express API
│   ├── hedera.js        # HCS topic creation + message submission
│   ├── certificate.js   # PDF generation (pdfkit)
│   ├── package.json
│   └── .env.example
└── frontend/
    └── public/
        └── index.html   # Full SPA — keystroke engine + writing UI + dashboard
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/session/start` | Create HCS topic, return sessionId + topicId |
| POST | `/api/session/snapshot` | Submit behavioral hash snapshot to HCS |
| POST | `/api/session/finalize` | Anchor final summary, aggregate stats |
| GET | `/api/session/:id` | Retrieve session details for verification |
| GET | `/api/session/:id/certificate` | Download PDF certificate |

---

## Quick Start

### 1. Get Hedera testnet credentials (free, 2 minutes)
```
1. Go to https://portal.hedera.com
2. Create account → choose Testnet
3. Copy your Account ID (e.g. 0.0.4758291) and Private Key
```

### 2. Setup
```bash
chmod +x setup.sh && ./setup.sh
```

### 3. Configure
```bash
# Edit backend/.env
HEDERA_ACCOUNT_ID=0.0.YOUR_ID
HEDERA_PRIVATE_KEY=your_private_key_here

# OR for demo mode (no Hedera account needed):
DEMO_MODE=true
```

### 4. Run
```bash
cd backend
npm start
# → http://localhost:3001
```

---

## Demo Script (for judges)

1. **Open** `http://localhost:3001`
2. **Enter** document title + your name, click "Begin Verified Writing Session"
3. **Type** for 30 seconds — watch the live WPM, rhythm score, and waveform
4. **Click** "Manual Snapshot Now" — see it anchor to Hedera in ~1-2s
5. **Click** the Hashscan link — verify the transaction exists on the public ledger
6. **Click** "Finalize & Issue Certificate"
7. **Download** the PDF certificate

**Key talking points:**
- Point to the rhythm waveform: *"This is what human typing looks like. AI would generate text instantly — no rhythm, no pauses, no backspaces."*
- Point to hashscan: *"This is on a public, immutable ledger. Nobody can falsify the timestamp."*
- Point to the privacy note: *"We never see their document. Zero content. Just hashes and statistics."*
- The Deloitte example: *"A simple HumanMark certificate requirement would have flagged that the document was never typed by a human."*

---

## Limitations (be honest with judges)

- **Spoofable** by a sufficiently motivated actor with a keystroke simulator — but so is any system. We raise the bar dramatically.
- **Browser extension** would be a stronger trust model than a web app (can't be turned off mid-session)
- **Session persistence** is in-memory for MVP — production needs a database
- **Content hash** uses FNV for demo speed; production uses Web Crypto SHA-256

---

## Roadmap (what's next)

- [ ] Browser extension for OS-level keystroke capture
- [ ] Multi-document session correlation (same author fingerprint over time)
- [ ] Verifier portal: paste a certificate ID, instantly verify on hashscan
- [ ] Integration with university LMS systems (Canvas, Moodle)
- [ ] NFT-style transferable provenance certificates
- [ ] SDK for third-party document editors to embed HumanMark

---

## Built With

- **[Hedera Consensus Service](https://hedera.com/consensus-service)** — immutable timestamped ledger
- **Node.js + Express** — backend API
- **@hashgraph/sdk** — official Hedera JS SDK  
- **PDFKit** — certificate generation
- Vanilla JS frontend (no framework dependencies)

---

*HumanMark — Hedera Hackathon 2025 submission — Open Track*
