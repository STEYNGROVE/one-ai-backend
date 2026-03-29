import express from "express";
import cors from "cors";

import { getUser, updateUser } from "./userService.js";
import { runAI } from "./aiService.js";
import { checkLimit } from "./rateLimiter.js";
import { log } from "./utils/logger.js";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Health
app.get("/", (req, res) => {
  res.send("🚀 ONE AI LIVE");
});

// AI endpoint
app.post("/ai", async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!userId || !message) {
      return res.json({ reply: "Missing data" });
    }

    // Rate limit
    if (!checkLimit(userId)) {
      return res.json({ reply: "Too many requests. Slow down." });
    }

    const user = await getUser(userId);

    // Free limit
    if (!user.pro && user.usage >= 5) {
      return res.json({
        reply: "🚀 Upgrade to PRO for unlimited access."
      });
    }

    const updatedHistory = [...user.history, message];

    await updateUser(userId, {
      usage: user.usage + 1,
      history: updatedHistory,
      lastActive: new Date(),
      goal: user.goal || message
    });

    const systemPrompt = `
You are ONE AI.

Goal: ${user.goal || message}

Give actionable ways to make money fast in South Africa.
`;

    const reply = await runAI(message, systemPrompt);

    log({ userId, message });

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Server error" });
  }
});

// Payment upgrade
app.post("/verify-payment", async (req, res) => {
  const { userId } = req.body;

  await updateUser(userId, { pro: true });

  res.json({ status: "PRO activated" });
});

// Stats
app.get("/stats", async (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log("Server running:", PORT);
});
