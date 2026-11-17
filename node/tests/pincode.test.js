import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookupIndiaPincode } from "../utils/indiaPincode.js";

describe("Indian PIN code lookup", () => {
  it("returns unique states and districts from post office results", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.postalpincode.in/pincode/682001");
      assert.equal(options.headers.Accept, "application/json");
      return {
        ok: true,
        json: async () => [{ Status: "Success", PostOffice: [
          { State: "Kerala", District: "Ernakulam" },
          { State: "Kerala", District: "Ernakulam" },
          { State: "Kerala", District: "Kochi" },
        ] }],
      };
    };
    assert.deepEqual(await lookupIndiaPincode("682001"), {
      states: ["Kerala"], districts: ["Ernakulam", "Kochi"],
    });
  });

  it("URL-encodes the requested PIN code", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async (url) => {
      assert.ok(url.endsWith("/%20682001%20"));
      return { ok: true, json: async () => [{ Status: "Success", PostOffice: [{ State: "Kerala", District: "Kochi" }] }] };
    };
    assert.deepEqual((await lookupIndiaPincode(" 682001 ")).states, ["Kerala"]);
  });

  it("returns null when the PIN code has no post offices", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async () => ({ ok: true, json: async () => [{ Status: "Error", PostOffice: null }] });
    assert.equal(await lookupIndiaPincode("000000"), null);
  });

  it("returns null for a malformed provider payload", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ Status: "Success" }) });
    assert.equal(await lookupIndiaPincode("682001"), null);
  });

  it("reports an unavailable service for an HTTP error", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(lookupIndiaPincode("682001"), /PIN code service is unavailable/);
  });
});
