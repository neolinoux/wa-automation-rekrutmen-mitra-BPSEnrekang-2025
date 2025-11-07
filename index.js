import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";
import { loadKnowledgeBase, getAnswerFromKnowledgeBase } from "./utils/vector.js";

dotenv.config();

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  console.log("📱 Scan QR ini untuk login WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ WhatsApp AI bot siap!");
  await loadKnowledgeBase();
});

client.on("message", async (message) => {
  const text = message.body.trim();

  // Hanya tanggapi pesan dengan "!bertanya"
  if (text.toLowerCase().startsWith("!bertanya")) {
    const question = text.replace("!bertanya", "").trim();
    if (!question) {
      return message.reply("Gunakan format: `!bertanya <pertanyaan>`");
    }

    message.reply("⏳ Tunggu sebentar, sedang memproses pertanyaan kamu...");
    const answer = await getAnswerFromKnowledgeBase(question);
    message.reply(answer);
  }
});

client.initialize();
