import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTheoAnalytics } = require("../analytics.js");

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createHarness() {
  const calls = [];
  const root = {
    location: { href: "https://theosfarm.com/" },
    document: { title: "Theo's Farm" },
    localStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };
  return {
    calls,
    analytics: createTheoAnalytics(root, { measurementId: "G-TEST123" }),
  };
}

const item = {
  sku: "ear-corn-20lb",
  name: "20 lb Ear Corn Bag",
  unitPriceCents: 1795,
  quantity: 2,
  email: "must-not-be-sent@example.com",
};

{
  const { analytics, calls } = createHarness();
  assert.equal(analytics.addToCart(item), true);
  assert.equal(analytics.beginCheckout([item], 1200), true);
  assert.equal(analytics.purchase("cs_test_trace_123", [item], 1200), true);
  assert.equal(analytics.purchase("cs_test_trace_123", [item], 1200), false);
  analytics.checkoutError("private exception text", "unknown step");

  assert.deepEqual(calls.map((call) => call[1]), [
    "add_to_cart",
    "begin_checkout",
    "purchase",
    "checkout_error",
  ]);
  const serialized = JSON.stringify(calls);
  assert(!serialized.includes("must-not-be-sent@example.com"));
  assert(!serialized.includes("private exception text"));

  const purchase = calls.find((call) => call[1] === "purchase")[2];
  assert.equal(purchase.transaction_id, "cs_test_trace_123");
  assert.equal(purchase.currency, "USD");
  assert.equal(purchase.value, 47.9);
  assert.equal(purchase.shipping, 12);
  assert.deepEqual(purchase.items[0], {
    item_id: "ear-corn-20lb",
    item_name: "20 lb Ear Corn Bag",
    price: 17.95,
    quantity: 2,
  });
}

{
  const analytics = createTheoAnalytics({}, { measurementId: "" });
  assert.equal(analytics.enabled, false);
  assert.equal(analytics.addToCart(item), false);
}

console.log("GA4 ecommerce contract checks passed.");
