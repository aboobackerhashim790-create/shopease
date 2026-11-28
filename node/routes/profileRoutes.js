import express from "express";
import {
  updateMyProfile,
  updateProfilePhoto,
  requestEmailChange,
  verifyEmailChange,
  changeMyPassword,
  listMyAddresses,
  getMyWallet,
  validateAddressPincode,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../controllers/profileController.js";
import {
  requireSignedIn,
  requireActiveCustomer,
} from "../middleware/authMiddleware.js";
import uploadProfileImage from "../middleware/profileImageUpload.js";
import uploadReturnEvidence from "../middleware/returnEvidenceUpload.js";
import { otpLimiter } from "../middleware/rateLimiters.js";
import {
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
  requestMyOrderReturn,
  cancelMyOrderItem
} from "../controllers/customerOrderController.js";
import { createSupportRequest, listMySupportRequests } from "../controllers/supportController.js";

const router = express.Router();
router.use(requireSignedIn, requireActiveCustomer);
router.patch("/me", updateMyProfile);
router.post("/photo", uploadProfileImage.single("photo"), updateProfilePhoto);
router.post("/email-change/request", otpLimiter, requestEmailChange);
router.post("/email-change/verify", otpLimiter, verifyEmailChange);
router.patch("/password", changeMyPassword);
router.get("/addresses", listMyAddresses);
router.get("/wallet", getMyWallet);
router.get("/addresses/pincode/:postalCode", validateAddressPincode);
router.post("/addresses", createAddress);
router.patch("/addresses/:addressId", updateAddress);
router.patch("/addresses/:addressId/default", setDefaultAddress);
router.delete("/addresses/:addressId", deleteAddress);
router.get("/orders", listMyOrders);
router.get("/orders/:orderId", getMyOrder);
router.patch("/orders/:orderId/cancel", cancelMyOrder);
router.post("/orders/:orderId/return", uploadReturnEvidence.array("images", 4), requestMyOrderReturn);
router.patch("/orders/:orderId/items/:itemIndex/cancel", cancelMyOrderItem);
router.get("/support", listMySupportRequests);
router.post("/support", createSupportRequest);
export default router;
