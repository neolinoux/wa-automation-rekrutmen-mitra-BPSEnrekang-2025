import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { Chroma } from "langchain/vectorstores/chroma";
import { RetrievalQAChain } from "langchain/chains";

let vectorStore;

export async function loadKnowledgeBase(docs) {
  const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  vectorStore = await Chroma.fromTexts(docs, docs.map(() => ({})), embeddings);
  console.log("📚 Knowledge base loaded (" + docs.length + " chunks)");
}

export async function getAnswerFromKnowledgeBase(query) {
  if (!vectorStore) return "Knowledge base belum dimuat.";

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    searchKwargs: { score_threshold: 0.7 },
  });

  const chain = RetrievalQAChain.fromLLM(llm, retriever, {
    promptTemplate: `
Anda adalah asisten yang hanya boleh menjawab berdasarkan konteks berikut.
Jika pertanyaan tidak dapat dijawab dari konteks, jawab:
"Tidak ada informasi tersebut dalam knowledge base saya."

Konteks:
{context}

Pertanyaan:
{question}

Jawaban:
`,
  });

  const response = await chain.call({ query });
  return response.text || "Tidak ada informasi tersebut dalam knowledge base saya.";
}
