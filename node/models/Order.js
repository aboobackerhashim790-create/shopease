import mongoose from "mongoose";

const returnEvidenceImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Snapshots: preserve what the customer bought at order time.
    name: { type: String, required: true, trim: true },
    sku: { type: String, default: "" },
    options: {
      color: { type: String, default: "" },
      storage: { type: String, default: "" },
    },
    image: { type: String, default: "" },

    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    itemTotal: { type: Number, required: true, min: 0 },
    fulfillmentStatus: {
      type: String,
      enum: ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Returned", "Cancelled"],
    },
    fulfillmentHistory: {
      type: [new mongoose.Schema(
        {
          status: {
            type: String,
            enum: ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Returned", "Cancelled"],
            required: true,
          },
          updatedAt: { type: Date, required: true },
        },
        { _id: false },
      )],
      default: [],
    },
    deliveredAt: { type: Date, default: null },
    returnRequest: {
      status: { type: String, enum: ["None", "Requested", "Accepted", "Rejected"], default: "None" },
      reason: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, maxlength: 1000, default: "" },
      evidenceImages: { type: [returnEvidenceImageSchema], default: [] },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      adminMessage: { type: String, trim: true, maxlength: 500, default: "" },
    },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, default: "" },
    refundDestination: {
      type: String,
      enum: ["None", "ShopEase Wallet", "Razorpay"],
      default: "None",
    },
    refundStatus: {
      type: String,
      enum: ["None", "Pending", "Processing", "Processed", "Failed", "Completed"],
      default: "None",
    },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundCompletedAt: { type: Date, default: null },
    razorpayRefundId: { type: String, default: "" },
  },
  { _id: false },
);

const deliveryAddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purchaseType: {
      type: String,
      enum: ["Cart", "BuyNow"],
      default: "Cart",
    },

    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "An order must contain at least one item.",
      },
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true, default: "" },
    couponReleased: { type: Boolean, default: false },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },
    // Set when an admin marks the order delivered; return eligibility is based on this date.
    deliveredAt: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay", "Wallet"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Cancelled", "Refunded"],
      default: "Pending",
    },
    refundDestination: {
      type: String,
      enum: ["None", "ShopEase Wallet", "Razorpay", "Mixed"],
      default: "None",
    },
    refundStatus: {
      type: String,
      enum: ["None", "Pending", "Processing", "Processed", "Failed", "Completed"],
      default: "None",
    },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundCompletedAt: { type: Date, default: null },
    razorpayRefundId: { type: String, default: "" },
    walletRefundedAt: { type: Date, default: null },

    // Service code should update this as part of the same transaction as stock.
    inventoryStatus: {
      type: String,
      enum: ["Pending", "Deducted", "Restored"],
      default: "Pending",
    },

    cancellationReason: { type: String, trim: true, default: "" },
    returnRequest: {
      status: {
        type: String,
        enum: ["None", "Requested", "Accepted", "Rejected"],
        default: "None",
      },
      reason: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, maxlength: 1000, default: "" },
      evidenceImages: { type: [returnEvidenceImageSchema], default: [] },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      adminMessage: { type: String, trim: true, maxlength: 500, default: "" },
    },

    // Keep payment provider IDs for verification and troubleshooting.
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },

    // A client-generated key can prevent duplicate order creation on retries.
    idempotencyKey: { type: String, default: undefined },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);

export default mongoose.model("Order", orderSchema);
