import express from "express";
import cors from "cors";
import fetch from "node-fetch";

import { getUser, updateUser } from "./userService.js";
import { runAI } from "./aiService.js";
import { checkLimit, ipRateLimitMiddleware, recordFailedAttempt, clearFailedAttempts } from "./rateLimiter.js";
import { verifyUser } from "./auth.js";
import { log, logError } from "./utils/logger.js";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// ── helpers ──────────────────────────────────────────────────────────────────

// Basic jailbreak / prompt-injection guard
const JAILBREAK_PATTERNS = [
  /ignore (all |previous |prior )?instructions/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /act as (if )?/i,
  /do anything now/i,
  /DAN/,
];

function isSafeMessage(message) {
  return !JAILBREAK_PATTERNS.some(re => re.test(message));
}

// ── routes ────────────────────────────────────────────────────────────────────

// Health
app.get("/", (req, res) => {
  res.send("🚀 ONE AI LIVE");
});

// AI endpoint
app.post("/ai", ipRateLimitMiddleware, verifyUser, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId; // from verified Firebase token — never from body

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }

    // User-based rate limit
    if (!checkLimit(userId)) {
      log({ userId, action: "rate_limit_user" });
      return res.status(429).json({ error: "Too many requests. Slow down." });
    }

    // Sanitise + safety-check message
    const clean = message.slice(0, 500);
    if (!isSafeMessage(clean)) {
      recordFailedAttempt(userId);
      log({ userId, action: "jailbreak_attempt" });
      return res.status(400).json({ error: "Invalid input" });
    }

    const user = await getUser(userId);
    clearFailedAttempts(userId);

    // Free tier limit
    if (!user.pro && user.usage >= 5) {
      return res.json({
        reply: "🚀 Upgrade to PRO for unlimited access."
      });
    }

    const updatedHistory = [...user.history, clean];

    await updateUser(userId, {
      usage: user.usage + 1,
      history: updatedHistory,
      lastActive: new Date(),
      goal: user.goal || clean
    });

    const systemPrompt = `
You are ONE AI.

Goal: ${user.goal || clean}

Give actionable ways to make money fast in South Africa.
`;

    const reply = await runAI(clean, systemPrompt);

    log({ userId, action: "ai_request", status: "success" });

    res.json({ reply });

  } catch (err) {
    logError({ action: "ai_request", status: "error", error: err.message });
    res.status(500).json({ error: "Server error" });
  }
});

// Payment upgrade — server-side Paystack verification
app.post("/verify-payment", ipRateLimitMiddleware, verifyUser, async (req, res) => {
  const { reference } = req.body;
  const userId = req.userId; // from verified Firebase token — never from body

  if (!reference || typeof reference !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  if (!checkLimit(userId)) {
    log({ userId, action: "rate_limit_user", route: "verify-payment" });
    return res.status(429).json({ error: "Too many requests. Slow down." });
  }

  log({ userId, action: "payment_attempt", status: "initiated", reference });

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } }
    );

    const data = await paystackRes.json();

    if (!data.status || data.data?.status !== "success") {
      log({ userId, action: "payment_attempt", status: "failed", reference });
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const { amount, currency, metadata, customer } = data.data;

    // Validate that the payment was made for this authenticated user
    if (!metadata?.userId || metadata.userId !== userId) {
      logError({ userId, action: "payment_attempt", status: "fraud_attempt", reference, claimedUserId: metadata?.userId });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Validate expected amount and currency (configure via env vars)
    const expectedAmount = parseInt(process.env.PRO_PRICE_KOBO || "0", 10);
    if (expectedAmount === 0) {
      logError({ userId, action: "payment_attempt", status: "config_error", reference });
      return res.status(500).json({ error: "Server configuration error" });
    }
    const expectedCurrency = process.env.PRO_CURRENCY || "ZAR";

    if (amount !== expectedAmount) {
      logError({ userId, action: "payment_attempt", status: "amount_mismatch", reference, amount, expectedAmount });
      return res.status(400).json({ error: "Payment amount mismatch" });
    }

    if (currency !== expectedCurrency) {
      logError({ userId, action: "payment_attempt", status: "currency_mismatch", reference, currency, expectedCurrency });
      return res.status(400).json({ error: "Payment currency mismatch" });
    }

    await updateUser(userId, { pro: true });

    log({ userId, action: "payment_attempt", status: "success", reference, amount, currency, email: customer?.email });

    res.json({ status: "PRO activated" });

  } catch (err) {
    logError({ userId, action: "payment_attempt", status: "error", error: err.message });
    res.status(500).json({ error: "Server error" });
  }
});

// Stats
app.get("/stats", async (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log("Server running:", PORT);
});
