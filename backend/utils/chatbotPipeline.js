import { analyzeQueryNLP } from "./nlp.js";
import { processDocumentContent } from "./documentProcessor.js";
import { retrieveRAGContext } from "./rag.js";
import { askOllama } from "./ollama.js";

/**
 * Unified NyaySetu Chatbot Pipeline:
 * User Query / Uploaded Legal Document
 *              ↓
 *             NLP (Intent, Entities, Cleaning)
 *              ↓
 *      Document Processing (Text extraction & Chunking)
 *              ↓
 *             RAG (Retrieve Doc context + Legal KB)
 *              ↓
 *          Qwen LLM (Grounded response generation)
 *              ↓
 *    Existing Chatbot Response
 */
export const runChatbotPipeline = async ({ message = "", documentText = "", history = [] }) => {
  // Step 1: NLP Analysis
  const nlpResult = analyzeQueryNLP(message || "Analyze this document.");

  // Step 2: Document Processing
  let docResult = null;
  if (documentText && documentText.trim()) {
    docResult = processDocumentContent(documentText);
  }

  // Step 3: RAG Retrieval
  const ragContext = retrieveRAGContext(nlpResult, docResult);

  // Step 4: Construct Prompt for Qwen LLM
  let promptContext = `### USER QUERY ANALYSIS (NLP)
- User Query: "${nlpResult.cleanQuery}"
- Detected Intent: ${nlpResult.intent}
- Language: ${nlpResult.language}
- Extracted Keywords/Entities: ${JSON.stringify(nlpResult.entities)}

`;

  if (docResult && docResult.chunks.length > 0) {
    promptContext += `### UPLOADED LEGAL DOCUMENT CONTEXT
Document Overview:
- Extracted Parties: ${docResult.metadata.parties.join(", ") || "N/A"}
- Financial Terms/Amounts: ${docResult.metadata.amounts.join(", ") || "N/A"}
- Duration/Notice: ${docResult.metadata.durations.join(", ") || "N/A"}

Relevant Document Chunks:
${ragContext.docChunks.map(c => `[${c.id}]:\n${c.content}`).join("\n\n")}

`;
  }

  if (ragContext.legalSections.length > 0) {
    promptContext += `### RETRIEVED LEGAL KNOWLEDGE BASE (RAG)
${ragContext.legalSections.map(s => `- [Reference: ${s.reference}]\n  Topic: ${s.categoryTopic}\n  Law Details: ${s.summary}`).join("\n\n")}

`;
  }

  promptContext += `### RESPONSE GENERATION RULES
- Respond in the user's language (${nlpResult.language}). If Hinglish, respond in Hinglish. If Hindi, respond in Hindi. If English, respond in English.
- Strictly address the user query:
  * If user asks "Is document ke according mujhe kya karna chahiye?" -> Give clear actionable steps grounded in the uploaded document and legal rights.
  * If user asks "Is document ka summary do" -> Give a clear, structured summary (parties, core obligations, key terms, risk areas).
  * If user asks "Isme relevant legal section kya hai?" -> Explicitly cite and explain the relevant legal sections (e.g. IPC/BNS, Contract Act, NI Act, etc.).
- Include legal and document source references in brackets like [Ref: Document Clause] or [Ref: Section 73, Indian Contract Act] where applicable.
- Produce ONLY ONE final, unified grounded response for the chatbot UI. Do NOT output internal pipeline labels or raw debug JSON.
`;

  // Step 5: Generate answer using Qwen LLM
  const aiReply = await askOllama(promptContext, history);

  return aiReply;
};
