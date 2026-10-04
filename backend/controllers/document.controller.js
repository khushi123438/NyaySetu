import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import axios from "axios";

import AIChat from "../models/AIChat.js";
import { runChatbotPipeline } from "../utils/chatbotPipeline.js";

const PYTHON_CHATBOT_URL = process.env.PYTHON_CHATBOT_URL || "http://127.0.0.1:5001";

/**
 * Extract text from PDF file
 */
async function extractPdfText(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      if (pageText.trim()) {
        text += `\n--- Page ${i} ---\n` + pageText;
      }
    }
    return text.trim();
  } catch (err) {
    console.warn("pdfjs text extraction warning:", err.message);
    return "";
  }
}

/**
 * Extract text from DOCX file
 */
async function extractDocxText(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value?.trim() || "";
  } catch (err) {
    console.warn("mammoth docx extraction warning:", err.message);
    return "";
  }
}

/**
 * Extract structured metadata (parties, amounts, durations)
 */
function extractBasicMetadata(text) {
  const parties = text.match(/(?:between|by and between|party of the first part|lessor|lessee|landlord|tenant|employer|employee)\s*[:\-\s]+([^\n,]+)/gi) || [];
  const amounts = text.match(/(?:Rs\.?|₹|INR)\s*[\d,]+(?:\.\d+)?(?:\s*\/-\b)?/gi) || [];
  const durations = text.match(/\b\d+\s+(?:months?|years?|days?|weeks?)\b/gi) || [];
  const dates = text.match(/\b(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/g) || [];

  return {
    parties: [...new Set(parties.map(p => p.trim()))].slice(0, 5),
    amounts: [...new Set(amounts)].slice(0, 8),
    durations: [...new Set(durations)].slice(0, 5),
    dates: [...new Set(dates)].slice(0, 5)
  };
}

/**
 * Main Controller: Analyze Document Upload
 */
export const analyzeDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select and upload a valid legal document (PDF, DOCX, TXT).",
      });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const filename = req.file.filename;
    const fileUrl = `/uploads/${filename}`;
    const ext = path.extname(originalName).toLowerCase();
    let extractedText = "";

    // 1. Text Extraction
    if (ext === ".pdf" || req.file.mimetype === "application/pdf") {
      extractedText = await extractPdfText(filePath);
    } else if (ext === ".docx" || ext === ".doc" || req.file.mimetype.includes("wordprocessingml")) {
      extractedText = await extractDocxText(filePath);
    } else if (ext === ".txt" || req.file.mimetype.startsWith("text/")) {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      extractedText = fs.readFileSync(filePath, "utf-8");
    }

    // 2. Python Fallback extraction if Node extraction is empty
    if (!extractedText.trim()) {
      try {
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer]);
        formData.append("file", blob, originalName);

        const pyRes = await axios.post(`${PYTHON_CHATBOT_URL}/api/chatbot/document/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 45000,
        });

        if (pyRes.data && pyRes.data.extractedText) {
          extractedText = pyRes.data.extractedText;
        }
      } catch (pyErr) {
        console.warn("Python document extraction fallback note:", pyErr.message);
      }
    }

    if (!extractedText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Unable to extract readable text from the document. Please ensure it is not an empty or scanned image file.",
      });
    }

    // 3. User Query & Analysis via Python NLP + RAG + SentenceTransformer + Qwen LLM
    const userQuery = req.body.message?.trim() || "Provide a comprehensive legal analysis and summary of this uploaded document, including key clauses, obligations, and actionable Indian legal steps.";
    
    const analysis = await runChatbotPipeline({
      message: userQuery,
      documentText: extractedText,
      history: []
    });

    const docMeta = extractBasicMetadata(extractedText);

    const documentInfo = {
      originalName,
      filename,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      extractedText,
      metadata: docMeta,
      summary: typeof analysis === "string" ? analysis.substring(0, 300) : "",
      uploadedAt: new Date()
    };

    // 4. Save to User's Chat Session if Authenticated
    if (req.user?.id) {
      try {
        let chat = await AIChat.findOne({ userId: req.user.id });
        if (!chat) {
          chat = await AIChat.create({
            userId: req.user.id,
            title: `Document: ${originalName}`,
            messages: [],
            activeDocument: documentInfo
          });
        } else {
          chat.activeDocument = documentInfo;
        }

        // Add user upload message & assistant analysis response
        chat.messages.push({
          role: "user",
          content: userQuery,
          file: {
            originalName,
            filename,
            fileUrl,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            extractedText: extractedText.substring(0, 3000)
          }
        });

        chat.messages.push({
          role: "assistant",
          content: analysis,
          document: {
            originalName,
            fileUrl,
            metadata: docMeta
          }
        });

        await chat.save();
      } catch (dbErr) {
        console.error("Error saving document to AIChat:", dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      analysis,
      reply: analysis,
      document: documentInfo,
      documentText: extractedText,
      fileUrl,
      message: "Document analyzed and indexed successfully."
    });

  } catch (err) {
    console.error("Analyze Document Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to process document through NLP and RAG pipeline.",
    });
  }
};

/**
 * Get Active Document for Current User
 */
export const getActiveDocument = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.json({ success: true, activeDocument: null });
    }

    const chat = await AIChat.findOne({ userId: req.user.id });
    return res.json({
      success: true,
      activeDocument: chat?.activeDocument || null,
    });
  } catch (err) {
    console.error("Get Active Document Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve active document.",
    });
  }
};

/**
 * Clear Active Document
 */
export const clearActiveDocument = async (req, res) => {
  try {
    if (req.user?.id) {
      await AIChat.updateOne(
        { userId: req.user.id },
        { $set: { activeDocument: null } }
      );
    }
    return res.json({
      success: true,
      message: "Active document cleared successfully.",
    });
  } catch (err) {
    console.error("Clear Active Document Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to clear active document.",
    });
  }
};