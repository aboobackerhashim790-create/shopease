import express from "express";
import {
  listUsers,
  blockUser,
  getCustomerDetails,
  createCategory,
  listCategory,
  editCategry,
  deleteCategory,
  setCategoryListing,
  createProducts,
  listProducts,
  unlistProduct,
  deleteProduct,
  updateProduct,
  uploadProductImages,
  getDashboardSummary,
  listOrders,
  getOrder,
  updateOrderStatus,
  updateOrderItemStatus,
  reviewReturn,
  listCoupons,
  createCoupon,
  updateCoupon,
  setCouponActive,
  listOfferCampaigns,
  createOfferCampaign,
  updateOfferCampaign,
  setOfferCampaignActive,
} from "../controllers/adminController.js";
import { requireSignedIn, requireAdmin } from "../middleware/authMiddleware.js";
import uploadProductImageFiles from "../middleware/productImageUpload.js";
import { listSupportRequests, updateSupportRequestStatus } from "../controllers/supportController.js";

const router = express.Router();

router.get("/dashboard", requireSignedIn, requireAdmin, getDashboardSummary);
router.get("/support", requireSignedIn, requireAdmin, listSupportRequests);
router.patch("/support/:requestId/status", requireSignedIn, requireAdmin, updateSupportRequestStatus);

router.get("/users", requireSignedIn, requireAdmin, listUsers);
router.get("/users/:userId", requireSignedIn, requireAdmin, getCustomerDetails);
router.patch("/users/:userId/block", requireSignedIn, requireAdmin, blockUser);
router.post("/category", requireSignedIn, requireAdmin, createCategory);
router.get("/category", requireSignedIn, requireAdmin, listCategory);
router.patch("/category", requireSignedIn, requireAdmin, editCategry);
router.delete(
  "/category/:categoryId",
  requireSignedIn,
  requireAdmin,
  deleteCategory,
);
router.patch(
  "/category/:categoryId/listing",
  requireSignedIn,
  requireAdmin,
  setCategoryListing,
);

//-----------------product management routers-------------------------------------//
router.get("/products", requireSignedIn, requireAdmin, listProducts);
router.post("/products", requireSignedIn, requireAdmin, createProducts)
router.post(
  "/products/images",
  requireSignedIn,
  requireAdmin,
  uploadProductImageFiles.array("images", 5),
  uploadProductImages,
);


router.patch(
  "/products/:productId/unlist",
  requireSignedIn,
  requireAdmin,
  unlistProduct,
);

router.delete(
  "/products/:productId",
  requireSignedIn,
  requireAdmin,
  deleteProduct,
);

router.patch(
  "/products/:productId",
  requireSignedIn,
  requireAdmin,
  updateProduct,
);
router.get("/orders", requireSignedIn, requireAdmin, listOrders);
router.get("/orders/:orderId", requireSignedIn, requireAdmin, getOrder);
router.patch("/orders/:orderId/status", requireSignedIn, requireAdmin, updateOrderStatus);
router.patch("/orders/:orderId/items/:itemIndex/status", requireSignedIn, requireAdmin, updateOrderItemStatus);
router.patch("/orders/:orderId/return", requireSignedIn, requireAdmin, reviewReturn);
router.get("/coupons", requireSignedIn, requireAdmin, listCoupons);
router.post("/coupons", requireSignedIn, requireAdmin, createCoupon);
router.patch("/coupons/:couponId", requireSignedIn, requireAdmin, updateCoupon);
router.patch("/coupons/:couponId/active", requireSignedIn, requireAdmin, setCouponActive);
router.get("/offer-campaigns", requireSignedIn, requireAdmin, listOfferCampaigns);
router.post("/offer-campaigns", requireSignedIn, requireAdmin, createOfferCampaign);
router.patch("/offer-campaigns/:campaignId", requireSignedIn, requireAdmin, updateOfferCampaign);
router.patch("/offer-campaigns/:campaignId/active", requireSignedIn, requireAdmin, setOfferCampaignActive);
export default router;
