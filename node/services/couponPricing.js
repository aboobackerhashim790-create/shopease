import Coupon from "../models/Coupon.js";
import Order from "../models/Order.js";

export function calculateCouponDiscount(coupon, subtotal) {
  if (coupon.discountType === "percentage") {
    const amount = subtotal * coupon.discountValue / 100;
    return Math.min(amount, coupon.maximumDiscount ?? amount, subtotal);
  }
  return Math.min(coupon.discountValue, subtotal);
}

export async function findUsableCoupon(code, subtotal, session, userId) {
  if (!code) return { coupon: null, discountAmount: 0 };
  const query = Coupon.findOne({ code: String(code).trim().toUpperCase(), active: true });
  if (session) query.session(session);
  const coupon = await query;
  const now = new Date(); 
  if (!coupon) throw Object.assign(new Error("Coupon code is invalid or inactive."), { status: 400 });
  if (coupon.startsAt && coupon.startsAt > now) throw Object.assign(new Error("This coupon is not active yet."), { status: 400 });
  if (coupon.expiresAt && coupon.expiresAt < now) throw Object.assign(new Error("This coupon has expired."), { status: 400 });
  if (subtotal < coupon.minimumSubtotal) throw Object.assign(new Error(`This coupon requires a minimum subtotal of ₹${coupon.minimumSubtotal}.`), { status: 400 });
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw Object.assign(new Error("This coupon has reached its usage limit."), { status: 400 });
  if (coupon.firstOrderOnly) {
    if (!userId) {
      throw Object.assign(new Error("Sign in to use this first-order coupon."), { status: 401 });
    }

    const previousOrderQuery = Order.exists({
      userId,
      $or: [
        { paymentStatus: { $in: ["Paid", "Refunded"] } },
        { paymentMethod: "COD", orderStatus: { $ne: "Cancelled" } },
      ],
    });
    if (session) previousOrderQuery.session(session);

    if (await previousOrderQuery) {
      throw Object.assign(new Error("This coupon is only available on your first order."), { status: 400 });
    }
  }
  return { coupon, discountAmount: calculateCouponDiscount(coupon, subtotal) };
}

export async function reserveCouponUse(coupon, session) {
  if (!coupon) return;
  const filter = { _id: coupon._id, active: true };
  if (coupon.usageLimit !== null) filter.usedCount = { $lt: coupon.usageLimit };
  const query = Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
  if (session) query.session(session);
  const updated = await query;
  if (updated.modifiedCount !== 1) throw Object.assign(new Error("This coupon is no longer available."), { status: 409 });
}

export async function releaseCouponUse(couponCode, session) {
  if (!couponCode) return;
  const filter = { code: String(couponCode).trim().toUpperCase(), usedCount: { $gt: 0 } };
  const query = Coupon.updateOne(filter, { $inc: { usedCount: -1 } });
  if (session) query.session(session);
  await query;
}
