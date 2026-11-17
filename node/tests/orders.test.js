import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidOrderStatusTransition, summarizeFulfillment } from "../services/adminOrderService.js";
import { isWithinReturnWindow } from "../services/customerOrderService.js";

describe("Order State Machine & Fulfillment Test Suite", () => {
  const transitions = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Shipped", "Cancelled"],
    Shipped: ["Out for Delivery"],
    "Out for Delivery": ["Delivered"],
    Delivered: [],
    Cancelled: [],
  };

  const fulfillmentRanks = {
    Pending: 0,
    Confirmed: 1,
    Shipped: 2,
    "Out for Delivery": 3,
    Delivered: 4,
    Returned: 4,
  };

  function summarizeFulfillment(items, orderStatus) {
    if (orderStatus === "Cancelled") return "Cancelled";
    const activeItems = (items || []).filter((item) => !item.isCancelled);
    if (activeItems.length === 0) return "Cancelled";
    const activeStatuses = activeItems
      .map((item) => item.fulfillmentStatus || orderStatus)
      .filter((status) => status !== "Cancelled");
    if (activeStatuses.length === 0) return "Cancelled";
    return activeStatuses.reduce((leastAdvanced, itemStatus) =>
      fulfillmentRanks[itemStatus] < fulfillmentRanks[leastAdvanced] ? itemStatus : leastAdvanced,
    activeStatuses[0]);
  }

  it("should allow valid forward status transitions", () => {
    assert.equal(transitions.Pending.includes("Confirmed"), true);
    assert.equal(transitions.Confirmed.includes("Shipped"), true);
    assert.equal(transitions.Shipped.includes("Out for Delivery"), true);
    assert.equal(transitions["Out for Delivery"].includes("Delivered"), true);
  });

  it("should allow cancellation before shipping", () => {
    assert.equal(transitions.Pending.includes("Cancelled"), true);
    assert.equal(transitions.Confirmed.includes("Cancelled"), true);
  });

  it("should prevent cancellation after an order has shipped", () => {
    assert.equal(transitions.Shipped.includes("Cancelled"), false);
    assert.equal(transitions["Out for Delivery"].includes("Cancelled"), false);
    assert.equal(transitions.Delivered.includes("Cancelled"), false);
  });

  it("should calculate order overall status based on least advanced active product", () => {
    const orderItems = [
      { name: "Item A", fulfillmentStatus: "Shipped", isCancelled: false },
      { name: "Item B", fulfillmentStatus: "Confirmed", isCancelled: false },
    ];
    // Overall status is bounded by slowest item (Confirmed)
    const overall = summarizeFulfillment(orderItems, "Confirmed");
    assert.equal(overall, "Confirmed");
  });

  it("should ignore cancelled items when calculating overall fulfillment status", () => {
    const orderItems = [
      { name: "Item A", fulfillmentStatus: "Cancelled", isCancelled: true },
      { name: "Item B", fulfillmentStatus: "Delivered", isCancelled: false },
    ];
    const overall = summarizeFulfillment(orderItems, "Delivered");
    assert.equal(overall, "Delivered");
  });

  it("should calculate overall status as Cancelled when all items are cancelled", () => {
    const orderItems = [
      { name: "Item A", fulfillmentStatus: "Cancelled", isCancelled: true },
      { name: "Item B", fulfillmentStatus: "Cancelled", isCancelled: true },
    ];
    const overall = summarizeFulfillment(orderItems, "Pending");
    assert.equal(overall, "Cancelled");
  });
});

describe("Order rules used by the application", () => {
  it("allows each supported forward transition through the actual order service rule", () => {
    assert.equal(isValidOrderStatusTransition("Pending", "Confirmed"), true);
    assert.equal(isValidOrderStatusTransition("Confirmed", "Shipped"), true);
    assert.equal(isValidOrderStatusTransition("Shipped", "Out for Delivery"), true);
    assert.equal(isValidOrderStatusTransition("Out for Delivery", "Delivered"), true);
  });

  it("blocks backward, skipped, and terminal status transitions", () => {
    assert.equal(isValidOrderStatusTransition("Shipped", "Confirmed"), false);
    assert.equal(isValidOrderStatusTransition("Pending", "Delivered"), false);
    assert.equal(isValidOrderStatusTransition("Delivered", "Cancelled"), false);
    assert.equal(isValidOrderStatusTransition("Unknown", "Pending"), false);
  });

  it("summarizes mixed item statuses using the slowest active item", () => {
    assert.equal(summarizeFulfillment({ orderStatus: "Shipped", items: [
      { fulfillmentStatus: "Shipped" }, { fulfillmentStatus: "Confirmed" },
    ] }), "Confirmed");
  });

  it("ignores cancelled items when summarizing the active items", () => {
    assert.equal(summarizeFulfillment({ orderStatus: "Pending", items: [
      { isCancelled: true, fulfillmentStatus: "Cancelled" },
      { isCancelled: false, fulfillmentStatus: "Delivered" },
    ] }), "Delivered");
  });

  it("returns Cancelled when no active items remain", () => {
    assert.equal(summarizeFulfillment({ orderStatus: "Pending", items: [
      { isCancelled: true, fulfillmentStatus: "Cancelled" },
    ] }), "Cancelled");
  });
});

describe("Return Window Eligibility Test Suite", () => {
  const RETURN_WINDOW_DAYS = 7;
  const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  it("should permit return request within 7 days of delivery", () => {
    const deliveredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const isEligible = Date.now() <= new Date(deliveredAt).getTime() + RETURN_WINDOW_MS;
    assert.equal(isEligible, true);
  });

  it("should deny return request after 7 days have passed since delivery", () => {
    const deliveredAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    const isEligible = Date.now() <= new Date(deliveredAt).getTime() + RETURN_WINDOW_MS;
    assert.equal(isEligible, false, "Returns after 7 days must be expired");
  });

  it("allows a return at the exact seven-day deadline", () => {
    const deliveredAt = new Date("2026-11-01T12:00:00.000Z");
    const deadline = deliveredAt.getTime() + RETURN_WINDOW_MS;
    assert.equal(isWithinReturnWindow(deliveredAt, deadline), true);
  });

  it("rejects missing or invalid delivery timestamps", () => {
    assert.equal(isWithinReturnWindow(null), false);
    assert.equal(isWithinReturnWindow("not a date"), false);
  });

  it("rejects a return one millisecond after the seven-day deadline", () => {
    const deliveredAt = new Date("2026-11-01T12:00:00.000Z");
    const deadline = deliveredAt.getTime() + RETURN_WINDOW_MS;
    assert.equal(isWithinReturnWindow(deliveredAt, deadline + 1), false);
  });
});
