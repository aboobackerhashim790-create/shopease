import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js";
import Counter from "../models/Counter.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Wallet from "../models/Wallet.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";
import { findUsableCoupon, reserveCouponUse, releaseCouponUse } from "./couponPricing.js";
import { priceWithActiveCampaign } from "./offerCampaignPricing.js";

const MAX_CART_ITEMS = 9;

let razorpayClient;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const error = new Error("Razorpay is not configured on the server.");
    error.status = 503;
    throw error;
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return razorpayClient;
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function isMongoTransactionsUnavailable(error) {
  return [20, 263, 303].includes(error?.code) ||
    /transaction numbers are only allowed|does not support retryable writes/i.test(error?.message || "");
}

function transactionSetupMessage() {
  return "Order placement needs MongoDB transactions. Configure local MongoDB as a replica set or use MongoDB Atlas, then restart the backend.";
}

async function makeOrderNumber(session = null) {
  const query = Counter.findOneAndUpdate(
    { _id: "orderNumber" },
    { $inc: { sequence: 1 } },
    { new: true, runValidators: true },
  );
  if (session) query.session(session);
  const counter = await query;
  if (!counter) fail(500, "Could not generate an order number.");
  return `SE-${counter.sequence}`;
}

async function makeOrderItems(cart, productsById) {
  const orderItems = [];
  let subtotal = 0;

  for (const line of cart.items) {
    const product = productsById.get(String(line.productId));
    if (!product) fail(409, "A product in your cart is no longer available.");

    let variant = null;
    if (product.variants?.length) {
      if (!mongoose.isValidObjectId(line.variantId)) {
        fail(409, `Choose an option for ${product.name}.`);
      }
      variant = product.variants.find(
        (item) => String(item._id) === String(line.variantId) && item.active !== false,
      );
      if (!variant || variant.stockQuantity < line.quantity) {
        fail(409, `There is not enough stock for ${product.name}.`);
      }
    } else if (line.variantId || product.stockQuantity < line.quantity) {
      fail(409, `There is not enough stock for ${product.name}.`);
    }

    const regularPrice = variant ? variant.price : product.price;
    const campaignPrice = await priceWithActiveCampaign(product, regularPrice);
    const unitPrice = campaignPrice.price;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      fail(409, `The price for ${product.name} is invalid.`);
    }

    const itemTotal = unitPrice * line.quantity;
    subtotal += itemTotal;
    orderItems.push({
      productId: product._id,
      variantId: variant?._id || null,
      name: product.name,
      sku: variant?.sku || product.sku || "",
      options: {
        color: variant?.options?.color || "",
        storage: variant?.options?.storage || "",
      },
      image: variant?.images?.[0] || product.images?.[0] || "",
      quantity: line.quantity,
      unitPrice,
      compareAtPrice:
        campaignPrice.compareAtPrice ??
        variant?.compareAtPrice ??
        product.compareAtPrice ??
        null,
      itemTotal,
      fulfillmentStatus: "Pending",
      fulfillmentHistory: [{ status: "Pending", updatedAt: new Date() }],
    });
  }

  return { orderItems, subtotal };
}

async function createRazorpayOrder(input) {
  try {
    const userId = input.user._id;
    const { addressId, idempotencyKey, couponCode, buyNow, orderId } = input.body || {};
    const isBuyNow = Boolean(buyNow);

    const client = getRazorpayClient();
    const keyId = process.env.RAZORPAY_KEY_ID;
    let order = null;
    let key = "";

    if (orderId) {
      if (!mongoose.isValidObjectId(orderId)) {
        return { status: 400, body: { message: "Invalid order ID." } };
      }
      order = await Order.findOne({ _id: orderId, userId, paymentMethod: "Razorpay" });
      if (!order) {
        return { status: 404, body: { message: "Online order not found." } };
      }
      if (order.paymentStatus === "Paid") {
        return { status: 409, body: { message: "This order has already been paid.", order } };
      }
      if (order.orderStatus === "Cancelled") {
        return { status: 409, body: { message: "This order was cancelled." } };
      }
      if (order.totalAmount < 1) {
        return { status: 400, body: { message: "Online payment requires an order total of at least ₹1." } };
      }

      const visibleCategoryIds = await getVisibleStoreCategoryIds();
      for (const item of order.items) {
        if (item.isCancelled) continue;
        const product = await Product.findOne({
          _id: item.productId,
          active: true,
          categoryId: { $in: visibleCategoryIds },
        }).lean();
        if (!product) {
          return { status: 409, body: { message: `${item.name} is no longer available.` } };
        }
        if (item.variantId) {
          const variant = product.variants?.find(
            (v) => String(v._id) === String(item.variantId) && v.active !== false,
          );
          if (!variant || variant.stockQuantity < item.quantity) {
            return { status: 409, body: { message: `There is not enough stock remaining for ${item.name}.` } };
          }
        } else if ((product.variants?.length > 0) || product.stockQuantity < item.quantity) {
          return { status: 409, body: { message: `There is not enough stock remaining for ${item.name}.` } };
        }
      }
    } else {
      if (!mongoose.isValidObjectId(addressId)) {
        return { status: 400, body: { message: "Choose a valid delivery address." } };
      }
      if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 8) {
        return { status: 400, body: { message: "A valid idempotency key is required." } };
      }

      key = idempotencyKey.trim();
      order = await Order.findOne({ userId, idempotencyKey: key });

      if (order && (order.purchaseType || "Cart") !== (isBuyNow ? "BuyNow" : "Cart")) {
        return { status: 409, body: { message: "This checkout key belongs to a different purchase." } };
      }

      if (order?.paymentStatus === "Paid") {
        return { status: 409, body: { message: "This order has already been paid.", order } };
      }

      if (order?.paymentStatus === "Pending" && order.razorpayOrderId) {
        return {
          status: 200,
          body: {
            keyId,
            orderId: order._id,
            razorpayOrderId: order.razorpayOrderId,
            amount: Math.round(order.totalAmount * 100),
            currency: order.currency,
            orderNumber: order.orderNumber,
          },
        };
      }
    }

    if (!order) {
      const address = await Address.findOne({ _id: addressId, user: userId }).lean();
      if (!address) {
        return { status: 404, body: { message: "The selected delivery address was not found." } };
      }

      let cart;
      if (isBuyNow) {
        const quantity = Number(buyNow.quantity || 1);
        if (!mongoose.isValidObjectId(buyNow.productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEMS) {
          return { status: 400, body: { message: "Choose a valid product and quantity." } };
        }
        if (buyNow.variantId && !mongoose.isValidObjectId(buyNow.variantId)) {
          return { status: 400, body: { message: "Choose a valid product option." } };
        }
        cart = { items: [{ productId: buyNow.productId, variantId: buyNow.variantId || null, quantity }] };
      } else {
        cart = await Cart.findOne({ userId }).lean();
        if (!cart?.items?.length) {
          return { status: 400, body: { message: "Your cart is empty." } };
        }
      }
      const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity > MAX_CART_ITEMS) {
        return { status: 400, body: { message: `Your cart can contain at most ${MAX_CART_ITEMS} items.` } };
      }

      const visibleCategoryIds = await getVisibleStoreCategoryIds();
      const products = await Product.find({
        _id: { $in: cart.items.map((item) => item.productId) },
        active: true,
        categoryId: { $in: visibleCategoryIds },
      }).lean();
      const productsById = new Map(products.map((product) => [String(product._id), product]));
      const { orderItems, subtotal } = await makeOrderItems(cart, productsById);
      const couponResult = await findUsableCoupon(couponCode, subtotal, null, userId);
      const discountAmount = Number(couponResult.discountAmount.toFixed(2));
      const totalAmount = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

      if (totalAmount < 1) {
        return {
          status: 400,
          body: {
            message: "Online payment requires an order total of at least ₹1. Choose Cash on Delivery for zero-total orders.",
          },
        };
      }

      await reserveCouponUse(couponResult.coupon);

      try {
        order = await Order.create({
          orderNumber: await makeOrderNumber(),
          idempotencyKey: key,
          purchaseType: isBuyNow ? "BuyNow" : "Cart",
          userId,
          deliveryAddress: {
            label: address.label,
            fullName: address.fullName,
            phone: address.phone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2 || "",
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
          },
          items: orderItems,
          subtotal,
          couponCode: couponResult.coupon?.code || "",
          discountAmount,
          shippingAmount: 0,
          taxAmount: 0,
          totalAmount,
          paymentMethod: "Razorpay",
          paymentStatus: "Pending",
          orderStatus: "Pending",
          inventoryStatus: "Pending",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        order = await Order.findOne({ userId, idempotencyKey: key });
        if (order && (order.purchaseType || "Cart") !== (isBuyNow ? "BuyNow" : "Cart")) {
          return { status: 409, body: { message: "This checkout key belongs to a different purchase." } };
        }
      }
    }

    if (!order || order.paymentMethod !== "Razorpay") {
      return { status: 409, body: { message: "Could not resume this online payment." } };
    }

    // Reuse a pending Razorpay order on retries; create a fresh gateway order after a failed attempt or explicit order retry.
    if (order.paymentStatus === "Failed" || order.paymentStatus === "Cancelled" || !order.razorpayOrderId || orderId) {
      const gatewayOrder = await client.orders.create({
        amount: Math.round(order.totalAmount * 100),
        currency: order.currency || "INR",
        receipt: order.orderNumber,
        notes: { localOrderId: String(order._id), userId: String(userId) },
      });
      order.razorpayOrderId = gatewayOrder.id;
      order.paymentStatus = "Pending";
      order.orderStatus = "Pending";
      order.razorpayPaymentId = "";
      await order.save();
    }

    return {
      status: 200,
      body: {
        keyId,
        orderId: order._id,
        razorpayOrderId: order.razorpayOrderId,
        amount: Math.round(order.totalAmount * 100),
        currency: order.currency || "INR",
        orderNumber: order.orderNumber,
      },
    };
  } catch (error) {
    // The Razorpay SDK keeps its useful explanation on `error.error`, while
    // ordinary Error instances only have `message`. Log just safe fields so
    // provider request configuration (which can contain credentials) is never
    // written to the server log.
    const gatewayMessage =
      error?.error?.description || error?.error?.reason || error?.error?.message;
    console.error("Create Razorpay order error:", {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      gatewayCode: error?.error?.code,
      gatewayMessage,
    });

    const isGatewayError = Boolean(gatewayMessage || error?.statusCode);
    return {
      status: error.status || (isGatewayError ? 502 : 500),
      body: {
        message: error.status
          ? error.message
          : gatewayMessage
            ? `Razorpay could not create the payment: ${gatewayMessage}`
            : error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT"
              ? "Could not connect to Razorpay. Check your internet connection and try again."
              : process.env.NODE_ENV === "production"
                ? "Could not start online payment. Please try again."
                : `Could not start online payment: ${error.message || "Unexpected server error."}`,
      },
    };
  }
}

async function verifyRazorpayPayment(input) {
  const session = await mongoose.startSession();
  try {
    const {
      orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = input.body || {};

    if (!mongoose.isValidObjectId(orderId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return { status: 400, body: { message: "Payment verification details are incomplete." } };
    }

    const order = await Order.findOne({ _id: orderId, userId: input.user._id });
    if (!order || order.paymentMethod !== "Razorpay") {
      return { status: 404, body: { message: "Online order not found." } };
    }
    if (order.paymentStatus === "Paid") {
      return { status: 200, body: { message: "Payment was already verified.", order } };
    }
    if (order.razorpayOrderId !== razorpayOrderId) {
      return { status: 400, body: { message: "The payment does not match this order." } };
    }

    const razorpay = getRazorpayClient();
    const expectedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const actualBuffer = /^[a-f\d]{64}$/i.test(razorpaySignature)
      ? Buffer.from(razorpaySignature, "hex")
      : Buffer.alloc(0);
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { status: 400, body: { message: "Payment signature is invalid." } };
    }

    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    if (payment.status === "authorized") {
      try {
        await razorpay.payments.capture(
          razorpayPaymentId,
          Math.round(order.totalAmount * 100),
          order.currency || "INR",
        );
        payment.status = "captured";
      } catch (captureError) {
        console.error("Razorpay capture attempt error:", captureError);
      }
    }

    if (
      payment.order_id !== razorpayOrderId ||
      payment.status !== "captured" ||
      payment.amount !== Math.round(order.totalAmount * 100) ||
      payment.currency !== order.currency
    ) {
      return { status: 409, body: { message: "Payment is not captured for the expected amount yet." } };
    }

    let verifiedOrder;
    await session.withTransaction(async () => {
      const currentOrder = await Order.findOne({ _id: orderId, userId: input.user._id }).session(session);
      if (!currentOrder) fail(404, "Online order not found.");
      if (currentOrder.paymentStatus === "Paid") {
        verifiedOrder = currentOrder;
        return;
      }
      if (currentOrder.razorpayOrderId !== razorpayOrderId) {
        fail(409, "A newer payment attempt exists for this order.");
      }

      const visibleCategoryIds = await getVisibleStoreCategoryIds();
      for (const item of currentOrder.items) {
        const product = await Product.findOne({
          _id: item.productId,
          active: true,
          categoryId: { $in: visibleCategoryIds },
        }).session(session);
        if (!product) fail(409, `${item.name} is no longer available.`);

        let stockUpdate;
        if (item.variantId) {
          stockUpdate = await Product.updateOne(
            {
              _id: item.productId,
              active: true,
              variants: {
                $elemMatch: {
                  _id: item.variantId,
                  active: { $ne: false },
                  stockQuantity: { $gte: item.quantity },
                },
              },
            },
            { $inc: { "variants.$.stockQuantity": -item.quantity } },
            { session },
          );
        } else {
          stockUpdate = await Product.updateOne(
            {
              _id: item.productId,
              active: true,
              $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }],
              stockQuantity: { $gte: item.quantity },
            },
            { $inc: { stockQuantity: -item.quantity } },
            { session },
          );
        }
        if (stockUpdate.modifiedCount !== 1) {
          // Automatic recovery: credit wallet for captured payment when item runs out of stock
          await Wallet.findOneAndUpdate(
            { userId: currentOrder.userId },
            {
              $inc: { balance: currentOrder.totalAmount },
              $push: {
                transactions: {
                  type: "Credit",
                  amount: currentOrder.totalAmount,
                  description: `Automatic refund for order ${currentOrder.orderNumber} (out of stock)`,
                  orderId: currentOrder._id,
                },
              },
            },
            { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true },
          );
          currentOrder.paymentStatus = "Refunded";
          currentOrder.orderStatus = "Cancelled";
          currentOrder.refundDestination = "ShopEase Wallet";
          currentOrder.refundAmount = currentOrder.totalAmount;
          currentOrder.refundStatus = "Completed";
          currentOrder.cancellationReason = `Stock ran out for ${item.name} during checkout. Total amount of ₹${currentOrder.totalAmount} was refunded to your ShopEase Wallet.`;
          if (currentOrder.couponCode && !currentOrder.couponReleased) {
            await releaseCouponUse(currentOrder.couponCode, session);
            currentOrder.couponReleased = true;
          }
          await currentOrder.save({ session });
          fail(409, `There is no longer enough stock for ${item.name}. Your payment of ₹${currentOrder.totalAmount} has been automatically credited to your ShopEase Wallet.`);
        }
      }

      const cart = currentOrder.purchaseType === "BuyNow"
        ? null
        : await Cart.findOne({ userId: input.user._id }).session(session);
      if (cart) {
        for (const purchasedItem of currentOrder.items) {
          const cartLine = cart.items.find(
            (line) =>
              String(line.productId) === String(purchasedItem.productId) &&
              String(line.variantId || "") === String(purchasedItem.variantId || ""),
          );
          if (!cartLine) continue;
          cartLine.quantity -= purchasedItem.quantity;
          if (cartLine.quantity <= 0) cart.items.pull({ _id: cartLine._id });
        }
        await cart.save({ session });
      }

      currentOrder.razorpayPaymentId = razorpayPaymentId;
      currentOrder.paymentStatus = "Paid";
      currentOrder.orderStatus = "Confirmed";
      currentOrder.inventoryStatus = "Deducted";
      const confirmedAt = new Date();
      for (const item of currentOrder.items) {
        if (item.isCancelled) continue;
        item.fulfillmentStatus = "Confirmed";
        item.fulfillmentHistory.push({ status: "Confirmed", updatedAt: confirmedAt });
      }
      await currentOrder.save({ session });
      verifiedOrder = currentOrder;
    });

    return { status: 200, body: { message: "Payment verified and order confirmed.", order: verifiedOrder } };
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);
    return {
      status: error.status || (isMongoTransactionsUnavailable(error) ? 503 : 500),
      body: {
        message: error.status
          ? error.message
          : isMongoTransactionsUnavailable(error)
            ? transactionSetupMessage()
            : "Could not verify the payment.",
      },
    };
  } finally {
    await session.endSession();
  }
}

async function markRazorpayPaymentFailed(input) {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId } = input.body || {};
    if (
      !mongoose.isValidObjectId(orderId) ||
      typeof razorpayOrderId !== "string" ||
      typeof razorpayPaymentId !== "string"
    ) {
      return { status: 400, body: { message: "Invalid payment attempt." } };
    }

    const order = await Order.findOne({ _id: orderId, userId: input.user._id, paymentMethod: "Razorpay" });
    if (!order) return { status: 404, body: { message: "Online order not found." } };
    if (order.paymentStatus === "Paid") {
      return { status: 200, body: { message: "This order is already paid.", order } };
    }
    if (order.razorpayOrderId !== razorpayOrderId) {
      return { status: 409, body: { message: "This payment attempt is no longer current." } };
    }
    const payment = await getRazorpayClient().payments.fetch(razorpayPaymentId);
    if (payment.order_id !== razorpayOrderId || payment.status !== "failed") {
      return { status: 409, body: { message: "Razorpay has not confirmed this payment failure." } };
    }
    order.paymentStatus = "Failed";
    await order.save();
    return { status: 200, body: { message: "Payment failed. You can retry without creating another order.", order } };
  } catch (error) {
    console.error("Mark Razorpay payment failed error:", error);
    return { status: 500, body: { message: "Could not update payment status." } };
  }
}

async function markRazorpayPaymentCancelled(input) {
  try {
    const { orderId, razorpayOrderId } = input.body || {};
    if (!mongoose.isValidObjectId(orderId) || typeof razorpayOrderId !== "string") {
      return { status: 400, body: { message: "Invalid payment cancellation request." } };
    }
    const order = await Order.findOne({ _id: orderId, userId: input.user._id, paymentMethod: "Razorpay" });
    if (!order) return { status: 404, body: { message: "Online order not found." } };
    if (order.paymentStatus === "Paid") {
      return { status: 409, body: { message: "This payment has already completed." } };
    }
    if (order.razorpayOrderId !== razorpayOrderId) {
      return { status: 409, body: { message: "This payment attempt is no longer current." } };
    }

    // Closing the Razorpay window does not prove a payment failed. Check the
    // gateway first so a captured payment cannot be labelled as cancelled.
    const gatewayPayments = await getRazorpayClient().orders.fetchPayments(razorpayOrderId);
    const hasCapturedPayment = gatewayPayments.items?.some(
      (payment) => payment.status === "captured",
    );
    if (hasCapturedPayment) {
      return {
        status: 409,
        body: { message: "Razorpay shows a captured payment. Refresh the order status instead of cancelling it." },
      };
    }

    // A customer closing the payment window cancels only that payment attempt.
    // The order stays Pending so the customer can retry payment.
    order.paymentStatus = "Cancelled";
    await order.save();
    return { status: 200, body: { message: "Payment attempt cancelled. The order is still pending, and you can retry payment.", order } };
  } catch (error) {
    console.error("Cancel Razorpay payment error:", error);
    return { status: 500, body: { message: "Could not update the cancelled payment." } };
  }
}

// Convert the existing unpaid Razorpay order to COD. Keeping the same order
// document and order number prevents a second order being created after a
// failed/cancelled online payment attempt.
async function convertRazorpayOrderToCod(input) {
  const { orderId } = input.body || {};
  if (!mongoose.isValidObjectId(orderId)) {
    return { status: 400, body: { message: "Invalid order ID." } };
  }

  const session = await mongoose.startSession();
  try {
    const order = await Order.findOne({
      _id: orderId,
      userId: input.user._id,
    }).lean();
    if (!order) return { status: 404, body: { message: "Online order not found." } };
    // If the first conversion succeeded but its response was lost, return the
    // already-converted order instead of making the customer submit again.
    if (order.paymentMethod === "COD" && order.inventoryStatus === "Deducted") {
      return { status: 200, body: { message: "This order is already set to Cash on Delivery.", order } };
    }
    if (order.paymentMethod !== "Razorpay") {
      return { status: 409, body: { message: "Only an unpaid Razorpay order can be changed to Cash on Delivery." } };
    }
    if (order.paymentStatus === "Paid" || order.inventoryStatus === "Deducted") {
      return { status: 409, body: { message: "This order has already been paid or confirmed." } };
    }
    if (!order.razorpayOrderId) {
      return { status: 409, body: { message: "This order has no Razorpay payment attempt to convert." } };
    }

    // A local failed/cancelled status is not proof that the gateway did not
    // capture money. Check Razorpay before switching the payment method.
    const payments = await getRazorpayClient().orders.fetchPayments(order.razorpayOrderId);
    if (payments.items?.some((payment) => payment.status === "captured")) {
      return { status: 409, body: { message: "Razorpay has captured this payment. Refresh your order status instead." } };
    }

    let convertedOrder;
    await session.withTransaction(async () => {
      const currentOrder = await Order.findOne({
        _id: orderId,
        userId: input.user._id,
      }).session(session);
      if (!currentOrder) fail(404, "Online order not found.");

      // Makes retries safe: a second click returns this same converted order.
      if (currentOrder.paymentMethod === "COD" && currentOrder.inventoryStatus === "Deducted") {
        convertedOrder = currentOrder;
        return;
      }
      if (currentOrder.paymentMethod !== "Razorpay" || currentOrder.paymentStatus === "Paid" || currentOrder.inventoryStatus !== "Pending") {
        fail(409, "This order can no longer be changed to Cash on Delivery.");
      }

      const visibleCategoryIds = await getVisibleStoreCategoryIds();
      for (const item of currentOrder.items) {
        const product = await Product.findOne({
          _id: item.productId,
          active: true,
          categoryId: { $in: visibleCategoryIds },
        }).session(session);
        if (!product) fail(409, `${item.name} is no longer available.`);

        const stockUpdate = item.variantId
          ? await Product.updateOne(
              {
                _id: item.productId,
                active: true,
                variants: { $elemMatch: { _id: item.variantId, active: { $ne: false }, stockQuantity: { $gte: item.quantity } } },
              },
              { $inc: { "variants.$.stockQuantity": -item.quantity } },
              { session },
            )
          : await Product.updateOne(
              {
                _id: item.productId,
                active: true,
                $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }],
                stockQuantity: { $gte: item.quantity },
              },
              { $inc: { stockQuantity: -item.quantity } },
              { session },
            );
        if (stockUpdate.modifiedCount !== 1) fail(409, `There is not enough stock for ${item.name}.`);
      }

      if (currentOrder.purchaseType !== "BuyNow") {
        const cart = await Cart.findOne({ userId: input.user._id }).session(session);
        if (cart) {
          for (const purchasedItem of currentOrder.items) {
            const cartLine = cart.items.find((line) =>
              String(line.productId) === String(purchasedItem.productId) &&
              String(line.variantId || "") === String(purchasedItem.variantId || ""),
            );
            if (!cartLine) continue;
            cartLine.quantity -= purchasedItem.quantity;
            if (cartLine.quantity <= 0) cart.items.pull({ _id: cartLine._id });
          }
          await cart.save({ session });
        }
      }

      currentOrder.paymentMethod = "COD";
      currentOrder.paymentStatus = currentOrder.totalAmount === 0 ? "Paid" : "Pending";
      currentOrder.orderStatus = currentOrder.totalAmount === 0 ? "Confirmed" : "Pending";
      currentOrder.inventoryStatus = "Deducted";
      const initialFulfillmentStatus = currentOrder.totalAmount === 0 ? "Confirmed" : "Pending";
      for (const item of currentOrder.items) {
        item.fulfillmentStatus = initialFulfillmentStatus;
        item.fulfillmentHistory.push({ status: initialFulfillmentStatus, updatedAt: new Date() });
      }
      await currentOrder.save({ session });
      convertedOrder = currentOrder;
    });

    return { status: 200, body: { message: "Payment method changed to Cash on Delivery.", order: convertedOrder } };
  } catch (error) {
    console.error("Convert Razorpay order to COD error:", error);
    return {
      status: error.status || (isMongoTransactionsUnavailable(error) ? 503 : 500),
      body: { message: error.status ? error.message : isMongoTransactionsUnavailable(error) ? transactionSetupMessage() : "Could not change the payment method." },
    };
  } finally {
    await session.endSession();
  }
}

async function placeOrder(input, paymentMethod) {
  const userId = input.user._id;
  const { addressId, idempotencyKey, couponCode, buyNow } = input.body || {};
  const isBuyNow = Boolean(buyNow);

  if (!mongoose.isValidObjectId(addressId)) {
    return { status: 400, body: { message: "Choose a valid delivery address." } };
  }

  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 8) {
    return {
      status: 400,
      body: { message: "A valid idempotency key is required." },
    };
  }

  const key = idempotencyKey.trim();

  // If the browser retries the same request, return its already-created order.
  const previousOrder = await Order.findOne({
    userId,
    idempotencyKey: key,
  }).lean();

  if (previousOrder) {
    if (
      (previousOrder.purchaseType || "Cart") !== (isBuyNow ? "BuyNow" : "Cart") ||
      previousOrder.paymentMethod !== paymentMethod
    ) {
      return {
        status: 409,
        body: { message: "This checkout key belongs to a different purchase or payment method." },
      };
    }
    return {
      status: 200,
      body: { message: "This order was already placed.", order: previousOrder },
    };
  }

  const session = await mongoose.startSession();
  let createdOrder;

  try {
    await session.withTransaction(async () => {
      const existingOrder = await Order.findOne({
        userId,
        idempotencyKey: key,
      }).session(session);

      if (existingOrder) {
        if (
          (existingOrder.purchaseType || "Cart") !== (isBuyNow ? "BuyNow" : "Cart") ||
          existingOrder.paymentMethod !== paymentMethod
        ) {
          fail(409, "This checkout key belongs to a different purchase or payment method.");
        }
        createdOrder = existingOrder;
        return;
      }

      const address = await Address.findOne({
        _id: addressId,
        user: userId,
      }).session(session);

      if (!address) {
        fail(404, "The selected delivery address was not found.");
      }

      let cart = null;
      let purchaseLines;
      if (isBuyNow) {
        const quantity = Number(buyNow.quantity || 1);
        if (!mongoose.isValidObjectId(buyNow.productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEMS) {
          fail(400, "Choose a valid product and quantity.");
        }
        if (buyNow.variantId && !mongoose.isValidObjectId(buyNow.variantId)) {
          fail(400, "Choose a valid product option.");
        }
        purchaseLines = [{ productId: buyNow.productId, variantId: buyNow.variantId || null, quantity }];
      } else {
        cart = await Cart.findOne({ userId }).session(session);
        if (!cart || cart.items.length === 0) fail(400, "Your cart is empty.");
        purchaseLines = cart.items;
      }

      const totalQuantity = purchaseLines.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      if (totalQuantity > MAX_CART_ITEMS) {
        fail(400, `Your cart can contain at most ${MAX_CART_ITEMS} items.`);
      }

      const visibleCategoryIds = await getVisibleStoreCategoryIds();
      const orderItems = [];
      let subtotal = 0;

      for (const line of purchaseLines) {
        if (!mongoose.isValidObjectId(line.productId) || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1) {
          fail(400, "A product or quantity in this order is invalid.");
        }
        const product = await Product.findOne({
          _id: line.productId,
          active: true,
          categoryId: { $in: visibleCategoryIds },
        })
          .session(session)
          .lean();

        if (!product) {
          fail(409, "A product in your cart is no longer available.");
        }

        let variant = null;
        let unitPrice;
        let image;
        let sku;
        let options;

        if (product.variants?.length > 0) {
          if (!mongoose.isValidObjectId(line.variantId)) {
            fail(409, `Choose a valid option for ${product.name}.`);
          }

          variant = product.variants.find(
            (item) =>
              String(item._id) === String(line.variantId) &&
              item.active !== false,
          );

          if (!variant) {
            fail(409, `An option for ${product.name} is no longer available.`);
          }

          // Atomic conditional update: stock is deducted only if enough remains.
          const stockUpdate = await Product.updateOne(
            {
              _id: product._id,
              active: true,
              variants: {
                $elemMatch: {
                  _id: variant._id,
                  active: { $ne: false },
                  stockQuantity: { $gte: line.quantity },
                },
              },
            },
            { $inc: { "variants.$.stockQuantity": -line.quantity } },
            { session },
          );

          if (stockUpdate.modifiedCount !== 1) {
            fail(409, `There is not enough stock for ${product.name}.`);
          }

          unitPrice = variant.price;
          image = variant.images?.[0] || product.images?.[0] || "";
          sku = variant.sku;
          options = {
            color: variant.options?.color || "",
            storage: variant.options?.storage || "",
          };
        } else {
          if (line.variantId) {
            fail(409, `The selected option for ${product.name} is invalid.`);
          }

          const stockUpdate = await Product.updateOne(
            {
              _id: product._id,
              active: true,
              $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }],
              stockQuantity: { $gte: line.quantity },
            },
            { $inc: { stockQuantity: -line.quantity } },
            { session },
          );

          if (stockUpdate.modifiedCount !== 1) {
            fail(409, `There is not enough stock for ${product.name}.`);
          }

          unitPrice = product.price;
          image = product.images?.[0] || "";
          sku = product.sku || "";
          options = { color: "", storage: "" };
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          fail(409, `The price for ${product.name} is invalid.`);
        }

        const campaignPrice = await priceWithActiveCampaign(
          product,
          unitPrice,
          session,
        );
        unitPrice = campaignPrice.price;

        const itemTotal = unitPrice * line.quantity;
        subtotal += itemTotal;

        orderItems.push({
          productId: product._id,
          variantId: variant?._id || null,
          name: product.name,
          sku,
          options,
          image,
          quantity: line.quantity,
          unitPrice,
          compareAtPrice:
            campaignPrice.compareAtPrice ??
            variant?.compareAtPrice ??
            product.compareAtPrice ??
            null,
          itemTotal,
          fulfillmentStatus: "Pending",
          fulfillmentHistory: [{ status: "Pending", updatedAt: new Date() }],
        });
      }

      const couponResult = await findUsableCoupon(couponCode, subtotal, session, userId);
      await reserveCouponUse(couponResult.coupon, session);
      const discountAmount = Number(couponResult.discountAmount.toFixed(2));
      const totalAmount = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
      const orderNumber = await makeOrderNumber(session);

      if (paymentMethod === "Wallet" && totalAmount <= 0) {
        fail(400, "Wallet payment requires an order total greater than zero.");
      }

      if (paymentMethod === "Wallet") {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet || wallet.balance < totalAmount) {
          fail(409, "Your ShopEase Wallet does not have enough balance for this order.");
        }

        const debit = await Wallet.updateOne(
          { _id: wallet._id, balance: { $gte: totalAmount } },
          {
            $inc: { balance: -totalAmount },
            $push: {
              transactions: {
                type: "Debit",
                amount: totalAmount,
                description: `Payment for order ${orderNumber}`,
              },
            },
          },
          { session, runValidators: true },
        );
        if (debit.modifiedCount !== 1) {
          fail(409, "Your ShopEase Wallet balance changed. Refresh checkout and try again.");
        }
      }

      const isPaidNow = paymentMethod === "Wallet" || totalAmount === 0;
      const initialFulfillment = isPaidNow ? "Confirmed" : "Pending";
      for (const item of orderItems) {
        item.fulfillmentStatus = initialFulfillment;
        item.fulfillmentHistory = [{ status: initialFulfillment, updatedAt: new Date() }];
      }

      const [order] = await Order.create(
        [
          {
            orderNumber,
            idempotencyKey: key,
            purchaseType: isBuyNow ? "BuyNow" : "Cart",
            userId,
            deliveryAddress: {
              label: address.label,
              fullName: address.fullName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2 || "",
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
            },
            items: orderItems,
            subtotal,
            couponCode: couponResult.coupon?.code || "",
            discountAmount,
            shippingAmount: 0,
            taxAmount: 0,
            totalAmount,
            paymentMethod,
            paymentStatus: isPaidNow ? "Paid" : "Pending",
            orderStatus: isPaidNow ? "Confirmed" : "Pending",
            inventoryStatus: "Deducted",
          },
        ],
        { session },
      );

      if (!isBuyNow) {
        await Cart.deleteOne({ _id: cart._id, userId }, { session });
      }
      createdOrder = order;
    });

    return {
      status: 201,
      body: {
        message: paymentMethod === "Wallet"
          ? "Order placed successfully using your ShopEase Wallet."
          : "COD order placed successfully.",
        order: createdOrder,
      },
    };
  } catch (error) {
    // Another simultaneous retry may have created the order first.
    if (error.code === 11000) {
      const duplicateOrder = await Order.findOne({
        userId,
        idempotencyKey: key,
      }).lean();

      if (duplicateOrder) {
        if (
          (duplicateOrder.purchaseType || "Cart") !== (isBuyNow ? "BuyNow" : "Cart") ||
          duplicateOrder.paymentMethod !== paymentMethod
        ) {
          return {
            status: 409,
            body: { message: "This checkout key belongs to a different purchase or payment method." },
          };
        }
        return {
          status: 200,
          body: { message: "This order was already placed.", order: duplicateOrder },
        };
      }
    }

    console.error(`Place ${paymentMethod} order error:`, error);

    return {
      status: error.status || (isMongoTransactionsUnavailable(error) ? 503 : 500),
      body: {
        message: error.status
          ? error.message
          : isMongoTransactionsUnavailable(error)
            ? transactionSetupMessage()
            : "Could not place your order.",
      },
    };  
  } finally {
    await session.endSession();
  }
}

function placeCodOrder(input) {
  return placeOrder(input, "COD");
}

function placeWalletOrder(input) {
  return placeOrder(input, "Wallet");
}

export { placeCodOrder, placeWalletOrder, createRazorpayOrder, verifyRazorpayPayment, markRazorpayPaymentFailed, markRazorpayPaymentCancelled, convertRazorpayOrderToCod };
