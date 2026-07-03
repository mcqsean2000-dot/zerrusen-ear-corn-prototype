"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const storefrontOrderRequests = require("../../order-request.js");
const {
  PRODUCT_CATALOG,
  buildStripeMetadata,
  buildTrustedOrderRequestForCreate,
  validateOrderRequestDraft,
} = require("./order-validation");

function validDraft(overrides = {}) {
  return {
    source: "static-storefront",
    status: "needs_review",
    subtotalCents: 4790,
    items: [
      {
        name: "20 lb Ear Corn Bag",
        sku: "ear-corn-20lb",
        quantity: 1,
        unitPriceCents: 1795,
      },
      {
        name: "40 lb Ear Corn Bag",
        sku: "ear-corn-40lb",
        quantity: 1,
        unitPriceCents: 2995,
      },
    ],
    customer: {
      name: "Customer Name",
      contact: "customer@example.com",
      preferredContact: "email",
      shippingZip: "62401",
      note: "Leave near the side door.",
    },
    ...overrides,
  };
}

test("backend catalog matches the storefront order request catalog", () => {
  assert.deepEqual(PRODUCT_CATALOG, storefrontOrderRequests.PRODUCT_CATALOG);
});

test("validates and canonicalizes a storefront order draft", () => {
  const result = validateOrderRequestDraft(validDraft({
    customer: {
      name: " Customer Name ",
      contact: " customer@example.com ",
      preferredContact: "Email",
      shippingZip: "62401",
      note: " Leave near the side door. ",
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.orderRequest.subtotalCents, 4790);
  assert.equal(result.orderRequest.customer.preferredContact, "email");
  assert.equal(result.orderRequest.customer.note, "Leave near the side door.");
});

test("rejects client-supplied trusted payment and timestamp fields", () => {
  const result = validateOrderRequestDraft(validDraft({
    checkoutErrorCode: "stripe_checkout_session_failed",
    createdAt: "2026-06-28T00:00:00.000Z",
    stripeCheckoutSessionId: "cs_test_client_supplied",
    paymentStatus: "paid",
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /reserved for trusted backend/);
});

test("rejects stale or tampered subtotal and unit prices", () => {
  const staleSubtotal = validateOrderRequestDraft(validDraft({ subtotalCents: 1 }));
  const stalePrice = validateOrderRequestDraft(validDraft({
    items: [
      {
        name: "20 lb Ear Corn Bag",
        sku: "ear-corn-20lb",
        quantity: 1,
        unitPriceCents: 1,
      },
    ],
    subtotalCents: 1,
  }));

  assert.equal(staleSubtotal.ok, false);
  assert.match(staleSubtotal.errors.join(" "), /subtotal/);
  assert.equal(stalePrice.ok, false);
  assert.match(stalePrice.errors.join(" "), /catalog/);
});

test("rejects unsupported customer and cart shapes", () => {
  const badZip = validateOrderRequestDraft(validDraft({
    customer: {
      name: "Customer Name",
      contact: "customer@example.com",
      preferredContact: "email",
      shippingZip: "bad",
    },
  }));
  const tooManyItems = validateOrderRequestDraft(validDraft({
    items: [
      {
        name: "20 lb Ear Corn Bag",
        sku: "ear-corn-20lb",
        quantity: 1,
        unitPriceCents: 1795,
      },
      {
        name: "40 lb Ear Corn Bag",
        sku: "ear-corn-40lb",
        quantity: 1,
        unitPriceCents: 2995,
      },
      {
        name: "20 lb Ear Corn Bag",
        sku: "ear-corn-20lb",
        quantity: 1,
        unitPriceCents: 1795,
      },
    ],
    subtotalCents: 6585,
  }));

  assert.equal(badZip.ok, false);
  assert.equal(tooManyItems.ok, false);
});

test("allows duplicate supported SKU lines when the storefront draft subtotal is correct", () => {
  const result = validateOrderRequestDraft(validDraft({
    items: [
      {
        name: "20 lb Ear Corn Bag",
        sku: "ear-corn-20lb",
        quantity: 1,
        unitPriceCents: 1795,
      },
      {
        name: "20 lb Ear Corn Bag",
        sku: "ear-corn-20lb",
        quantity: 2,
        unitPriceCents: 1795,
      },
    ],
    subtotalCents: 5385,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.orderRequest.items.length, 2);
});

test("builds trusted Firestore fields and Stripe metadata without sensitive data", () => {
  const result = validateOrderRequestDraft(validDraft());
  const trustedOrder = buildTrustedOrderRequestForCreate(result.orderRequest, {
    serverTimestamp: "SERVER_TIMESTAMP",
  });
  const metadata = buildStripeMetadata(result.orderRequest, "order_123");

  assert.equal(trustedOrder.createdAt, "SERVER_TIMESTAMP");
  assert.equal(trustedOrder.paymentStatus, "unpaid");
  assert.equal(metadata.orderRequestId, "order_123");
  assert.equal(metadata.itemsSummary, "ear-corn-20lb:1,ear-corn-40lb:1");
  assert.equal(metadata.shippingZip, "62401");
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, "contact"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, "note"), false);
});
