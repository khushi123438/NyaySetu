# ⚖️ NyaySetu: AI-Powered Legal Assistance Platform

NyaySetu is an AI-powered legal assistance platform that connects users with legal professionals and provides intelligent legal support through modern AI technologies. The platform simplifies access to legal services by enabling users to find advocates, resolve legal queries, analyze documents, generate legal documents, and stay updated with legal news.

Built with the MERN stack and integrated with **Qwen LLM through Ollama**, NyaySetu combines **NLP, RAG, Large Language Models, and Generative AI** to provide context-aware legal assistance while maintaining secure, role-based access for users and advocates.

---

## 🚀 Key Features

### 👥 Role-Based Access Control (RBAC)

* Separate dashboards for Users and Advocates
* Secure role-based authorization
* Different functionalities based on user roles

### 🔐 Secure Authentication System

* User and Advocate registration/login
* JWT-based authentication
* Password encryption using bcrypt hashing
* Protected routes and secure access management

### ⚖️ Advocate Discovery Platform

* Users can search and explore advocates
* Find suitable legal professionals based on requirements
* Connect with advocates for legal consultation

### 🤖 AI Legal Assistant — NLP + RAG + Qwen LLM

* AI-powered chatbot for legal queries
* NLP-based query understanding, intent detection, and entity extraction
* RAG-based retrieval of relevant legal information
* Qwen LLM generates context-aware responses using retrieved information
* GenAI-powered natural-language legal explanations
* Supports contextual follow-up questions
* Provides grounded responses based on available legal knowledge

### 📄 AI Legal Document Analysis

* Upload and analyze legal documents
* Extracts and processes relevant information from documents
* NLP-based understanding of document content
* RAG retrieves relevant context from uploaded documents
* Qwen LLM generates summaries and explanations
* Helps users understand complex legal content in simpler language

### 📝 AI Legal Document Generator

* Generates structured legal documents using Generative AI
* Uses user-provided information and relevant legal context
* Creates structured legal drafts
* Provides downloadable PDF documents

### 📰 Legal News Updates

* Provides latest legal news and updates
* Keeps users informed about important legal developments

### 📊 User & Advocate Dashboards

* Personalized dashboards for different roles
* Manage profiles and legal activities efficiently

---

## 🧠 AI Architecture

```text
User Query / Legal Document
            │
            ▼
      NLP Processing
   ┌──────────────────┐
   │ Intent Detection │
   │ Entity Extraction│
   │ Query Processing │
   └────────┬─────────┘
            │
            ▼
       RAG Pipeline
   ┌──────────────────┐
   │ Embeddings       │
   │ Retrieval        │
   │ Legal Context    │
   └────────┬─────────┘
            │
            ▼
       Qwen LLM
      via Ollama
            │
            ▼
    Generative AI Layer
            │
            ▼
   Context-Aware Response
```

### AI Technologies

* **NLP** — Query understanding, intent classification, entity extraction, and text processing
* **RAG** — Retrieval of relevant legal information and document context
* **LLM** — Qwen for context-aware reasoning and response generation
* **Generative AI** — Legal explanations, summarization, and document generation
* **Document Intelligence** — Processing and understanding uploaded legal documents

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Tailwind CSS
* JavaScript
* Axios
* Vite

### Backend

* Node.js
* Express.js
* MongoDB
* JWT Authentication
* bcrypt.js
* Multer

### Artificial Intelligence

* Ollama
* Qwen LLM
* NLP
* Retrieval-Augmented Generation (RAG)
* Generative AI
* AI-based Document Processing

### Tools & Platforms

* Git & GitHub
* Postman
* VS Code

---

## 📂 Project Structure

```text
NyaySetu/
│
├── backend/
│ ├── controllers/
│ ├── models/
│ ├── routes/
│ ├── middlewares/
│ ├── utils/
│ ├── server.js
│
├── frontend/
│ ├── src/
│ ├── components/
│ ├── pages/
│ └── package.json
│
└── README.md
```

---

## ⚙️ Installation & Setup

### Clone Repository

```bash
git clone https://github.com/your-username/NyaySetu.git
cd NyaySetu
```

### Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
OLLAMA_URL=http://localhost:11434
MODEL=qwen2.5
NEWS_API_KEY=your_api_key
```

### Start Ollama

Make sure Ollama is installed and the Qwen model is available:

```bash
ollama pull qwen2.5
```

Run the model:

```bash
ollama run qwen2.5
```

### Run Backend

```bash
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 👩‍💻 Author

**Khushi Pandey**

⭐ If you find this project useful, consider giving it a star!
