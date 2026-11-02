import express from "express";
import {
  listUsers,
  blockUser,
  getCustomerDetails,
  createCategory,
  listCategory,
  editCategry,
  deleteCategory,
  createProducts,
  listProducts,
  unlistProduct,
  deleteProduct,
  updateProduct,
  uploadProductImages,
} from "../controllers/adminController.js";
import { requireSignedIn, requireAdmin } from "../middleware/authMiddleware.js";
import uploadProductImageFiles from "../middleware/productImageUpload.js";

const router = express.Router();

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
export default router;
