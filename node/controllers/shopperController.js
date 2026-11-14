import * as cartService from "../services/cartService.js";
import * as wishlistService from "../services/wishlistService.js";
import * as orderService from "../services/orderService.js";
import * as storeCouponService from "../services/storeCouponService.js";

function inputFrom(req) {
  return {
    body: req.body || {},
    params: req.params || {},
    query: req.query || {},
    user: req.user,
  };
}

function respond(res, result) {
  return res.status(result.status).json(result.body);
}

export async function getCart(req, res) {
  return respond(res, await cartService.getCart(inputFrom(req)));
}
export async function validateCheckout(req, res) {
  return respond(res, await cartService.validateCheckout(inputFrom(req)));
}
export async function addCartItem(req, res) {
  return respond(res, await cartService.addCartItem(inputFrom(req)));
}
export async function updateCartItem(req, res) {
  return respond(res, await cartService.updateCartItem(inputFrom(req)));
}
export async function removeCartItem(req, res) {
  return respond(res, await cartService.removeCartItem(inputFrom(req)));
}
export async function getWishlist(req, res) {
  return respond(res, await wishlistService.getWishlist(inputFrom(req)));
}
export async function addWishlistItem(req, res) {
  return respond(res, await wishlistService.addWishlistItem(inputFrom(req)));
}
export async function removeWishlistItem(req, res) {
  return respond(res, await wishlistService.removeWishlistItem(inputFrom(req)));
}
export async function getCheckoutSummary(req, res) {
  return respond(
    res,
    await cartService.getCheckoutSummary(inputFrom(req)),
  );
}

export async function placeCodOrder(req, res) {
  return respond(res, await orderService.placeCodOrder(inputFrom(req)));
}

export async function placeWalletOrder(req, res) {
  return respond(res, await orderService.placeWalletOrder(inputFrom(req)));
}

export async function createRazorpayOrder(req, res) {
  return respond(res, await orderService.createRazorpayOrder(inputFrom(req)));
}

export async function verifyRazorpayPayment(req, res) {
  return respond(res, await orderService.verifyRazorpayPayment(inputFrom(req)));
}

export async function markRazorpayPaymentFailed(req, res) {
  return respond(res, await orderService.markRazorpayPaymentFailed(inputFrom(req)));
}

export async function markRazorpayPaymentCancelled(req, res) {
  return respond(res, await orderService.markRazorpayPaymentCancelled(inputFrom(req)));
}

export async function convertRazorpayOrderToCod(req, res) {
  return respond(res, await orderService.convertRazorpayOrderToCod(inputFrom(req)));
}

export async function validateStoreCoupon(req, res) {
  return respond(res, await storeCouponService.validateStoreCoupon(inputFrom(req)));
}

export async function listAvailableStoreCoupons(req, res) {
  return respond(res, await storeCouponService.listAvailableStoreCoupons(inputFrom(req)));
}
