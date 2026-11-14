import mongoose from "mongoose";
import Product from "../models/Product.js";
import { isCloudinaryConfigured, uploadProductImage } from "../config/cloudinary.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";
import { caseInsensitiveExact } from "./adminSharedService.js";

function parseNonNegativeNumber(value, field, { integer = false, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) {
    return { value: null };
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) {
    return { error: `${field} must be a non-negative ${integer ? "whole number" : "number"}.` };
  }
  return { value: number };
}


function validateImageList(images, { minimum = 2, maximum = 5, field = "Product images" } = {}) {
  if (!Array.isArray(images) || images.length < minimum || images.length > maximum) {
    return `${field} must contain between ${minimum} and ${maximum} image URLs.`;
  }
  if (images.some((url) => typeof url !== "string" || !/^https:\/\//i.test(url.trim()))) {
    return `${field} must contain valid HTTPS image URLs.`;
  }
  return null;
}

function normalizeProductFields(body, { requireAll = false } = {}) {
  const allowedFields = [
    "name", "slug", "description", "categoryId", "brand", "sku", "price",
    "compareAtPrice", "stockQuantity", "images", "specifications", "warranty",
    "tags", "isFeatured", "active", "variants",
  ];
  const normalized = Object.fromEntries(
    allowedFields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]),
  );
  const requiredText = ["name", "slug", "description"];
  for (const field of requiredText) {
    if ((requireAll || body[field] !== undefined) &&
      (typeof body[field] !== "string" || !body[field].trim())) {
      return { error: `${field[0].toUpperCase()}${field.slice(1)} is required.` };
    }
    if (typeof body[field] === "string") normalized[field] = body[field].trim();
  }
  if (normalized.name?.length > 200 || normalized.slug?.length > 200 || normalized.description?.length > 10000) {
    return { error: "Name, slug, or description is longer than allowed." };
  }

  if (normalized.slug) normalized.slug = normalized.slug.toLowerCase();
  if (normalized.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized.slug)) {
    return { error: "Slug may contain letters, numbers, and single hyphens only." };
  }
  if (normalized.brand !== undefined && typeof normalized.brand !== "string") {
    return { error: "Brand must be text." };
  }
  if (normalized.brand !== undefined) normalized.brand = normalized.brand.trim();
  if (normalized.warranty !== undefined && typeof normalized.warranty !== "string") {
    return { error: "Warranty must be text." };
  }
  if (normalized.warranty !== undefined) normalized.warranty = normalized.warranty.trim();
  if (normalized.isFeatured !== undefined && typeof normalized.isFeatured !== "boolean") {
    return { error: "Featured status must be true or false." };
  }
  if (normalized.active !== undefined && typeof normalized.active !== "boolean") {
    return { error: "Product listing status must be true or false." };
  }

  for (const field of ["price", "compareAtPrice", "stockQuantity"]) {
    const isRequired = requireAll && field !== "compareAtPrice";
    if (normalized[field] === undefined && !isRequired) continue;
    const parsed = parseNonNegativeNumber(normalized[field], field, {
      integer: field === "stockQuantity",
      optional: field === "compareAtPrice",
    });
    if (parsed.error) return { error: parsed.error };
    normalized[field] = parsed.value;
  }
  if (normalized.price != null && normalized.compareAtPrice != null && normalized.compareAtPrice <= normalized.price) {
    return { error: "Compare-at price must be greater than the selling price." };
  }

  if (normalized.images !== undefined || requireAll) {
    const imageError = validateImageList(normalized.images);
    if (imageError) return { error: imageError };
    normalized.images = normalized.images.map((url) => url.trim());
  }
  if (normalized.tags !== undefined &&
    (!Array.isArray(normalized.tags) || normalized.tags.some((tag) => typeof tag !== "string"))) {
    return { error: "Tags must be an array of text values." };
  }
  if (normalized.tags) normalized.tags = normalized.tags.map((tag) => tag.trim()).filter(Boolean);
  if (normalized.specifications !== undefined &&
    (!normalized.specifications || typeof normalized.specifications !== "object" || Array.isArray(normalized.specifications) ||
      Object.values(normalized.specifications).some((value) => typeof value !== "string"))) {
    return { error: "Specifications must be an object of text values." };
  }

  if (normalized.variants !== undefined || requireAll) {
    if (!Array.isArray(normalized.variants)) return { error: "Variants must be an array." };
    if (normalized.variants.length > 100) return { error: "A product cannot have more than 100 variants." };
    const variantSkus = new Set();
    const variants = [];
    for (const variant of normalized.variants) {
      if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
        return { error: "Each variant must be an object." };
      }
      if (typeof variant.sku !== "string" || !variant.sku.trim()) {
        return { error: "Every variant needs a SKU." };
      }
      const sku = variant.sku.trim().toUpperCase();
      if (variantSkus.has(sku.toLowerCase())) return { error: "Variant SKUs must be unique within the product." };
      variantSkus.add(sku.toLowerCase());
      const price = parseNonNegativeNumber(variant.price, "Variant price");
      const stockQuantity = parseNonNegativeNumber(variant.stockQuantity, "Variant stock quantity", { integer: true });
      const compareAtPrice = parseNonNegativeNumber(variant.compareAtPrice, "Variant compare-at price", { optional: true });
      if (price.error || stockQuantity.error || compareAtPrice.error) {
        return { error: price.error || stockQuantity.error || compareAtPrice.error };
      }
      if (compareAtPrice.value != null && compareAtPrice.value <= price.value) {
        return { error: "Variant compare-at price must be greater than its selling price." };
      }
      if (variant.active !== undefined && typeof variant.active !== "boolean") {
        return { error: "Variant listing status must be true or false." };
      }
      const optionValues = variant.options || {};
      if (!optionValues || typeof optionValues !== "object" || Array.isArray(optionValues) ||
        [optionValues.color, optionValues.storage].some((value) => value !== undefined && typeof value !== "string")) {
        return { error: "Variant color and storage options must be text." };
      }
      const variantImages = variant.images ?? [];
      const imageError = validateImageList(variantImages, { minimum: 0, maximum: 5, field: "Variant images" });
      if (imageError) return { error: imageError };
      variants.push({
        ...(variant._id && mongoose.isValidObjectId(variant._id) ? { _id: variant._id } : {}),
        sku,
        options: { color: optionValues.color?.trim() || "", storage: optionValues.storage?.trim() || "" },
        price: price.value,
        compareAtPrice: compareAtPrice.value,
        stockQuantity: stockQuantity.value,
        images: variantImages.map((url) => url.trim()),
        active: variant.active ?? true,
      });
    }
    normalized.variants = variants;
  }

  const hasVariants = normalized.variants?.length > 0;
  if (hasVariants) {
    normalized.sku = undefined;
    normalized.price = null;
    normalized.compareAtPrice = null;
    normalized.stockQuantity = 0;
  } else if (requireAll && (normalized.price == null || normalized.stockQuantity == null)) {
    return { error: "Enter product price and stock, or add variants." };
  }
  if (normalized.sku !== undefined && normalized.sku !== null && typeof normalized.sku !== "string") {
    return { error: "Product SKU must be text." };
  }
  if (typeof normalized.sku === "string") normalized.sku = normalized.sku.trim().toUpperCase() || undefined;
  return { value: normalized };
}

async function validateProductCategory(categoryId) {
  if (!mongoose.isValidObjectId(categoryId)) return "A valid category is required.";
  const visibleIds = await getVisibleStoreCategoryIds();
  return visibleIds.some((id) => String(id) === String(categoryId))
    ? null
    : "Active category (with active parent categories) not found.";
}

//---------------------------------------Product Management-------------------------------------------

async function uploadProductImages(input) {
  if (!isCloudinaryConfigured()) {
    return {
      status: 503,
      body: { message: "Image storage is not configured." },
    };
  }
  if (!input.files?.length) {
    return {
      status: 400,
      body: { message: "Choose at least one image file." },
    };
  }

  try {
    const uploadedImages = await Promise.all(
      input.files.map((file) => uploadProductImage(file.buffer)),
    );
    return {
      status: 201,
      body: {
        images: uploadedImages.map((image) => ({
          url: image.secure_url,
          publicId: image.public_id,
        })),
      },
    };
  } catch (error) {
    console.error("Product image upload error:", error);
    return {
      status: 502,
      body: { message: "Could not upload product images." },
    };
  }
}

async function createProduct(input) {
  try {
    const body = input.body || {};
    const normalizedResult = normalizeProductFields(body, { requireAll: true });
    if (normalizedResult.error) return { status: 400, body: { message: normalizedResult.error } };
    const productData = normalizedResult.value;
    const categoryError = await validateProductCategory(body.categoryId);
    if (categoryError) return { status: 400, body: { message: categoryError } };
    productData.categoryId = body.categoryId;

    const duplicateFilters = [];
    if (productData.slug) duplicateFilters.push({ slug: productData.slug });
    if (productData.sku) duplicateFilters.push(caseInsensitiveExact("sku", productData.sku));
    for (const variant of productData.variants || []) duplicateFilters.push(caseInsensitiveExact("variants.sku", variant.sku));
    if (duplicateFilters.length && await Product.exists({ $or: duplicateFilters })) {
      return { status: 409, body: { message: "A product or variant already uses that slug or SKU." } };
    }

    const product = await Product.create(productData);

    return {
      status: 201,
      body: {
        message: "Product created successfully.",
        product,
      },
    };
  } catch (error) {
    console.error("Create product error:", error);

    // MongoDB duplicate-key error, such as duplicate slug or SKU
    if (error.code === 11000) {
      return {
        status: 409,
        body: {
          message: "A product with that slug or SKU already exists.",
        },
      };
    }

    return {
      status: 500,
      body: { message: "Could not create product." },
    };
  }
}


async function listProducts(input) {
  try {
    const searchInput = input.query?.search;
    if (searchInput !== undefined && typeof searchInput !== "string") {
      return { status: 400, body: { message: "Search must be text." } };
    }
    const search = searchInput?.trim() || "";
    const sort = input.query?.sort || "newest";
    const categoryId = input.query?.categoryId;
    const status = input.query?.status || "all";

    const filter = {};

    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) {
        return { status: 400, body: { message: "Invalid category ID." } };
      }
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (!["newest", "oldest"].includes(sort)) {
      return {
        status: 400,
        body: { message: "Invalid product sort option." },
      };
    }
    const sortOrder =
      sort === "oldest"
        ? { createdAt: 1, _id: 1 }
        : { createdAt: -1, _id: -1 };
    if (!["all", "listed", "unlisted"].includes(status)) {
      return { status: 400, body: { message: "Invalid product status filter." } };
    }
    if (status === "listed") filter.active = true;
    if (status === "unlisted") filter.active = false;

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = { $regex: safeSearch, $options: "i" };

      filter.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { sku: searchRegex },
        { "variants.sku": searchRegex },
        { slug: searchRegex },
      ];
    }

    const page = Math.max(Number.parseInt(input.query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(input.query.limit, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .populate("categoryId", "name")
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return {
      status: 200,
      body: {
        products,
        pagination: {
          page,
          limit,
          totalProducts,
          totalPages: Math.ceil(totalProducts / limit),
        },
      },
    };
  } catch (error) {
    console.error("Get products error:", error);

    return {
      status: 500,
      body: { message: "Could not load products." },
    };
  }
}

async function unlistProduct(input) {
  try {
    const { productId } = input.params;

    if (!mongoose.isValidObjectId(productId)) {
      return {
        status: 400,
        body: { message: "Invalid product ID." },
      };
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { $set: { active: false } },
      { new: true, runValidators: true },
    );

    if (!product) {
      return {
        status: 404,
        body: { message: "Product not found." },
      };
    }

    return {
      status: 200,
      body: { message: "Product unlisted.", product },
    };
  } catch (error) {
    console.error("Unlist product error:", error);
    return {
      status: 500,
      body: { message: "Could not unlist product." },
    };
  }
}

async function deleteProduct(input) {
  try {
    const { productId } = input.params;

    if (!mongoose.isValidObjectId(productId)) {
      return {
        status: 400,
        body: { message: "Invalid product ID." },
      };
    }

    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      return {
        status: 404,
        body: { message: "Product not found." },
      };
    }

    return {
      status: 200,
      body: { message: "Product permanently deleted." },
    };
  } catch (error) {
    console.error("Delete product error:", error);
    return {
      status: 500,
      body: { message: "Could not delete product." },
    };
  }
}

async function updateProduct(input) {
  try {
    const { productId } = input.params;
    const body = input.body || {};

    if (!mongoose.isValidObjectId(productId)) {
      return {
        status: 400,
        body: { message: "Invalid product ID." },
      };
    }

    const existingProduct = await Product.findById(productId).lean();
    if (!existingProduct) {
      return { status: 404, body: { message: "Product not found." } };
    }

    const allowedFields = [
      "name",
      "slug",
      "description",
      "categoryId",
      "brand",
      "sku",
      "price",
      "compareAtPrice",
      "stockQuantity",
      "images",
      "specifications",
      "warranty",
      "tags",
      "isFeatured",
      "active",
      "variants",
    ];

    const providedFields = allowedFields.filter((field) => body[field] !== undefined);
    if (!providedFields.length) {
      return {
        status: 400,
        body: { message: "Provide at least one field to update." },
      };
    }
    const merged = { ...existingProduct, variants: existingProduct.variants || [] };
    for (const field of providedFields) merged[field] = body[field];
    const normalizedResult = normalizeProductFields(merged, { requireAll: true });
    if (normalizedResult.error) return { status: 400, body: { message: normalizedResult.error } };
    const updates = normalizedResult.value;
    updates.categoryId = merged.categoryId;

    if (providedFields.includes("categoryId") || body.active === true) {
      const categoryError = await validateProductCategory(updates.categoryId);
      if (categoryError) return { status: 400, body: { message: categoryError } };
    }

    const skuValues = [updates.sku, ...(updates.variants || []).map((variant) => variant.sku)]
      .filter(Boolean);
    const uniqueSkuValues = new Set(skuValues.map((sku) => sku.toLowerCase()));
    if (uniqueSkuValues.size !== skuValues.length) {
      return { status: 400, body: { message: "Product and variant SKUs must be unique." } };
    }
    const duplicateFilters = [];
    if (updates.slug) duplicateFilters.push({ slug: updates.slug });
    for (const sku of skuValues) {
      duplicateFilters.push(caseInsensitiveExact("sku", sku), caseInsensitiveExact("variants.sku", sku));
    }
    if (duplicateFilters.length && await Product.exists({ _id: { $ne: productId }, $or: duplicateFilters })) {
      return { status: 409, body: { message: "Another product or variant already uses that slug or SKU." } };
    }

    // Only update recognized fields, using the validated merged values.
    const updatesToSave = Object.fromEntries(providedFields.map((field) => [field, updates[field]]));
    // For price/stock option switching, keep the base fields consistent with whether variants exist.
    if (providedFields.includes("variants")) {
      updatesToSave.sku = updates.sku;
      updatesToSave.price = updates.price;
      updatesToSave.compareAtPrice = updates.compareAtPrice;
      updatesToSave.stockQuantity = updates.stockQuantity;
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { $set: updatesToSave },
      { returnDocument: "after", runValidators: true },
    );

    if (!product) {
      return {
        status: 404,
        body: { message: "Product not found." },
      };
    }

    return {
      status: 200,
      body: { message: "Product updated successfully.", product },
    };
  } catch (error) {
    console.error("Update product error:", error);

    if (error.code === 11000) {
      return {
        status: 409,
        body: { message: "A product with that slug or SKU already exists." },
      };
    }

    return {
      status: 500,
      body: { message: "Could not update product." },
    };
  }
}

export { createProduct, listProducts, unlistProduct, deleteProduct, updateProduct, uploadProductImages };
