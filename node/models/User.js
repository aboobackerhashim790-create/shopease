import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
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
      trim: true,
      default: "",
    },
    passwordHash: {
      type: String,
      required: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    personalReferralCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    profilePhotoUrl: { type: String, default: "" },
    profilePhotoPublicId: { type: String, default: "" },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    verificationCodeHash: String,
    verificationCodeExpiresAt: Date,
    verificationResendAvailableAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
