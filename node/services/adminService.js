import mongoose from "mongoose";
import User from "../models/User.js";
import Address from "../models/Address.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { isCloudinaryConfigured, uploadProductImage } from "../config/cloudinary.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";


// ---------------------User Management -------------------------


async function getCustomerDetails(input) {
  try {
    if (!mongoose.isValidObjectId(input.params.userId)) {
      return {
        status: 400,
        body: {
          message: "Invalid customer ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const customer = await User.findOne({
      _id: input.params.userId,
      role: "customer",
    })
      .select(
        "fullName email role isVerified isBlocked personalReferralCode profilePhotoUrl createdAt",
      )
      .lean();
    if (!customer)
      return {
        status: 404,
        body: {
          message: "Customer not found.",
        },
        authUserId: input.authUserId,
      };
    const addresses = await Address.find({
      user: customer._id,
    })
      .sort({
        isDefault: -1,
        createdAt: -1,
      })
      .lean();
    return {
      status: 200,
      body: {
        customer,
        addresses,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Get customer details error:", error);
    return {
      status: 500,
      body: {
        message: "Could not load customer details.",
      },
      authUserId: input.authUserId,
    };
  }
}



async function listUsers(input) {
  try {
    const blockedFilter = {
      role: "customer",
      isBlocked: true,
    };
    const blockedUsersCount = await User.countDocuments(blockedFilter);
    const page = Math.max(Number.parseInt(input.query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(input.query.limit, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const searchInput = input.query?.search;
    if (searchInput !== undefined && typeof searchInput !== "string") {
      return { status: 400, body: { message: "Search must be text." } };
    }
    const search = searchInput?.trim() || "";
    const sort = input.query.sort === "oldest" ? "oldest" : "latest";
    const sortDirection = sort === "oldest" ? 1 : -1;
    const userFilter = {
      role: "customer",
    };
    if (input.query.status === "blocked") {
      userFilter.isBlocked = true;
    } else if (input.query.status === "active") {
      userFilter.isBlocked = false;
    }
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      userFilter.$or = [
        {
          fullName: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          email: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }
    const [users, totalUsers] = await Promise.all([
      User.find(userFilter)
        .select("fullName email role isVerified isBlocked createdAt")
        .sort({
          createdAt: sortDirection,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(userFilter),
    ]);
    return {
      status: 200,
      body: {
        users,
        count: blockedUsersCount,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Get users error:", error);
    return {
      status: 500,
      body: {
        message: "Could not load users.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function blockUser(input) {
  try {
    const { isBlocked } = input.body || {};
    if (typeof isBlocked !== "boolean") {
      return {
        status: 400,
        body: {
          message: "isBlocked must be true or false.",
        },
        authUserId: input.authUserId,
      };
    }
    if (!mongoose.isValidObjectId(input.params.userId)) {
      return {
        status: 400,
        body: {
          message: "Invalid user ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const user = await User.findOneAndUpdate(
      {
        _id: input.params.userId,
        role: "customer",
      },
      {
        $set: {
          isBlocked,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).select("fullName email role isBlocked");
    if (!user) {
      return {
        status: 404,
        body: {
          message: "Customer not found.",
        },
        authUserId: input.authUserId,
      };
    }
    return {
      status: 200,
      body: {
        message: isBlocked ? "Customer blocked." : "Customer unblocked.",
        user,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Update customer block status error:", error);
    return {
      status: 500,
      body: {
        message: "Could not update customer status.",
      },
      authUserId: input.authUserId,
    };
  }
}

//------------------ Category Management -------------------------------

async function createCategory(input) {
  try {
    const { name, slug, active = true, sortOrder = 0, parentCategoryId } = input.body || {};
    if (typeof name !== "string" || !name.trim() || typeof slug !== "string" || !slug.trim()) {
      return {
        status: 400,
        body: {
          message: "Name and Slug are required"
        }
      }
    }

    if (typeof active !== "boolean" || !Number.isFinite(Number(sortOrder))) {
      return { status: 400, body: { message: "Active must be true or false and sort order must be a number." } };
    }
    if (Number(sortOrder) < 0 || name.trim().length > 120 || slug.trim().length > 160 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug.trim())) {
      return { status: 400, body: { message: "Use a name up to 120 characters, a valid URL slug, and a non-negative sort order." } };
    }

    if (parentCategoryId && !mongoose.isValidObjectId(parentCategoryId)) {
      return {
        status: 400,
        body: { message: "Invalid parent category ID." },
      };
    }

    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    if (parentCategoryId && !visibleCategoryIds.some((id) => String(id) === String(parentCategoryId))) {
      return {
        status: 404,
        body: { message: "Active parent category not found." },
      };
    }

    const pendingCategory = await Category.findOne({
      $or: [
        caseInsensitiveExact("name", name.trim()),
        caseInsensitiveExact("slug", slug.trim().toLowerCase()),
      ],
    });

    if (pendingCategory) {
      return {
        status: 409,
        body: {
          message: "A category with this name and slug already exists"
        }
      }
    }

    const category = await Category.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      active,
      sortOrder: Number(sortOrder),
      parentCategoryId: parentCategoryId || null,
    })
    return {
      status: 201,
      body: { message: "Category created." },
    };

  } catch (error) {
    console.error("Create category error:", error);
    if (error.code === 11000) return { status: 409, body: { message: "A category with this name or slug already exists." } };

    return {
      status: 500,
      body: {
        message: "Could not create category.",
      },
    };

  }
}

async function listCategory(input) {
  try {
    const searchInput = input.query?.search;
    if (searchInput !== undefined && typeof searchInput !== "string") {
      return { status: 400, body: { message: "Search must be text." } };
    }
    const search = searchInput?.trim() || "";

    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = search
      ? { name: { $regex: safeSearch, $options: "i" } }
      : {};

    const page = Math.max(Number.parseInt(input.query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(input.query.limit, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const skip = (page - 1) * limit;


    const sortOrderDirection =
      input.query.sortOrderDirection === "desc" ? -1 : 1;

    const createdAtDirection = input.query.createdAtDirection === "asc" ? 1 : -1;

    const [categories, totalCategories] = await Promise.all([
      Category.find(filter)
        .sort({ sortOrder: sortOrderDirection, createdAt: createdAtDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    const catogeriesWithChildCount = await Promise.all(
      categories.map(async (category) => {
        const childCount = await Category.countDocuments({
          parentCategoryId: category._id
        })
        return {
          ...category,
          childCount
        }
      })
    )
    return {
      status: 200,
      body: {
        categories: catogeriesWithChildCount,
        pagination: {
          page,
          limit,
          totalCategories,
          totalPages: Math.ceil(totalCategories / limit),
        },
      },
    }
  } catch (error) {
    console.error("Get categorie error:", error);


    return {
      status: 500,
      body: { message: "Could not load categories" }
    }
  }
}

async function editCategry(input) {
  try {
    const { name, sortOrder, slug, active, _id, parentCategoryId } = input.body || {};

    if (typeof name !== "string" || !name.trim() || typeof slug !== "string" || !slug.trim()) {
      return {
        status: 400,
        body: { message: "Name and slug are required." },
      };
    }
    if (name.trim().length > 120 || slug.trim().length > 160 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug.trim())) {
      return { status: 400, body: { message: "Category name or URL slug is invalid or too long." } };
    }

    if (!mongoose.isValidObjectId(_id)) {
      return {
        status: 400,
        body: { message: "Invalid category ID." },
      };
    }

    if (active !== undefined && typeof active !== "boolean") {
      return { status: 400, body: { message: "Active must be true or false." } };
    }
    if (sortOrder !== undefined && (!Number.isFinite(Number(sortOrder)) || Number(sortOrder) < 0)) {
      return { status: 400, body: { message: "Sort order must be a non-negative number." } };
    }

    const normalizedParentCategoryId = parentCategoryId || null;
    if (
      normalizedParentCategoryId &&
      !mongoose.isValidObjectId(normalizedParentCategoryId)
    ) {
      return {
        status: 400,
        body: { message: "Invalid parent category ID." },
      };
    }

    if (normalizedParentCategoryId && normalizedParentCategoryId.toString() === _id) {
      return {
        status: 400,
        body: { message: "A category cannot be its own parent." },
      };
    }

    if (normalizedParentCategoryId) {
      let ancestorId = normalizedParentCategoryId;
      const visited = new Set();
      while (ancestorId) {
        const ancestorKey = String(ancestorId);
        if (ancestorKey === String(_id) || visited.has(ancestorKey)) {
          return { status: 400, body: { message: "This parent would create a category cycle." } };
        }
        visited.add(ancestorKey);
        const ancestor = await Category.findById(ancestorId).select("parentCategoryId").lean();
        ancestorId = ancestor?.parentCategoryId || null;
      }
    }

    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    if (normalizedParentCategoryId && !visibleCategoryIds.some((id) => String(id) === String(normalizedParentCategoryId))) {
      return {
        status: 404,
        body: { message: "Active parent category not found." },
      };
    }

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();
    const anotherCategoryWithName = await Category.findOne({
      ...caseInsensitiveExact("name", trimmedName),
      _id: { $ne: _id },
    });

    if (anotherCategoryWithName) {
      return {
        status: 409,
        body: { message: "Another category already uses this name." },
      };
    }

    const anotherCategoryWithSlug = await Category.findOne({
      ...caseInsensitiveExact("slug", trimmedSlug),
      _id: { $ne: _id },
    });

    if (anotherCategoryWithSlug) {
      return {
        status: 409,
        body: { message: "Another category already uses this slug." },
      };
    }

    const category = await Category.findByIdAndUpdate(
      _id,
      {
        $set: {
          name: trimmedName,
          slug: trimmedSlug,
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
          ...(active !== undefined ? { active } : {}),
          parentCategoryId: normalizedParentCategoryId,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!category) {
      return {
        status: 404,
        body: { message: "Category not found." },
      };
    }

    return {
      status: 200,
      body: { message: "Category updated successfully." },
    };
  } catch (error) {
    console.error("Update category error:", error);
    if (error.code === 11000) return { status: 409, body: { message: "Another category already uses this name or slug." } };
    return {
      status: 500,
      body: { message: "Could not update category." },
    };
  }
}

async function deleteCategory(input) {
  try {
    const { categoryId } = input.params;

    if (!mongoose.isValidObjectId(categoryId)) {
      return {
        status: 400,
        body: { message: "Invalid category ID." },
      };
    }

    // Category deletion is a soft delete: products remain in the database,
    // while storefront queries exclude products in inactive categories.
    const category = await Category.findByIdAndUpdate(
      categoryId,
      { $set: { active: false } },
      { returnDocument: "after", runValidators: true },
    );

    if (!category) {
      return {
        status: 404,
        body: { message: "Category not found." },
      };
    }

    return {
      status: 200,
      body: { message: "Category unlisted." },
    };
  } catch (error) {
    console.error("Delete category error:", error);
    return {
      status: 500,
      body: { message: "Could not delete category." },
    };
  }
}

//---------------------------------------Product Management-------------------------------------------

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

function caseInsensitiveExact(field, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { [field]: { $regex: `^${escaped}$`, $options: "i" } };
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
    const categoryId = input.query?.categoryId;
    const status = input.query?.status || "all";

    const filter = {};

    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) {
        return { status: 400, body: { message: "Invalid category ID." } };
      }
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

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
        .sort({ createdAt: -1 })
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
export { listUsers, blockUser, getCustomerDetails, createCategory, listCategory, editCategry, deleteCategory, createProduct, listProducts, unlistProduct, deleteProduct, updateProduct, uploadProductImages };
