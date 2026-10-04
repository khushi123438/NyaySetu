import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FaRobot, FaUserCircle } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import {
  FiFileText,
  FiEye,
  FiDownload,
  FiExternalLink,
  FiCheckCircle,
  FiCpu,
  FiDatabase,
} from "react-icons/fi";

const API_BASE = "http://localhost:5000";

export default function ChatMessages({
  messages,
  loading,
  processingStep,
  onOpenDocument,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading, processingStep]);

  const renderFileCard = (fileObj) => {
    if (!fileObj) return null;

    const originalName =
      typeof fileObj === "string"
        ? fileObj
        : fileObj.originalName || fileObj.name || fileObj.filename || "Uploaded Document";

    const rawFileUrl = typeof fileObj === "object" ? fileObj.fileUrl : "";
    const fullFileUrl = rawFileUrl
      ? rawFileUrl.startsWith("http")
        ? rawFileUrl
        : `${API_BASE}${rawFileUrl}`
      : "";

    const isPdf = originalName.toLowerCase().endsWith(".pdf");
    const fileSize = typeof fileObj === "object" && fileObj.fileSize ? fileObj.fileSize : null;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-cyan-500/30 rounded-xl p-3.5 mb-3 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
            <FiFileText size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-xs">
              {originalName}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {fileSize && <span>{(fileSize / 1024).toFixed(1)} KB</span>}
              {fileSize && <span>•</span>}
              <span className="text-cyan-400 font-medium">
                {isPdf ? "PDF Document" : "Legal Document"}
              </span>
              <span>•</span>
              <span className="text-emerald-400">RAG Vector Context</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={() => onOpenDocument && onOpenDocument(typeof fileObj === "object" ? fileObj : { originalName, fileUrl: rawFileUrl })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
          >
            <FiEye size={13} />
            <span>View / Read</span>
          </button>

          {fullFileUrl && (
            <a
              href={fullFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition"
              title="Open file in new tab"
            >
              <FiExternalLink size={13} />
            </a>
          )}

          {fullFileUrl && (
            <a
              href={fullFileUrl}
              download={originalName}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition"
              title="Download file"
            >
              <FiDownload size={13} />
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Empty State */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-xl">
            <FaRobot className="text-5xl text-cyan-400" />
          </div>

          <h2 className="text-white text-2xl font-bold">
            NyaySetu AI Legal Assistant
          </h2>

          <p className="text-slate-400 mt-2 max-w-md text-sm leading-relaxed">
            Upload legal agreements, contracts, or notices for instant RAG vector analysis, clause breakdown, and Indian statutory grounding.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-lg w-full text-left">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
              <span className="text-cyan-400 font-semibold block mb-1">📄 Document RAG Analysis</span>
              Upload rent agreements, employment contracts, or NDAs to ask questions.
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
              <span className="text-cyan-400 font-semibold block mb-1">⚖️ Statutory Law Guidance</span>
              BNS, IPC, Contract Act, NI Act, Consumer Protection & Tenancy Acts.
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg, index) => {
        const isAssistant = msg.role === "assistant";
        const hasFile = msg.file || msg.document;

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[82%] rounded-2xl p-4 sm:p-5 shadow-xl transition ${
                isAssistant
                  ? "bg-slate-900/90 border border-white/10 text-slate-100"
                  : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  {isAssistant ? (
                    <div className="h-6 w-6 rounded-md bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-xs">
                      <FaRobot />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-md bg-white/20 flex items-center justify-center text-white text-xs">
                      <FaUserCircle />
                    </div>
                  )}

                  <span className="font-semibold text-xs sm:text-sm">
                    {isAssistant ? "NyaySetu AI Legal Assistant" : "You"}
                  </span>
                </div>

                {isAssistant && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    RAG + Qwen2.5:3b
                  </span>
                )}
              </div>

              {/* Attached File Card */}
              {hasFile && renderFileCard(msg.file || msg.document)}

              {/* Message Content */}
              <div className="prose prose-invert max-w-none text-sm leading-relaxed overflow-hidden break-words space-y-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Dynamic Processing State Indicator */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 shadow-xl max-w-md">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {processingStep || "Analyzing legal context..."}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-cyan-400">
                  <span className="flex items-center gap-1">
                    <FiDatabase size={12} /> SentenceTransformer Vector RAG
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <FiCpu size={12} /> Qwen2.5:3b
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}