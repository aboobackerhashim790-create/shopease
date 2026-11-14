import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Credit", "Debit"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, default: 0, min: 0 },
    transactions: { type: [walletTransactionSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("Wallet", walletSchema);
