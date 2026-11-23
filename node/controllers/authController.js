import * as authService from "../services/authService.js";
import User from "../models/User.js";
import RefreshSession from "../models/RefreshSession.js";
import {
  REFRESH_COOKIE,
  clearAuthTokens,
  hashRefreshToken,
  issueAuthTokens,
  revokeUserRefreshSessions,
} from "../utils/jwtAuth.js";

function makeServiceInput(req) {
  return {
    body: req.body || {},
    user: req.user,
    params: req.params || {},
    query: req.query || {},
    file: req.file,
  };
}

function hasTrustedBrowserOrigin(req) {
  const origin = req.get("origin");
  // Non-browser clients such as Postman may omit Origin.
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, "");
  const configuredClientUrl = (process.env.CLIENT_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
  return normalized === configuredClientUrl ||
    normalized === "http://localhost:5173" ||
    normalized === "http://localhost:3000" ||
    normalized.endsWith(".vercel.app");
}

export async function resendVerification(req, res) {
  const result = await authService.resendVerification(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getCurrentUser(req, res) {
  const result = await authService.getCurrentUser(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function signup(req, res) {
  const result = await authService.signup(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function verifyEmail(req, res) {
  const result = await authService.verifyEmail(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function login(req, res) {
  const result = await authService.login(makeServiceInput(req));
  if (result.authUserId) await issueAuthTokens(res, result.authUserId);
  return res.status(result.status).json(result.body);
}

export async function refresh(req, res) {
  if (!hasTrustedBrowserOrigin(req)) {
    return res.status(403).json({ message: "This origin cannot refresh your session." });
  }
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) {
    clearAuthTokens(res);
    return res.status(401).json({ message: "Please sign in again." });
  }

  try {
    const tokenHash = hashRefreshToken(rawToken);
    const session = await RefreshSession.findOne({ tokenHash });
    if (!session || session.expiresAt <= new Date()) {
      clearAuthTokens(res);
      return res.status(401).json({ message: "Please sign in again." });
    }

    if (session.revokedAt) {
      await RefreshSession.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      clearAuthTokens(res);
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    const consumed = await RefreshSession.findOneAndUpdate(
      { _id: session._id, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { revokedAt: new Date() } },
      { new: false },
    );
    if (!consumed) {
      await RefreshSession.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      clearAuthTokens(res);
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    const user = await User.findById(session.userId).select("_id role isBlocked");
    if (!user || (user.role === "customer" && user.isBlocked)) {
      await revokeUserRefreshSessions(session.userId);
      clearAuthTokens(res);
      return res.status(401).json({ message: "Please sign in again." });
    }

    await issueAuthTokens(res, user._id, session.familyId);
    return res.status(200).json({ message: "Session refreshed." });
  } catch (error) {
    console.error("Refresh token error:", error);
    clearAuthTokens(res);
    return res.status(500).json({ message: "Could not refresh your session." });
  }
}

export async function logout(req, res) {
  if (!hasTrustedBrowserOrigin(req)) {
    return res.status(403).json({ message: "This origin cannot sign you out." });
  }
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) {
    try {
      await RefreshSession.updateOne(
        { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    } catch (error) {
      console.error("Logout session revocation error:", error);
    }
  }
  clearAuthTokens(res);
  return res.status(200).json({ message: "You have been signed out." });
}

export async function googleLogin(req, res) {
  const result = await authService.googleLogin(makeServiceInput(req));
  if (result.authUserId) await issueAuthTokens(res, result.authUserId);
  return res.status(result.status).json(result.body);
}

export async function requestPasswordReset(req, res) {
  const result = await authService.requestPasswordReset(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword(makeServiceInput(req));
  if (result.status === 200 && typeof req.body?.email === "string") {
    const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select("_id");
    if (user) await revokeUserRefreshSessions(user._id);
  }
  return res.status(result.status).json(result.body);
}
