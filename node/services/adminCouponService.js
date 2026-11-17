import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";

const result = (status, message, extra = {}) => ({ status, body: { message, ...extra } });

export function validateCoupon(body = {}) {
  const code = String(body.code || "").trim().toUpperCase();
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const minimumSubtotal = Number(body.minimumSubtotal || 0);
  const maximumDiscount = body.maximumDiscount === "" || body.maximumDiscount == null ? null : Number(body.maximumDiscount);
  const usageLimit = body.usageLimit === "" || body.usageLimit == null ? null : Number(body.usageLimit);
  const firstOrderOnly = body.firstOrderOnly === true;
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const errors = {};
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    errors.code = "Code must be 3–40 letters, numbers, hyphens, or underscores.";
  }
  if (!["percentage", "fixed"].includes(discountType)) {
    errors.discountType = "Choose a percentage or fixed discount.";
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percentage" && discountValue > 100)) {
    errors.discountValue = "Enter a valid discount value.";
  }
  if (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0) {
    errors.minimumSubtotal = "Minimum subtotal must be zero or more.";
  }
  if (maximumDiscount !== null && (!Number.isFinite(maximumDiscount) || maximumDiscount < 0)) {
    errors.maximumDiscount = "Maximum discount must be zero or more.";
  }
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
    errors.usageLimit = "Usage limit must be a positive whole number.";
  }
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    errors.startsAt = "Enter a valid start date.";
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    errors.expiresAt = "Enter a valid expiry date.";
  }
  if (
    startsAt &&
    expiresAt &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(expiresAt.getTime()) &&
    startsAt > expiresAt
  ) {
    errors.expiresAt = "Expiry date must be on or after the start date.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  return { value: { code, discountType, discountValue, minimumSubtotal, maximumDiscount, usageLimit, firstOrderOnly, startsAt, expiresAt, description: String(body.description || "").trim().slice(0, 200) } };
}

export async function listCoupons(input) {
  try {
    const page = Math.max(parseInt(input.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.query.limit, 10) || 10, 1), 50);
    const filter = {};
    const search = String(input.query.search || "").trim();
    if (search) filter.code = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (input.query.status === "active") filter.active = true;
    if (input.query.status === "inactive") filter.active = false;
    const [coupons, totalCoupons] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Coupon.countDocuments(filter),
    ]);
    return { status: 200, body: { coupons, pagination: { page, limit, totalCoupons, totalPages: Math.ceil(totalCoupons / limit) } } };
  } catch (error) {
    console.error("Admin list coupons error:", error);
    return result(500, "Could not load coupons.");
  }
}

export async function createCoupon(input) {
  const parsed = validateCoupon(input.body || {});
  if (parsed.errors) return result(400, "Please correct the highlighted fields.", { errors: parsed.errors });
  try {
    const coupon = await Coupon.create({ ...parsed.value, active: input.body.active !== false });
    return { status: 201, body: { message: "Coupon created.", coupon } };
  } catch (error) {
    if (error.code === 11000) {
      const message = "That coupon code is already in use.";
      return result(409, message, { errors: { code: message } });
    }
    console.error("Create coupon error:", error);
    return result(500, "Could not create coupon.");
  }
}

export async function updateCoupon(input) {
  const { couponId } = input.params;
  if (!mongoose.isValidObjectId(couponId)) return result(400, "Invalid coupon ID.");
  const parsed = validateCoupon(input.body || {});
  if (parsed.errors) return result(400, "Please correct the highlighted fields.", { errors: parsed.errors });
  try {
    const coupon = await Coupon.findByIdAndUpdate(couponId, { $set: { ...parsed.value, active: input.body.active !== false } }, { returnDocument: "after", runValidators: true });
    if (!coupon) return result(404, "Coupon not found.");
    return { status: 200, body: { message: "Coupon updated.", coupon } };
  } catch (error) {
    if (error.code === 11000) {
      const message = "That coupon code is already in use.";
      return result(409, message, { errors: { code: message } });
    }
    console.error("Update coupon error:", error);
    return result(500, "Could not update coupon.");
  }
}

export async function setCouponActive(input) {
  const { couponId } = input.params;
  const active = input.body?.active;
  if (!mongoose.isValidObjectId(couponId)) return result(400, "Invalid coupon ID.");
  if (typeof active !== "boolean") return result(400, "Active must be true or false.");
  const coupon = await Coupon.findByIdAndUpdate(couponId, { $set: { active } }, { returnDocument: "after", runValidators: true });
  return coupon ? { status: 200, body: { message: active ? "Coupon activated." : "Coupon deactivated.", coupon } } : result(404, "Coupon not found.");
}
