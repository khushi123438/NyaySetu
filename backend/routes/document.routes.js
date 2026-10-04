import express from "express";
import upload from "../middlewares/document.upload.js";
import { optionalAuthMiddleware, authMiddleware } from "../middlewares/authMiddleware.js";
import {
  analyzeDocument,
  getActiveDocument,
  clearActiveDocument,
} from "../controllers/document.controller.js";

const router = express.Router();

// Upload & Analyze Document
router.post(
  "/analyze",
  optionalAuthMiddleware,
  upload.single("file"),
  analyzeDocument
);

router.post(
  "/upload",
  optionalAuthMiddleware,
  upload.single("file"),
  analyzeDocument
);

// Active Document status & management
router.get("/active", optionalAuthMiddleware, getActiveDocument);
router.delete("/active", optionalAuthMiddleware, clearActiveDocument);

export default router;