import axios from "axios";
import systemPrompt from "./prompts.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export const askOllama = async (message, history = []) => {
  try {
    console.time("Ollama");

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },

      ...history.slice(-8),

      {
        role: "user",
        content: message,
      },
    ];

    const { data } = await axios.post(
  `${OLLAMA_URL}/api/chat`,
  {
    model: process.env.MODEL,
    messages,
    stream: false,
    keep_alive: "30m",

    options: {
      temperature: 0.2,
      top_p: 0.9,
      num_predict: 1024
    }
  }
);

    console.timeEnd("Ollama");

    return data.message.content;

  } catch (err) {
    console.error(err.response?.data || err.message);
    throw new Error("Unable to connect to Ollama.");
  }
};