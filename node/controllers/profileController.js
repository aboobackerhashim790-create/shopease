import * as profileService from "../services/profileService.js";
import { clearAuthTokens, revokeUserRefreshSessions } from "../utils/jwtAuth.js";

function makeServiceInput(req) {
  return {
    body: req.body || {},
    user: req.user,
    params: req.params || {},
    query: req.query || {},
    file: req.file,
  };
}

export async function updateMyProfile(req, res) {
  const result = await profileService.updateMyProfile(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateProfilePhoto(req, res) {
  const result = await profileService.updateProfilePhoto(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function requestEmailChange(req, res) {
  const result = await profileService.requestEmailChange(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function verifyEmailChange(req, res) {
  const result = await profileService.verifyEmailChange(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function changeMyPassword(req, res) {
  const result = await profileService.changeMyPassword(makeServiceInput(req));
  if (result.status === 200) {
    await revokeUserRefreshSessions(req.user._id);
    clearAuthTokens(res);
  }
  return res.status(result.status).json(result.body);
}

export async function listMyAddresses(req, res) {
  const result = await profileService.listMyAddresses(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getMyWallet(req, res) {
  const result = await profileService.getMyWallet(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function validateAddressPincode(req, res) {
  const result = await profileService.validateAddressPincode(
    makeServiceInput(req),
  );
  return res.status(result.status).json(result.body);
}

export async function createAddress(req, res) {
  const result = await profileService.createAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateAddress(req, res) {
  const result = await profileService.updateAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setDefaultAddress(req, res) {
  const result = await profileService.setDefaultAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteAddress(req, res) {
  const result = await profileService.deleteAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
