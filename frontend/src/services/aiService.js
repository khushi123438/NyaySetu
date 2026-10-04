import axios from "axios";

const API = "http://localhost:5000";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

export const chatWithAI = async (message, documentText = "") => {
  const res = await axios.post(
    `${API}/api/ai/chat`,
    { message, documentText },
    authHeader()
  );

  return res.data;
};

export const getChatHistory = async () => {
  const res = await axios.get(
    `${API}/api/ai/history`,
    authHeader()
  );

  return res.data;
};

export const clearHistory = async () => {
  const res = await axios.delete(
    `${API}/api/ai/history`,
    authHeader()
  );

  return res.data;
};

export const analyzeDocument = async (file, message = "") => {
  const formData = new FormData();

  formData.append("file", file);
  if (message) {
    formData.append("message", message);
  }

  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${API}/api/document/analyze`,
    formData,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
};

export const getActiveDocument = async () => {
  const res = await axios.get(
    `${API}/api/document/active`,
    authHeader()
  );

  return res.data;
};

export const clearActiveDocument = async () => {
  const res = await axios.delete(
    `${API}/api/document/active`,
    authHeader()
  );

  return res.data;
};