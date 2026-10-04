import AIChat from "../models/AIChat.js";
import { runChatbotPipeline } from "../utils/chatbotPipeline.js";

export const chatWithAI = async (req, res) => {
  try {
    const { message, documentText } = req.body;

    if (!message?.trim() && !documentText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message or documentText is required.",
      });
    }

    let chat = null;
    if (req.user?.id) {
      chat = await AIChat.findOne({
        userId: req.user.id,
      });

      if (!chat) {
        chat = await AIChat.create({
          userId: req.user.id,
          title: "NyaySetu Legal Consultation",
          messages: [],
        });
      }
    }

    // Determine document context: provided directly in body or active in chat session
    const docContext = documentText || chat?.activeDocument?.extractedText || "";

    const aiReply = await runChatbotPipeline({
      message: message || "Analyze query",
      documentText: docContext,
      history: chat?.messages || []
    });

    if (chat) {
      chat.messages.push({
        role: "user",
        content: message,
      });

      chat.messages.push({
        role: "assistant",
        content: aiReply,
        document: chat.activeDocument ? {
          originalName: chat.activeDocument.originalName,
          fileUrl: chat.activeDocument.fileUrl
        } : null
      });

      await chat.save();
    }

    res.json({
      success: true,
      reply: aiReply,
      activeDocument: chat?.activeDocument || null,
    });

  } catch (err) {
    console.error("Chat With AI Controller Error:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Failed to generate AI response.",
    });
  }
};


export const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: "NyaySetu AI is running.",
    model: process.env.MODEL || "qwen2.5:3b",
  });
};

export const getChatHistory = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.json({
        success: true,
        messages: [],
        activeDocument: null
      });
    }

    const chat = await AIChat.findOne({
      userId: req.user.id,
    });

    res.json({
      success: true,
      messages: chat?.messages || [],
      activeDocument: chat?.activeDocument || null,
    });

  } catch (err) {
    console.error("Get Chat History Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch history.",
    });
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    if (req.user?.id) {
      await AIChat.updateOne(
        {
          userId: req.user.id,
        },
        {
          $set: {
            messages: [],
            activeDocument: null,
          },
        }
      );
    }

    res.json({
      success: true,
      message: "Chat history and active document cleared.",
    });

  } catch (err) {
    console.error("Clear Chat History Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to clear history.",
    });
  }
};
