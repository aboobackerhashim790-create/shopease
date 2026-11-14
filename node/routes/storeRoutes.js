import express from "express";
import {
  getProductDetails,
  listCategories,
  listProducts,
} from "../controllers/storeController.js";
import {
  addCartItem,
  addWishlistItem,
  getCart,
  getWishlist,
  removeCartItem,
  removeWishlistItem,
  updateCartItem,
  validateCheckout,
  getCheckoutSummary,
  placeCodOrder,
  placeWalletOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  markRazorpayPaymentFailed,
  markRazorpayPaymentCancelled,
  convertRazorpayOrderToCod,
  validateStoreCoupon,
  listAvailableStoreCoupons,
} from "../controllers/shopperController.js";
import {
  requireActiveCustomer,
  requireSignedIn,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/categories", listCategories);
router.get("/products", listProducts);
router.get("/products/:slug", getProductDetails);

router.use(requireSignedIn, requireActiveCustomer);
router.get("/cart", getCart);
router.post("/cart/items", addCartItem);
router.patch("/cart/items/:itemId", updateCartItem);
router.delete("/cart/items/:itemId", removeCartItem);
router.get("/checkout", getCheckoutSummary);
router.get("/coupons/available", listAvailableStoreCoupons);
router.post("/coupons/validate", validateStoreCoupon);
router.post("/checkout/validate", validateCheckout);
router.post("/orders/cod", placeCodOrder);
router.post("/orders/wallet", placeWalletOrder);
router.post("/orders/razorpay", createRazorpayOrder);
router.post("/orders/razorpay/verify", verifyRazorpayPayment);
router.post("/orders/razorpay/failed", markRazorpayPaymentFailed);
router.post("/orders/razorpay/cancelled", markRazorpayPaymentCancelled);
router.post("/orders/razorpay/convert-to-cod", convertRazorpayOrderToCod);
router.get("/wishlist", getWishlist);
router.post("/wishlist/items/:productId", addWishlistItem);
router.delete("/wishlist/items/:productId", removeWishlistItem);

export default router;
