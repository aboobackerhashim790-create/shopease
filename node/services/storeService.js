import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";
import { addCampaignPrices } from "./offerCampaignPricing.js";

function availableStockFilter() {
  return {
    $or: [
      {
        variants: {
          $elemMatch: {
            active: { $ne: false },
            stockQuantity: { $gt: 0 },
          },
        },
      },
      {
        $and: [
          { variants: { $size: 0 } },
          { stockQuantity: { $gt: 0 } },
        ],
      },
    ],
  };
}

function availableVariantsExpression(priceRange = {}) {
  const conditions = [
    { $ne: ["$$variant.active", false] },
    { $gt: [{ $ifNull: ["$$variant.stockQuantity", 0] }, 0] },
  ];
  if (priceRange.$gte !== undefined) {
    conditions.push({ $gte: ["$$variant.price", priceRange.$gte] });
  }
  if (priceRange.$lte !== undefined) {
    conditions.push({ $lte: ["$$variant.price", priceRange.$lte] });
  }
  return {
    $filter: {
      input: { $ifNull: ["$variants", []] },
      as: "variant",
      cond: { $and: conditions },
    },
  };
}

function addAvailableVariantStages(priceRange = {}) {
  return [
    { $addFields: { _availableVariants: availableVariantsExpression(priceRange) } },
    {
      $addFields: {
        listingPrice: {
          $cond: [
            { $gt: [{ $size: "$_availableVariants" }, 0] },
            { $min: "$_availableVariants.price" },
            "$price",
          ],
        },
      },
    },
  ];
}

function shapeStoreProduct(product) {
  const variants = (product.variants || []).filter(
    (variant) => variant.active !== false && variant.stockQuantity > 0,
  );
  return {
    ...product,
    variants,
    listingPrice: variants.length
      ? Math.min(...variants.map((variant) => variant.price))
      : product.price,
  };
}

function parseOptionalPrice(value) {
  if (value === undefined || value === "") return { value: undefined };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { invalid: true };
  return { value: parsed };
}

async function listStoreCategories() {
  try {
    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    const categories = await Category.find({ _id: { $in: visibleCategoryIds } })
      .select("name slug parentCategoryId sortOrder")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return { status: 200, body: { categories } };
  } catch (error) {
    console.error("List store categories error:", error);
    return {
      status: 500,
      body: { message: "Could not load categories." },
    };
  }
}

async function listStoreProducts(input) {
  try {
    const query = input.query || {};
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || 12;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const minPriceResult = parseOptionalPrice(query.minPrice);
    const maxPriceResult = parseOptionalPrice(query.maxPrice);

    if (minPriceResult.invalid || maxPriceResult.invalid) {
      return {
        status: 400,
        body: { message: "Price filters must be valid non-negative numbers." },
      };
    }
    if (
      minPriceResult.value !== undefined &&
      maxPriceResult.value !== undefined &&
      minPriceResult.value > maxPriceResult.value
    ) {
      return {
        status: 400,
        body: { message: "Minimum price cannot exceed maximum price." },
      };
    }

    const activeCategoryIds = await getVisibleStoreCategoryIds();
    const conditions = [
      { active: true },
      { categoryId: { $in: activeCategoryIds } },
      availableStockFilter(),
    ];
    if (query.featured === "true") conditions.push({ isFeatured: true });

    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = { $regex: safeSearch, $options: "i" };
      conditions.push({
        $or: [
          { name: searchRegex },
          { brand: searchRegex },
          { sku: searchRegex },
          { slug: searchRegex },
          {
            variants: {
              $elemMatch: {
                sku: searchRegex,
                active: { $ne: false },
                stockQuantity: { $gt: 0 },
              },
            },
          },
        ],
      });
    }

    if (query.categoryId) {
      if (!mongoose.isValidObjectId(query.categoryId)) {
        return { status: 400, body: { message: "Invalid category ID." } };
      }
      conditions.push({ categoryId: new mongoose.Types.ObjectId(query.categoryId) });
    }

    const priceRange = {};
    if (minPriceResult.value !== undefined) priceRange.$gte = minPriceResult.value;
    if (maxPriceResult.value !== undefined) priceRange.$lte = maxPriceResult.value;
    if (Object.keys(priceRange).length) {
      conditions.push({
        $or: [
          {
            variants: {
              $elemMatch: {
                active: { $ne: false },
                stockQuantity: { $gt: 0 },
                price: priceRange,
              },
            },
          },
          { variants: { $size: 0 }, price: priceRange },
        ],
      });
    }

    const sortOptions = {
      price_asc: { listingPrice: 1, name: 1, _id: 1 },
      price_desc: { listingPrice: -1, name: 1, _id: 1 },
      name_asc: { name: 1, _id: 1 },
      name_desc: { name: -1, _id: 1 },
      newest: { createdAt: -1, _id: -1 },
    };
    const sort = sortOptions[query.sort] || sortOptions.newest;
    const match = { $and: conditions };

    const [result] = await Product.aggregate([
      { $match: match },
      ...addAvailableVariantStages(priceRange),
      { $sort: sort },
      {
        $facet: {
          products: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: Category.collection.name,
                localField: "categoryId",
                foreignField: "_id",
                as: "_category",
              },
            },
            { $unwind: "$_category" },
            {
              $addFields: {
                categoryId: "$_category",
                variants: "$_availableVariants",
              },
            },
            { $project: { _category: 0, _availableVariants: 0 } },
          ],
          count: [{ $count: "totalProducts" }],
        },
      },
    ]);

    const totalProducts = result?.count?.[0]?.totalProducts || 0;
    const products = await addCampaignPrices(result?.products || []);
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
    console.error("List store products error:", error);
    return {
      status: 500,
      body: { message: "Could not load products." },
    };
  }
}

async function getStoreProductDetails(input) {
  try {
    const { slug } = input.params || {};
    if (!slug?.trim()) {
      return { status: 400, body: { message: "Product slug is required." } };
    }

    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    const product = await Product.findOne({ slug: slug.trim(), active: true, categoryId: { $in: visibleCategoryIds } })
      .populate({
        path: "categoryId",
        match: { active: true },
        select: "name slug parentCategoryId",
      })
      .lean();

    if (!product?.categoryId) {
      return { status: 404, body: { message: "Product is unavailable." } };
    }

    const availableProduct = shapeStoreProduct(product);
    if (
      (product.variants?.length && !availableProduct.variants.length) ||
      (!product.variants?.length && product.stockQuantity <= 0)
    ) {
      return { status: 404, body: { message: "Product is currently unavailable." } };
    }

    const relatedDocuments = await Product.find({
      _id: { $ne: product._id },
      categoryId: product.categoryId._id,
      active: true,
      ...availableStockFilter(),
    })
      .populate({ path: "categoryId", match: { active: true }, select: "name slug" })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    const relatedProducts = relatedDocuments
      .filter((related) => related.categoryId)
      .map(shapeStoreProduct)
      .filter((related) =>
        related.variants.length > 0 || related.stockQuantity > 0,
      );
    const [productWithCampaign, relatedWithCampaigns] = await Promise.all([
      addCampaignPrices([availableProduct]),
      addCampaignPrices(relatedProducts),
    ]);
    return {
      status: 200,
      body: { product: productWithCampaign[0], relatedProducts: relatedWithCampaigns },
    };
  } catch (error) {
    console.error("Get store product details error:", error);
    return {
      status: 500,
      body: { message: "Could not load this product." },
    };
  }
}

export { listStoreCategories, listStoreProducts, getStoreProductDetails };
