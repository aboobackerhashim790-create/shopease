import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Wishlist from "../models/Wishlist.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";
import Address from "../models/Address.js";
import Wallet from "../models/Wallet.js";
import {
  getActiveCampaigns,
  priceWithActiveCampaign,
  priceWithCampaigns,
} from "./offerCampaignPricing.js";

const MAX_CART_ITEMS = 9;

function invalid(status, message) {
  return { status, body: { message } };
}

async function findPurchasableProduct(productId) {
  if (!mongoose.isValidObjectId(productId)) return null;
  const visibleCategoryIds = await getVisibleStoreCategoryIds();
  return Product.findOne({ _id: productId, active: true, categoryId: { $in: visibleCategoryIds } })
    .populate({ path: "categoryId", match: { active: true }, select: "name slug" })
    .lean();
}



async function resolvePurchaseOption(product, variantId, campaigns = null) {
  if (!product?.categoryId) return null;
  if (product.variants?.length) {
    if (!mongoose.isValidObjectId(variantId)) return null;
    const variant = product.variants.find(
      (item) => String(item._id) === String(variantId) && item.active !== false,
    );
    if (!variant || variant.stockQuantity <= 0) return null;
    const campaignPrice = campaigns
      ? priceWithCampaigns(product, variant.price, campaigns)
      : await priceWithActiveCampaign(product, variant.price);
    return {
      variant,
      stock: variant.stockQuantity,
      price: campaignPrice.price,
      compareAtPrice: campaignPrice.compareAtPrice ?? variant.compareAtPrice,
      campaignName: campaignPrice.campaignName,
    };
  }
  if (variantId || product.stockQuantity <= 0) return null;
  const campaignPrice = campaigns
    ? priceWithCampaigns(product, product.price, campaigns)
    : await priceWithActiveCampaign(product, product.price);
  return {
    variant: null,
    stock: product.stockQuantity,
    price: campaignPrice.price,
    compareAtPrice: campaignPrice.compareAtPrice ?? product.compareAtPrice,
    campaignName: campaignPrice.campaignName,
  };
}

async function loadCart(userId) {
  const cart = await Cart.findOne({ userId }).lean();
  if (!cart) return { items: [], total: 0, totalQuantity: 0, hasInvalidItems: false, exceedsMaximum: false, canCheckout: false };
  const campaigns = await getActiveCampaigns();

  const items = await Promise.all(
    cart.items.map(async (line) => {
      const product = await findPurchasableProduct(line.productId);
      const option = await resolvePurchaseOption(product, line.variantId, campaigns);
      const available = Boolean(option && line.quantity <= option.stock);
      return {
        _id: line._id,
        quantity: line.quantity,
        product: product
          ? {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            images: product.images,
            active: product.active,
            category: product.categoryId,
          }
          : null,
        variant: option?.variant || null,
        unitPrice: option?.price ?? null,
        itemTotal: available ? option.price * line.quantity : 0,
        available,
        availableStock: option?.stock ?? 0,
        message: available
          ? ""
          : product
            ? "This option is unavailable or has insufficient stock."
            : "This product is no longer available.",
      };
    }),
  );
  const validItems = items.filter((item) => item.available);
  const hasInvalidItems = items.some((item) => !item.available);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const exceedsMaximum = totalQuantity > MAX_CART_ITEMS;
  const total = validItems.reduce((sum, item) => sum + item.itemTotal, 0);
  return {
    items,
    total,
    totalQuantity,
    hasInvalidItems,
    exceedsMaximum,
    canCheckout: items.length > 0 && !hasInvalidItems && !exceedsMaximum,
  };
}

async function getCart(input) {
  try {
    return { status: 200, body: { cart: await loadCart(input.user._id), maxCartItems: MAX_CART_ITEMS } };
  } catch (error) {
    console.error("Get cart error:", error);
    return invalid(500, "Could not load your cart.");
  }
}
async function getCheckoutSummary(input) {
  try {
    const buyNow = input.query?.buyNow === "true";
    const [addresses, cart, wallet] = await Promise.all([
      Address.find({ user: input.user._id })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean(),

      buyNow
        ? loadBuyNowCart(input.user._id, input.query)
        : loadCart(input.user._id),
      Wallet.findOne({ userId: input.user._id }).select("balance").lean(),
    ]);

    const defaultAddress =
      addresses.find((address) => address.isDefault) || addresses[0] || null;

    return {
      status: 200,
      body: {
        addresses,
        selectedAddressId: defaultAddress?._id || null,
        cart,
        shippingAmount: 0,
        taxAmount: 0,
        totalAmount: cart.total,
        walletBalance: wallet?.balance || 0,
        maxCartItems: MAX_CART_ITEMS,
      },
    };
  } catch (error) {
    console.error("Get checkout summary error:", error);
    return invalid(error.status || 500, error.status ? error.message : "Could not load checkout information.");
  }
}

async function loadBuyNowCart(userId, selection = {}) {
  const quantity = Number(selection.quantity || 1);
  if (!mongoose.isValidObjectId(selection.productId)) {
    throw Object.assign(new Error("Choose a valid product."), { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEMS) {
    throw Object.assign(new Error(`Quantity must be between 1 and ${MAX_CART_ITEMS}.`), { status: 400 });
  }

  const product = await findPurchasableProduct(selection.productId);
  const option = await resolvePurchaseOption(product, selection.variantId || null);
  if (!option || quantity > option.stock) {
    throw Object.assign(new Error("This product option is unavailable or has insufficient stock."), { status: 409 });
  }

  const line = {
    _id: `buy-now-${product._id}-${selection.variantId || "base"}`,
    quantity,
    product: {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      images: product.images,
      active: product.active,
      category: product.categoryId,
    },
    variant: option.variant,
    unitPrice: option.price,
    itemTotal: option.price * quantity,
    available: true,
    availableStock: option.stock,
    message: "",
  };

  return {
    items: [line],
    total: line.itemTotal,
    totalQuantity: quantity,
    hasInvalidItems: false,
    exceedsMaximum: false,
    canCheckout: true,
  };
}
async function validateCheckout(input) {
  try {

    const cart = await loadCart(input.user._id);
    if (cart.items.length === 0) {
      return { status: 400, body: { message: "Your cart is empty.", cart, maxCartItems: MAX_CART_ITEMS } };
    }
    if (!cart.canCheckout) {
      return {
        status: 409,
        body: {
          message: cart.exceedsMaximum
            ? `Your cart can contain at most ${MAX_CART_ITEMS} items total.`
            : "Some cart items are unavailable or no longer have enough stock. Review your cart.",
          cart,
          maxCartItems: MAX_CART_ITEMS,
        },
      };
    }
    return {
      status: 200,
      body: {
        message: "Cart checked against current product prices and stock.",
        cart,
        checkedAt: new Date().toISOString(),
        maxCartItems: MAX_CART_ITEMS,
      },
    };
  } catch (error) {
    console.error("Checkout validation error:", error);
    return invalid(500, "Could not verify current prices and stock.");
  }
}

async function addCartItem(input) {
  try {
    const { productId, variantId = null, quantity = 1 } = input.body || {};
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_CART_ITEMS) {
      return invalid(400, `You can have at most ${MAX_CART_ITEMS} items in your cart.`);
    }
    const product = await findPurchasableProduct(productId);
    if (!product?.categoryId) return invalid(404, "Product is unavailable.");
    const option = await resolvePurchaseOption(product, variantId);
    if (!option) return invalid(409, "This product option is unavailable.");

    let cart = await Cart.findOne({ userId: input.user._id });
    if (!cart) {
      try {
        cart = await Cart.create({ userId: input.user._id, items: [] });
      } catch (error) {
        if (error.code !== 11000) throw error;
        cart = await Cart.findOne({ userId: input.user._id });
      }
    }
    const existing = cart.items.find(
      (line) =>
        String(line.productId) === String(product._id) &&
        String(line.variantId || "") === String(variantId || ""),
    );
    const currentCartCount = cart.items.reduce((total, line) => total + line.quantity, 0);
    if (currentCartCount + amount > MAX_CART_ITEMS) {
      return invalid(400, `Your cart can contain at most ${MAX_CART_ITEMS} items total.`);
    }
    const nextQuantity = (existing?.quantity || 0) + amount;
    if (nextQuantity > option.stock) {
      return invalid(409, `Only ${option.stock} are currently in stock.`);
    }
    if (existing) existing.quantity = nextQuantity;
    else cart.items.push({ productId: product._id, variantId: variantId || null, quantity: amount });
    await cart.save();
    await Wishlist.updateOne({ userId: input.user._id }, { $pull: { items: { productId: product._id } } });
    return { status: 200, body: { message: "Added to cart.", cart: await loadCart(input.user._id), maxCartItems: MAX_CART_ITEMS } };
  } catch (error) {
    console.error("Add cart item error:", error);
    return invalid(500, "Could not add this item to your cart.");
  }
}

async function updateCartItem(input) {
  try {
    const { itemId } = input.params;
    const quantity = Number(input.body?.quantity);
    if (!mongoose.isValidObjectId(itemId)) return invalid(400, "Invalid cart item ID.");
    if (!Number.isInteger(quantity) || quantity < 1) return invalid(400, "Quantity must be a positive whole number.");
    const cart = await Cart.findOne({ userId: input.user._id });
    const line = cart?.items.id(itemId);
    if (!line) return invalid(404, "Cart item not found.");
    if (quantity > MAX_CART_ITEMS && quantity >= line.quantity) {
      return invalid(400, `Your cart can contain at most ${MAX_CART_ITEMS} items total.`);
    }
    const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
    const nextCartCount = cartCount - line.quantity + quantity;
    if (quantity >= line.quantity && nextCartCount > MAX_CART_ITEMS) {
      return invalid(400, `Your cart can contain at most ${MAX_CART_ITEMS} items total.`);
    }
    const product = await findPurchasableProduct(line.productId);
    const option = await resolvePurchaseOption(product, line.variantId);
    // Reducing quantity is always allowed, including when its option has sold out.
    if (!option && quantity >= line.quantity) {
      return invalid(409, "This product option is unavailable. You can reduce or remove it from your cart.");
    }
    if (!option) {
      line.quantity = quantity;
      await cart.save();
      return { status: 200, body: { message: "Cart updated.", cart: await loadCart(input.user._id), maxCartItems: MAX_CART_ITEMS } };
    }
    // If stock has fallen below the current quantity, allow decreases so the customer can correct it.
    if (quantity > option.stock && quantity >= line.quantity) {
      return invalid(409, `Only ${option.stock} are currently in stock.`);
    }
    line.quantity = quantity;
    await cart.save();
    return { status: 200, body: { message: "Cart updated.", cart: await loadCart(input.user._id), maxCartItems: MAX_CART_ITEMS } };
  } catch (error) {
    console.error("Update cart item error:", error);
    return invalid(500, "Could not update your cart.");
  }
}

async function removeCartItem(input) {
  try {
    const { itemId } = input.params;
    if (!mongoose.isValidObjectId(itemId)) return invalid(400, "Invalid cart item ID.");
    const cart = await Cart.findOne({ userId: input.user._id });
    if (!cart?.items.id(itemId)) return invalid(404, "Cart item not found.");
    cart.items.pull({ _id: itemId });
    await cart.save();
    return { status: 200, body: { message: "Removed from cart.", cart: await loadCart(input.user._id), maxCartItems: MAX_CART_ITEMS } };
  } catch (error) {
    console.error("Remove cart item error:", error);
    return invalid(500, "Could not remove this cart item.");
  }
}

export { getCart, getCheckoutSummary, addCartItem, updateCartItem, removeCartItem, validateCheckout, loadBuyNowCart };
