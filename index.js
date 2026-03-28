import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// 🧠 Simple memory (MVP)
let users = {};

// 🔍 Health check
app.get("/", (req, res) => {
  res.send("🚀 ONE AI backend running");
});

// 🚀 AI endpoint
app.post("/ai", async (req, res) => {
  try {
    const { message, mode, userId } = req.body;

    if (!userId) {
      return res.json({ reply: "Missing userId" });
    }

    // Track users
    users[userId] = users[userId] || { count: 0, pro: false };

    // Free limit
    if (!users[userId].pro && users[userId].count >= 5) {
      return res.json({
        reply: "🚀 Free limit reached. Upgrade to PRO."
      });
    }

    users[userId].count++;

    let systemPrompt = "";

    if (mode === "money") {
      systemPrompt = `
Give 3 REAL ways to make money TODAY in South Africa.

Include:
- Step-by-step
- WhatsApp message script
- Estimated earnings
`;
    } else if (mode === "task") {
      systemPrompt = `
Complete the task fully and return ready-to-copy result.
`;
    } else {
      systemPrompt = `
Translate, summarize, or explain clearly.
`;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    // Debug errors
    if (data.error) {
      return res.json({ reply: "Groq Error: " + data.error.message });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No response from AI";

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Server error" });
  }
});

// 💳 Fake payment verification (MVP)
app.post("/verify-payment", (req, res) => {
  const { userId } = req.body;

  if (users[userId]) {
    users[userId].pro = true;
  }

  res.json({ status: "PRO activated" });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
