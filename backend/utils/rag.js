/**
 * RAG Module for NyaySetu Chatbot
 * Legal Knowledge Base (Indian Laws, IPC/BNS, Contract Act, Consumer Law, etc.)
 * and Context Retriever for Document + Legal KB.
 */

export const LEGAL_KNOWLEDGE_BASE = [
  {
    topic: "Rent & Tenancy / Property Disputes",
    keywords: ["rent", "tenant", "landlord", "lease", "eviction", "deposit", "agreement", "kiraya", "makaan"],
    sections: [
      {
        title: "Model Tenancy Act & State Rent Control Acts",
        reference: "Model Tenancy Act, 2021 / State Rent Control Act",
        summary: "11-month rental agreements are standard to avoid Rent Control Act provisions. Landlords cannot cut off essential supply (water/electricity) or forcibly evict without proper notice. Security deposit must be refunded minus legitimate damages upon peaceful handover."
      },
      {
        title: "Transfer of Property Act, 1882 - Section 106",
        reference: "Section 106, Transfer of Property Act, 1882",
        summary: "In the absence of a written contract, lease of immovable property for residential purpose is terminable by 15 days' notice from either party."
      }
    ]
  },
  {
    topic: "Cheating, Fraud & Forgery (IPC & BNS)",
    keywords: ["cheat", "fraud", "scam", "dhokha", "fake", "forgery", "money", "paise", "stole", "ipc 420", "bns 318"],
    sections: [
      {
        title: "Cheating & Dishonestly Inducing Delivery of Property",
        reference: "Section 420 IPC / Section 318 BNS",
        summary: "Punishes cheating and dishonestly inducing delivery of property with imprisonment up to 7 years and fine. Applicable when someone makes false promises to take money/property."
      },
      {
        title: "Forgery & Counterfeiting Documents",
        reference: "Section 468 IPC / Section 336 BNS",
        summary: "Forgery for the purpose of cheating is punishable with imprisonment up to 7 years and fine."
      }
    ]
  },
  {
    topic: "Breach of Contract & Agreement Violations",
    keywords: ["contract", "agreement", "breach", "terms", "violation", "shart", "penalty", "notice", "termination"],
    sections: [
      {
        title: "Compensation for Loss or Damage Caused by Breach of Contract",
        reference: "Section 73, Indian Contract Act, 1872",
        summary: "When a contract has been broken, the party who suffers by such breach is entitled to receive compensation for any loss or damage caused to them thereby."
      },
      {
        title: "Compensation for Breach of Contract Where Penalty Stipulated",
        reference: "Section 74, Indian Contract Act, 1872",
        summary: "If a sum is named in the contract as the amount to be paid in case of breach, the aggrieved party is entitled to reasonable compensation not exceeding the amount named."
      }
    ]
  },
  {
    topic: "Consumer Protection & Service Defect",
    keywords: ["consumer", "defective", "product", "service", "refund", "replace", "warranty", "complaint", "grahak"],
    sections: [
      {
        title: "Consumer Rights & Defect in Goods/Services",
        reference: "Consumer Protection Act, 2019 (Sections 2(10), 2(11), 35)",
        summary: "Consumers can file complaints in District Consumer Redressal Commission for defective products, deficiency in service, or unfair trade practices to claim refund, replacement, and compensation."
      }
    ]
  },
  {
    topic: "Employment & Salary Disputes",
    keywords: ["salary", "employer", "employee", "job", "termination", "resignation", "notice period", "company", "unpaid"],
    sections: [
      {
        title: "Non-Payment of Wages & Unlawful Termination",
        reference: "Payment of Wages Act, 1936 & Industrial Disputes Act, 1947",
        summary: "Employers cannot withhold salary earned for work done. If terminated without contractual notice pay, employee can send legal notice and approach Labour Commissioner or civil court."
      }
    ]
  },
  {
    topic: "Cheque Dishonour / Bounce",
    keywords: ["cheque", "bounce", "dishonour", "bank", "insufficient funds", "payment"],
    sections: [
      {
        title: "Dishonour of Cheque for Insufficiency of Funds",
        reference: "Section 138, Negotiable Instruments Act, 1881",
        summary: "Bouncing of cheque due to insufficient funds is a criminal offence. Legal demand notice must be served to drawer within 30 days of receiving bank memo. If unpaid within 15 days, criminal complaint can be filed."
      }
    ]
  },
  {
    topic: "Cyber Crime & Financial Scams",
    keywords: ["cyber", "online", "otp", "phishing", "bank fraud", "hack", "scam"],
    sections: [
      {
        title: "Cheating by Personation & Cyber Fraud",
        reference: "Section 66D, Information Technology Act, 2000",
        summary: "Punishes cheating by personation by using computer resource or communication device with imprisonment up to 3 years and fine. Victims should immediately report at Cyber Crime Helpline 1930 or cybercrime.gov.in."
      }
    ]
  },
  {
    topic: "Domestic & Family Disputes",
    keywords: ["divorce", "maintenance", "marriage", "wife", "husband", "dowry", "domestic violence", "patni", "pati"],
    sections: [
      {
        title: "Order for Maintenance of Wives, Children and Parents",
        reference: "Section 125 CrPC / Section 144 BNSS",
        summary: "Provides monthly allowance for maintenance of wife, minor children, or elderly parents unable to maintain themselves."
      },
      {
        title: "Protection of Women from Domestic Violence",
        reference: "Protection of Women from Domestic Violence Act, 2005",
        summary: "Provides protection orders, residence orders, and monetary relief for women suffering physical, emotional, or economic abuse."
      }
    ]
  }
];

export const retrieveRAGContext = (nlpResult, docResult = null) => {
  const { cleanQuery, intent, entities } = nlpResult;
  const lowerQuery = cleanQuery.toLowerCase();

  // 1. Retrieve Document Context (if uploaded document exists)
  let retrievedDocChunks = [];
  if (docResult && docResult.chunks && docResult.chunks.length > 0) {
    if (intent === "summary" || docResult.chunks.length <= 3) {
      retrievedDocChunks = docResult.chunks;
    } else {
      const scoredChunks = docResult.chunks.map(chunk => {
        let score = 0;
        const lowerContent = chunk.content.toLowerCase();

        entities.legalKeywords.forEach(kw => {
          if (lowerContent.includes(kw)) score += 2;
        });

        const words = lowerQuery.split(/\s+/).filter(w => w.length > 3);
        words.forEach(w => {
          if (lowerContent.includes(w)) score += 1;
        });

        return { ...chunk, score };
      });

      scoredChunks.sort((a, b) => b.score - a.score);
      retrievedDocChunks = scoredChunks.slice(0, 3);
    }
  }

  // 2. Retrieve Legal Knowledge Base Context
  const retrievedLegalSections = [];
  LEGAL_KNOWLEDGE_BASE.forEach(category => {
    let matchScore = 0;
    category.keywords.forEach(kw => {
      if (lowerQuery.includes(kw) || entities.legalKeywords.includes(kw)) {
        matchScore += 2;
      }
    });

    if (docResult && docResult.fullText) {
      const lowerDoc = docResult.fullText.toLowerCase();
      category.keywords.forEach(kw => {
        if (lowerDoc.includes(kw)) matchScore += 1;
      });
    }

    if (matchScore > 0) {
      category.sections.forEach(sec => {
        retrievedLegalSections.push({
          ...sec,
          categoryTopic: category.topic,
          score: matchScore
        });
      });
    }
  });

  retrievedLegalSections.sort((a, b) => b.score - a.score);
  const topLegalSections = retrievedLegalSections.slice(0, 3);

  return {
    docChunks: retrievedDocChunks,
    legalSections: topLegalSections
  };
};
