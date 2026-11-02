import { rateLimit } from "express-rate-limit";

const makeLimiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message },
  });

export const loginLimiter = makeLimiter(
  10,
  "Too many sign-in attempts. Please try again in 15 minutes.",
);
export const signupLimiter = makeLimiter(
  8,
  "Too many signup attempts. Please try again in 15 minutes.",
);
export const otpLimiter = makeLimiter(
  8,
  "Too many verification requests. Please try again in 15 minutes.",
);
