import express from "express";
import { requireSignedIn } from "../middleware/authMiddleware.js";
import {
  loginLimiter,
  signupLimiter,
  otpLimiter,
} from "../middleware/rateLimiters.js";
import {
  resendVerification,
  getCurrentUser,
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  googleLogin,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();
router.get("/me", requireSignedIn, getCurrentUser);
router.post("/resend-verification", otpLimiter, resendVerification);
router.post("/signup", signupLimiter, signup);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/google", loginLimiter, googleLogin);
router.post("/forgot-password", otpLimiter, requestPasswordReset);
router.post("/reset-password", otpLimiter, resetPassword);

export default router;
