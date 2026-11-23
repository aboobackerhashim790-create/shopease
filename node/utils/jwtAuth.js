import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import RefreshSession from "../models/RefreshSession.js";

const TOKEN_COOKIE = "shopease.token";
const REFRESH_COOKIE = "shopease.refresh";
const ACCESS_LIFETIME_SECONDS = 15 * 60;
const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(maxAge, path = "/") {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path,
    maxAge,
  };
}

function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function issueAuthTokens(res, userId, familyId = randomUUID()) {
  const accessToken = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId.toString(),
    expiresIn: ACCESS_LIFETIME_SECONDS,
  });
  const refreshToken = randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_LIFETIME_MS);

  await RefreshSession.create({
    userId,
    familyId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  });

  res.cookie(TOKEN_COOKIE, accessToken, cookieOptions(ACCESS_LIFETIME_SECONDS * 1000));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_LIFETIME_MS, "/api/auth"));
}

async function revokeUserRefreshSessions(userId) {
  await RefreshSession.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

function clearAuthTokens(res) {
  const accessOptions = cookieOptions(0);
  delete accessOptions.maxAge;
  const refreshOptions = cookieOptions(0, "/api/auth");
  delete refreshOptions.maxAge;
  res.clearCookie(TOKEN_COOKIE, accessOptions);
  res.clearCookie(REFRESH_COOKIE, refreshOptions);
}

function verifyAuthToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
}

export {
  TOKEN_COOKIE,
  REFRESH_COOKIE,
  issueAuthTokens,
  revokeUserRefreshSessions,
  clearAuthTokens,
  hashRefreshToken,
  REFRESH_LIFETIME_MS,
  verifyAuthToken,
};
