import * as adminService from "../services/adminService.js";

function makeServiceInput(req) {
  return {
    body: req.body || {},
    user: req.user,
    params: req.params || {},
    query: req.query || {},
    file: req.file,
    files: req.files,
  };
}

export async function listUsers(req, res) {
  const result = await adminService.listUsers(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function blockUser(req, res) {
  const result = await adminService.blockUser(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getCustomerDetails(req, res) {
  const result = await adminService.getCustomerDetails(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function createCategory(req, res) {
  const result = await adminService.createCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body)
}

export async function listCategory(req, res) {
  const result = await adminService.listCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body)
}

export async function editCategry(req, res) {
  const result = await adminService.editCategry(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCategory(req, res) {
  const result = await adminService.deleteCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listProducts(req, res) {
  const result = await adminService.listProducts(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function createProducts(req, res) {
  const result = await adminService.createProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function unlistProduct(req, res) {
  const result = await adminService.unlistProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteProduct(req, res) {
  const result = await adminService.deleteProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateProduct(req, res) {
  const result = await adminService.updateProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function uploadProductImages(req, res) {
  const result = await adminService.uploadProductImages(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
