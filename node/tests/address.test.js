import { describe, it } from "node:test";
import assert from "node:assert/strict";
import addressSchema from "../schemas/addressSchema.js";

describe("Address & Profile Validation Test Suite", () => {
  const validAddressData = {
    fullName: "Hashim Aboobacker",
    phone: "9876543210",
    addressLine1: "Flat 4B, Emerald Green Apts",
    addressLine2: "Near Metro Station",
    city: "Kochi",
    state: "Kerala",
    postalCode: "672001",
    country: "India",
  };

  it("should validate a complete and properly formatted address", () => {
    const parsed = addressSchema.parse(validAddressData);
    assert.equal(parsed.fullName, "Hashim Aboobacker");
    assert.equal(parsed.phone, "9876543210");
    assert.equal(parsed.label, "Home", "Default label should be 'Home'");
    assert.equal(parsed.isDefault, false);
  });

  it("should accept Indian mobile numbers starting with 6, 7, 8, or 9", () => {
    for (const prefix of ["6", "7", "8", "9"]) {
      const phone = `${prefix}123456789`;
      const result = addressSchema.safeParse({ ...validAddressData, phone });
      assert.equal(result.success, true, `Phone starting with ${prefix} should be valid`);
    }
  });

  it("should reject invalid mobile numbers", () => {
    const invalidPhones = [
      "1234567890", // starts with 1
      "5123456789", // starts with 5
      "987654321",  // only 9 digits
      "98765432100",// 11 digits
      "abcdefghij", // non-numeric
      "+919876543210", // includes country code
    ];

    for (const phone of invalidPhones) {
      const result = addressSchema.safeParse({ ...validAddressData, phone });
      assert.equal(result.success, false, `Phone '${phone}' must be rejected`);
    }
  });

  it("should reject empty or missing required fields", () => {
    const requiredFields = ["fullName", "phone", "addressLine1", "city", "state", "postalCode", "country"];

    for (const field of requiredFields) {
      const data = { ...validAddressData };
      delete data[field];
      const result = addressSchema.safeParse(data);
      assert.equal(result.success, false, `Address without '${field}' must be rejected`);
    }
  });

  it("trims surrounding whitespace from address fields", () => {
    const parsed = addressSchema.parse({
      ...validAddressData,
      fullName: "  Hashim Aboobacker  ",
      city: " Kochi ",
      addressLine2: "  Near Metro  ",
    });
    assert.equal(parsed.fullName, "Hashim Aboobacker");
    assert.equal(parsed.city, "Kochi");
    assert.equal(parsed.addressLine2, "Near Metro");
  });

  it("defaults an omitted optional address line to an empty string", () => {
    const data = { ...validAddressData };
    delete data.addressLine2;
    assert.equal(addressSchema.parse(data).addressLine2, "");
  });

  it("uses Home when the optional label is blank", () => {
    assert.equal(addressSchema.parse({ ...validAddressData, label: "  " }).label, "Home");
  });

  it("accepts a provided address label and default flag", () => {
    const parsed = addressSchema.parse({ ...validAddressData, label: "Office", isDefault: true });
    assert.equal(parsed.label, "Office");
    assert.equal(parsed.isDefault, true);
  });

  it("rejects names and address lines that exceed their maximum lengths", () => {
    assert.equal(addressSchema.safeParse({ ...validAddressData, fullName: "a".repeat(101) }).success, false);
    assert.equal(addressSchema.safeParse({ ...validAddressData, addressLine1: "a".repeat(161) }).success, false);
    assert.equal(addressSchema.safeParse({ ...validAddressData, addressLine2: "a".repeat(161) }).success, false);
  });

  it("rejects an unsupported address label or non-boolean default flag", () => {
    assert.equal(addressSchema.safeParse({ ...validAddressData, label: "a".repeat(31) }).success, false);
    assert.equal(addressSchema.safeParse({ ...validAddressData, isDefault: "yes" }).success, false);
  });
});
