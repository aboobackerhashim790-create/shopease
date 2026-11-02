import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    options: {
      color: { type: String, trim: true, default: "" },
      storage: { type: String, trim: true, default: "" },
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
      default: 0,
    },
    images: {
      type: [String],
      validate: {
        validator: (images) => images.length <= 5,
        message: "A variant can have no more than five images.",
      },
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      unique: true,
      sparse: true,
    },
    price: {
      type: Number,
      min: 0,
      default: null,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    stockQuantity: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    warranty: {
      type: String,
      trim: true,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.model("product", productSchema);
