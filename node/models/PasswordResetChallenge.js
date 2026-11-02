import mongoose from "mongoose";

const passwordResetChallengeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  resendAvailableAt: { type: Date, required: true },
  // Counts resend requests after the initial reset code.
  resendsUsed: { type: Number, default: 0, min: 0 },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

passwordResetChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model(
  "PasswordResetChallenge",
  passwordResetChallengeSchema,
);
