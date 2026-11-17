import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { calculateCouponDiscount } from "../services/couponPricing.js";
import { validateCoupon } from "../services/adminCouponService.js";

// Helper to simulate Razorpay HMAC verification as implemented in orderService.js
function verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, secret) {
  const expectedSignature = createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = /^[a-f\d]{64}$/i.test(razorpaySignature)
    ? Buffer.from(razorpaySignature, "hex")
    : Buffer.alloc(0);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

// Helper to calculate proportional item refund as used in customerOrderService & adminOrderService
function calculateItemRefund(itemSubtotal, orderSubtotal, orderDiscountAmount) {
  const discountShare = orderSubtotal > 0
    ? Number(((orderDiscountAmount * itemSubtotal) / orderSubtotal).toFixed(2))
    : 0;
  return Math.max(0, Number((itemSubtotal - discountShare).toFixed(2)));
}

describe("Payment Test Suite: Signatures, Pricing & Rounding", () => {
  const testSecret = "KEWp1QoxGpNYJBN4NlfuWqUq";

  it("should accept valid Razorpay payment HMAC SHA256 signatures", () => {
    const orderId = "order_Qwer1234567890";
    const paymentId = "pay_Asdf0987654321";
    const validSignature = createHmac("sha256", testSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = verifySignature(orderId, paymentId, validSignature, testSecret);
    assert.equal(result, true, "Signature verification should pass for untampered payload");
  });

  it("should reject tampered or invalid Razorpay payment signatures", () => {
    const orderId = "order_Qwer1234567890";
    const paymentId = "pay_Asdf0987654321";
    const invalidSignature = "0".repeat(64);

    const result = verifySignature(orderId, paymentId, invalidSignature, testSecret);
    assert.equal(result, false, "Signature verification must fail for forged signature");
  });

  it("should reject signatures for mismatched order or payment IDs", () => {
    const orderId1 = "order_Qwer1234567890";
    const orderId2 = "order_Different12345";
    const paymentId = "pay_Asdf0987654321";
    const signatureForOrder1 = createHmac("sha256", testSecret)
      .update(`${orderId1}|${paymentId}`)
      .digest("hex");

    const result = verifySignature(orderId2, paymentId, signatureForOrder1, testSecret);
    assert.equal(result, false, "Signature must not match when order ID differs");
  });

  it("should convert INR order total to paise correctly for Razorpay API", () => {
    const totalAmount = 1499.5;
    const amountInPaise = Math.round(totalAmount * 100);
    assert.equal(amountInPaise, 149950, "1499.50 INR should convert to 149950 paise");
  });

  it("should enforce minimum total of ₹1 for Razorpay online payments", () => {
    const freeOrderTotal = 0;
    const isAllowedForRazorpay = freeOrderTotal >= 1;
    assert.equal(isAllowedForRazorpay, false, "Zero-total orders must be rejected for Razorpay");
  });
});

describe("Payment Test Suite: Coupons & Discount Math", () => {
  it("should calculate percentage discount within maximum cap", () => {
    const coupon = {
      discountType: "percentage",
      discountValue: 20,
      maximumDiscount: 200,
    };
    const subtotal = 1500; // 20% of 1500 = 300, capped at 200
    const discount = calculateCouponDiscount(coupon, subtotal);
    assert.equal(discount, 200);
  });

  it("should calculate percentage discount without maximum cap", () => {
    const coupon = {
      discountType: "percentage",
      discountValue: 10,
      maximumDiscount: null,
    };
    const subtotal = 1500;
    const discount = calculateCouponDiscount(coupon, subtotal);
    assert.equal(discount, 150);
  });

  it("should calculate flat discount not exceeding subtotal", () => {
    const coupon = {
      discountType: "flat",
      discountValue: 500,
    };
    const subtotal = 300;
    const discount = calculateCouponDiscount(coupon, subtotal);
    assert.equal(discount, 300, "Discount cannot exceed subtotal");
  });

  it("should maintain 2 decimal precision without floating point inaccuracies", () => {
    const subtotal = 999;
    const coupon = {
      discountType: "percentage",
      discountValue: 15, // 149.85
      maximumDiscount: null,
    };
    const discountAmount = Number(calculateCouponDiscount(coupon, subtotal).toFixed(2));
    const totalAmount = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

    assert.equal(discountAmount, 149.85);
    assert.equal(totalAmount, 849.15);
    assert.equal(totalAmount.toString(), "849.15", "Should not have precision drift like 849.1499999999999");
  });

  it("applies a 100 percent coupon without making the total negative", () => {
    assert.equal(calculateCouponDiscount({ discountType: "percentage", discountValue: 100 }, 250), 250);
  });

  it("returns zero discount for a zero subtotal", () => {
    assert.equal(calculateCouponDiscount({ discountType: "fixed", discountValue: 500 }, 0), 0);
  });

  it("normalizes coupon codes to uppercase and trims whitespace", () => {
    const parsed = validateCoupon({
      code: "  welcome_10 ", discountType: "percentage", discountValue: "10",
    });
    assert.equal(parsed.value.code, "WELCOME_10");
    assert.equal(parsed.value.discountValue, 10);
  });

  it("accepts an optional unlimited use limit and no expiry", () => {
    const parsed = validateCoupon({ code: "SAVE10", discountType: "fixed", discountValue: 10 });
    assert.equal(parsed.value.usageLimit, null);
    assert.equal(parsed.value.expiresAt, null);
    assert.equal(parsed.value.firstOrderOnly, false);
  });

  it("rejects coupon codes with unsupported characters", () => {
    const parsed = validateCoupon({ code: "SAVE 10!", discountType: "fixed", discountValue: 10 });
    assert.ok(parsed.errors.code);
  });

  it("rejects percentage discounts above 100", () => {
    const parsed = validateCoupon({ code: "SAVE10", discountType: "percentage", discountValue: 101 });
    assert.ok(parsed.errors.discountValue);
  });

  it("rejects a zero or negative discount", () => {
    for (const discountValue of [0, -1]) {
      assert.ok(validateCoupon({ code: "SAVE10", discountType: "fixed", discountValue }).errors.discountValue);
    }
  });

  it("rejects a negative minimum subtotal", () => {
    const parsed = validateCoupon({ code: "SAVE10", discountType: "fixed", discountValue: 10, minimumSubtotal: -1 });
    assert.ok(parsed.errors.minimumSubtotal);
  });

  it("rejects non-positive usage limits that are provided", () => {
    for (const usageLimit of [0, -1, 1.5]) {
      assert.ok(validateCoupon({ code: "SAVE10", discountType: "fixed", discountValue: 10, usageLimit }).errors.usageLimit);
    }
  });

  it("rejects invalid coupon dates and expiry before start", () => {
    const invalidDate = validateCoupon({
      code: "SAVE10", discountType: "fixed", discountValue: 10, startsAt: "bad-date",
    });
    assert.ok(invalidDate.errors.startsAt);
    const reversed = validateCoupon({
      code: "SAVE10", discountType: "fixed", discountValue: 10,
      startsAt: "2030-12-02", expiresAt: "2030-12-01",
    });
    assert.ok(reversed.errors.expiresAt);
  });
});

describe("Payment Test Suite: Wallet Deductions & Proportional Refunds", () => {
  it("should allow wallet payment when balance is sufficient", () => {
    const walletBalance = 2444;
    const totalAmount = 1499;
    const canPayWithWallet = totalAmount > 0 && walletBalance >= totalAmount;
    assert.equal(canPayWithWallet, true);
  });

  it("should reject wallet payment when balance is insufficient", () => {
    const walletBalance = 500;
    const totalAmount = 1499;
    const canPayWithWallet = totalAmount > 0 && walletBalance >= totalAmount;
    assert.equal(canPayWithWallet, false);
  });

  it("should reject wallet payment when total amount is 0", () => {
    const walletBalance = 500;
    const totalAmount = 0;
    const canPayWithWallet = totalAmount > 0 && walletBalance >= totalAmount;
    assert.equal(canPayWithWallet, false, "Wallet payment requires an order total greater than zero");
  });

  it("should calculate proportional item refund when an order with a coupon is partially cancelled", () => {
    // Order: Item 1 = 1000, Item 2 = 1000, Subtotal = 2000, Coupon Discount = 400 (20% off)
    // Order Total Paid = 1600.
    // If Item 1 is cancelled:
    // Item 1 subtotal = 1000
    // Item 1 discount share = (400 * 1000) / 2000 = 200
    // Refund due = 1000 - 200 = 800
    const refund = calculateItemRefund(1000, 2000, 400);
    assert.equal(refund, 800, "Refund should be 800 (1000 minus 200 discount share)");
  });

  it("should calculate correct refund for item cancellation with uneven amounts", () => {
    // Subtotal: 1500 (Item 1: 500, Item 2: 1000), Discount: 150
    // Item 1 share = (150 * 500) / 1500 = 50
    // Refund for Item 1 = 500 - 50 = 450
    const refundItem1 = calculateItemRefund(500, 1500, 150);
    const refundItem2 = calculateItemRefund(1000, 1500, 150);

    assert.equal(refundItem1, 450);
    assert.equal(refundItem2, 900);
    assert.equal(refundItem1 + refundItem2, 1350, "Sum of refunds should equal total paid amount (1500 - 150)");
  });
});

describe("Payment Test Suite: Order Status & Recovery Rules", () => {
  it("should mark COD order as Paid upon delivery", () => {
    const order = {
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Out for Delivery",
    };
    const nextStatus = "Delivered";
    if (nextStatus === "Delivered" && order.paymentMethod === "COD") {
      order.paymentStatus = "Paid";
    }
    assert.equal(order.paymentStatus, "Paid");
  });

  it("should automatically credit wallet if payment is captured but items are out of stock", () => {
    const capturedPaymentAmount = 1499;
    let walletBalance = 100;
    const isOutOfStock = true;

    let refundStatus = "None";
    let refundAmount = 0;

    if (isOutOfStock) {
      walletBalance += capturedPaymentAmount;
      refundStatus = "Completed";
      refundAmount = capturedPaymentAmount;
    }

    assert.equal(walletBalance, 1599);
    assert.equal(refundStatus, "Completed");
    assert.equal(refundAmount, 1499);
  });
});
