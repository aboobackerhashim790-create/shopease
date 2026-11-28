import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Wallet from "../models/Wallet.js";
import { releaseCouponUse } from "./couponPricing.js";
import { deleteCloudinaryImage, uploadReturnEvidenceImage } from "../config/cloudinary.js";

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];
const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const fulfillmentRanks = { Pending: 0, Confirmed: 1, Shipped: 2, "Out for Delivery": 3, Delivered: 4, Returned: 4 };

function summarizeFulfillment(order) {
  const activeItems = (order.items || []).filter((item) => !item.isCancelled);
  if (activeItems.length === 0) return "Cancelled";
  const itemStatuses = activeItems
    .map((item) => item.fulfillmentStatus || order.orderStatus)
    .filter((status) => status !== "Cancelled");
  if (itemStatuses.length === 0) return "Cancelled";
  return itemStatuses.reduce((slowest, status) =>
    fulfillmentRanks[status] < fulfillmentRanks[slowest] ? status : slowest,
  itemStatuses[0]);
}

function invalid(status, message) {
  return { status, body: { message } };
}

export function isWithinReturnWindow(deliveredAt, now = Date.now()) {
  if (!deliveredAt) return false;
  const deliveryTime = new Date(deliveredAt).getTime();
  return Number.isFinite(deliveryTime) && now <= deliveryTime + RETURN_WINDOW_MS;
}

function isTransactionsUnavailable(error) {
  return [20, 263, 303].includes(error?.code) ||
    /transaction numbers are only allowed|does not support retryable writes/i.test(error?.message || "");
}

function transactionsUnavailableMessage() {
  return "Order cancellation needs MongoDB transactions. Check that your local replica set is running, then restart the backend.";
}

export async function listMyOrders(input) {
  try {
    const query = input.query || {};
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 50);
    const filter = { userId: input.user._id };
    const status = String(query.status || "all");

    if (status !== "all") {
      if (!ORDER_STATUSES.includes(status)) return invalid(400, "Choose a valid order status.");
      filter.orderStatus = status;
    }

    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      filter.$or = [
        { orderNumber: searchRegex },
        { "items.name": searchRegex },
        { "items.sku": searchRegex },
      ];
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      status: 200,
      body: {
        orders,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages: Math.ceil(totalOrders / limit),
        },
      },
    };
  } catch (error) {
    console.error("List customer orders error:", error);
    return invalid(500, "Could not load your orders.");
  }
}

export async function getMyOrder(input) {
  try {
    const { orderId } = input.params;
    if (!mongoose.isValidObjectId(orderId)) return invalid(400, "Invalid order ID.");

    // Including userId means a customer can never read another customer's order.
    const order = await Order.findOne({ _id: orderId, userId: input.user._id }).lean();
    return order ? { status: 200, body: { order } } : invalid(404, "Order not found.");
  } catch (error) {
    console.error("Get customer order error:", error);
    return invalid(500, "Could not load this order.");
  }
}

export async function cancelMyOrder(input) {
  const { orderId } = input.params;
  if (!mongoose.isValidObjectId(orderId)) return invalid(400, "Invalid order ID.");

  const reason = typeof input.body?.reason === "string" ? input.body.reason.trim() : "";
  if (reason.length > 500) return invalid(400, "Cancellation reason must be 500 characters or fewer.");

  const session = await mongoose.startSession();
  try {
    let updatedOrder;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, userId: input.user._id }).session(session);
      if (!order) {
        const error = new Error("Order not found.");
        error.status = 404;
        throw error;
      }
      if (order.orderStatus === "Cancelled") {
        updatedOrder = order;
        return;
      }
      const activeItems = order.items.filter((item) => !item.isCancelled);
      if (!activeItems.length || activeItems.some((item) =>
        !["Pending", "Confirmed"].includes(item.fulfillmentStatus || order.orderStatus),
      )) {
        const error = new Error("This order can no longer be cancelled because one or more products have shipped.");
        error.status = 409;
        throw error;
      }
      // Restore previously deducted inventory in the same transaction as cancellation.
      if (order.inventoryStatus === "Deducted") {
        for (const item of order.items) {
          if (item.isCancelled) continue;
          const stockUpdate = item.variantId
            ? await Product.updateOne(
                { _id: item.productId, "variants._id": item.variantId },
                { $inc: { "variants.$.stockQuantity": item.quantity } },
                { session },
              )
            : await Product.updateOne(
                {
                  _id: item.productId,
                  $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }],
                },
                { $inc: { stockQuantity: item.quantity } },
                { session },
              );
          if (stockUpdate.matchedCount !== 1) {
            const error = new Error(`Could not restore stock for ${item.name}.`);
            error.status = 409;
            throw error;
          }
        }
        order.inventoryStatus = "Restored";
      }

      if (order.couponCode && !order.couponReleased) {
        await releaseCouponUse(order.couponCode, session);
        order.couponReleased = true;
      }

      order.orderStatus = "Cancelled";
      order.cancellationReason = reason;
      for (const item of order.items) {
        if (item.isCancelled) continue;
        item.isCancelled = true;
        item.fulfillmentStatus = "Cancelled";
        item.fulfillmentHistory.push({ status: "Cancelled", updatedAt: new Date() });
        item.cancelledAt = new Date();
        item.cancellationReason = reason;
      }
      if (order.paymentStatus === "Paid") {
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
                  description: `Refund for cancelled order ${order.orderNumber}`,
                  orderId: order._id,
                },
              },
            },
            { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true },
          );
          order.paymentStatus = "Refunded";
          order.walletRefundedAt = new Date();
        } else {
          order.refundDestination = "None";
          order.refundAmount = 0;
          order.refundStatus = "Completed";
          order.paymentStatus = "Cancelled";
        }
      } else {
        order.paymentStatus = "Cancelled";
      }
      await order.save({ session });
      updatedOrder = order;
    });

    return {
      status: 200,
      body: {
        message: updatedOrder.paymentStatus === "Refunded"
          ? "Order cancelled. The paid amount was credited to your ShopEase wallet."
          : "Order cancelled.",
        order: updatedOrder,
      },
    };
  } catch (error) {
    console.error("Cancel customer order error:", error);
    const status = error.status || (isTransactionsUnavailable(error) ? 503 : 500);
    const message = error.status
      ? error.message
      : isTransactionsUnavailable(error)
        ? transactionsUnavailableMessage()
        : "Could not cancel this order.";
    return invalid(status, message);
  } finally {
    await session.endSession();
  }
}

export async function requestMyOrderReturn(input) {
  let uploadedEvidence = [];
  try {
    const { orderId } = input.params;
    const itemIndex = Number(input.body?.itemIndex);
    const reason = typeof input.body?.reason === "string" ? input.body.reason.trim() : "";
    const description = typeof input.body?.description === "string"
      ? input.body.description.trim()
      : "";
    const allowedReasons = [
      "Damaged item",
      "Defective item",
      "Wrong item received",
      "Missing parts or accessories",
      "Item not as described",
      "Other",
    ];
    if (!mongoose.isValidObjectId(orderId)) return invalid(400, "Invalid order ID.");
    if (!Number.isInteger(itemIndex) || itemIndex < 0) return invalid(400, "Choose a valid product to return.");
    if (!allowedReasons.includes(reason)) return invalid(400, "Choose a valid reason for the return.");
    if (!description) return invalid(400, "Please describe why you want to return this product.");
    if (description.length > 1000) return invalid(400, "Return description must be 1,000 characters or fewer.");
    if ((input.files || []).length > 4) return invalid(400, "You can attach up to 4 images.");

    const order = await Order.findOne({ _id: orderId, userId: input.user._id });
    if (!order) return invalid(404, "Order not found.");
    if (order.returnRequest?.status && order.returnRequest.status !== "None") {
      return invalid(409, "A return request for this order was already submitted under the previous return system.");
    }
    const item = order.items[itemIndex];
    if (!item) return invalid(404, "That product is not part of this order.");
    if ((item.fulfillmentStatus || order.orderStatus) !== "Delivered") {
      return invalid(409, "You can request a return only after this product is delivered.");
    }
    const deliveredAt = item.deliveredAt || order.deliveredAt || order.updatedAt;
    if (!isWithinReturnWindow(deliveredAt)) {
      return invalid(409, "The 7-day return window has expired.");
    }
    if (!order.deliveredAt && order.items.every((orderItem) => (orderItem.fulfillmentStatus || order.orderStatus) === "Delivered")) {
      order.deliveredAt = deliveredAt;
    }
    // Older order records may not have this subdocument yet. Create it before
    // assigning its fields so the request works for both old and new orders.
    if (!item.returnRequest) item.returnRequest = { status: "None" };
    if (["Requested", "Accepted"].includes(item.returnRequest?.status)) {
      return invalid(409, "A return request has already been submitted for this product.");
    }

    for (const file of input.files || []) {
      const uploaded = await uploadReturnEvidenceImage(file.buffer);
      uploadedEvidence.push({ url: uploaded.secure_url, publicId: uploaded.public_id });
    }

    item.returnRequest.status = "Requested";
    item.returnRequest.reason = reason;
    item.returnRequest.description = description;
    item.returnRequest.evidenceImages = uploadedEvidence;
    item.returnRequest.requestedAt = new Date();
    item.returnRequest.reviewedAt = null;
    await order.save();

    uploadedEvidence = [];
    return { status: 201, body: { message: `Return request submitted for ${item.name}.`, order } };
  } catch (error) {
    await Promise.all(
      uploadedEvidence.map((image) =>
        deleteCloudinaryImage(image.publicId).catch(() => undefined),
      ),
    );
    console.error("Request customer order return error:", error);
    return invalid(500, "Could not submit the return request.");
  }
}
export async function cancelMyOrderItem(input) {
  const { orderId, itemIndex: rawItemIndex } = input.params;
  const itemIndex = Number(rawItemIndex);
  const reason = typeof input.body?.reason === "string"
    ? input.body.reason.trim()
    : "";
  if (!mongoose.isValidObjectId(orderId)) {
    return invalid(400, "Invalid order ID.");
  }

  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    return invalid(400, "Choose a valid product.");
  }

  if (reason.length > 500) {
    return invalid(400, "Cancellation reason must be 500 characters or fewer.");
  }
  const session = await mongoose.startSession();

  try {
    let updatedOrder;
    let refundAmount = 0;
    let wasPaid = false;

    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        userId: input.user._id,
      }).session(session);

      if (!order) {
        const error = new Error("Order not found.");
        error.status = 404;
        throw error;
      }

      wasPaid = order.paymentStatus === "Paid";

      const activeItems = order.items.filter((item) => !item.isCancelled);
      if (!activeItems.length || activeItems.some((item) => !["Pending", "Confirmed"].includes(item.fulfillmentStatus || order.orderStatus))) {
        const error = new Error("Products can only be cancelled before shipment.");
        error.status = 409;
        throw error;
      }

      const item = order.items[itemIndex];

      if (!item) {
        const error = new Error("Product not found in this order.");
        error.status = 404;
        throw error;
      }

      if (item.isCancelled) {
        const error = new Error("This product has already been cancelled.");
        error.status = 409;
        throw error;
      }
      if (!["Pending", "Confirmed"].includes(item.fulfillmentStatus || order.orderStatus)) {
        const error = new Error("Products can only be cancelled before shipment.");
        error.status = 409;
        throw error;
      }

      const itemSubtotal = Number(item.itemTotal) || 0;
      const discountShare = order.subtotal > 0
        ? Number(((order.discountAmount * itemSubtotal) / order.subtotal).toFixed(2))
        : 0;

      refundAmount = Math.max(0, Number((itemSubtotal - discountShare).toFixed(2)));

      if (order.inventoryStatus === "Deducted") {
        const stockUpdate = item.variantId
          ? await Product.updateOne(
              { _id: item.productId, "variants._id": item.variantId },
              { $inc: { "variants.$.stockQuantity": item.quantity } },
              { session },
            )
          : await Product.updateOne(
              {
                _id: item.productId,
                $or: [{ variants: { $size: 0 } }, { variants: { $exists: false } }, { variants: null }],
              },
              { $inc: { stockQuantity: item.quantity } },
              { session },
            );

        if (stockUpdate.matchedCount !== 1) {
          const error = new Error(`Could not restore stock for ${item.name}.`);
          error.status = 409;
          throw error;
        }
      }

      item.isCancelled = true;
      item.fulfillmentStatus = "Cancelled";
      item.fulfillmentHistory.push({ status: "Cancelled", updatedAt: new Date() });
      item.cancelledAt = new Date();
      item.cancellationReason = reason;

      order.subtotal = Math.max(0, Number((order.subtotal - itemSubtotal).toFixed(2)));
      order.discountAmount = Math.max(0, Number((order.discountAmount - discountShare).toFixed(2)));
      order.totalAmount = Math.max(0, Number((order.totalAmount - refundAmount).toFixed(2)));

      if (order.paymentStatus === "Paid" && refundAmount > 0) {
        item.refundDestination = "ShopEase Wallet";
        item.refundAmount = refundAmount;
        item.refundStatus = "Completed";
      }
      if (order.paymentStatus === "Paid" && refundAmount > 0) {
        await Wallet.findOneAndUpdate(
          { userId: order.userId },
          {
            $inc: { balance: refundAmount },
            $push: {
              transactions: {
                type: "Credit",
                amount: refundAmount,
                description: `Refund for ${item.name} in order ${order.orderNumber}`,
                orderId: order._id,
              },
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
            session,
            setDefaultsOnInsert: true,
          },
        );
      }
      const allItemsCancelled = order.items.every((orderItem) => orderItem.isCancelled);

      if (allItemsCancelled) {
        order.orderStatus = "Cancelled";
        order.inventoryStatus = "Restored";

        if (order.couponCode && !order.couponReleased) {
          await releaseCouponUse(order.couponCode, session);
          order.couponReleased = true;
        }

        if (order.paymentStatus === "Paid") {
          const refundedItems = order.items.filter((orderItem) => orderItem.refundDestination && orderItem.refundDestination !== "None");
          const allRefundsWentToWallet = refundedItems.every((orderItem) => orderItem.refundDestination === "ShopEase Wallet");
          const allRefundsCompleted = refundedItems.length > 0 && refundedItems.every((orderItem) => ["Completed", "Processed"].includes(orderItem.refundStatus));
          if (allRefundsCompleted) {
            order.paymentStatus = "Refunded";
            order.refundDestination = allRefundsWentToWallet ? "ShopEase Wallet" : refundedItems.every((orderItem) => orderItem.refundDestination === "Razorpay") ? "Razorpay" : "Mixed";
            order.refundStatus = "Completed";
            order.refundAmount = refundedItems.reduce((sum, orderItem) => sum + (Number(orderItem.refundAmount) || 0), 0);
            if (allRefundsWentToWallet) order.walletRefundedAt = new Date();
            order.refundCompletedAt = new Date();
          }
        } else {
          order.paymentStatus = "Cancelled";
        }
      } else {
        order.orderStatus = summarizeFulfillment(order);
      }

      await order.save({ session });
      updatedOrder = order;
    });

    return {
      status: 200,
      body: {
        message: wasPaid && refundAmount > 0
          ? "Product cancelled. Its refund was credited to your ShopEase Wallet."
          : "Product cancelled.",
        order: updatedOrder,
      },
    };
  } catch (error) {
    console.error("Cancel order item error:", error);
    const status = error.status || (isTransactionsUnavailable(error) ? 503 : 500);
    const message = error.status
      ? error.message
      : isTransactionsUnavailable(error)
        ? transactionsUnavailableMessage()
        : "Could not cancel this product.";
    return invalid(status, message);
  } finally {
    await session.endSession();
  }
}
