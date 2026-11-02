import express from "express";
import {
  updateMyProfile,
  updateProfilePhoto,
  requestEmailChange,
  verifyEmailChange,
  changeMyPassword,
  listMyAddresses,
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
import { otpLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();
router.use(requireSignedIn, requireActiveCustomer);
router.patch("/me", updateMyProfile);
router.post("/photo", uploadProfileImage.single("photo"), updateProfilePhoto);
router.post("/email-change/request", otpLimiter, requestEmailChange);
router.post("/email-change/verify", otpLimiter, verifyEmailChange);
router.patch("/password", changeMyPassword);
router.get("/addresses", listMyAddresses);
router.get("/addresses/pincode/:postalCode", validateAddressPincode);
router.post("/addresses", createAddress);
router.patch("/addresses/:addressId", updateAddress);
router.patch("/addresses/:addressId/default", setDefaultAddress);
router.delete("/addresses/:addressId", deleteAddress);

export default router;
