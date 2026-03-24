const { Client, TopicCreateTransaction, TopicMessageSubmitTransaction, PrivateKey, AccountId } = require("@hashgraph/sdk");

const DEMO_MODE = process.env.DEMO_MODE === "true";

// ─────────────────────────────────────────────
// Hedera client setup
// ─────────────────────────────────────────────
function getClient() {
  if (DEMO_MODE) return null;

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;

  if (!accountId || !privateKey || accountId.includes("XXXXXXX")) {
    console.warn("[HEDERA] No credentials found — falling back to DEMO MODE");
    process.env.DEMO_MODE = "true";
    return null;
  }

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(accountId), PrivateKey.fromStringECDSA(privateKey));
  return client;
}

// ─────────────────────────────────────────────
// Demo mode helpers — generate realistic fake IDs
// ─────────────────────────────────────────────
function fakeTxId(accountId = "0.0.4758291") {
  const ts = Math.floor(Date.now() / 1000);
  const nano = Math.floor(Math.random() * 999999999);
  return `${accountId}@${ts}.${nano}`;
}

function fakeTopicId() {
  const num = Math.floor(Math.random() * 9000000) + 1000000;
  return `0.0.${num}`;
}

function hashscanUrl(topicId, txId) {
  // Encode the tx ID for hashscan URL format
  const encoded = txId.replace("@", "-").replace(".", "-").replace(".", "-");
  return `https://hashscan.io/testnet/topic/${topicId}`;
}

// ─────────────────────────────────────────────
// hederaService
// ─────────────────────────────────────────────
const hederaService = {
  /**
   * Creates a new HCS topic for a writing session.
   * Returns the topic ID string e.g. "0.0.1234567"
   */
  async createTopic(memo) {
    if (DEMO_MODE || !process.env.HEDERA_ACCOUNT_ID?.match(/0\.0\.\d+/)) {
      const topicId = fakeTopicId();
      console.log(`[DEMO] Created topic: ${topicId} | Memo: ${memo}`);
      return topicId;
    }

    const client = getClient();
    const tx = await new TopicCreateTransaction()
      .setTopicMemo(memo.slice(0, 100)) // HCS memo max 100 chars
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const topicId = receipt.topicId.toString();
    console.log(`[HEDERA] Created topic: ${topicId}`);
    return topicId;
  },

  /**
   * Submits a message to an HCS topic.
   * Returns { transactionId, hashscanUrl }
   */
  async submitMessage(topicId, messageJson) {
    if (DEMO_MODE || !process.env.HEDERA_ACCOUNT_ID?.match(/0\.0\.\d+/)) {
      // Simulate ~1s network delay for realism in demo
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
      const txId = fakeTxId(process.env.HEDERA_ACCOUNT_ID || "0.0.4758291");
      console.log(`[DEMO] Submitted to ${topicId} | TX: ${txId}`);
      return {
        transactionId: txId,
        hashscanUrl: hashscanUrl(topicId, txId),
      };
    }

    const client = getClient();

    // HCS message size limit is 1024 bytes — chunk if needed
    const msgBytes = Buffer.byteLength(messageJson, "utf8");
    if (msgBytes > 1024) {
      console.warn(`[HEDERA] Message is ${msgBytes} bytes, chunking enabled`);
    }

    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(messageJson)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const txId = tx.transactionId.toString();

    console.log(`[HEDERA] Submitted to ${topicId} | TX: ${txId}`);

    return {
      transactionId: txId,
      hashscanUrl: `https://hashscan.io/testnet/topic/${topicId}`,
    };
  },
};

module.exports = { hederaService };
