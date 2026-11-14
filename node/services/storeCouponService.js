import * as cartService from "./cartService.js";
import Coupon from "../models/Coupon.js";
import Order from "../models/Order.js";
import { calculateCouponDiscount, findUsableCoupon } from "./couponPricing.js";

export async function listAvailableStoreCoupons(input) {
  try {
    let cart;
    const buyNow = input.query?.buyNow === "true"
      ? {
          productId: input.query.productId,
          variantId: input.query.variantId,
          quantity: input.query.quantity,
        }
      : null;

    if (buyNow) {
      cart = await cartService.loadBuyNowCart(input.user._id, buyNow);
    } else {
      const cartResult = await cartService.getCart(input);
      if (cartResult.status !== 200) return cartResult;
      cart = cartResult.body.cart;
    }

    const now = new Date();
    const coupons = await Coupon.find({ active: true })
      .sort({ createdAt: -1 })
      .lean();

    const hasPreviousOrder = await Order.exists({
      userId: input.user._id,
      $or: [
        { paymentStatus: { $in: ["Paid", "Refunded"] } },
        { paymentMethod: "COD", orderStatus: { $ne: "Cancelled" } },
      ],
    });

    const availableCoupons = coupons
      .filter((coupon) =>
        (!coupon.startsAt || coupon.startsAt <= now) &&
        (!coupon.expiresAt || coupon.expiresAt >= now) &&
        (coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit) &&
        cart.total >= coupon.minimumSubtotal &&
        (!coupon.firstOrderOnly || !hasPreviousOrder),
      )
      .map((coupon) => ({
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maximumDiscount: coupon.maximumDiscount,
        minimumSubtotal: coupon.minimumSubtotal,
        firstOrderOnly: coupon.firstOrderOnly,
        expiresAt: coupon.expiresAt,
        discountAmount: calculateCouponDiscount(coupon, cart.total),
      }));

    return { status: 200, body: { coupons: availableCoupons } };
  } catch (error) {
    return {
      status: error.status || 500,
      body: { message: error.status ? error.message : "Could not load available coupons." },
    };
  }
}

export async function validateStoreCoupon(input) {
  const code = String(input.body?.code || "").trim();
  if (!code) return { status: 400, body: { message: "Enter a coupon code." } };
  try {
    let cart;
    if (input.body?.buyNow) {
      cart = await cartService.loadBuyNowCart(input.user._id, input.body.buyNow);
    } else {
      const cartResult = await cartService.getCart(input);
      if (cartResult.status !== 200) return cartResult;
      cart = cartResult.body.cart;
    }
    if (!cart.canCheckout) return { status: 409, body: { message: "Fix unavailable cart items before applying a coupon." } };
    const { coupon, discountAmount } = await findUsableCoupon(code, cart.total, null, input.user._id);
    return { status: 200, body: { message: "Coupon applied.", coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue }, subtotal: cart.total, discountAmount, totalAmount: Math.max(0, cart.total - discountAmount) } };
  } catch (error) {
    return { status: error.status || 500, body: { message: error.status ? error.message : "Could not validate coupon." } };
  }
}
