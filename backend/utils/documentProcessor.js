/**
 * Document Processing Module for NyaySetu Chatbot
 * Cleans, extracts, and chunks uploaded legal document content for RAG retrieval.
 */

export const processDocumentContent = (rawText = "") => {
  if (!rawText || !rawText.trim()) {
    return {
      fullText: "",
      chunks: [],
      metadata: { parties: [], amounts: [], durations: [] }
    };
  }

  const cleanedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Break text into paragraphs / sections / clauses
  const rawParagraphs = cleanedText.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";
  let chunkIndex = 1;

  for (const para of rawParagraphs) {
    if ((currentChunk + "\n\n" + para).length > 800) {
      if (currentChunk.trim()) {
        chunks.push({
          id: `Chunk-${chunkIndex++}`,
          content: currentChunk.trim()
        });
      }
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: `Chunk-${chunkIndex++}`,
      content: currentChunk.trim()
    });
  }

  // Metadata extraction (parties, amounts, duration)
  const partyMatches = cleanedText.match(/(?:between|by and between|party of the first part|lessor|lessee|landlord|tenant|employer|employee)\s*[:\-\s]+([^\n,]+)/gi) || [];
  const amountMatches = cleanedText.match(/(?:Rs\.?|₹)\s*[\d,]+(?:\/\-)?/gi) || [];
  const durationMatches = cleanedText.match(/\b\d+\s+(?:months|years|days)\b/gi) || [];

  return {
    fullText: cleanedText,
    chunks: chunks.length > 0 ? chunks : [{ id: "Chunk-1", content: cleanedText }],
    metadata: {
      parties: partyMatches.map(m => m.trim()),
      amounts: [...new Set(amountMatches)],
      durations: [...new Set(durationMatches)]
    }
  };
};
