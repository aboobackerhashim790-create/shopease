import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  newEmail: { type: String, required: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  resendAvailableAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("EmailChangeChallenge", schema);
