import { randomInt, timingSafeEqual } from "crypto";
import validator from "validator";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import PendingSignup from "../models/PendingSignup.js";
import PasswordResetChallenge from "../models/PasswordResetChallenge.js";
import { sendEmailMessage } from "../config/mailer.js";
import googleClient from "../config/google.js";
import { hashVerificationCode } from "../utils/verificationCode.js";

function generatePersonalReferralCode() {
  return String(randomInt(100000, 1000000));
}

async function createUniquePersonalReferralCode() {
  let code;
  do {
    code = generatePersonalReferralCode();
  } while (
    await User.exists({
      personalReferralCode: code,
    })
  );
  return code;
}

async function resendVerification(input) {
  try {
    const email =
      typeof input.body?.email === "string"
        ? input.body.email.trim().toLowerCase()
        : "";
    if (!email) {
      return {
        status: 400,
        body: {
          message: "Email is required.",
        },
        authUserId: input.authUserId,
      };
    }
    const pendingSignup = await PendingSignup.findOne({
      email,
      expiresAt: {
        $gt: new Date(),
      },
    });
    if (!pendingSignup) {
      return {
        status: 409,
        body: {
          message:
            "This signup request has expired or could not be found. Go back to signup and submit your details again.",
        },
        authUserId: input.authUserId,
      };
    }
    const now = new Date();
    const availableAt = pendingSignup.resendAvailableAt;
    if (availableAt && availableAt > now) {
      const retryAfterSeconds = Math.ceil((availableAt - now) / 1000);
      return {
        status: 429,
        body: {
          message: "Please wait before requesting another code.",
          retryAfterSeconds,
          remainingResends: Math.max(0, 3 - (pendingSignup.resendsUsed || 0)),
        },
        authUserId: input.authUserId,
      };
    }
    if ((pendingSignup.resendsUsed || 0) >= 3) {
      return {
        status: 429,
        body: {
          message:
            "You have used all 3 resend attempts. Please restart signup to get a new code.",
          remainingResends: 0,
        },
        authUserId: input.authUserId,
      };
    }
    const code = String(randomInt(100000, 1000000));
    await sendEmailMessage({
      to: email,
      subject: "Your new ShopEase verification code",
      text: `Your new verification code is ${code}. It expires in 10 minutes.`,
    });
    pendingSignup.verificationCodeHash = hashVerificationCode(code);
    pendingSignup.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    pendingSignup.resendAvailableAt = new Date(Date.now() + 60 * 1000);
    pendingSignup.resendsUsed = (pendingSignup.resendsUsed || 0) + 1;
    await pendingSignup.save();
    return {
      status: 200,
      body: {
        message: "A new verification code has been sent.",
        retryAfterSeconds: 60,
        remainingResends: Math.max(0, 3 - pendingSignup.resendsUsed),
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error('Resend verification code error:', error);
    return {
      status: 500,
      body: {
        message: "Could not resend the verification code.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function getCurrentUser(input) {
  try {
    const user = input.user;
    if (!user) {
      return {
        status: 401,
        body: {
          message: "Not signed in.",
        },
        authUserId: input.authUserId,
      };
    }
    return {
      status: 200,
      body: {
        user,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Authentication check error:", error);
    return {
      status: 500,
      body: {
        message: "Could not check session.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function signup(input) {
  let normalizedEmail;
  try {
    const { fullName, email, referralCode, password } = input.body || {};
    const requiredFieldErrors = {};
    if (typeof fullName !== "string" || !fullName.trim()) {
      requiredFieldErrors.fullName = "Full name is required.";
    }
    if (typeof email !== "string" || !email.trim()) {
      requiredFieldErrors.email = "Email address is required.";
    }
    if (typeof password !== "string" || !password) {
      requiredFieldErrors.password = "Password is required.";
    }
    if (Object.keys(requiredFieldErrors).length > 0) {
      return {
        status: 400,
        body: {
          message: "Full name, email, and password are required.",
          fieldErrors: requiredFieldErrors,
        },
        authUserId: input.authUserId,
      };
    }
    const normalizedFullName = fullName.trim().replace(/\s+/g, " ");
    const validNamePattern = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;
    if (
      !validator.isLength(normalizedFullName, { min: 2, max: 100 }) ||
      !validNamePattern.test(normalizedFullName)
    ) {
      return {
        status: 400,
        body: {
          message:
            "Enter a valid full name using letters and normal name separators only.",
          fieldErrors: { fullName: "Enter a valid full name using letters and normal name separators only." },
        },
        authUserId: input.authUserId,
      };
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

    if (password.length < 8 || !hasLetter || !hasNumber || !hasSpecial) {
      const message =
        password.length < 8
          ? "Password must be at least 8 characters."
          : !hasLetter
            ? "Password must contain at least one letter."
            : !hasNumber
              ? "Password must contain at least one number."
              : "Password must contain at least one punctuation or special character.";

      return {
        status: 400,
        body: {
          message,
          fieldErrors: { password: message },
        },
        authUserId: input.authUserId,
      };
    }
    normalizedEmail = email.trim().toLowerCase();
    if (!validator.isEmail(normalizedEmail)) {
      return {
        status: 400,
        body: {
          message: "Enter a valid email address.",
          fieldErrors: { email: "Enter a valid email address." },
        },
        authUserId: input.authUserId,
      };
    }
    if (normalizedEmail.endsWith("@gmail.com")) {
      const gmailUsername = normalizedEmail.slice(0, -"@gmail.com".length);
      if (gmailUsername.length < 6 || gmailUsername.length > 30) {
        return {
          status: 400,
          body: {
            message: "For Gmail addresses, the username before @gmail.com must be 6–30 characters.",
            fieldErrors: { email: "Gmail usernames must be 6–30 characters before @gmail.com." },
          },
          authUserId: input.authUserId,
        };
      }
    }
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });
    if (existingUser) {
      return {
        status: 409,
        body: {
          message: "An account with that email already exists. Please sign in.",
          fieldErrors: { email: "This email is already registered. Please sign in." },
        },
        authUserId: input.authUserId,
      };
    }
    const trimmedReferralCode = typeof referralCode === "string" ? referralCode.trim() : "";
    if (trimmedReferralCode) {
      const referrerExists = await User.exists({
        personalReferralCode: trimmedReferralCode,
      });
      if (!referrerExists) {
        return {
          status: 400,
          body: {
            message: "The referral code entered does not exist.",
            fieldErrors: { referralCode: "Invalid referral code. Please check or leave empty." },
          },
          authUserId: input.authUserId,
        };
      }
    }
    const existingPendingSignup = await PendingSignup.findOne({
      email: normalizedEmail,
      expiresAt: {
        $gt: new Date(),
      },
    });
    if (existingPendingSignup) {
      return {
        status: 409,
        body: {
          message: "Signup is already started. Continue email verification.",
          needsVerification: true,
          email: normalizedEmail,
        },
        authUserId: input.authUserId,
      };
    }
    const code = String(randomInt(100000, 1000000));
    const passwordHash = await bcrypt.hash(password, 12);
    await PendingSignup.findOneAndUpdate(
      {
        email: normalizedEmail,
      },
      {
        fullName: normalizedFullName,
        email: normalizedEmail,
        referralCode:
          typeof referralCode === "string" ? referralCode.trim() : "",
        passwordHash,
        verificationCodeHash: hashVerificationCode(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        resendAvailableAt: new Date(Date.now() + 60 * 1000),
        resendsUsed: 0,
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      },
    );
    try {
      await sendEmailMessage({
        to: normalizedEmail,
        subject: "Your ShopEase verification code",
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
      });
    } catch (mailError) {
      if (normalizedEmail) {
        await PendingSignup.deleteOne({ email: normalizedEmail });
      }
      console.error("Email send failed:", mailError);
      return {
        status: 500,
        body: {
          message: `Email sending failed: ${mailError.message}`,
        },
        authUserId: input.authUserId,
      };
    }
    return {
      status: 201,
      body: {
        message: "Check your email for the verification code.",
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    if (normalizedEmail) {
      await PendingSignup.deleteOne({
        email: normalizedEmail,
      });
    }
    if (error.code === 11000) {
      return {
        status: 409,
        body: {
          message:
            "An account or pending signup with that email already exists.",
          fieldErrors: { email: "This email is already registered or has a pending signup." },
        },
        authUserId: input.authUserId,
      };
    }
    console.error("Sign-up error:", error);
    return {
      status: 500,
      body: {
        message: error.message || "Could not start signup or send the verification email.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function verifyEmail(input) {
  try {
    const { email, code } = input.body || {};
    if (
      typeof email !== "string" ||
      !email.trim() ||
      !/^\d{6}$/.test(String(code))
    ) {
      return {
        status: 400,
        body: {
          message: "Enter your email and the 6-digit code.",
        },
        authUserId: input.authUserId,
      };
    }
    const normalizedEmail = email.trim().toLowerCase();
    const pendingSignup = await PendingSignup.findOne({
      email: normalizedEmail,
    });
    if (!pendingSignup || pendingSignup.expiresAt < new Date()) {
      return {
        status: 400,
        body: {
          message: "Invalid or expired code. Request a new one.",
        },
        authUserId: input.authUserId,
      };
    }
    const submittedHash = Buffer.from(
      hashVerificationCode(String(code)),
      "hex",
    );
    const savedHash = Buffer.from(pendingSignup.verificationCodeHash, "hex");
    if (
      submittedHash.length !== savedHash.length ||
      !timingSafeEqual(submittedHash, savedHash)
    ) {
      return {
        status: 400,
        body: {
          message: "Invalid or expired code.",
        },
        authUserId: input.authUserId,
      };
    }

    // The permanent User document is created only after OTP verification.
    const newUser = await User.create({
      fullName: pendingSignup.fullName,
      email: pendingSignup.email,
      referralCode: pendingSignup.referralCode,
      personalReferralCode: await createUniquePersonalReferralCode(),
      passwordHash: pendingSignup.passwordHash,
      isVerified: true,
    });

    let initialBalance = 0;
    const initialTransactions = [];

    if (pendingSignup.referralCode) {
      const referrer = await User.findOne({
        personalReferralCode: pendingSignup.referralCode,
      });

      if (referrer && String(referrer._id) !== String(newUser._id)) {
        // 1. Credit ₹5 to the new user who used the referral code
        initialBalance = 5;
        initialTransactions.push({
          type: "Credit",
          amount: 5,
          description: `Referral signup reward (Referred by ${referrer.fullName || "friend"})`,
          createdAt: new Date(),
        });

        // 2. Also reward the referrer with ₹5 in their wallet
        await Wallet.findOneAndUpdate(
          { userId: referrer._id },
          {
            $inc: { balance: 5 },
            $push: {
              transactions: {
                type: "Credit",
                amount: 5,
                description: `Referral bonus (Referred ${newUser.fullName || "new user"})`,
                createdAt: new Date(),
              },
            },
          },
          { upsert: true, new: true },
        );
      }
    }

    // Initialize the new user's wallet
    await Wallet.create({
      userId: newUser._id,
      balance: initialBalance,
      transactions: initialTransactions,
    });

    await PendingSignup.deleteOne({
      _id: pendingSignup._id,
    });
    return {
      status: 200,
      body: {
        message: "Email verified. You can sign in.",
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    if (error.code === 11000) {
      return {
        status: 409,
        body: {
          message: "An account with this email already exists. Please sign in.",
        },
        authUserId: input.authUserId,
      };
    }
    console.error("Email verification error:", error);
    return {
      status: 500,
      body: {
        message: "Could not verify your email.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function login(input) {
  try {
    const { email, password } = input.body || {};
    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return {
        status: 400,
        body: {
          message: "Email and password are required.",
        },
        authUserId: input.authUserId,
      };
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: normalizedEmail,
    });
    if (!user || !user.passwordHash) {
      return {
        status: 401,
        body: {
          message: "Invalid email or password.",
        },
        authUserId: input.authUserId,
      };
    }
    const now = new Date();

    // Stop login attempts while the 5-hour lock is active.
    if (user.lockedUntil && user.lockedUntil > now) {
      return {
        status: 429,
        body: {
          message: "Too many failed attempts. Please try again later.",
        },
        authUserId: input.authUserId,
      };
    }

    // Reset the count once the lock has expired.
    if (user.lockedUntil && user.lockedUntil <= now) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }
    const passwordIsCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!passwordIsCorrect) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 3) {
        user.lockedUntil = new Date(Date.now() + 5 * 60 * 60 * 1000);
        await user.save();
        return {
          status: 429,
          body: {
            message: "Too many failed attempts. Please try again later.",
          },
          authUserId: input.authUserId,
        };
      }
      await user.save();
      return {
        status: 401,
        body: {
          message: "Invalid email or password.",
        },
        authUserId: input.authUserId,
      };
    }

    // Correct password: clear the failed-attempt count.
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();
    if (!user.isVerified) {
      return {
        status: 403,
        body: {
          message: "Please verify your email first.",
        },
        authUserId: input.authUserId,
      };
    }
    if (user.role === "customer" && user.isBlocked) {
      return {
        status: 403,
        body: {
          message: "This account is blocked.",
        },
        authUserId: input.authUserId,
      };
    }
    input.authUserId = user._id;
    return {
      status: 200,
      body: {
        message: "Login successful.",
        user: {
          role: user.role,
        },
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      status: 500,
      body: {
        message: "Something went wrong.",
      },
      authUserId: input.authUserId,
    };
  }
}


async function googleLogin(input) {
  try {
    const { credential } = input.body || {};
    if (!credential) {
      return {
        status: 400,
        body: {
          message: "Google credential is required.",
        },
        authUserId: input.authUserId,
      };
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const googleUser = ticket.getPayload();
    if (!googleUser?.sub || !googleUser.email || !googleUser.email_verified) {
      return {
        status: 401,
        body: {
          message: "Google account could not be verified.",
        },
        authUserId: input.authUserId,
      };
    }
    let user = await User.findOne({
      googleId: googleUser.sub,
    });
    if (!user) {
      const email = googleUser.email.toLowerCase();
      const existingEmailUser = await User.findOne({
        email,
      });
      if (existingEmailUser) {
        return {
          status: 409,
          body: {
            message:
              "An account with this email already exists. Sign in to that account first.",
          },
          authUserId: input.authUserId,
        };
      }
      user = await User.create({
        fullName: googleUser.name || email,
        email,
        googleId: googleUser.sub,
        isVerified: true,
        personalReferralCode: await createUniquePersonalReferralCode(),
      });
      await Wallet.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { balance: 0, transactions: [] } },
        { upsert: true },
      );
    }
    if (user.role === "customer" && user.isBlocked) {
      return {
        status: 403,
        body: {
          message: "This account is blocked.",
        },
        authUserId: input.authUserId,
      };
    }
    input.authUserId = user._id;
    return {
      status: 200,
      body: {
        message: "Google sign-in successful.",
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Google sign-in error:", error);
    return {
      status: 401,
      body: {
        message: "Google sign-in could not be verified.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function requestPasswordReset(input) {
  try {
    const email =
      typeof input.body?.email === "string"
        ? input.body.email.trim().toLowerCase()
        : "";
    if (!email)
      return {
        status: 400,
        body: {
          message: "Email is required.",
        },
        authUserId: input.authUserId,
      };
    const genericMessage =
      "If an account exists for that email, a reset code has been sent.";
    const user = await User.findOne({
      email,
      isVerified: true,
    });
    if (!user)
      return {
        status: 404,
        body: {
          message: "No verified account was found for this email address.",
        },
        authUserId: input.authUserId,
      };
    const currentChallenge = await PasswordResetChallenge.findOne({
      user: user._id,
      expiresAt: {
        $gt: new Date(),
      },
    }).sort({
      createdAt: -1,
    });
    if (currentChallenge?.resendAvailableAt > new Date()) {
      return {
        status: 429,
        body: {
          message: "Please wait a minute before requesting another code.",
          retryAfterSeconds: Math.ceil(
            (currentChallenge.resendAvailableAt - new Date()) / 1000,
          ),
          remainingResends: Math.max(
            0,
            3 - (currentChallenge.resendsUsed || 0),
          ),
        },
        authUserId: input.authUserId,
      };
    }
    if (currentChallenge && (currentChallenge.resendsUsed || 0) >= 3) {
      return {
        status: 429,
        body: {
          message:
            "You have used all 3 reset-code resend attempts. Please try again later.",
          remainingResends: 0,
        },
        authUserId: input.authUserId,
      };
    }
    const code = String(randomInt(100000, 1000000));
    await sendEmailMessage({
      to: email,
      subject: "Your ShopEase password reset code",
      text: `Your password reset code is ${code}. It expires in 10 minutes.`,
    });

    if (currentChallenge) {
      currentChallenge.codeHash = hashVerificationCode(code);
      currentChallenge.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      currentChallenge.resendAvailableAt = new Date(Date.now() + 60 * 1000);
      currentChallenge.resendsUsed = (currentChallenge.resendsUsed || 0) + 1;
      currentChallenge.attempts = 0;
      await currentChallenge.save();
    } else {
      await PasswordResetChallenge.create({
        user: user._id,
        codeHash: hashVerificationCode(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        resendAvailableAt: new Date(Date.now() + 60 * 1000),
        resendsUsed: 0,
      });
    }
    return {
      status: 200,
      body: {
        message: genericMessage,
        retryAfterSeconds: 60,
        remainingResends: currentChallenge
          ? Math.max(0, 3 - (currentChallenge.resendsUsed || 0))
          : 3,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Request password reset error:", {
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
    });
    return {
      status: 500,
      body: {
        message: "Could not send a reset code right now.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function resetPassword(input) {
  try {
    const email =
      typeof input.body?.email === "string"
        ? input.body.email.trim().toLowerCase()
        : "";
    const code = String(input.body?.code || "");
    const newPassword =
      typeof input.body?.newPassword === "string" ? input.body.newPassword : "";
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword);
    if (!email || !/^\d{6}$/.test(code) || newPassword.length < 8 || !hasLetter || !hasNumber || !hasSpecial) {
      return {
        status: 400,
        body: {
          message:
            !email || !/^\d{6}$/.test(code)
              ? "Enter your email and the 6-digit code."
              : newPassword.length < 8
                ? "Password must be at least 8 characters."
                : !hasLetter
                  ? "Password must contain at least one letter."
                  : !hasNumber
                    ? "Password must contain at least one number."
                    : "Password must contain at least one punctuation or special character.",
        },
        authUserId: input.authUserId,
      };
    }
    const user = await User.findOne({
      email,
      isVerified: true,
    });
    if (!user)
      return {
        status: 400,
        body: {
          message: "Invalid or expired reset code.",
        },
        authUserId: input.authUserId,
      };
    const challenge = await PasswordResetChallenge.findOne({
      user: user._id,
      expiresAt: {
        $gt: new Date(),
      },
    }).sort({
      createdAt: -1,
    });
    if (!challenge)
      return {
        status: 400,
        body: {
          message: "Invalid or expired reset code.",
        },
        authUserId: input.authUserId,
      };
    const submittedHash = Buffer.from(hashVerificationCode(code), "hex");
    const savedHash = Buffer.from(challenge.codeHash, "hex");
    if (
      submittedHash.length !== savedHash.length ||
      !timingSafeEqual(submittedHash, savedHash)
    ) {
      challenge.attempts += 1;
      if (challenge.attempts >= 5) await challenge.deleteOne();
      else await challenge.save();
      return {
        status: 400,
        body: {
          message:
            challenge.attempts >= 5
              ? "Too many incorrect attempts. Request a new code."
              : "Invalid or expired reset code.",
        },
        authUserId: input.authUserId,
      };
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    await PasswordResetChallenge.deleteMany({
      user: user._id,
    });
    return {
      status: 200,
      body: {
        message: "Password reset successfully. You can now sign in.",
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Reset password error:", error);
    return {
      status: 500,
      body: {
        message: "Could not reset your password.",
      },
      authUserId: input.authUserId,
    };
  }
}

export {
  resendVerification,
  getCurrentUser,
  signup,
  verifyEmail,
  login,
  googleLogin,
  requestPasswordReset,
  resetPassword,
};
