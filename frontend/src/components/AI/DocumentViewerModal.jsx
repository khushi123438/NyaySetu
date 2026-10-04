import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiCopy,
  FiCheck,
  FiLayers,
  FiShield,
  FiSearch,
} from "react-icons/fi";

const API_BASE = "http://localhost:5000";

export default function DocumentViewerModal({ document, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("preview"); // 'preview' | 'text' | 'metadata'
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen || !document) return null;

  const originalName = document.originalName || document.filename || "Uploaded Legal Document";
  const rawFileUrl = document.fileUrl || (document.filename ? `/uploads/${document.filename}` : "");
  const fullFileUrl = rawFileUrl.startsWith("http") ? rawFileUrl : `${API_BASE}${rawFileUrl}`;
  const extractedText = document.extractedText || "";
  const metadata = document.metadata || {};
  const isPdf = originalName.toLowerCase().endsWith(".pdf") || document.mimeType === "application/pdf";

  const handleCopyText = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredText = searchTerm
    ? extractedText.split("\n").filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase())).join("\n")
    : extractedText;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        >
          {/* MODAL HEADER */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <FiFileText size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate max-w-md sm:max-w-xl">
                  {originalName}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {document.fileSize && (
                    <span>{(document.fileSize / 1024).toFixed(1)} KB</span>
                  )}
                  <span>•</span>
                  <span className="text-cyan-400 font-medium">
                    {metadata.document_type || "Legal Document"}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400">RAG Vector Indexed</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {rawFileUrl && (
                <a
                  href={fullFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-cyan-300 transition"
                  title="Open file in new tab"
                >
                  <FiExternalLink size={14} />
                  <span className="hidden sm:inline">Open File</span>
                </a>
              )}
              {rawFileUrl && (
                <a
                  href={fullFileUrl}
                  download={originalName}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-xs font-medium text-cyan-300 border border-cyan-500/30 transition"
                  title="Download original file"
                >
                  <FiDownload size={14} />
                  <span className="hidden sm:inline">Download</span>
                </a>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-400 transition"
              >
                <FiX size={20} />
              </button>
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <div className="flex items-center gap-2 px-6 py-2 border-b border-white/10 bg-slate-900/50">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "preview"
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <FiFileText size={14} />
              Document Preview
            </button>
            <button
              onClick={() => setActiveTab("text")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "text"
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <FiLayers size={14} />
              Extracted Legal Text ({extractedText ? `${extractedText.length} chars` : "0"})
            </button>
            <button
              onClick={() => setActiveTab("metadata")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "metadata"
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <FiShield size={14} />
              Identified Clauses & Entities
            </button>
          </div>

          {/* MODAL BODY */}
          <div className="flex-1 overflow-hidden p-6 bg-slate-950/40">
            {/* TAB 1: PREVIEW (IFRAME OR FALLBACK) */}
            {activeTab === "preview" && (
              <div className="h-full w-full rounded-xl overflow-hidden border border-white/10 bg-slate-900/80 flex flex-col">
                {isPdf && rawFileUrl ? (
                  <iframe
                    src={fullFileUrl}
                    title="PDF Viewer"
                    className="w-full h-full rounded-xl bg-white"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <FiFileText className="text-6xl text-cyan-400 mb-4 animate-pulse" />
                    <h4 className="text-xl font-bold text-white mb-2">{originalName}</h4>
                    <p className="text-slate-400 text-sm max-w-md mb-6">
                      {isPdf
                        ? "Click below to view the PDF file in a new browser tab or download it directly."
                        : "Extracted document text is available in the 'Extracted Legal Text' tab."}
                    </p>
                    <div className="flex gap-4">
                      {rawFileUrl && (
                        <a
                          href={fullFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition shadow-lg shadow-cyan-500/30"
                        >
                          <FiExternalLink /> Open Document
                        </a>
                      )}
                      <button
                        onClick={() => setActiveTab("text")}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 font-medium transition"
                      >
                        <FiLayers /> View Extracted Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EXTRACTED TEXT */}
            {activeTab === "text" && (
              <div className="h-full flex flex-col bg-slate-900/90 rounded-xl border border-white/10 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search within document..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition"
                  >
                    {copied ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
                    <span>{copied ? "Copied!" : "Copy Full Text"}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mt-4 p-3 bg-slate-950/60 rounded-lg font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                  {filteredText || "No text available."}
                </div>
              </div>
            )}

            {/* TAB 3: CLAUSES & METADATA */}
            {activeTab === "metadata" && (
              <div className="h-full overflow-y-auto space-y-6 pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Parties */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10">
                    <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
                      <FiShield />
                      <span>Identified Parties</span>
                    </div>
                    {metadata.parties && metadata.parties.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-slate-200">
                        {metadata.parties.map((party, i) => (
                          <li key={i} className="flex items-start gap-2 bg-white/5 p-2 rounded-lg">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{party}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">No parties explicitly extracted.</p>
                    )}
                  </div>

                  {/* Financial Terms */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-3">
                      <FiLayers />
                      <span>Financial & Monetary Amounts</span>
                    </div>
                    {metadata.amounts && metadata.amounts.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {metadata.amounts.map((amt, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs"
                          >
                            {amt}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No monetary amounts detected.</p>
                    )}
                  </div>

                  {/* Notice Periods / Durations */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold mb-3">
                      <FiFileText />
                      <span>Notice Periods & Durations</span>
                    </div>
                    {metadata.durations && metadata.durations.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {metadata.durations.map((dur, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs"
                          >
                            {dur}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No durations detected.</p>
                    )}
                  </div>

                  {/* Document Type & Indexing */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold mb-3">
                      <FiLayers />
                      <span>RAG & Pipeline Status</span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-400">Document Type:</span>{" "}
                        <span className="text-white font-medium">
                          {metadata.document_type || "Legal Document"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Vector Embeddings:</span>{" "}
                        <span className="text-cyan-400">SentenceTransformer (384-d normalized)</span>
                      </div>
                      <div>
                        <span className="text-slate-400">LLM Model:</span>{" "}
                        <span className="text-emerald-400">Ollama Qwen2.5:3b</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
