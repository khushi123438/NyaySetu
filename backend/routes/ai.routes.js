import express from "express";
import { optionalAuthMiddleware } from "../middlewares/authMiddleware.js";
import {
  chatWithAI,
  healthCheck,
  getChatHistory,
  clearChatHistory,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.get("/health", healthCheck);

// Optional auth enabled: Works for both logged in users (with MongoDB persistence) and guest users
router.post("/chat", optionalAuthMiddleware, chatWithAI);
router.get("/history", optionalAuthMiddleware, getChatHistory);
router.delete("/history", optionalAuthMiddleware, clearChatHistory);

export default router;