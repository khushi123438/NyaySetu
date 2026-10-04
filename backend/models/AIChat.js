import mongoose from "mongoose";

const messageFileSchema = new mongoose.Schema(
  {
    originalName: String,
    filename: String,
    fileUrl: String,
    fileSize: Number,
    mimeType: String,
    extractedText: String,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    file: {
      type: messageFileSchema,
      default: null,
    },
    document: {
      type: Object,
      default: null,
    },
    metadata: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

const activeDocumentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    extractedText: { type: String, default: "" },
    summary: { type: String, default: "" },
    metadata: { type: Object, default: {} },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "NyaySetu AI Consultation",
    },
    activeDocument: {
      type: activeDocumentSchema,
      default: null,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("AIChat", aiChatSchema);