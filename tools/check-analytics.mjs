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
  const scripts = [];
  const root = {
    location: { href: "https://theosfarm.com/" },
    document: {
      title: "Theo's Farm",
      createElement: () => ({ dataset: {} }),
      head: { appendChild: (script) => scripts.push(script) },
      querySelector: () => null,
    },
    localStorage: createStorage(),
    gtag: (...args) => calls.push(args),
  };
  return {
    calls,
    scripts,
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
  const { analytics, calls, scripts } = createHarness();
  assert.equal(analytics.initialize(), true);
  assert.equal(analytics.pageView(), true);
  assert.equal(analytics.viewItem(item), true);
  assert.equal(analytics.addToCart(item), true);
  assert.equal(analytics.beginCheckout([item], 1200), true);
  assert.equal(analytics.purchase("invalid_session", [item], 1200), false);
  assert.equal(analytics.purchase("cs_test_trace_123", [item], 1200), true);
  assert.equal(analytics.purchase("cs_test_trace_123", [item], 1200), false);
  analytics.checkoutError("private exception text", "unknown step");

  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST123");
  assert.deepEqual(calls.filter((call) => call[0] === "event").map((call) => call[1]), [
    "page_view",
    "view_item",
    "add_to_cart",
    "begin_checkout",
    "purchase",
    "checkout_error",
  ]);
  const serialized = JSON.stringify(calls);
  assert(!serialized.includes("must-not-be-sent@example.com"));
  assert(!serialized.includes("private exception text"));

  const pageView = calls.find((call) => call[1] === "page_view")[2];
  assert.equal(pageView.page_location, "https://theosfarm.com/");
  assert.equal(pageView.page_title, "Theo's Farm");

  const viewItem = calls.find((call) => call[1] === "view_item")[2];
  assert.equal(viewItem.currency, "USD");
  assert.equal(viewItem.value, 35.9);
  assert.equal(viewItem.items[0].item_id, "ear-corn-20lb");

  const beginCheckout = calls.find((call) => call[1] === "begin_checkout")[2];
  assert.equal(beginCheckout.value, 47.9);
  assert.equal(beginCheckout.shipping, 12);

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

{
  const calls = [];
  const analytics = createTheoAnalytics({
    gtag: (...args) => calls.push(args),
    localStorage: {
      getItem: () => { throw new Error("storage blocked"); },
      setItem: () => { throw new Error("storage blocked"); },
    },
  }, { measurementId: "G-TEST123" });

  assert.equal(analytics.purchase("cs_test_restricted_storage", [item], 1200), true);
  assert.equal(analytics.purchase("cs_test_restricted_storage", [item], 1200), false);
  assert.equal(calls.filter((call) => call[1] === "purchase").length, 1);
}

console.log("GA4 ecommerce contract checks passed.");
