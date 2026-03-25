import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.get("/", (req, res) => {
  res.send("ONE AI backend running 🚀");
});

app.post("/ai", async (req, res) => {
  try {
    const { message, mode } = req.body;

    let systemPrompt = "";

    if (mode === "money") {
      systemPrompt = `
Give 3 ways to make money TODAY in South Africa.
Include steps and a WhatsApp message.
`;
    } else if (mode === "task") {
      systemPrompt = `
Complete the task fully and return ready-to-copy result.
`;
    } else {
      systemPrompt = `
Act as a smart assistant: translate, summarize, explain.
`;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "Error";

    res.json({ reply });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
