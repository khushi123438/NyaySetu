/**
 * NLP Module for NyaySetu Chatbot
 * Detects intent, extracts entities and keywords, cleans and understands user queries.
 */

export const analyzeQueryNLP = (query = "") => {
  const cleanQuery = query.trim().replace(/\s+/g, " ");
  const lowerQuery = cleanQuery.toLowerCase();

  // 1. Intent Detection
  let intent = "general_query";

  const summaryKeywords = [
    "summary", "saaransh", "saransh", "samjhao", "brief", "summarize",
    "overview", "is document ka summary", "kya hai isme", "digest", "details"
  ];

  const actionKeywords = [
    "kya karna chahiye", "what should i do", "next step", "kaise kare", "action",
    "kya karu", "kaise karu", "remedy", "rights", "hacks", "solution", "process",
    "step", "kya kar sakte hain", "is document ke according"
  ];

  const legalSectionKeywords = [
    "section", "dhara", "ipc", "bns", "act", "law", "punishment", "penalty",
    "legal section", "relevant section", "crpc", "bnss", "court", "clause",
    "isme relevant legal section kya hai", "konsi dhara"
  ];

  const clauseKeywords = [
    "clause", "term", "condition", "shart", "notice period", "rent",
    "deposit", "termination", "validity", "expiry"
  ];

  if (summaryKeywords.some(kw => lowerQuery.includes(kw))) {
    intent = "summary";
  } else if (actionKeywords.some(kw => lowerQuery.includes(kw))) {
    intent = "action_required";
  } else if (legalSectionKeywords.some(kw => lowerQuery.includes(kw))) {
    intent = "legal_sections";
  } else if (clauseKeywords.some(kw => lowerQuery.includes(kw))) {
    intent = "clause_analysis";
  }

  // 2. Entity & Keyword Extraction
  const dates = cleanQuery.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d+\s+(months?|years?|days?))\b/gi) || [];
  const amounts = cleanQuery.match(/\b(rs\.?|₹|rupees?)\s*[\d,]+|\b[\d,]+\s*(rupees?|lakhs?|crores?)\b/gi) || [];

  const legalDomainKeywords = [
    "rent", "agreement", "tenant", "landlord", "eviction", "deposit", "salary",
    "employer", "termination", "fraud", "cheating", "cyber", "online", "scam",
    "police", "fir", "consumer", "defect", "refund", "divorce", "maintenance",
    "cheque", "bounce", "loan", "property", "possession", "will", "inheritance"
  ].filter(kw => lowerQuery.includes(kw));

  // 3. Language Detection
  let detectedLanguage = "English";
  const hindiDevanagari = /[\u0900-\u097F]/;
  const hinglishPatterns = ["kya", "hai", "kaise", "chahiye", "karne", "mujhe", "isme", "ke", "do", "batao", "dhara", "ka"];

  if (hindiDevanagari.test(cleanQuery)) {
    detectedLanguage = "Hindi";
  } else if (hinglishPatterns.some(w => lowerQuery.split(/\s+/).includes(w))) {
    detectedLanguage = "Hinglish";
  }

  return {
    cleanQuery,
    intent,
    entities: {
      dates,
      amounts,
      legalKeywords: legalDomainKeywords
    },
    language: detectedLanguage
  };
};
