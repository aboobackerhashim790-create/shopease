import mongoose from "mongoose";
import Category from "../models/Category.js";
import OfferCampaign from "../models/OfferCampaign.js";
import Product from "../models/Product.js";

const response = (status, message, extra = {}) => ({
  status,
  body: { message, ...extra },
});

export function validateCampaign(body = {}) {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const appliesTo = body.appliesTo;
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);

  const errors = {};
  if (!name) errors.name = "Campaign name is required.";
  else if (name.length > 100) errors.name = "Campaign name must be 100 characters or fewer.";
  if (!description) errors.description = "Campaign description is required.";
  if (!["percentage", "fixed"].includes(discountType)) {
    errors.discountType = "Choose a valid discount type.";
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    errors.discountValue = "Discount must be greater than zero.";
  } else if (discountType === "percentage" && discountValue > 99) {
    errors.discountValue = "Percentage must be between 0 and 99.";
  }
  if (!["all", "category", "product"].includes(appliesTo)) {
    errors.appliesTo = "Choose what the campaign applies to.";
  }
  if (body.active !== undefined && typeof body.active !== "boolean") {
    errors.active = "Campaign enabled status must be true or false.";
  }
  if (Number.isNaN(startsAt.getTime())) errors.startsAt = "Choose a valid start date and time.";
  if (Number.isNaN(endsAt.getTime())) errors.endsAt = "Choose a valid end date and time.";
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    startsAt >= endsAt
  ) {
    errors.endsAt = "The campaign end time must be after its start time.";
  }

  const categoryId = appliesTo === "category" ? String(body.categoryId || "") : "";
  const productId = appliesTo === "product" ? String(body.productId || "") : "";
  if (appliesTo === "category" && !mongoose.isValidObjectId(categoryId)) {
    errors.categoryId = "Choose a category for this campaign.";
  }
  if (appliesTo === "product" && !mongoose.isValidObjectId(productId)) {
    errors.productId = "Choose a product for this campaign.";
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    value: {
      name,
      description: description.slice(0, 300),
      discountType,
      discountValue,
      appliesTo,
      categoryId: categoryId || null,
      productId: productId || null,
      startsAt,
      endsAt,
      active: body.active !== false,
    },
  };
}

export async function listOfferCampaigns() {
  try {
    const campaigns = await OfferCampaign.find()
      .populate("categoryId", "name")
      .populate("productId", "name")
      .sort({ createdAt: -1 })
      .lean();
    return { status: 200, body: { campaigns } };
  } catch (error) {
    console.error("List offer campaigns error:", error);
    return response(500, "Could not load offer campaigns.");
  }
}

async function validateTarget(value) {
  if (value.appliesTo === "category") {
    const exists = await Category.exists({ _id: value.categoryId });
    if (!exists) return "The selected category was not found.";
  }
  if (value.appliesTo === "product") {
    const exists = await Product.exists({ _id: value.productId });
    if (!exists) return "The selected product was not found.";
  }
  return "";
}

export async function createOfferCampaign(input) {
  const parsed = validateCampaign(input.body);
  if (parsed.errors) return response(400, "Please correct the highlighted fields.", { errors: parsed.errors });
  try {
    const targetError = await validateTarget(parsed.value);
    if (targetError) {
      const field = parsed.value.appliesTo === "category" ? "categoryId" : "productId";
      return response(404, targetError, { errors: { [field]: targetError } });
    }
    const campaign = await OfferCampaign.create(parsed.value);
    return { status: 201, body: { message: "Offer campaign created.", campaign } };
  } catch (error) {
    console.error("Create offer campaign error:", error);
    return response(500, "Could not create offer campaign.");
  }
}

export async function updateOfferCampaign(input) {
  const { campaignId } = input.params;
  if (!mongoose.isValidObjectId(campaignId)) return response(400, "Invalid campaign ID.");
  const parsed = validateCampaign(input.body);
  if (parsed.errors) return response(400, "Please correct the highlighted fields.", { errors: parsed.errors });
  try {
    const targetError = await validateTarget(parsed.value);
    if (targetError) {
      const field = parsed.value.appliesTo === "category" ? "categoryId" : "productId";
      return response(404, targetError, { errors: { [field]: targetError } });
    }
    const campaign = await OfferCampaign.findByIdAndUpdate(
      campaignId,
      { $set: parsed.value },
      { returnDocument: "after", runValidators: true },
    );
    if (!campaign) return response(404, "Offer campaign not found.");
    return { status: 200, body: { message: "Offer campaign updated.", campaign } };
  } catch (error) {
    console.error("Update offer campaign error:", error);
    return response(500, "Could not update offer campaign.");
  }
}

export async function setOfferCampaignActive(input) {
  const { campaignId } = input.params;
  const active = input.body?.active;
  if (!mongoose.isValidObjectId(campaignId)) return response(400, "Invalid campaign ID.");
  if (typeof active !== "boolean") return response(400, "Active must be true or false.");
  try {
    const campaign = await OfferCampaign.findByIdAndUpdate(
      campaignId,
      { $set: { active } },
      { returnDocument: "after", runValidators: true },
    );
    if (!campaign) return response(404, "Offer campaign not found.");
    return { status: 200, body: { message: active ? "Campaign activated." : "Campaign paused.", campaign } };
  } catch (error) {
    console.error("Change offer campaign status error:", error);
    return response(500, "Could not change campaign status.");
  }
}
