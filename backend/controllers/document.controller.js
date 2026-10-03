import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";

import { runChatbotPipeline } from "../utils/chatbotPipeline.js";

async function extractPdfText(filePath) {
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

    text +=
      content.items
        .map((item) => item.str)
        .join(" ") + "\n";
  }

  return text;
}

export const analyzeDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a document.",
      });
    }

    let extractedText = "";

    if (req.file.mimetype === "application/pdf") {
      extractedText = await extractPdfText(req.file.path);
    }

    else if (
      req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({
        path: req.file.path,
      });

      extractedText = result.value;
    }

    else {
      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        success: false,
        message: "Only PDF and DOCX files are supported.",
      });
    }

    if (!extractedText.trim()) {
      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        success: false,
        message: "Unable to extract text.",
      });
    }

    const userQuery = req.body.message || "Is document ke according mujhe kya karna chahiye?";

    const analysis = await runChatbotPipeline({
      message: userQuery,
      documentText: extractedText,
      history: []
    });

    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      success: true,
      analysis,
      documentText: extractedText,
    });

  } catch (err) {

    console.log(err);

    if (req.file && fs.existsSync(req.file.path))
      fs.unlinkSync(req.file.path);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};