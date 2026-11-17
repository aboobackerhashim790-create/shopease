import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyCampaignPricing, priceWithCampaigns } from "../services/offerCampaignPricing.js";
import { validateCampaign } from "../services/adminOfferCampaignService.js";

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
        discountType: "fixed",
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

  it("matches a product-targeted campaign by ID", () => {
    const result = priceWithCampaigns(dummyProduct, 2000, [{
      name: "One product", appliesTo: "product", productId: dummyProduct._id,
      discountType: "percentage", discountValue: 25,
    }]);
    assert.equal(result.price, 1500);
    assert.equal(result.campaignDiscountAmount, 500);
  });

  it("does not apply a product campaign to a different product", () => {
    const result = priceWithCampaigns(dummyProduct, 2000, [{
      name: "Other product", appliesTo: "product", productId: "another-product",
      discountType: "percentage", discountValue: 25,
    }]);
    assert.equal(result.price, 2000);
    assert.equal(result.campaignName, "");
  });

  it("does not apply a category campaign to a different category", () => {
    const result = priceWithCampaigns(dummyProduct, 2000, [{
      name: "Other category", appliesTo: "category", categoryId: "other-category",
      discountType: "percentage", discountValue: 25,
    }]);
    assert.equal(result.price, 2000);
  });

  it("does not let a matching campaign increase the product price", () => {
    const result = priceWithCampaigns(dummyProduct, 2000, [{
      name: "Bad flat data", appliesTo: "all", discountType: "fixed", discountValue: -50,
    }]);
    assert.equal(result.price, 2000);
  });

  it("returns the base price when the input price is invalid", () => {
    assert.equal(priceWithCampaigns(dummyProduct, "not-a-price", []).price, Number.NaN);
    assert.equal(priceWithCampaigns(dummyProduct, -2, [{
      appliesTo: "all", discountType: "fixed", discountValue: 1,
    }]).price, -2);
  });

  it("prices each variant separately and uses the lowest variant for listings", () => {
    const product = {
      ...dummyProduct,
      variants: [
        { price: 1000, compareAtPrice: 1200 },
        { price: 2000, compareAtPrice: null },
      ],
    };
    const priced = applyCampaignPricing(product, [{
      name: "All sale", appliesTo: "all", discountType: "percentage", discountValue: 10,
    }]);
    assert.deepEqual(priced.variants.map((variant) => variant.salePrice), [900, 1800]);
    assert.equal(priced.listingPrice, 900);
    assert.equal(priced.variants[0].saleCompareAtPrice, 1000);
  });

  it("keeps existing compare-at pricing when no campaign matches", () => {
    const priced = applyCampaignPricing({ ...dummyProduct, compareAtPrice: 2500 }, []);
    assert.equal(priced.salePrice, 2000);
    assert.equal(priced.saleCompareAtPrice, 2500);
    assert.equal(priced.campaignDiscountPercent, 0);
  });

  it("validates and normalizes a valid all-products campaign", () => {
    const parsed = validateCampaign({
      name: "  Holiday sale  ", description: "  Save today  ", discountType: "percentage",
      discountValue: "50", appliesTo: "all", startsAt: "2030-12-01T00:00:00.000Z",
      endsAt: "2030-12-31T00:00:00.000Z",
    });
    assert.equal(parsed.value.name, "Holiday sale");
    assert.equal(parsed.value.discountValue, 50);
    assert.equal(parsed.value.active, true);
    assert.equal(parsed.value.categoryId, null);
  });

  it("requires campaign name and description", () => {
    const parsed = validateCampaign({});
    assert.ok(parsed.errors.name);
    assert.ok(parsed.errors.description);
  });

  it("rejects percentage discounts above the supported maximum", () => {
    const parsed = validateCampaign({
      name: "Sale", description: "Offer", discountType: "percentage", discountValue: 100,
      appliesTo: "all", startsAt: "2030-12-01", endsAt: "2030-12-02",
    });
    assert.ok(parsed.errors.discountValue);
  });

  it("requires a valid category ID for a category campaign", () => {
    const parsed = validateCampaign({
      name: "Sale", description: "Offer", discountType: "fixed", discountValue: 10,
      appliesTo: "category", categoryId: "bad-id", startsAt: "2030-12-01", endsAt: "2030-12-02",
    });
    assert.ok(parsed.errors.categoryId);
  });

  it("requires a valid product ID for a product campaign", () => {
    const parsed = validateCampaign({
      name: "Sale", description: "Offer", discountType: "fixed", discountValue: 10,
      appliesTo: "product", productId: "bad-id", startsAt: "2030-12-01", endsAt: "2030-12-02",
    });
    assert.ok(parsed.errors.productId);
  });

  it("rejects campaigns whose end time is not after their start time", () => {
    const parsed = validateCampaign({
      name: "Sale", description: "Offer", discountType: "fixed", discountValue: 10,
      appliesTo: "all", startsAt: "2030-12-02", endsAt: "2030-12-01",
    });
    assert.ok(parsed.errors.endsAt);
  });
});
