import {
  FiSend,
  FiPaperclip,
  FiX,
  FiFileText,
  FiCheck,
} from "react-icons/fi";

export default function ChatInput({
  message,
  setMessage,
  handleSendMessage,
  handleFileChange,
  filePreview,
  selectedFile,
  removeFile,
  fileInputRef,
  loading,
  hasActiveDocument,
}) {
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && (message.trim() || selectedFile)) {
        handleSendMessage();
      }
    }
  };

  const isPdf = selectedFile?.name?.toLowerCase().endsWith(".pdf");

  return (
    <div className="border-t border-white/10 bg-slate-950/70 backdrop-blur-xl p-4 sm:p-5">
      {/* Attached File Preview Badge before sending */}
      {selectedFile && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
              <FiFileText size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-cyan-300/80">
                {(selectedFile.size / 1024).toFixed(1)} KB • Ready for NLP & Vector RAG analysis
              </p>
            </div>
          </div>

          <button
            onClick={removeFile}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition"
            title="Remove attached file"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-end gap-2 sm:gap-3">
        {/* Upload Attachment Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="
            h-12 w-12 shrink-0
            rounded-xl
            bg-white/10 hover:bg-cyan-500/20
            border border-white/10 hover:border-cyan-500/30
            flex items-center justify-center
            text-cyan-300
            transition
            disabled:opacity-50
          "
          title="Upload legal document (PDF, DOCX, TXT)"
        >
          <FiPaperclip size={20} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Text Input Area */}
        <textarea
          rows={1}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={onKeyDown}
          placeholder={
            selectedFile
              ? "Ask a question about this document or leave blank for a full legal summary..."
              : hasActiveDocument
              ? "Ask any question about the uploaded document or statutory law..."
              : "Describe your legal issue, dispute, or upload a document..."
          }
          className="
            flex-1
            resize-none
            max-h-40 min-h-[48px]
            rounded-xl
            bg-white/5 border border-white/10
            px-4 py-3
            text-sm text-white
            placeholder-slate-400
            outline-none
            focus:border-cyan-400 focus:bg-white/10
            transition
          "
        />

        {/* Send Button */}
        <button
          onClick={handleSendMessage}
          disabled={loading || (!message.trim() && !selectedFile)}
          className="
            h-12 w-12 shrink-0
            rounded-xl
            bg-gradient-to-r from-cyan-500 to-blue-600
            hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105
            disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none
            transition
            flex items-center justify-center
            text-white
          "
          title="Send query"
        >
          <FiSend size={18} />
        </button>
      </div>

      {/* Helper Footer */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
        <div>
          Press <span className="text-cyan-300 font-medium">Enter</span> to send •{" "}
          <span className="text-cyan-300 font-medium">Shift + Enter</span> for new line
        </div>
        <div className="hidden sm:block text-slate-400">
          Supported: <span className="text-slate-300">PDF, DOCX, TXT</span> (Max 25MB)
        </div>
      </div>
    </div>
  );
}