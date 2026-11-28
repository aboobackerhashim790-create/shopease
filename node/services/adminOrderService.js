import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { releaseCouponUse } from "./couponPricing.js";

const transitions = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Shipped", "Cancelled"],
  Shipped: ["Out for Delivery"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  Cancelled: [],
};
const fulfillmentRanks = {
  Pending: 0,
  Confirmed: 1,
  Shipped: 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Returned: 4,
};

export function summarizeFulfillment(order) {
  // A failed/cancelled payment attempt does not cancel an order. It has not
  // reserved stock or entered fulfillment, so keep it available for retry.
  if (
    order.paymentMethod === "Razorpay" &&
    ["Failed", "Cancelled"].includes(order.paymentStatus) &&
    order.inventoryStatus !== "Deducted" &&
    !(order.items || []).some((item) => item.isCancelled)
  ) return "Pending";
  if (order.orderStatus === "Cancelled") return "Cancelled";
  const activeItems = (order.items || []).filter((item) => !item.isCancelled);
  if (activeItems.length === 0) return "Cancelled";
  const activeStatuses = activeItems
    .map((item) => item.fulfillmentStatus || order.orderStatus)
    .filter((itemStatus) => itemStatus !== "Cancelled");
  if (activeStatuses.length === 0) return "Cancelled";
  return activeStatuses.reduce((leastAdvanced, itemStatus) =>
    fulfillmentRanks[itemStatus] < fulfillmentRanks[leastAdvanced] ? itemStatus : leastAdvanced,
  activeStatuses[0]);
}

export function isValidOrderStatusTransition(currentStatus, nextStatus) {
  return Boolean(transitions[currentStatus]?.includes(nextStatus));
}

const bad = (status, message) => ({ status, body: { message } });
const isTransactionsUnavailable = (error) =>
  [20, 263, 303].includes(error?.code) ||
  /transaction numbers are only allowed|does not support retryable writes/i.test(error?.message || "");
const transactionsUnavailableMessage =
  "Order updates need MongoDB transactions. Configure local MongoDB as a replica set or use MongoDB Atlas, then restart the backend.";

export async function listOrders(input) {
  try {
    const query = input.query || {};
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 50);
    const conditions = [];
    const status = String(query.status || "all");
    const paymentStatus = String(query.paymentStatus || "all");
    const failedRazorpayAttempt = {
      paymentMethod: "Razorpay",
      paymentStatus: { $in: ["Failed", "Cancelled"] },
      // Also recognize older orders that predate the inventoryStatus field.
      inventoryStatus: { $ne: "Deducted" },
      items: { $not: { $elemMatch: { isCancelled: true } } },
    };
    if (status === "Cancelled") {
      conditions.push({ orderStatus: "Cancelled", $nor: [failedRazorpayAttempt] });
    } else if (status === "Pending") {
      conditions.push({ $or: [{ orderStatus: "Pending" }, { ...failedRazorpayAttempt }] });
    } else if (status !== "all") {
      conditions.push({ orderStatus: status });
    }
    if (paymentStatus !== "all") conditions.push({ paymentStatus });

    const search = String(query.search || "").trim();
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      const users = await User.find({ $or: [{ fullName: regex }, { email: regex }] }).select("_id").lean();
      conditions.push({ $or: [{ orderNumber: regex }, { userId: { $in: users.map((user) => user._id) } }] });
    }

    const filter = conditions.length ? { $and: conditions } : {};

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
        .populate("userId", "fullName email").lean(),
      Order.countDocuments(filter),
    ]);
    const ordersWithSummaryStatus = orders.map((order) => ({
      ...order,
      orderStatus: summarizeFulfillment(order),
    }));
    return { status: 200, body: { orders: ordersWithSummaryStatus, pagination: { page, limit, totalOrders, totalPages: Math.ceil(totalOrders / limit) } } };
  } catch (error) {
    console.error("Admin list orders error:", error);
    return bad(500, "Could not load orders.");
  }
}

export async function getOrder(input) {
  if (!mongoose.isValidObjectId(input.params.orderId)) return bad(400, "Invalid order ID.");
  try {
    const order = await Order.findById(input.params.orderId).populate("userId", "fullName email").lean();
    if (!order) return bad(404, "Order not found.");
    return {
      status: 200,
      body: { order: { ...order, orderStatus: summarizeFulfillment(order) } },
    };
  } catch (error) {
    console.error("Admin get order error:", error);
    return bad(500, "Could not load this order.");
  }
}

export async function updateOrderStatus(input) {
  const { orderId } = input.params;
  const nextStatus = input.body?.orderStatus;
  if (!mongoose.isValidObjectId(orderId)) return bad(400, "Invalid order ID.");
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        const error = new Error("Order not found.");
        error.status = 404;
        throw error;
      }
      // Older failed Razorpay attempts may have been stored as cancelled.
      // Treat them as pending so an admin can manage the unpaid order correctly.
      const effectiveStatus = summarizeFulfillment(order);
      if (order.orderStatus !== effectiveStatus) order.orderStatus = effectiveStatus;
      if (!isValidOrderStatusTransition(effectiveStatus, nextStatus)) {
        const error = new Error(`Cannot move an order from ${effectiveStatus} to ${nextStatus}.`);
        error.status = 409;
        throw error;
      }
      if (nextStatus === "Confirmed" && order.paymentMethod === "Razorpay" && order.paymentStatus !== "Paid") {
        const error = new Error("An online order can be confirmed only after Razorpay verifies the payment.");
        error.status = 409;
        throw error;
      }
      if (nextStatus === "Cancelled" && order.paymentStatus === "Paid") {
        const refundAmount = Number(order.totalAmount);
        if (refundAmount > 0) {
          order.refundDestination = "ShopEase Wallet";
          order.refundAmount = refundAmount;
          order.refundStatus = "Completed";
          await Wallet.findOneAndUpdate(
            { userId: order.userId },
            {
              $inc: { balance: refundAmount },
              $push: {
                transactions: {
                  type: "Credit",
                  amount: refundAmount,
                  description: `Refund for order ${order.orderNumber} cancelled by administrator`,
                  orderId: order._id,
                },
              },
            },
            { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true },
          );
          order.paymentStatus = "Refunded";
          order.walletRefundedAt = new Date();
        } else {
          order.paymentStatus = "Cancelled";
        }
      } else if (nextStatus === "Cancelled") {
        order.paymentStatus = "Cancelled";
      }

      if (nextStatus === "Cancelled" && order.couponCode && !order.couponReleased) {
        await releaseCouponUse(order.couponCode, session);
        order.couponReleased = true;
      }

      if (nextStatus === "Cancelled" && order.inventoryStatus === "Deducted") {
        for (const item of order.items) {
          if (item.isCancelled) continue;
          const update = item.variantId
            ? await Product.updateOne({ _id: item.productId, "variants._id": item.variantId }, { $inc: { "variants.$.stockQuantity": item.quantity } }, { session })
            : await Product.updateOne({ _id: item.productId, $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }] }, { $inc: { stockQuantity: item.quantity } }, { session });
          if (update.matchedCount !== 1) throw new Error(`Could not restore stock for ${item.name}.`);
        }
        order.inventoryStatus = "Restored";
      }
      const statusUpdatedAt = new Date();
      for (const item of order.items) {
        if (item.isCancelled) continue;
        item.fulfillmentStatus = nextStatus;
        item.fulfillmentHistory.push({ status: nextStatus, updatedAt: statusUpdatedAt });
        if (nextStatus === "Delivered") item.deliveredAt = statusUpdatedAt;
        if (nextStatus === "Cancelled") {
          item.isCancelled = true;
          item.cancelledAt = new Date();
          item.cancellationReason = "Order cancelled by administrator.";
        }
      }
      order.orderStatus = nextStatus;
      if (nextStatus === "Delivered" && !order.deliveredAt) {
        order.deliveredAt = statusUpdatedAt;
      }
      if (nextStatus === "Delivered" && order.paymentMethod === "COD") {
        order.paymentStatus = "Paid";
      }
      await order.save({ session });
      updated = order;
    });
    return { status: 200, body: { message: "Order status updated.", order: updated } };
  } catch (error) {
    console.error("Admin update order error:", error);
    return bad(error.status || (isTransactionsUnavailable(error) ? 503 : 500), error.status ? error.message : isTransactionsUnavailable(error) ? transactionsUnavailableMessage : error.message || "Could not update order.");
  } finally {
    await session.endSession();
  }
}      

export async function updateOrderItemStatus(input) {
  const { orderId } = input.params;
  const itemIndex = Number(input.params.itemIndex);
  const nextStatus = input.body?.fulfillmentStatus;
  if (!mongoose.isValidObjectId(orderId)) return bad(400, "Invalid order ID.");
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return bad(400, "Choose a valid order item.");
  if (!["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered"].includes(nextStatus)) {
    return bad(400, "Choose a valid product status.");
  }

  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        const error = new Error("Order not found.");
        error.status = 404;
        throw error;
      }
      const item = order.items[itemIndex];
      if (!item) {
        const error = new Error("That product is not part of this order.");
        error.status = 404;
        throw error;
      }
      if (item.isCancelled) {
        const error = new Error("A cancelled product cannot be updated.");
        error.status = 409;
        throw error;
      }

      const currentStatus = item.fulfillmentStatus || order.orderStatus;
      if (!isValidOrderStatusTransition(currentStatus, nextStatus) || nextStatus === "Cancelled") {
        const error = new Error(`Cannot move this product from ${currentStatus} to ${nextStatus}.`);
        error.status = 409;
        throw error;
      }

      const statusUpdatedAt = new Date();
      item.fulfillmentStatus = nextStatus;
      item.fulfillmentHistory.push({ status: nextStatus, updatedAt: statusUpdatedAt });
      if (nextStatus === "Delivered" && !item.deliveredAt) item.deliveredAt = statusUpdatedAt;

      order.orderStatus = summarizeFulfillment(order);
      const activeItems = order.items.filter((orderItem) => !orderItem.isCancelled);
      const allDelivered = activeItems.length > 0 && activeItems.every(
        (orderItem) => ["Delivered", "Returned"].includes(orderItem.fulfillmentStatus || order.orderStatus),
      );
      if (allDelivered) {
        if (!order.deliveredAt) order.deliveredAt = new Date();
        if (order.paymentMethod === "COD") order.paymentStatus = "Paid";
      }

      await order.save({ session });
      updated = order;
    });
    return { status: 200, body: { message: "Product status updated.", order: updated } };
  } catch (error) {
    console.error("Admin update order item status error:", error);
    return bad(error.status || (isTransactionsUnavailable(error) ? 503 : 500), error.status ? error.message : isTransactionsUnavailable(error) ? transactionsUnavailableMessage : error.message || "Could not update product status.");
  } finally {
    await session.endSession();
  }
}

export async function listReturnRequests(input) {
  try {
    const query = input.query || {};
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 50);
    const status = String(query.status || "Requested");
    const allowedStatuses = ["Requested", "Accepted", "Rejected"];
    if (status !== "all" && !allowedStatuses.includes(status)) {
      return bad(400, "Choose a valid return request status.");
    }
    const statuses = status === "all" ? allowedStatuses : [status];
    const filter = {
      $or: [
        { "items.returnRequest.status": { $in: statuses } },
        { "returnRequest.status": { $in: statuses } },
      ],
    };
    const orders = await Order.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .populate("userId", "fullName email")
      .lean();
    const requests = [];
    for (const order of orders) {
      const customer = {
        fullName: order.userId?.fullName || "Customer",
        email: order.userId?.email || "",
      };
      for (const [itemIndex, item] of (order.items || []).entries()) {
        const returnRequest = item.returnRequest;
        if (!returnRequest || !statuses.includes(returnRequest.status)) continue;
        requests.push({
          id: `${order._id}:${itemIndex}`,
          orderId: order._id,
          orderNumber: order.orderNumber,
          itemIndex,
          item: {
            name: item.name,
            sku: item.sku,
            options: item.options,
            image: item.image,
            quantity: item.quantity,
            itemTotal: item.itemTotal,
          },
          customer,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          currency: order.currency,
          returnRequest,
        });
      }
      const legacyRequest = order.returnRequest;
      if (legacyRequest && statuses.includes(legacyRequest.status)) {
        requests.push({
          id: `${order._id}:order`,
          orderId: order._id,
          orderNumber: order.orderNumber,
          itemIndex: null,
          item: null,
          customer,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          currency: order.currency,
          returnRequest: legacyRequest,
        });
      }
    }
    requests.sort(
      (left, right) =>
        new Date(right.returnRequest.requestedAt || 0) -
        new Date(left.returnRequest.requestedAt || 0),
    );
    const totalRequests = requests.length;
    const start = (page - 1) * limit;
    return {
      status: 200,
      body: {
        requests: requests.slice(start, start + limit),
        pagination: {
          page,
          limit,
          totalRequests,
          totalPages: Math.ceil(totalRequests / limit),
        },
      },
    };
  } catch (error) {
    console.error("Admin list return requests error:", error);
    return bad(500, "Could not load return requests.");
  }
}

export async function reviewReturn(input) {
  const { orderId } = input.params;
  const decision = input.body?.decision;
  const adminMessage = typeof input.body?.adminMessage === "string"
    ? input.body.adminMessage.trim()
    : "";
  const rawItemIndex = input.body?.itemIndex;
  const itemIndex = rawItemIndex === undefined ? null : Number(rawItemIndex);
  if (!mongoose.isValidObjectId(orderId)) return bad(400, "Invalid order ID.");
  if (!["Accepted", "Rejected"].includes(decision)) return bad(400, "Choose accept or reject.");
  if (!adminMessage) return bad(400, "Enter a message for the customer.");
  if (adminMessage.length > 500) return bad(400, "The customer message must be 500 characters or fewer.");
  if (itemIndex !== null && (!Number.isInteger(itemIndex) || itemIndex < 0)) return bad(400, "Choose a valid order item.");
  const session = await mongoose.startSession();
  try {
    let updated;
    let refundAmount = 0;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) { const e = new Error("Order not found."); e.status = 404; throw e; }
      const item = itemIndex === null ? null : order.items[itemIndex];
      if (itemIndex !== null && !item) {
        const e = new Error("That product is not part of this order."); e.status = 404; throw e;
      }
      if (item && (item.fulfillmentStatus || order.orderStatus) !== "Delivered") {
        const e = new Error("Returns can be reviewed only after that product is delivered."); e.status = 409; throw e;
      }
      if (!item && order.orderStatus !== "Delivered") {
        const e = new Error("Returns can be reviewed only after delivery."); e.status = 409; throw e;
      }
      const returnRequest = item ? item.returnRequest : order.returnRequest;
      if (returnRequest?.status !== "Requested") {
        const e = new Error("This product has no return request that can be reviewed."); e.status = 409; throw e;
      }
      if (decision === "Accepted" && order.paymentStatus !== "Paid") {
        const e = new Error("A return refund can be credited only for a paid order."); e.status = 409; throw e;
      }
      if (decision === "Accepted" && item && order.inventoryStatus === "Deducted") {
        const result = item.variantId
          ? await Product.updateOne({ _id: item.productId, "variants._id": item.variantId }, { $inc: { "variants.$.stockQuantity": item.quantity } }, { session })
          : await Product.updateOne({ _id: item.productId, $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }] }, { $inc: { stockQuantity: item.quantity } }, { session });
        if (result.matchedCount !== 1) throw new Error(`Could not restore stock for ${item.name}.`);
      } else if (decision === "Accepted" && !item && order.inventoryStatus === "Deducted") {
        // Legacy order-level return requests: preserve their original behavior.
        for (const legacyItem of order.items) {
          const result = legacyItem.variantId
            ? await Product.updateOne({ _id: legacyItem.productId, "variants._id": legacyItem.variantId }, { $inc: { "variants.$.stockQuantity": legacyItem.quantity } }, { session })
            : await Product.updateOne({ _id: legacyItem.productId, $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }] }, { $inc: { stockQuantity: legacyItem.quantity } }, { session });
          if (result.matchedCount !== 1) throw new Error(`Could not restore stock for ${legacyItem.name}.`);
        }
        order.inventoryStatus = "Restored";
      }
      if (decision === "Accepted" && item) {
        const itemSubtotal = Number(item.itemTotal) || 0;
        const discountShare = order.subtotal > 0
          ? Number(((order.discountAmount * itemSubtotal) / order.subtotal).toFixed(2))
          : 0;
        refundAmount = Math.max(0, Number((itemSubtotal - discountShare).toFixed(2)));
        if (!Number.isFinite(refundAmount) || refundAmount < 0) {
          const e = new Error("The product refund amount is invalid."); e.status = 409; throw e;
        }
        if (refundAmount > 0) {
          await Wallet.findOneAndUpdate(
            { userId: order.userId },
            {
              $inc: { balance: refundAmount },
              $push: {
                transactions: {
                  type: "Credit",
                  amount: refundAmount,
                  description: `Return refund for ${item.name} in order ${order.orderNumber}`,
                  orderId: order._id,
                },
              },
            },
            { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true },
          );
        }
        item.fulfillmentStatus = "Returned";
        const refundedAt = new Date();
        item.fulfillmentHistory.push({ status: "Returned", updatedAt: refundedAt });
        item.refundDestination = "ShopEase Wallet";
        item.refundStatus = "Completed";
        item.refundAmount = refundAmount;
        item.refundCompletedAt = refundedAt;
        order.refundDestination = "ShopEase Wallet";
        order.refundStatus = "Completed";
        order.refundAmount = Number((Number(order.refundAmount || 0) + refundAmount).toFixed(2));
        order.refundCompletedAt = refundedAt;
      } else if (decision === "Accepted") {
        refundAmount = Number(order.totalAmount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          const e = new Error("The order refund amount is invalid."); e.status = 409; throw e;
        }
        await Wallet.findOneAndUpdate(
          { userId: order.userId },
          {
            $inc: { balance: refundAmount },
            $push: {
              transactions: {
                type: "Credit",
                amount: refundAmount,
                description: `Return refund for order ${order.orderNumber}`,
                orderId: order._id,
              },
            },
          },
          { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true },
        );
        const refundedAt = new Date();
        order.refundDestination = "ShopEase Wallet";
        order.refundStatus = "Completed";
        order.refundAmount = Number((Number(order.refundAmount || 0) + refundAmount).toFixed(2));
        order.refundCompletedAt = refundedAt;
        order.paymentStatus = "Refunded";
        for (const returnedItem of order.items) {
          if (returnedItem.isCancelled) continue;
          returnedItem.fulfillmentStatus = "Returned";
          returnedItem.fulfillmentHistory.push({ status: "Returned", updatedAt: refundedAt });
          returnedItem.refundDestination = "ShopEase Wallet";
          returnedItem.refundStatus = "Completed";
          const itemSubtotal = Number(returnedItem.itemTotal) || 0;
          const discountShare = order.subtotal > 0
            ? Number(((order.discountAmount * itemSubtotal) / order.subtotal).toFixed(2))
            : 0;
          returnedItem.refundAmount = Math.max(0, Number((itemSubtotal - discountShare).toFixed(2)));
          returnedItem.refundCompletedAt = refundedAt;
        }
      }
      returnRequest.status = decision;
      returnRequest.reviewedAt = new Date();
      returnRequest.adminMessage = adminMessage;
      if (decision === "Accepted" && item) {
        const allItemsRefunded = order.items.every((orderItem) =>
          orderItem.isCancelled || orderItem.returnRequest?.status === "Accepted",
        );
        if (allItemsRefunded) order.paymentStatus = "Refunded";
      }
      await order.save({ session });
      updated = order;
    });
    const message = decision === "Accepted"
      ? refundAmount > 0
        ? `Return accepted${itemIndex === null ? "" : ` for ${updated.items[itemIndex].name}`}. ${new Intl.NumberFormat("en-IN", { style: "currency", currency: updated.currency || "INR", maximumFractionDigits: 2 }).format(refundAmount)} was credited to the customer's ShopEase Wallet.`
        : `Return accepted${itemIndex === null ? "" : ` for ${updated.items[itemIndex].name}`}. No refund was due for this product.`
      : `Return request rejected${itemIndex === null ? "" : ` for ${updated.items[itemIndex].name}`}.`;
    return { status: 200, body: { message, order: updated } };
  } catch (error) {
    console.error("Admin review return error:", error);
    return bad(error.status || (isTransactionsUnavailable(error) ? 503 : 500), error.status ? error.message : isTransactionsUnavailable(error) ? transactionsUnavailableMessage : error.message || "Could not review return request.");
  } finally {
    await session.endSession();
  }
}

export async function getDashboardSummary() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const [orders, customers, blockedUsers, products, revenue, recentOrders, revenueByDay] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "customer", isBlocked: true }),
      Product.countDocuments({ active: true }),
      Order.aggregate([
        { $match: { paymentStatus: "Paid", orderStatus: { $ne: "Cancelled" } } },
        {
          $project: {
            totalAmount: 1,
            subtotal: 1,
            discountAmount: 1,
            legacyReturnAccepted: { $eq: ["$returnRequest.status", "Accepted"] },
            returnedItemsAmount: {
              $reduce: {
                input: { $ifNull: ["$items", []] },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $eq: ["$$this.returnRequest.status", "Accepted"] },
                        {
                          $cond: [
                            { $gt: ["$subtotal", 0] },
                            {
                              $subtract: [
                                "$$this.itemTotal",
                                {
                                  $multiply: [
                                    "$discountAmount",
                                    { $divide: ["$$this.itemTotal", "$subtotal"] },
                                  ],
                                },
                              ],
                            },
                            "$$this.itemTotal",
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  "$legacyReturnAccepted",
                  0,
                  { $max: [0, { $subtract: ["$totalAmount", "$returnedItemsAmount"] }] },
                ],
              },
            },
          },
        },
      ]), 
      Order.find().sort({ createdAt: -1 }).limit(6).populate("userId", "fullName email").lean(),
      Order.aggregate([
        { $match: { paymentStatus: "Paid", orderStatus: { $ne: "Cancelled" }, createdAt: { $gte: sevenDaysAgo } } },
        { $project: {
          createdAt: 1,
          totalAmount: 1,
          subtotal: 1,
          discountAmount: 1,
          legacyReturnAccepted: { $eq: ["$returnRequest.status", "Accepted"] },
          returnedItemsAmount: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $cond: [
                { $eq: ["$$this.returnRequest.status", "Accepted"] },
                { $cond: [{ $gt: ["$subtotal", 0] },
                  { $subtract: ["$$this.itemTotal", { $multiply: ["$discountAmount", { $divide: ["$$this.itemTotal", "$subtotal"] }] }] },
                  "$$this.itemTotal"] },
                0,
              ] }] },
            },
          },
        } },
        { $project: { day: { $dateTrunc: { date: "$createdAt", unit: "day" } }, amount: { $cond: ["$legacyReturnAccepted", 0, { $max: [0, { $subtract: ["$totalAmount", "$returnedItemsAmount"] }] }] } } },
        { $group: { _id: "$day", amount: { $sum: "$amount" } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const orderStatus = await Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]);
    const revenueDays = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(sevenDaysAgo);
      day.setDate(day.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      const match = revenueByDay.find((item) => new Date(item._id).toISOString().slice(0, 10) === key);
      return { date: key, amount: match?.amount || 0 };
    });
    return { status: 200, body: { summary: { totalOrders: orders, customers, blockedUsers, listedProducts: products, paidRevenue: revenue[0]?.total || 0, orderStatus }, revenueDays, recentOrders } };
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return bad(500, "Could not load dashboard.");
  }
}
