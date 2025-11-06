import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";
import { loadKnowledgeBase, getAnswerFromKnowledgeBase } from "./utils/vector.js";

dotenv.config();
const app = express();
app.use(bodyParser.json());

// ✅ Load knowledge base sekali saat server start
(async () => {
  const text = fs.readFileSync("./data/knowledge.txt", "utf-8");
  const chunks = text.split(/\n\n+/);
  await loadKnowledgeBase(chunks);
})();

// ✅ Webhook verification untuk Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ Handler pesan masuk dari WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const changes = req.body.entry?.[0]?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || "";

    console.log(`📩 Pesan dari ${from}: ${text}`);

    // 🔸 Cek apakah pesan mengandung trigger "!bertanya"
    if (!text.toLowerCase().includes("!bertanya")) {
      console.log("⏩ Pesan tidak mengandung '!bertanya', diabaikan.");
      return res.sendStatus(200); // Tidak kirim balasan
    }

    // 🔹 Bersihkan teks dari "!bertanya" untuk dikirim ke AI
    const question = text.replace(/!bertanya/gi, "").trim();
    if (question.length === 0) {
      await sendWhatsAppMessage(from, "Silakan tulis pertanyaan setelah '!bertanya'.");
      return res.sendStatus(200);
    }

    // 🔹 Panggil AI dengan knowledge base
    const reply = await getAnswerFromKnowledgeBase(question);

    // 🔹 Kirim jawaban balik ke WhatsApp
    await sendWhatsAppMessage(from, reply);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// ✅ Fungsi helper untuk kirim pesan ke WhatsApp
async function sendWhatsAppMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
});
