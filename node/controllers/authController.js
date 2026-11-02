import * as authService from "../services/authService.js";
import { issueAuthToken, clearAuthToken } from "../utils/jwtAuth.js";

function makeServiceInput(req) {
  return {
    body: req.body || {},
    user: req.user,
    params: req.params || {},
    query: req.query || {},
    file: req.file,
  };
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
  if (result.authUserId) issueAuthToken(res, result.authUserId);
  return res.status(result.status).json(result.body);
}

export function logout(_req, res) {
  clearAuthToken(res);
  return res.status(200).json({ message: "You have been signed out." });
}

export async function googleLogin(req, res) {
  const result = await authService.googleLogin(makeServiceInput(req));
  if (result.authUserId) issueAuthToken(res, result.authUserId);
  return res.status(result.status).json(result.body);
}

export async function requestPasswordReset(req, res) {
  const result = await authService.requestPasswordReset(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
