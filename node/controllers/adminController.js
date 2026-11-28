import * as adminUserService from "../services/adminUserService.js";
import * as adminCategoryService from "../services/adminCategoryService.js";
import * as adminProductService from "../services/adminProductService.js";
import * as adminOrderService from "../services/adminOrderService.js";
import * as adminCouponService from "../services/adminCouponService.js";
import * as adminOfferCampaignService from "../services/adminOfferCampaignService.js";

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
  const result = await adminUserService.listUsers(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function blockUser(req, res) {
  const result = await adminUserService.blockUser(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getCustomerDetails(req, res) {
  const result = await adminUserService.getCustomerDetails(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function createCategory(req, res) {
  const result = await adminCategoryService.createCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body)
}

export async function listCategory(req, res) {
  const result = await adminCategoryService.listCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body)
}

export async function editCategry(req, res) {
  const result = await adminCategoryService.editCategry(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCategory(req, res) {
  const result = await adminCategoryService.deleteCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setCategoryListing(req, res) {
  const result = await adminCategoryService.setCategoryListing(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listProducts(req, res) {
  const result = await adminProductService.listProducts(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function createProducts(req, res) {
  const result = await adminProductService.createProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function unlistProduct(req, res) {
  const result = await adminProductService.unlistProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteProduct(req, res) {
  const result = await adminProductService.deleteProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateProduct(req, res) {
  const result = await adminProductService.updateProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function uploadProductImages(req, res) {
  const result = await adminProductService.uploadProductImages(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getDashboardSummary(_req, res) {
  const result = await adminOrderService.getDashboardSummary();
  return res.status(result.status).json(result.body);
}

export async function listOrders(req, res) {
  const result = await adminOrderService.listOrders(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getOrder(req, res) {
  const result = await adminOrderService.getOrder(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listReturnRequests(req, res) {
  const result = await adminOrderService.listReturnRequests(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateOrderStatus(req, res) {
  const result = await adminOrderService.updateOrderStatus(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateOrderItemStatus(req, res) {
  const result = await adminOrderService.updateOrderItemStatus(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function reviewReturn(req, res) {
  const result = await adminOrderService.reviewReturn(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listCoupons(req, res) {
  const result = await adminCouponService.listCoupons(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCoupon(req, res) {
  const result = await adminCouponService.deleteCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function createCoupon(req, res) {
  const result = await adminCouponService.createCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateCoupon(req, res) {
  const result = await adminCouponService.updateCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setCouponActive(req, res) {
  const result = await adminCouponService.setCouponActive(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listOfferCampaigns(_req, res) {
  const result = await adminOfferCampaignService.listOfferCampaigns();
  return res.status(result.status).json(result.body);
}

export async function createOfferCampaign(req, res) {
  const result = await adminOfferCampaignService.createOfferCampaign(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateOfferCampaign(req, res) {
  const result = await adminOfferCampaignService.updateOfferCampaign(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setOfferCampaignActive(req, res) {
  const result = await adminOfferCampaignService.setOfferCampaignActive(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
