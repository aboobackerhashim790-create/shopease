import * as supportService from "../services/supportService.js";
import * as adminSupportService from "../services/adminSupportService.js";

function makeServiceInput(req) {
  return { body: req.body || {}, user: req.user, params: req.params || {}, query: req.query || {} };
}

export async function createSupportRequest(req, res) {
  const result = await supportService.createSupportRequest(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listMySupportRequests(req, res) {
  const result = await supportService.listMySupportRequests(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listSupportRequests(req, res) {
  const result = await adminSupportService.listSupportRequests(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateSupportRequestStatus(req, res) {
  const result = await adminSupportService.updateSupportRequestStatus(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
