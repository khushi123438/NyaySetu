import AIChat from "../models/AIChat.js";
import { runChatbotPipeline } from "../utils/chatbotPipeline.js";

export const chatWithAI = async (req, res) => {
  try {
    const { message, documentText } = req.body;

    if (!message?.trim() && !documentText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    let chat = await AIChat.findOne({
      userId: req.user.id,
    });

    if (!chat) {
      chat = await AIChat.create({
        userId: req.user.id,
        title: "New Chat",
        messages: [],
      });
    }

    const aiReply = await runChatbotPipeline({
      message: message || "Analyze query",
      documentText: documentText || "",
      history: chat.messages
    });


    chat.messages.push({
      role: "user",
      content: message,
    });

    chat.messages.push({
      role: "assistant",
      content: aiReply,
    });

    await chat.save();

    res.json({
      success: true,
      reply: aiReply,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to generate AI response.",
    });
  }
};


export const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: "NyaySetu AI is running.",
    model: process.env.MODEL,
  });
};

export const getChatHistory = async (req, res) => {
  try {
    const chat = await AIChat.findOne({
      userId: req.user.id,
    });

    res.json({
      success: true,
      messages: chat?.messages || [],
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch history.",
    });
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    await AIChat.updateOne(
      {
        userId: req.user.id,
      },
      {
        $set: {
          messages: [],
        },
      }
    );

    res.json({
      success: true,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to clear history.",
    });
  }
};

