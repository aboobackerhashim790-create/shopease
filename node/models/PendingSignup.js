import mongoose from "mongoose";

const pendingSignupSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  referralCode: {
    type: String,
    default: "",
  },
  passwordHash: {
    type: String,
    required: true,
  },
  verificationCodeHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  resendAvailableAt: Date,
  resendsUsed: {
    type: Number,
    default: 0,
    min: 0,
  },
});

pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PendingSignup", pendingSignupSchema);
