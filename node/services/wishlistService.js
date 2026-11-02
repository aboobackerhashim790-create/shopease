import mongoose from "mongoose";
import Product from "../models/Product.js";
import Wishlist from "../models/Wishlist.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";

function invalid(status, message) {
  return { status, body: { message } };
}

async function getWishlist(input) {
  try {
    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    const visibleCategorySet = new Set(visibleCategoryIds.map(String));
    const wishlist = await Wishlist.findOne({ userId: input.user._id }).lean();
    const items = await Promise.all(
      (wishlist?.items || []).map(async (entry) => {
        const product = await Product.findById(entry.productId)
          .populate({ path: "categoryId", match: { active: true }, select: "name slug" })
          .lean();
        if (!product) return null;
        const activeVariants = (product.variants || []).filter(
          (variant) => variant.active !== false && variant.stockQuantity > 0,
        );
        const isAvailable = Boolean(
          product.active && product.categoryId && visibleCategorySet.has(String(product.categoryId._id)) &&
          (product.variants?.length ? activeVariants.length : product.stockQuantity > 0),
        );
        return {
          addedAt: entry.addedAt,
          product: {
            ...product,
            variants: activeVariants,
            listingPrice: activeVariants.length
              ? Math.min(...activeVariants.map((variant) => variant.price))
              : product.price,
          },
          available: isAvailable,
        };
      }),
    );
    return { status: 200, body: { items: items.filter(Boolean) } };
  } catch (error) {
    console.error("Get wishlist error:", error);
    return invalid(500, "Could not load your wishlist.");
  }
}

async function addWishlistItem(input) {
  try {
    const { productId } = input.params;
    if (!mongoose.isValidObjectId(productId)) return invalid(400, "Invalid product ID.");
    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    const product = await Product.findOne({
      _id: productId,
      active: true,
      categoryId: { $in: visibleCategoryIds },
    });
    if (!product) return invalid(404, "Product is unavailable.");
    let wishlist = await Wishlist.findOne({ userId: input.user._id });
    if (!wishlist) {
      try {
        wishlist = await Wishlist.create({ userId: input.user._id, items: [] });
      } catch (error) {
        if (error.code !== 11000) throw error;
        wishlist = await Wishlist.findOne({ userId: input.user._id });
      }
    }
    if (!wishlist.items.some((item) => String(item.productId) === String(productId))) {
      wishlist.items.push({ productId });
      await wishlist.save();
    }
    return { status: 200, body: { message: "Added to wishlist." } };
  } catch (error) {
    console.error("Add wishlist item error:", error);
    return invalid(500, "Could not add this item to your wishlist.");
  }
}

async function removeWishlistItem(input) {
  try {
    const { productId } = input.params;
    if (!mongoose.isValidObjectId(productId)) return invalid(400, "Invalid product ID.");
    await Wishlist.updateOne(
      { userId: input.user._id },
      { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } },
    );
    return { status: 200, body: { message: "Removed from wishlist." } };
  } catch (error) {
    console.error("Remove wishlist item error:", error);
    return invalid(500, "Could not remove this wishlist item.");
  }
}

export { getWishlist, addWishlistItem, removeWishlistItem };
