import mongoose from "mongoose";

const supportRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["Order", "Payment", "Return/Refund", "Product", "Account", "Other"],
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
      index: true,
    },
  },
  { timestamps: true },
);

supportRequestSchema.index({ createdAt: -1 });

export default mongoose.model("SupportRequest", supportRequestSchema);
