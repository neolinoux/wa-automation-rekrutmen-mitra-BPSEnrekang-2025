import fs from "fs";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RetrievalQAChain } from "langchain/chains";

let vectorStore = null;

/**
 * Muat knowledge base dari file teks lokal.
 * Format file: setiap topik dipisahkan dengan 1–2 baris kosong.
 */
export async function loadKnowledgeBase() {
  const path = "./data/knowledge.txt";

  if (!fs.existsSync(path)) {
    console.error("❌ File knowledge.txt tidak ditemukan di folder data/");
    process.exit(1);
  }

  const content = fs.readFileSync(path, "utf-8").trim();
  if (!content) {
    console.error("❌ File knowledge.txt kosong.");
    process.exit(1);
  }

  const docs = content.split(/\n{2,}/g).map((t) => t.trim());
  const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  vectorStore = await MemoryVectorStore.fromTexts(docs, docs.map(() => ({})), embeddings);

  console.log(`📚 Knowledge base dimuat (${docs.length} entri).`);
}

/**
 * Dapatkan jawaban dari knowledge base.
 * ADIMAS hanya menjawab jika relevan dengan konteks rekrutmen mitra BPS Enrekang.
 */
export async function getAnswerFromKnowledgeBase(question) {
  try {
    if (!vectorStore) await loadKnowledgeBase();

    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const retriever = vectorStore.asRetriever({ k: 3 });

    // Deteksi dini apakah pertanyaan di luar konteks rekrutmen BPS Enrekang
    const lowerQuestion = question.toLowerCase();
    const relatedKeywords = [
      "mitra",
      "rekrut",
      "bps",
      "pendaftaran",
      "enrekang",
      "petugas",
      "pengumuman",
      "seleksi",
      "berkas",
      "dokumen",
      "syarat",
      "jadwal",
    ];

    const isRelevant = relatedKeywords.some((word) => lowerQuestion.includes(word));

    // ❌ Jika pertanyaan sama sekali tidak relevan
    if (!isRelevant) {
      return "Sistem ini hanya melayani pertanyaan seputar rekrutmen mitra BPS Kabupaten Enrekang tahun 2026. Untuk pertanyaan lain, silakan hubungi admin BPS Kabupaten Enrekang. 🙏";
    }

    // ✅ Kalau masih relevan, lanjutkan dengan chain LangChain
    const chain = RetrievalQAChain.fromLLM(llm, retriever, {
      promptTemplate: `
Anda adalah ADIMAS, asisten virtual resmi Badan Pusat Statistik (BPS) Kabupaten Enrekang.

Tugas Anda adalah:
- Menjawab pertanyaan hanya jika berkaitan dengan rekrutmen mitra BPS Kabupaten Enrekang tahun 2026.
- Semua jawaban harus berdasarkan knowledge base di bawah ini.
- Jika informasi tidak ditemukan dalam knowledge base, jangan mencoba menebak.
- Dalam kasus seperti itu, jawab persis dengan:
  "Pertanyaan tersebut akan diteruskan kepada admin BPS Kabupaten Enrekang. Mohon tunggu balasan selanjutnya. 🙏"

Gunakan bahasa sopan, profesional, dan singkat.

---
📚 Knowledge Base:
{context}

❓ Pertanyaan pengguna:
{question}

💬 Jawaban ADIMAS:
      `,
    });

    const response = await chain.call({ query: question });
    let answer = response.text?.trim();
    const lower = (answer || "").toLowerCase();

    // 🔍 Fallback jika model tetap menghasilkan jawaban tidak relevan
    if (
      !answer ||
      lower.includes("tidak tahu") ||
      lower.includes("tidak ditemukan") ||
      lower.includes("tidak ada informasi") ||
      lower.includes("maaf") ||
      lower.length < 20
    ) {
      answer =
        "Pertanyaan tersebut akan diteruskan kepada admin BPS Kabupaten Enrekang. Mohon tunggu balasan selanjutnya. 🙏";
    }

    return answer;
  } catch (err) {
    console.error("❌ Error saat memproses knowledge base:", err.message);
    return "Terjadi kesalahan saat mengakses knowledge base. Admin akan segera membalas pesan kamu.";
  }
}
