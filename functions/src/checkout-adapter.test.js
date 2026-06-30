"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildCheckoutSessionParams,
  createCheckoutSessionAdapter,
} = require("./checkout-adapter");

const env = {
  FIRESTORE_ORDER_COLLECTION: "orderRequests",
  STRIPE_CANCEL_URL: "https://theos.example/#cart",
  STRIPE_SUCCESS_URL: "https://theos.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
};

const trustedOrderRequest = {
  source: "static-storefront",
  status: "needs_review",
  subtotalCents: 4400,
  createdAt: "SERVER_TIMESTAMP",
  paymentStatus: "unpaid",
  checkoutStatus: "open",
  checkoutCreatedAt: "SERVER_TIMESTAMP",
  trustedUpdatedAt: "SERVER_TIMESTAMP",
  items: [
    {
      name: "20 lb Ear Corn Bag",
      sku: "ear-corn-20lb",
      quantity: 1,
      unitPriceCents: 1600,
    },
    {
      name: "40 lb Ear Corn Bag",
      sku: "ear-corn-40lb",
      quantity: 1,
      unitPriceCents: 2800,
    },
  ],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    preferredContact: "email",
    shippingZip: "62401",
    note: "Leave near the side door.",
  },
};

test("checkout session params use server-owned line items and safe metadata", () => {
  const params = buildCheckoutSessionParams({
    env,
    orderRequest: trustedOrderRequest,
    orderRequestId: "order_123",
  });

  assert.equal(params.mode, "payment");
  assert.equal(params.success_url, env.STRIPE_SUCCESS_URL);
  assert.equal(params.cancel_url, env.STRIPE_CANCEL_URL);
  assert.equal(params.client_reference_id, "order_123");
  assert.equal(params.customer_email, "customer@example.com");
  assert.deepEqual(params.line_items.map((item) => ({
    quantity: item.quantity,
    name: item.price_data.product_data.name,
    unitAmount: item.price_data.unit_amount,
    sku: item.price_data.product_data.metadata.sku,
  })), [
    {
      quantity: 1,
      name: "20 lb Ear Corn Bag",
      unitAmount: 1600,
      sku: "ear-corn-20lb",
    },
    {
      quantity: 1,
      name: "40 lb Ear Corn Bag",
      unitAmount: 2800,
      sku: "ear-corn-40lb",
    },
  ]);
  assert.equal(params.metadata.orderRequestId, "order_123");
  assert.equal(params.metadata.itemsSummary, "ear-corn-20lb:1,ear-corn-40lb:1");
  assert.equal(Object.prototype.hasOwnProperty.call(params.metadata, "note"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(params.metadata, "contact"), false);
});

test("checkout adapter is disabled without injected trusted dependencies", async () => {
  const adapter = createCheckoutSessionAdapter();

  await assert.rejects(
    adapter({ env, orderRequest: trustedOrderRequest }),
    (error) => {
      assert.equal(error.code, "checkout_adapter_dependency_missing");
      assert.deepEqual(error.missingDependencies, [
        "createOrderRequest",
        "createStripeCheckoutSession",
        "updateOrderRequest",
      ]);
      return true;
    },
  );
});

test("checkout adapter creates trusted order, creates checkout session, and stores trusted Stripe fields", async () => {
  const calls = [];
  const adapter = createCheckoutSessionAdapter({
    createOrderRequest({ collection, orderRequest }) {
      calls.push({ type: "createOrderRequest", collection, orderRequest });
      return { id: "order_123" };
    },
    createStripeCheckoutSession({ orderRequestId, params }) {
      calls.push({ type: "createStripeCheckoutSession", orderRequestId, params });
      return {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
        payment_intent: { id: "pi_test_123" },
        customer: { id: "cus_test_123" },
      };
    },
    updateOrderRequest({ collection, orderRequestId, fields }) {
      calls.push({ type: "updateOrderRequest", collection, orderRequestId, fields });
    },
  });

  const result = await adapter({ env, orderRequest: trustedOrderRequest });

  assert.deepEqual(result, {
    orderRequestId: "order_123",
    checkoutSessionId: "cs_test_123",
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
  assert.equal(calls[0].type, "createOrderRequest");
  assert.equal(calls[0].orderRequest.createdAt, "SERVER_TIMESTAMP");
  assert.equal(calls[1].params.metadata.orderRequestId, "order_123");
  assert.deepEqual(calls[2], {
    type: "updateOrderRequest",
    collection: "orderRequests",
    orderRequestId: "order_123",
    fields: {
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_test_123",
      stripeCustomerId: "cus_test_123",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });
});

test("checkout adapter marks trusted order when checkout session creation fails", async () => {
  const calls = [];
  const adapter = createCheckoutSessionAdapter({
    createOrderRequest() {
      calls.push({ type: "createOrderRequest" });
      return "order_123";
    },
    createStripeCheckoutSession() {
      calls.push({ type: "createStripeCheckoutSession" });
      const error = new Error("Stripe test failure");
      error.code = "stripe_checkout_session_failed";
      throw error;
    },
    updateOrderRequest() {
      calls.push({ type: "updateOrderRequest" });
    },
    markCheckoutSessionFailed({ collection, orderRequestId, fields }) {
      calls.push({ type: "markCheckoutSessionFailed", collection, orderRequestId, fields });
    },
  });

  await assert.rejects(
    adapter({ env, orderRequest: trustedOrderRequest }),
    /Stripe test failure/,
  );

  assert.deepEqual(calls, [
    { type: "createOrderRequest" },
    { type: "createStripeCheckoutSession" },
    {
      type: "markCheckoutSessionFailed",
      collection: "orderRequests",
      orderRequestId: "order_123",
      fields: {
        checkoutStatus: "error",
        paymentStatus: "unpaid",
        checkoutErrorCode: "stripe_checkout_session_failed",
        trustedUpdatedAt: "SERVER_TIMESTAMP",
      },
    },
  ]);
});

test("checkout adapter preserves created session details when trusted persistence fails", async () => {
  const calls = [];
  const adapter = createCheckoutSessionAdapter({
    createOrderRequest() {
      calls.push({ type: "createOrderRequest" });
      return "order_123";
    },
    createStripeCheckoutSession() {
      calls.push({ type: "createStripeCheckoutSession" });
      return {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
        payment_intent: "pi_test_123",
      };
    },
    updateOrderRequest() {
      calls.push({ type: "updateOrderRequest" });
      const error = new Error("Firestore update failed");
      error.code = "order_request_update_failed";
      throw error;
    },
    markCheckoutSessionFailed({ collection, orderRequestId, fields }) {
      calls.push({ type: "markCheckoutSessionFailed", collection, orderRequestId, fields });
    },
  });

  await assert.rejects(
    adapter({ env, orderRequest: trustedOrderRequest }),
    /Firestore update failed/,
  );

  assert.deepEqual(calls, [
    { type: "createOrderRequest" },
    { type: "createStripeCheckoutSession" },
    { type: "updateOrderRequest" },
    {
      type: "markCheckoutSessionFailed",
      collection: "orderRequests",
      orderRequestId: "order_123",
      fields: {
        paymentStatus: "unpaid",
        trustedUpdatedAt: "SERVER_TIMESTAMP",
        checkoutStatus: "open",
        checkoutErrorCode: "order_request_update_failed",
        stripeCheckoutSessionId: "cs_test_123",
        stripePaymentIntentId: "pi_test_123",
      },
    },
  ]);
});
