import os
import re
import json
import logging
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("NyaySetuChatbot")

app = Flask(__name__)
CORS(app)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL", "qwen2.5:3b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
PORT = int(os.getenv("PYTHON_PORT", os.getenv("PORT_CHATBOT", 5001)))


# ==============================================================================
# 1. TEXT EXTRACTION UTILITIES (PDF, DOCX, TXT)
# ==============================================================================

def extract_text_from_file_bytes(file_bytes: bytes, filename: str) -> str:
    """
    Extract text content from file bytes based on file extension.
    Supports PDF, DOCX, TXT.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text.strip())
            return "\n\n".join(text_parts).strip()
        except Exception as e:
            logger.warning(f"PyPDF extraction error: {e}")
            return ""

    elif ext in [".docx", ".doc"]:
        try:
            import io
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs).strip()
        except Exception as e:
            logger.warning(f"python-docx extraction error: {e}")
            return ""

    else:
        try:
            return file_bytes.decode("utf-8", errors="replace").strip()
        except Exception as e:
            logger.warning(f"Plain text decoding error: {e}")
            return ""


def extract_text_from_filepath(file_path: str) -> str:
    """
    Extract text content from local file path.
    """
    if not os.path.exists(file_path):
        return ""
    with open(file_path, "rb") as f:
        return extract_text_from_file_bytes(f.read(), os.path.basename(file_path))


# ==============================================================================
# 2. REAL SEMANTIC EMBEDDINGS ENGINE (SentenceTransformer / Vectorizer)
# ==============================================================================

class SemanticEmbeddingEngine:
    """
    Real Semantic Embedding Provider:
    1. Attempts to use local SentenceTransformer ('all-MiniLM-L6-v2')
    2. Falls back to Ollama Embeddings API (/api/embeddings or /api/embed)
    3. Falls back to dense Sklearn TF-IDF / Subword Vectorizer
    Guarantees true float32 normalized dense vector representations for vector search.
    """

    def __init__(self, model_name=EMBEDDING_MODEL):
        self.model_name = model_name
        self.st_model = None
        self._init_model()

    def _init_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer model: {self.model_name}...")
            self.st_model = SentenceTransformer(self.model_name)
            logger.info("SentenceTransformer model loaded successfully.")
        except Exception as e:
            logger.info(f"SentenceTransformers not loaded locally ({e}). Will use Ollama Embeddings or Dense Vectorizer fallback.")

    def embed_texts(self, texts: list) -> np.ndarray:
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)

        # Strategy A: SentenceTransformer
        if self.st_model is not None:
            try:
                embeddings = self.st_model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
                return np.asarray(embeddings, dtype=np.float32)
            except Exception as e:
                logger.warning(f"SentenceTransformer encoding error: {e}")

        # Strategy B: Ollama Embeddings API
        try:
            ollama_embeddings = []
            for text in texts:
                res = requests.post(
                    f"{OLLAMA_URL}/api/embeddings",
                    json={"model": os.getenv("OLLAMA_EMBED_MODEL", MODEL_NAME), "prompt": text[:1500]},
                    timeout=10
                )
                if res.status_code == 200:
                    vec = res.json().get("embedding", [])
                    if vec:
                        v_np = np.array(vec, dtype=np.float32)
                        norm = np.linalg.norm(v_np)
                        if norm > 0:
                            v_np = v_np / norm
                        ollama_embeddings.append(v_np)
            if len(ollama_embeddings) == len(texts):
                return np.vstack(ollama_embeddings)
        except Exception as e:
            logger.debug(f"Ollama embedding endpoint unavailable: {e}")

        # Strategy C: Dense TF-IDF / Subword N-Gram Vectorizer
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            vectorizer = TfidfVectorizer(ngram_range=(1, 3), max_features=512, sublinear_tf=True)
            tfidf_mat = vectorizer.fit_transform(texts).toarray().astype(np.float32)
            norms = np.linalg.norm(tfidf_mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return tfidf_mat / norms
        except Exception:
            # Pure numpy dense vector representation
            vecs = []
            vocab = {}
            for text in texts:
                words = re.findall(r"\b\w{2,}\b", text.lower())
                for w in words:
                    if w not in vocab and len(vocab) < 512:
                        vocab[w] = len(vocab)
            dim = max(len(vocab), 1)
            for text in texts:
                vec = np.zeros(dim, dtype=np.float32)
                words = re.findall(r"\b\w{2,}\b", text.lower())
                for w in words:
                    if w in vocab:
                        vec[vocab[w]] += 1.0
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                vecs.append(vec)
            return np.vstack(vecs)

    def embed_query(self, query: str) -> np.ndarray:
        return self.embed_texts([query])[0]


# Global Embedding Engine Instance
embedding_engine = SemanticEmbeddingEngine()


# ==============================================================================
# 3. MODEL-BASED NLP PROCESSOR (Python)
# ==============================================================================

class ModelBasedNLPProcessor:
    """
    Model-based NLP Processor:
    - Multi-lingual Language Identification (English, Hindi, Hinglish)
    - Semantic Intent Classification
    - Legal Entity & Statutory Citation Extraction
    """

    CANONICAL_INTENTS = {
        "summary": "Summarize the legal document, explain the main points, provide an overview of clauses and agreement terms.",
        "action_required": "What should I do next? Actionable legal steps, legal notice, dispute remedy, procedure to follow.",
        "legal_sections": "What are the relevant legal sections, IPC, BNS, CrPC, BNSS, Indian Contract Act, NI Act, or law provisions?",
        "clause_analysis": "Analyze specific contract clauses, rent, notice period, security deposit, termination conditions, or penalty terms.",
        "consumer_grievance": "File a consumer dispute, defective goods or service deficiency, claim refund, replacement, or compensation.",
        "criminal_remedy": "File an FIR or criminal complaint for fraud, cheating, scam, assault, cyber crime, or police harassment.",
        "matrimonial_dispute": "Family dispute, maintenance under 125 CrPC or 144 BNSS, domestic violence, or mutual divorce procedure.",
        "employment_wages": "Unpaid salary, wrongful termination, labor dispute, gratuity, or employment contract violation.",
        "cheque_bounce": "Cheque bounce procedure, Section 138 NI Act legal demand notice, and criminal court filing.",
        "general_legal_query": "General legal advice and consultation regarding rights and legal remedies under Indian law."
    }

    def __init__(self, embed_engine: SemanticEmbeddingEngine):
        self.embed_engine = embed_engine
        self.intent_keys = list(self.CANONICAL_INTENTS.keys())
        self.intent_descriptions = list(self.CANONICAL_INTENTS.values())
        self.intent_embeddings = self.embed_engine.embed_texts(self.intent_descriptions)

    def detect_language(self, text: str) -> str:
        if re.search(r"[\u0900-\u097F]", text):
            return "Hindi"
        
        hinglish_words = {"kya", "hai", "kaise", "chahiye", "karne", "mujhe", "isme", "ke", "do", "batao", "dhara", "ka", "ki", "ko", "mera", "paise", "makaan", "bataiye", "samjhao"}
        words = set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))
        if len(words & hinglish_words) >= 2:
            return "Hinglish"
        return "English"

    def classify_intent_semantic(self, query: str) -> str:
        q_emb = self.embed_engine.embed_query(query)
        if len(q_emb) == self.intent_embeddings.shape[1]:
            similarities = np.dot(self.intent_embeddings, q_emb)
            best_idx = int(np.argmax(similarities))
            return self.intent_keys[best_idx]
        return "general_legal_query"

    def extract_entities(self, text: str) -> dict:
        dates = re.findall(r"\b(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d+\s+(?:months?|years?|days?))\b", text, flags=re.IGNORECASE)
        amounts = re.findall(r"\b(?:rs\.?|₹|inr|rupees?)\s*[\d,]+(?:\.\d+)?|\b[\d,]+\s*(?:rupees?|lakhs?|crores?)\b", text, flags=re.IGNORECASE)
        
        statute_citations = re.findall(
            r"\b(?:section|sec\.?|dhara)\s*\d+[a-zA-Z]?(?:\s*(?:of\s+the\s+)?(?:ipc|bns|crpc|bnss|ni\s*act|contract\s*act|it\s*act|consumer\s*protection\s*act|transfer\s*of\s*property\s*act))?",
            text,
            flags=re.IGNORECASE
        )

        return {
            "dates": list(set(dates)),
            "amounts": list(set(amounts)),
            "statute_citations": list(set(statute_citations))
        }

    def process(self, query: str) -> dict:
        clean_query = re.sub(r"\s+", " ", (query or "").strip())
        language = self.detect_language(clean_query)
        intent = self.classify_intent_semantic(clean_query)
        entities = self.extract_entities(clean_query)

        return {
            "clean_query": clean_query,
            "language": language,
            "intent": intent,
            "entities": entities
        }


# Global NLP Processor Instance
nlp_processor = ModelBasedNLPProcessor(embedding_engine)


# ==============================================================================
# 4. STATUTORY LEGAL KNOWLEDGE BASE & REAL RAG RETRIEVER (Python)
# ==============================================================================

LEGAL_KNOWLEDGE_BASE = [
    {
        "topic": "Rent, Tenancy & Property Disputes",
        "title": "Model Tenancy Act & Eviction Safeguards",
        "reference": "Model Tenancy Act, 2021 / State Rent Control Act",
        "content": "Standard 11-month lease agreements govern tenancy rights. Landlords cannot disconnect essential utilities (water, power) or forcefully evict tenants without formal legal notice under Section 106 Transfer of Property Act. Security deposits must be refunded upon peaceful property handover minus legitimate verified damage."
    },
    {
        "topic": "Rent & Lease Notice Periods",
        "title": "Termination of Residential / Commercial Leases",
        "reference": "Section 106, Transfer of Property Act, 1882",
        "content": "In absence of a contrary written agreement, residential lease termination requires minimum 15 days written notice expiring with the end of a month of tenancy. Commercial/manufacturing leases require 6 months notice."
    },
    {
        "topic": "Cheating & Criminal Fraud (BNS & IPC)",
        "title": "Cheating & Dishonest Inducement of Property",
        "reference": "Section 318 BNS / Section 420 IPC",
        "content": "Whoever cheats and dishonestly induces delivery of any property or valuable security is punishable with imprisonment up to 7 years and fine. Applicable to financial deception, property fraud, and dishonest breach of trust."
    },
    {
        "topic": "Document Forgery & Counterfeiting",
        "title": "Forgery for Purpose of Cheating",
        "reference": "Section 336 BNS / Section 468 IPC",
        "content": "Creating false documents, signatures, electronic records, or forged agreements for cheating carries imprisonment up to 7 years and mandatory fine."
    },
    {
        "topic": "Breach of Contract & Liquidated Damages",
        "title": "Compensation for Loss Caused by Breach of Contract",
        "reference": "Section 73, Indian Contract Act, 1872",
        "content": "When a contract is broken, the aggrieved party is legally entitled to compensation for direct financial loss or damage naturally arising from such breach. Remote or indirect losses are not compensable."
    },
    {
        "topic": "Contractual Penalties & Lock-in Clauses",
        "title": "Reasonable Compensation Where Penalty Stipulated",
        "reference": "Section 74, Indian Contract Act, 1872",
        "content": "If a contract specifies a penalty amount for breach or lock-in default, the aggrieved party is entitled only to reasonable compensation not exceeding the stipulated penalty sum."
    },
    {
        "topic": "Consumer Protection & Deficiency in Service",
        "title": "Consumer Redressal Commissions & Product Liability",
        "reference": "Consumer Protection Act, 2019 (Sections 2(10), 2(11), 35)",
        "content": "Consumers can file complaints before the District Consumer Disputes Redressal Commission (claims up to Rs 50 Lakhs) online via e-daakhil for defective goods, deficiency of service, or misleading advertisements to claim full refund, replacement, and litigation costs."
    },
    {
        "topic": "Employment & Wage Withholding",
        "title": "Recovery of Unpaid Wages & Notice Period Compensation",
        "reference": "Payment of Wages Act, 1936 & Industrial Disputes Act, 1947",
        "content": "Employers cannot unlawfully withhold earned salary, bonuses, or full-and-final settlement. Employees terminated without mandatory contractual notice can issue a formal legal demand notice and file claims with the Labour Commissioner."
    },
    {
        "topic": "Cheque Bounce & Dishonour",
        "title": "Dishonour of Cheque for Insufficiency of Funds",
        "reference": "Section 138, Negotiable Instruments Act, 1881",
        "content": "Cheque bounce is a criminal offense punishable with up to 2 years imprisonment or twice the cheque amount. Mandatory procedure: 1) Issue statutory demand notice within 30 days of bank memo. 2) Allow 15 days for payment. 3) If unpaid, file criminal complaint before Magistrate within 30 days."
    },
    {
        "topic": "Cyber Crime & Financial Online Fraud",
        "title": "Cheating by Personation & Cyber Fraud Redressal",
        "reference": "Section 66D, Information Technology Act, 2000",
        "content": "Punishes online financial fraud, phishing, OTP scams, and identity theft with imprisonment up to 3 years. Victims should immediately register grievances on National Cyber Crime Helpline 1930 or portal cybercrime.gov.in within the golden hour to freeze fraudulent bank transfers."
    },
    {
        "topic": "Matrimonial Maintenance & Protection",
        "title": "Monthly Maintenance Allowance for Wife, Children and Parents",
        "reference": "Section 144 BNSS / Section 125 CrPC",
        "content": "Enables wives, minor children, or elderly parents who cannot support themselves to claim monthly maintenance allowance from a person having sufficient means who neglects or refuses to maintain them."
    },
    {
        "topic": "Domestic Violence Protection",
        "title": "Protection Orders & Monetary Relief for Women",
        "reference": "Protection of Women from Domestic Violence Act, 2005 (PWDVA)",
        "content": "Provides rapid civil and emergency relief including Protection Orders, Right to Reside in Shared Household, and Monthly Maintenance for aggrieved women experiencing physical, emotional, or economic abuse."
    },
    {
        "topic": "Real Estate & Builder Delay",
        "title": "Delayed Possession & Mandatory Refund with Interest",
        "reference": "Section 18, Real Estate (Regulation and Development) Act, 2016 (RERA)",
        "content": "If a builder fails to deliver apartment possession as per the agreement, homebuyers have the absolute right to withdraw from the project with full refund plus statutory interest, or claim monthly delay compensation."
    }
]


class ModelBasedLegalRAG:
    """
    Model-based Vector RAG Engine:
    - Pre-computes semantic vector embeddings matrix for Legal Statutory KB
    - Ingests, preprocesses, and chunks uploaded documents
    - Computes SentenceTransformer embeddings for document chunks
    - Performs vector similarity search via cosine matrix dot products
    """

    def __init__(self, embed_engine: SemanticEmbeddingEngine, kb: list):
        self.embed_engine = embed_engine
        self.kb = kb
        self.kb_texts = [
            f"{item['topic']}: {item['title']}. {item['reference']}. {item['content']}"
            for item in self.kb
        ]
        logger.info(f"Computing semantic embeddings for {len(self.kb_texts)} legal KB entries...")
        self.kb_embeddings = self.embed_engine.embed_texts(self.kb_texts)

    def retrieve_legal_knowledge(self, query: str, top_k: int = 3) -> list:
        q_emb = self.embed_engine.embed_query(query)
        if len(q_emb) != self.kb_embeddings.shape[1]:
            all_texts = self.kb_texts + [query]
            all_embs = self.embed_engine.embed_texts(all_texts)
            kb_embs = all_embs[:-1]
            q_emb = all_embs[-1]
            similarities = np.dot(kb_embs, q_emb)
        else:
            similarities = np.dot(self.kb_embeddings, q_emb)

        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = []
        for idx in top_indices:
            results.append({
                "score": float(similarities[idx]),
                "topic": self.kb[idx]["topic"],
                "title": self.kb[idx]["title"],
                "reference": self.kb[idx]["reference"],
                "content": self.kb[idx]["content"]
            })
        return results

    def extract_document_metadata(self, raw_text: str) -> dict:
        """
        Extract structured legal metadata from document text.
        """
        parties = re.findall(
            r"(?:between|by and between|party of the first part|party of the second part|lessor|lessee|landlord|tenant|employer|employee|first party|second party)\s*[:\-\s]+([^\n,;]+)",
            raw_text,
            flags=re.IGNORECASE
        )
        amounts = re.findall(r"(?:Rs\.?|₹|INR)\s*[\d,]+(?:\.\d+)?(?:\s*/\-)?", raw_text, flags=re.IGNORECASE)
        durations = re.findall(r"\b\d+\s+(?:months?|years?|days?|weeks?)\b", raw_text, flags=re.IGNORECASE)
        dates = re.findall(r"\b(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b", raw_text, flags=re.IGNORECASE)
        
        # Detect document type
        doc_type = "Legal Agreement / Document"
        lower_text = raw_text.lower()
        if "rent agreement" in lower_text or "lease agreement" in lower_text or "tenancy agreement" in lower_text:
            doc_type = "Rent / Lease Agreement"
        elif "employment agreement" in lower_text or "appointment letter" in lower_text or "job offer" in lower_text:
            doc_type = "Employment Agreement"
        elif "non-disclosure" in lower_text or "nda" in lower_text or "confidentiality agreement" in lower_text:
            doc_type = "Non-Disclosure Agreement (NDA)"
        elif "service agreement" in lower_text or "contract for services" in lower_text:
            doc_type = "Service Contract"
        elif "partnership deed" in lower_text:
            doc_type = "Partnership Deed"
        elif "sale deed" in lower_text or "agreement to sell" in lower_text:
            doc_type = "Sale Deed / Property Agreement"
        elif "loan agreement" in lower_text or "promissory note" in lower_text:
            doc_type = "Loan Agreement"

        return {
            "document_type": doc_type,
            "parties": list(set([p.strip() for p in parties if len(p.strip()) > 2]))[:6],
            "amounts": list(set(amounts))[:8],
            "durations": list(set(durations))[:6],
            "dates": list(set(dates))[:6]
        }

    def chunk_document_semantically(self, raw_text: str) -> list:
        """
        Split document into semantic clause chunks (with titles / IDs).
        """
        if not raw_text or not raw_text.strip():
            return []

        # Try splitting by numbered clauses or headers first
        clause_blocks = re.split(r"(?=\n\s*(?:(?:Clause|Article|Section|\d+[\.\)]|[A-Z\s]{4,}:)\s+))", raw_text)
        
        chunks = []
        c_idx = 1
        current_chunk = ""

        for block in clause_blocks:
            clean_block = block.strip()
            if not clean_block:
                continue

            if len(current_chunk) + len(clean_block) + 2 > 750:
                if current_chunk.strip():
                    chunks.append({"id": f"Clause/Chunk-{c_idx}", "content": current_chunk.strip()})
                    c_idx += 1
                current_chunk = clean_block
            else:
                current_chunk = f"{current_chunk}\n\n{clean_block}" if current_chunk else clean_block

        if current_chunk.strip():
            chunks.append({"id": f"Clause/Chunk-{c_idx}", "content": current_chunk.strip()})

        if not chunks:
            # Fallback paragraph split
            paras = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
            for p in paras:
                chunks.append({"id": f"Chunk-{c_idx}", "content": p})
                c_idx += 1

        return chunks

    def chunk_and_retrieve_document(self, raw_text: str, query: str, top_k: int = 3) -> tuple:
        if not raw_text or not raw_text.strip():
            return [], {}

        metadata = self.extract_document_metadata(raw_text)
        chunks = self.chunk_document_semantically(raw_text)

        if not chunks:
            chunks = [{"id": "DocChunk-1", "content": raw_text[:1500]}]

        # If few chunks, return all
        if len(chunks) <= top_k:
            return chunks, metadata

        # Vector retrieval across document chunks using SentenceTransformer
        chunk_texts = [c["content"] for c in chunks]
        all_texts = chunk_texts + [query]
        all_embs = self.embed_engine.embed_texts(all_texts)
        chunk_embs = all_embs[:-1]
        q_emb = all_embs[-1]

        similarities = np.dot(chunk_embs, q_emb)
        top_indices = np.argsort(similarities)[::-1][:top_k]

        retrieved_chunks = [chunks[idx] for idx in top_indices]
        return retrieved_chunks, metadata


# Global RAG Retriever Instance
rag_retriever = ModelBasedLegalRAG(embedding_engine, LEGAL_KNOWLEDGE_BASE)


# ==============================================================================
# 5. QWEN LLM SERVICE & PROMPT PIPELINE (Python)
# ==============================================================================

class QwenLLMService:
    """
    Qwen LLM Integration:
    - Constructs context-grounded prompt with NLP metadata, vector-retrieved legal statutes, and document excerpts.
    - Sends request to Ollama /api/chat or /api/generate.
    - Fallback grounded synthesizer if Ollama is unavailable.
    """

    SYSTEM_PROMPT = """You are NyaySetu AI, an authoritative, empathetic Indian legal information assistant.

CORE RULES:
1. Language Consistency: Reply in the EXACT SAME language as the user's query (English, Hindi, or Hinglish).
2. Grounded Analysis: If document excerpts are provided, strictly prioritize answering from the uploaded document clauses, terms, parties, and financial details.
3. Statutory Grounding: Explicitly cite relevant statutory provisions with references like [Ref: Section 106, TP Act], [Ref: Section 138, NI Act], [Ref: Section 73, Indian Contract Act], or [Ref: Section 318 BNS].
4. Structure your response clearly:
   - **Document Summary / Assessment**: Direct answer to user's question with specific references to document terms.
   - **Key Clauses & Provisions**: Breakdown of relevant clauses, obligations, notice periods, or penalties.
   - **Applicable Legal Provisions**: Statutory Indian law backing the situation.
   - **Actionable Steps**: Concrete steps (Legal notice, dispute resolution, negotiation, police complaint / forum).
   - **Important Advice / Caution**: Disclaimer to consult a licensed advocate for court matters.
5. Output ONLY the clean formatted markdown response. Never include internal debug tags or JSON schemas.
"""

    @classmethod
    def generate_response(cls, nlp_data: dict, retrieved_kb: list, retrieved_doc_chunks: list, doc_meta: dict, history: list = None) -> str:
        prompt_parts = []
        prompt_parts.append("### QUERY & NLP ANALYSIS")
        prompt_parts.append(f"- Query: \"{nlp_data['clean_query']}\"")
        prompt_parts.append(f"- Detected Intent: {nlp_data['intent']}")
        prompt_parts.append(f"- Language: {nlp_data['language']}")
        prompt_parts.append("")

        if retrieved_doc_chunks:
            prompt_parts.append("### UPLOADED LEGAL DOCUMENT CONTEXT (VECTOR RAG RETRIEVED)")
            if doc_meta:
                if doc_meta.get("document_type"):
                    prompt_parts.append(f"- Identified Document Type: {doc_meta['document_type']}")
                if doc_meta.get("parties"):
                    prompt_parts.append(f"- Identified Parties: {', '.join(doc_meta['parties'])}")
                if doc_meta.get("amounts"):
                    prompt_parts.append(f"- Financial Figures: {', '.join(doc_meta['amounts'])}")
                if doc_meta.get("durations"):
                    prompt_parts.append(f"- Notice Periods / Durations: {', '.join(doc_meta['durations'])}")
                if doc_meta.get("dates"):
                    prompt_parts.append(f"- Relevant Dates: {', '.join(doc_meta['dates'])}")
            prompt_parts.append("")
            prompt_parts.append("#### RELEVANT DOCUMENT EXCERPTS:")
            for chunk in retrieved_doc_chunks:
                prompt_parts.append(f"[{chunk['id']}]:\n{chunk['content']}\n")
            prompt_parts.append("")

        if retrieved_kb:
            prompt_parts.append("### STATUTORY LEGAL PROVISIONS (KNOWLEDGE BASE RAG)")
            for sec in retrieved_kb:
                prompt_parts.append(f"- [Reference: {sec['reference']}]\n  Title: {sec['title']}\n  Summary: {sec['content']}\n")
            prompt_parts.append("")

        prompt_parts.append("### INSTRUCTION")
        prompt_parts.append(f"Answer the user query in {nlp_data['language']} using the above document and statutory context.")
        prompt_parts.append(f"User Query: {nlp_data['clean_query']}")

        user_content = "\n".join(prompt_parts)

        # Build chat messages payload
        messages = [{"role": "system", "content": cls.SYSTEM_PROMPT}]
        if history:
            valid_history = [
                {"role": m.get("role", "user"), "content": m.get("content", "")}
                for m in history[-6:]
                if m.get("content") and not m.get("content", "").startswith("📄 **")
            ]
            messages.extend(valid_history)
        messages.append({"role": "user", "content": user_content})

        # 1. Try Ollama /api/chat
        try:
            logger.info(f"Calling Ollama ({MODEL_NAME}) at {OLLAMA_URL}...")
            res = requests.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": MODEL_NAME,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "num_predict": 1024
                    }
                },
                timeout=60
            )
            if res.status_code == 200:
                content = res.json().get("message", {}).get("content", "")
                if content:
                    return content.strip()
        except Exception as e:
            logger.warning(f"Ollama /api/chat error: {e}. Trying /api/generate fallback...")

        # 2. Try Ollama /api/generate
        try:
            full_prompt = f"{cls.SYSTEM_PROMPT}\n\n{user_content}"
            res = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": MODEL_NAME, "prompt": full_prompt, "stream": False},
                timeout=60
            )
            if res.status_code == 200:
                content = res.json().get("response", "")
                if content:
                    return content.strip()
        except Exception as e:
            logger.error(f"Ollama /api/generate error: {e}")

        # 3. Grounded fallback with Document & Statutory context
        return cls._grounded_fallback(nlp_data, retrieved_doc_chunks, doc_meta, retrieved_kb)

    @classmethod
    def _grounded_fallback(cls, nlp_data: dict, retrieved_doc_chunks: list, doc_meta: dict, retrieved_kb: list) -> str:
        parts = []
        is_hindi = nlp_data.get("language") in ["Hindi", "Hinglish"]

        if is_hindi:
            parts.append("### ⚖️ NyaySetu AI Legal Assessment\n")
            if doc_meta and doc_meta.get("document_type"):
                parts.append(f"**Document Type**: {doc_meta['document_type']}")
            if doc_meta.get("parties"):
                parts.append(f"**Parties**: {', '.join(doc_meta['parties'])}")
            if doc_meta.get("amounts"):
                parts.append(f"**Financial Amounts**: {', '.join(doc_meta['amounts'])}")
            if doc_meta.get("durations"):
                parts.append(f"**Notice / Duration**: {', '.join(doc_meta['durations'])}")
            
            parts.append(f"\n**Query Analysis**: {nlp_data['clean_query']}\n")

            if retrieved_doc_chunks:
                parts.append("**Document Relevant Clauses (RAG Retrieved)**:")
                for c in retrieved_doc_chunks:
                    snippet = c['content'][:250].replace('\n', ' ') + "..."
                    parts.append(f"- **{c['id']}**: {snippet}")
                parts.append("")

            if retrieved_kb:
                parts.append("**Applicable Statutory Provisions (Indian Law)**:")
                for s in retrieved_kb:
                    parts.append(f"- **{s['reference']}** ({s['title']}): {s['content']}")
                parts.append("")

            parts.append("**Recommended Actionable Steps**:\n"
                         "1. Document ke terms aur notice periods ka verification karein.\n"
                         "2. Agar koi dispute ya violation hai toh formal Statutory Legal Notice bhejein.\n"
                         "3. Banking proofs, signed agreements, aur communication records securely maintain karein.\n"
                         "4. Zarurat padne par licensed advocate se consult karein.\n\n"
                         "💡 *Disclaimer: Yeh general legal analysis hai. Court proceedings ke liye advocate se consult karein.*")
        else:
            parts.append("### ⚖️ NyaySetu AI Legal Assessment\n")
            if doc_meta and doc_meta.get("document_type"):
                parts.append(f"**Document Type**: {doc_meta['document_type']}")
            if doc_meta.get("parties"):
                parts.append(f"**Parties Involved**: {', '.join(doc_meta['parties'])}")
            if doc_meta.get("amounts"):
                parts.append(f"**Financial Amounts**: {', '.join(doc_meta['amounts'])}")
            if doc_meta.get("durations"):
                parts.append(f"**Notice / Term Duration**: {', '.join(doc_meta['durations'])}")

            parts.append(f"\n**Query**: {nlp_data['clean_query']}\n")

            if retrieved_doc_chunks:
                parts.append("**Document Excerpts Analyzed (Vector RAG)**:")
                for c in retrieved_doc_chunks:
                    snippet = c['content'][:250].replace('\n', ' ') + "..."
                    parts.append(f"- **{c['id']}**: {snippet}")
                parts.append("")

            if retrieved_kb:
                parts.append("**Applicable Statutory Law (Indian Legal Framework)**:")
                for s in retrieved_kb:
                    parts.append(f"- **{s['reference']}** ({s['title']}): {s['content']}")
                parts.append("")

            parts.append("**Actionable Legal Steps**:\n"
                         "1. Verify key obligations, lock-in conditions, and notice covenants in the agreement.\n"
                         "2. If breach or non-compliance has occurred, issue a formal statutory Legal Demand Notice.\n"
                         "3. Preserve all written correspondence, signed documents, and payment receipts.\n"
                         "4. Consult a verified legal advocate for formal representation.\n\n"
                         "💡 *Disclaimer: NyaySetu provides legal information. For formal legal representation, please consult a licensed advocate.*")

        return "\n".join(parts)


# ==============================================================================
# 6. COMPLETE END-TO-END PIPELINE FUNCTION (Python)
# ==============================================================================

def run_python_ai_pipeline(query: str, document_text: str = "", history: list = None) -> dict:
    """
    End-to-End Pipeline:
    Query -> NLP -> Embeddings -> Vector Retrieval -> RAG Context -> Qwen LLM -> Response
    """
    clean_query = query if (query and query.strip()) else "Summarize and analyze this document according to Indian legal provisions."
    
    # 1. NLP Processing
    nlp_data = nlp_processor.process(clean_query)

    # 2. Document Processing & Vector Retrieval (if document attached)
    retrieved_doc_chunks, doc_meta = rag_retriever.chunk_and_retrieve_document(
        raw_text=document_text,
        query=nlp_data["clean_query"],
        top_k=3
    )

    # 3. Vector Retrieval from Statutory Legal Knowledge Base
    retrieved_kb = rag_retriever.retrieve_legal_knowledge(
        query=nlp_data["clean_query"],
        top_k=3
    )

    # 4. LLM Generation
    ai_reply = QwenLLMService.generate_response(
        nlp_data=nlp_data,
        retrieved_kb=retrieved_kb,
        retrieved_doc_chunks=retrieved_doc_chunks,
        doc_meta=doc_meta,
        history=history or []
    )

    return {
        "success": True,
        "reply": ai_reply,
        "nlp": {
            "intent": nlp_data["intent"],
            "language": nlp_data["language"],
            "entities": nlp_data["entities"]
        },
        "document_metadata": doc_meta,
        "document_chunks_used": len(retrieved_doc_chunks),
        "retrieved_legal_sections": [
            {"reference": s["reference"], "title": s["title"], "score": s.get("score", 1.0)}
            for s in retrieved_kb
        ]
    }


# ==============================================================================
# 7. REST API ROUTES (Preserves API Contract & Extends Functionality)
# ==============================================================================

@app.route("/api/chatbot/chat", methods=["POST"])
@app.route("/api/ai/chat", methods=["POST"])
@app.route("/chat", methods=["POST"])
def chat_endpoint():
    try:
        data = request.get_json() or {}
        message = data.get("message", "")
        document_text = data.get("documentText", "") or data.get("document_text", "")
        history = data.get("history", [])

        if not message.strip() and not document_text.strip():
            return jsonify({
                "success": False,
                "message": "Message or documentText is required."
            }), 400

        result = run_python_ai_pipeline(
            query=message,
            document_text=document_text,
            history=history
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "message": f"Chatbot error: {str(e)}"
        }), 500


@app.route("/api/chatbot/document/upload", methods=["POST"])
@app.route("/api/document/upload", methods=["POST"])
@app.route("/api/document/process", methods=["POST"])
def process_document_endpoint():
    try:
        extracted_text = ""
        filename = ""
        
        # Check if file was uploaded via multipart/form-data
        if "file" in request.files:
            file_obj = request.files["file"]
            filename = file_obj.filename or "uploaded_document"
            file_bytes = file_obj.read()
            extracted_text = extract_text_from_file_bytes(file_bytes, filename)
        elif request.is_json:
            data = request.get_json() or {}
            extracted_text = data.get("documentText", "") or data.get("text", "")
            filename = data.get("filename", "document.txt")
        else:
            extracted_text = request.form.get("documentText", "")
            filename = request.form.get("filename", "document.txt")

        if not extracted_text.strip():
            return jsonify({
                "success": False,
                "message": "No readable text could be extracted from the document."
            }), 400

        user_query = request.form.get("message") or (request.json.get("message") if request.is_json else None) or "Provide a comprehensive legal analysis and summary of this document."

        pipeline_res = run_python_ai_pipeline(
            query=user_query,
            document_text=extracted_text,
            history=[]
        )

        chunks = rag_retriever.chunk_document_semantically(extracted_text)
        metadata = rag_retriever.extract_document_metadata(extracted_text)

        return jsonify({
            "success": True,
            "filename": filename,
            "extractedText": extracted_text,
            "metadata": metadata,
            "chunks_count": len(chunks),
            "analysis": pipeline_res["reply"],
            "nlp": pipeline_res.get("nlp"),
            "retrieved_sections": pipeline_res.get("retrieved_legal_sections")
        })

    except Exception as e:
        logger.error(f"Error in document upload endpoint: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "message": f"Document processing error: {str(e)}"
        }), 500


@app.route("/api/chatbot/health", methods=["GET"])
@app.route("/health", methods=["GET"])
def health_endpoint():
    return jsonify({
        "success": True,
        "service": "NyaySetu Model-based Python NLP + Vector RAG + Qwen LLM",
        "model": MODEL_NAME,
        "embedding_model": EMBEDDING_MODEL,
        "ollama_url": OLLAMA_URL,
        "kb_entries_indexed": len(LEGAL_KNOWLEDGE_BASE),
        "status": "healthy"
    })


if __name__ == "__main__":
    logger.info(f"Starting NyaySetu Python Chatbot on port {PORT}...")
    app.run(host="0.0.0.0", port=PORT, debug=False)