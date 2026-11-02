import User from "../models/User.js";
import { TOKEN_COOKIE, verifyAuthToken } from "../utils/jwtAuth.js";

async function requireSignedIn(req, res, next) {
  try {
    const token = req.cookies?.[TOKEN_COOKIE];
    if (!token) {
      return res.status(401).json({ message: "Please sign in." });
    }

    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      return res.status(401).json({ message: "Please sign in." });
    }

    const user = await User.findById(payload.sub).select(
      "fullName email role isBlocked personalReferralCode profilePhotoUrl",
    );

    if (!user) {
      return res.status(401).json({ message: "Please sign in." });
    }
    if (user.role === "customer" && user.isBlocked) {
      return res.status(403).json({ message: "This account is blocked." });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Sign-in check error:", error);
    return res.status(500).json({
      message: "Could not check your account.",
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  return next();
}

function requireActiveCustomer(req, res, next) {
  if (req.user.role !== "customer") {
    return res.status(403).json({
      message: "Customer access required.",
    });
  }

  if (req.user.isBlocked) {
    return res.status(403).json({
      message: "This account is blocked.",
    });
  }

  return next();
}

export { requireSignedIn, requireAdmin, requireActiveCustomer };
