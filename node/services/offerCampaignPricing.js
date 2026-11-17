import OfferCampaign from "../models/OfferCampaign.js";

function getCategoryId(product) {
  return product?.categoryId?._id || product?.categoryId || null;
}

function campaignMatchesProduct(campaign, product) {
  if (campaign.appliesTo === "all") return true;
  if (campaign.appliesTo === "product") {
    return String(campaign.productId) === String(product._id);
  }
  return String(campaign.categoryId) === String(getCategoryId(product));
}

function calculateCampaignPrice(price, campaign) {
  const discount = campaign.discountType === "percentage"
    ? price * campaign.discountValue / 100
    : campaign.discountValue;
  const minimumPrice = price > 0 ? 0.01 : 0;
  return Math.max(minimumPrice, Number((price - discount).toFixed(2)));
}

function findBestCampaign(product, price, campaigns) {
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return null;

  let best = null;
  for (const campaign of campaigns) {
    const discountValue = Number(campaign.discountValue);
    if (
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      !["percentage", "fixed"].includes(campaign.discountType)
    ) continue;
    if (!campaignMatchesProduct(campaign, product)) continue;
    const salePrice = calculateCampaignPrice(Number(price), campaign);
    if (!best || salePrice < best.salePrice) {
      best = { campaign, salePrice };
    }
  }
  return best;
}

async function getActiveCampaigns(session = null) {
  const now = new Date();
  let query = OfferCampaign.find({
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).lean();
  if (session) query = query.session(session);
  return query;
}

function applyCampaignPricing(product, campaigns) {
  const variants = (product.variants || []).map((variant) => {
    const basePrice = Number(variant.price);
    const best = findBestCampaign(product, basePrice, campaigns);
    return {
      ...variant,
      salePrice: best?.salePrice ?? basePrice,
      saleCompareAtPrice: best ? basePrice : variant.compareAtPrice ?? null,
      campaignName: best?.campaign.name || "",
      campaignDiscountPercent: best
        ? Math.round((1 - best.salePrice / basePrice) * 100)
        : 0,
    };
  });

  const basePrice = Number(product.price);
  const best = Number.isFinite(basePrice)
    ? findBestCampaign(product, basePrice, campaigns)
    : null;
  const salePrice = best?.salePrice ?? basePrice;

  return {
    ...product,
    variants,
    salePrice,
    saleCompareAtPrice: best ? basePrice : product.compareAtPrice ?? null,
    campaignName: best?.campaign.name || "",
    campaignDiscountPercent: best
      ? Math.round((1 - salePrice / basePrice) * 100)
      : 0,
    listingPrice: variants.length
      ? Math.min(...variants.map((variant) => variant.salePrice))
      : salePrice,
  };
}

async function priceWithActiveCampaign(product, price, session = null) {
  const campaigns = await getActiveCampaigns(session);
  return priceWithCampaigns(product, price, campaigns);
}

function priceWithCampaigns(product, price, campaigns = []) {
  const best = findBestCampaign(product, Number(price), campaigns);
  return {
    price: best?.salePrice ?? Number(price),
    compareAtPrice: best ? Number(price) : null,
    campaignName: best?.campaign.name || "",
    campaignDiscountAmount: best
      ? Number((Number(price) - best.salePrice).toFixed(2))
      : 0,
  };
}

async function addCampaignPrices(products) {
  if (!products.length) return products;
  const campaigns = await getActiveCampaigns();
  return products.map((product) => applyCampaignPricing(product, campaigns));
}

export {
  addCampaignPrices,
  applyCampaignPricing,
  getActiveCampaigns,
  priceWithActiveCampaign,
  priceWithCampaigns,
};
