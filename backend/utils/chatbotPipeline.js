import axios from "axios";

const PYTHON_CHATBOT_URL = process.env.PYTHON_CHATBOT_URL || "http://127.0.0.1:5001";

/**
 * Unified NyaySetu Chatbot Pipeline:
 * Delegates all chatbot NLP, Document processing/chunking, Vector RAG retrieval,
 * Legal Knowledge Base grounding, and LLM generation to the Python service (chatbot.py).
 */
export const runChatbotPipeline = async ({ message = "", documentText = "", history = [] }) => {
  try {
    const response = await axios.post(
      `${PYTHON_CHATBOT_URL}/api/chatbot/chat`,
      {
        message: message || "Analyze query",
        documentText: documentText || "",
        history: history || [],
      },
      {
        timeout: 90000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.reply) {
      return response.data.reply;
    }

    throw new Error("No response received from Python Chatbot AI service.");
  } catch (err) {
    console.error("Python Chatbot service error:", err.response?.data || err.message);
    throw new Error(err.response?.data?.message || "Failed to communicate with Python Chatbot AI service.");
  }
};
