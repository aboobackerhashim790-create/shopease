import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { priceWithCampaigns } from "../services/offerCampaignPricing.js";

describe("Offer Campaigns Pricing Test Suite", () => {
  const dummyProduct = {
    _id: "6724a11f7142416f0b690001",
    name: "Noise Pulse 2 Smartwatch",
    price: 2000,
    categoryId: "6724a11f7142416f0b699999",
  };

  it("should apply percentage discount from an active campaign", () => {
    const campaigns = [
      {
        name: "Festival 20% Off",
        appliesTo: "all",
        discountType: "percentage",
        discountValue: 20,
      },
    ];

    const result = priceWithCampaigns(dummyProduct, 2000, campaigns);
    assert.equal(result.price, 1600, "20% off 2000 should be 1600");
    assert.equal(result.compareAtPrice, 2000);
    assert.equal(result.campaignName, "Festival 20% Off");
    assert.equal(result.campaignDiscountAmount, 400);
  });

  it("should select the best discount when multiple campaigns match", () => {
    const campaigns = [
      {
        name: "Small Discount",
        appliesTo: "all",
        discountType: "percentage",
        discountValue: 10, // price = 1800
      },
      {
        name: "Mega Discount",
        appliesTo: "all",
        discountType: "percentage",
        discountValue: 30, // price = 1400 (better)
      },
    ];

    const result = priceWithCampaigns(dummyProduct, 2000, campaigns);
    assert.equal(result.price, 1400, "Should pick the campaign with lowest final price");
    assert.equal(result.campaignName, "Mega Discount");
    assert.equal(result.campaignDiscountAmount, 600);
  });

  it("should apply flat campaign discount without going below minimum 0.01", () => {
    const campaigns = [
      {
        name: "Huge Flat Discount",
        appliesTo: "all",
        discountType: "flat",
        discountValue: 2500, // exceeds price
      },
    ];

    const result = priceWithCampaigns(dummyProduct, 2000, campaigns);
    assert.equal(result.price, 0.01, "Price must not become zero or negative");
  });

  it("should match category-specific campaigns only to corresponding category", () => {
    const matchingCampaign = {
      name: "Smartwatch Category Sale",
      appliesTo: "category",
      categoryId: "6724a11f7142416f0b699999",
      discountType: "percentage",
      discountValue: 15,
    };
    const nonMatchingCampaign = {
      name: "Audio Category Sale",
      appliesTo: "category",
      categoryId: "6724a11f7142416f0b698888",
      discountType: "percentage",
      discountValue: 50,
    };

    const result = priceWithCampaigns(dummyProduct, 2000, [nonMatchingCampaign, matchingCampaign]);
    assert.equal(result.campaignName, "Smartwatch Category Sale");
    assert.equal(result.price, 1700);
  });
});
