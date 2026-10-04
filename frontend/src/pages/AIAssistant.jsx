import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiTrash2,
  FiFileText,
  FiEye,
  FiX,
  FiLayers,
  FiShield,
  FiAlertCircle,
  FiExternalLink,
} from "react-icons/fi";
import { FaRobot } from "react-icons/fa";
import Background from "../components/Background/Background";
import {
  chatWithAI,
  getChatHistory,
  clearHistory,
  analyzeDocument,
  getActiveDocument,
  clearActiveDocument,
} from "../services/aiService";
import ChatMessages from "../components/AI/ChatMessages";
import ChatInput from "../components/AI/ChatInput";
import DocumentViewerModal from "../components/AI/DocumentViewerModal";

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `# 👋 Welcome to NyaySetu AI Legal Assistant

I provide grounded legal information, document contract analysis, and statutory guidance under Indian Law.

### 📄 Upload Legal Documents
- **Rent & Lease Agreements** (Eviction safeguards, notice periods, security deposits)
- **Employment Contracts** (Termination clauses, unpaid wages, non-competes)
- **Non-Disclosure Agreements (NDAs)** & Service Contracts
- **Consumer Grievance Proofs & Cheque Dishonour Notices**

Upload your document via the **paperclip icon** below for instant Vector RAG analysis.`,
    },
  ]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Document Viewer Modal State
  const [viewerDoc, setViewerDoc] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // -----------------------------
  // Load History & Active Document
  // -----------------------------
  const loadChatData = async () => {
    try {
      const res = await getChatHistory();
      if (res.success && res.messages && res.messages.length > 0) {
        setMessages(res.messages);
      }
      if (res.activeDocument) {
        setActiveDocument(res.activeDocument);
      } else {
        const docRes = await getActiveDocument().catch(() => null);
        if (docRes?.activeDocument) {
          setActiveDocument(docRes.activeDocument);
        }
      }
    } catch (err) {
      console.log("History load note:", err.message);
    }
  };

  useEffect(() => {
    loadChatData();
  }, []);

  // -----------------------------
  // File Picker Handling
  // -----------------------------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage(null);

    if (file.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDetachDocument = async () => {
    try {
      await clearActiveDocument();
      setActiveDocument(null);
    } catch (err) {
      console.error(err);
      setActiveDocument(null);
    }
  };

  const handleOpenViewer = (doc) => {
    setViewerDoc(doc || activeDocument);
    setIsViewerOpen(true);
  };

  // -----------------------------
  // Send Message / Upload Document
  // -----------------------------
  const sendMessage = async () => {
    if (!message.trim() && !selectedFile) return;

    const currentMessage = message.trim();
    const currentFile = selectedFile;

    // Reset inputs immediately
    setMessage("");
    setSelectedFile(null);
    setFilePreview(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setLoading(true);

    try {
      // CASE 1: DOCUMENT UPLOAD FLOW
      if (currentFile) {
        setProcessingStep("📤 Uploading document & extracting text...");

        const fileTempMeta = {
          originalName: currentFile.name,
          fileSize: currentFile.size,
          mimeType: currentFile.type,
        };

        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            content: currentMessage || `Please analyze this document: **${currentFile.name}**`,
            file: fileTempMeta,
          },
        ]);

        // Simulating step transitions for clear UI feedback
        setTimeout(() => {
          setProcessingStep("⚙️ SentenceTransformer chunking & Vector RAG indexing...");
        }, 1200);

        setTimeout(() => {
          setProcessingStep("⚖️ Analyzing document with Qwen2.5:3b LLM...");
        }, 2800);

        const res = await analyzeDocument(currentFile, currentMessage);

        if (res.success) {
          const docData = res.document || {
            originalName: currentFile.name,
            fileUrl: res.fileUrl,
            extractedText: res.documentText,
            fileSize: currentFile.size,
          };

          setActiveDocument(docData);

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.analysis || res.reply,
              document: docData,
            },
          ]);
        } else {
          throw new Error(res.message || "Failed to analyze document.");
        }
      } else {
        // CASE 2: NORMAL CHAT / FOLLOW-UP QUESTION ON ACTIVE DOCUMENT
        setProcessingStep(
          activeDocument
            ? "🔍 Retrieving relevant document clauses & statutory provisions..."
            : "⚖️ Consulting Indian Statutory Knowledge Base & Qwen2.5:3b..."
        );

        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            content: currentMessage,
          },
        ]);

        const res = await chatWithAI(currentMessage);

        if (res.success) {
          if (res.activeDocument) {
            setActiveDocument(res.activeDocument);
          }

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.reply,
              document: activeDocument
                ? {
                    originalName: activeDocument.originalName,
                    fileUrl: activeDocument.fileUrl,
                  }
                : null,
            },
          ]);
        } else {
          throw new Error(res.message || "Failed to generate AI response.");
        }
      }
    } catch (err) {
      console.error("AI Assistant Error:", err);
      const errText = err.response?.data?.message || err.message || "Something went wrong.";
      setErrorMessage(errText);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **Error**: ${errText}\n\nPlease verify that your document is readable or try asking again.`,
        },
      ]);
    } finally {
      setLoading(false);
      setProcessingStep("");
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
    } catch (err) {}

    setActiveDocument(null);
    setMessages([
      {
        role: "assistant",
        content: "# 👋 Welcome to NyaySetu AI\n\nHow may I assist you with Indian law or legal document analysis today?",
      },
    ]);
  };

  return (
    <>
      <Background />

      <div className="relative z-20 h-screen p-3 sm:p-6 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="
            mx-auto
            h-full
            w-full
            max-w-7xl
            rounded-3xl
            border border-white/10
            bg-slate-900/60
            backdrop-blur-2xl
            overflow-hidden
            flex
            flex-col
            shadow-2xl
          "
        >
          {/* HEADER */}
          <div className="h-20 shrink-0 border-b border-white/10 px-6 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <FaRobot className="text-white text-xl" />
              </div>

              <div>
                <h1 className="text-white text-lg sm:text-xl font-bold flex items-center gap-2">
                  NyaySetu AI Legal Assistant
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    NLP + Vector RAG + Qwen2.5:3b
                  </span>
                </h1>

                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 text-xs font-medium">
                    Model Ready & Grounded in Indian Law
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearHistory}
                className="
                  flex items-center gap-1.5
                  px-3.5 py-2
                  rounded-xl
                  bg-red-500/10 hover:bg-red-500/20
                  border border-red-500/20
                  text-red-300 text-xs font-semibold
                  transition
                "
                title="Clear conversation and active document context"
              >
                <FiTrash2 size={14} />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            </div>
          </div>

          {/* ACTIVE DOCUMENT BANNER */}
          {activeDocument && (
            <div className="shrink-0 bg-cyan-950/40 border-b border-cyan-500/20 px-6 py-2.5 flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300 shrink-0">
                  <FiFileText size={15} />
                </div>
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-md">
                    📄 Active Document: {activeDocument.originalName || activeDocument.filename}
                  </span>
                  <span className="text-[11px] text-cyan-300/80 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    Vector RAG Active — Questions are answered from this document
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenViewer(activeDocument)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition"
                >
                  <FiEye size={12} />
                  <span>View Document</span>
                </button>
                <button
                  onClick={handleDetachDocument}
                  className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition"
                  title="Detach active document"
                >
                  <FiX size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ERROR NOTIFICATION BANNER */}
          {errorMessage && (
            <div className="shrink-0 bg-red-950/60 border-b border-red-500/30 px-6 py-2 flex items-center justify-between text-xs text-red-200">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-200"
              >
                <FiX size={14} />
              </button>
            </div>
          )}

          {/* CHAT MESSAGES AREA */}
          <div className="flex-1 overflow-hidden">
            <ChatMessages
              messages={messages}
              loading={loading}
              processingStep={processingStep}
              onOpenDocument={handleOpenViewer}
            />
          </div>

          {/* INPUT BAR */}
          <div className="shrink-0">
            <ChatInput
              message={message}
              setMessage={setMessage}
              handleSendMessage={sendMessage}
              handleFileChange={handleFileChange}
              filePreview={filePreview}
              selectedFile={selectedFile}
              removeFile={removeFile}
              fileInputRef={fileInputRef}
              loading={loading}
              hasActiveDocument={Boolean(activeDocument)}
            />
          </div>
        </motion.div>
      </div>

      {/* DOCUMENT VIEWER MODAL */}
      <DocumentViewerModal
        document={viewerDoc || activeDocument}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
      />
    </>
  );
}