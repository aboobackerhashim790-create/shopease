import * as cartService from "../services/cartService.js";
import * as wishlistService from "../services/wishlistService.js";

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
