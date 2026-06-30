"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  checkoutSessionsHandler,
  stripeWebhookHandler,
} = require("./index");

const validOrderRequest = {
  source: "static-storefront",
  status: "needs_review",
  subtotalCents: 4400,
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
  },
};

const configuredEnv = {
  CORS_ALLOWED_ORIGINS: "https://theos.example",
  FIREBASE_PROJECT_ID: "theos-farm-test",
  STRIPE_CANCEL_URL: "https://theos.example/#cart",
  STRIPE_SECRET_KEY: "sk_test_configured_for_unit_tests",
  STRIPE_SUCCESS_URL: "https://theos.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_configured_for_unit_tests",
};

function mockReq({ method = "POST", headers = {}, body = {} } = {}) {
  return {
    method,
    headers,
    body,
  };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

function parseJson(res) {
  return res.body ? JSON.parse(res.body) : {};
}

test("checkout handler returns disabled mock response when env is missing", async () => {
  const req = mockReq({
    headers: { origin: "http://localhost:4173" },
    body: { orderRequest: validOrderRequest },
  });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, { env: { NODE_ENV: "development" } });

  assert.equal(res.statusCode, 503);
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:4173");
  assert.equal(parseJson(res).error.code, "checkout_disabled");
  assert.equal(parseJson(res).mock, true);
});

test("checkout handler supports CORS preflight for configured storefront origin", async () => {
  const req = mockReq({
    method: "OPTIONS",
    headers: { origin: "https://theos.example" },
  });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, { env: configuredEnv });

  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["access-control-allow-origin"], "https://theos.example");
  assert.equal(res.headers["access-control-allow-methods"], "POST, OPTIONS");
});

test("checkout handler rejects unsupported methods", async () => {
  const req = mockReq({ method: "GET" });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, { env: configuredEnv });

  assert.equal(res.statusCode, 405);
  assert.equal(parseJson(res).error.code, "method_not_allowed");
});

test("checkout handler requires a trusted adapter after env is configured", async () => {
  const req = mockReq({ body: { orderRequest: validOrderRequest } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, { env: configuredEnv });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "checkout_adapter_missing");
});

test("checkout handler reports incomplete injected adapter setup", async () => {
  const req = mockReq({ body: { orderRequest: validOrderRequest } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: {
      ...configuredEnv,
      NODE_ENV: "development",
    },
    checkoutAdapterDependencies: {
      createOrderRequest() {},
    },
  });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "checkout_adapter_dependency_missing");
  assert.deepEqual(parseJson(res).setupRequired, [
    "createStripeCheckoutSession",
    "updateOrderRequest",
  ]);
});

test("checkout handler passes Firestore timestamp sentinel to future adapter by default", async () => {
  const req = mockReq({ body: { orderRequest: validOrderRequest } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    createCheckoutSession({ orderRequest }) {
      assert.equal(orderRequest.createdAt, "FIRESTORE_SERVER_TIMESTAMP_REQUIRED");
      assert.equal(orderRequest.checkoutCreatedAt, "FIRESTORE_SERVER_TIMESTAMP_REQUIRED");
      return {
        orderRequestId: "order_123",
        checkoutSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      };
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(parseJson(res).orderRequestId, "order_123");
  assert.equal(parseJson(res).checkoutSessionId, "cs_test_123");
});

test("checkout handler can use injected checkout adapter dependencies", async () => {
  const req = mockReq({ body: { orderRequest: validOrderRequest } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
    checkoutAdapterDependencies: {
      createOrderRequest({ orderRequest }) {
        assert.equal(orderRequest.createdAt, "SERVER_TIMESTAMP");
        return { id: "order_123" };
      },
      createStripeCheckoutSession({ params }) {
        assert.equal(params.metadata.orderRequestId, "order_123");
        return {
          id: "cs_test_123",
          url: "https://checkout.stripe.com/c/pay/cs_test_123",
        };
      },
      updateOrderRequest({ fields }) {
        assert.deepEqual(fields, {
          stripeCheckoutSessionId: "cs_test_123",
          trustedUpdatedAt: "SERVER_TIMESTAMP",
        });
      },
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(parseJson(res).checkoutUrl, "https://checkout.stripe.com/c/pay/cs_test_123");
});

test("webhook handler returns disabled mock response when signing secret is missing", async () => {
  const req = mockReq({ body: Buffer.from("{}") });
  const res = mockRes();

  await stripeWebhookHandler(req, res, { env: {} });

  assert.equal(res.statusCode, 503);
  assert.equal(parseJson(res).error.code, "webhook_disabled");
});

test("webhook handler requires Stripe signature after env is configured", async () => {
  const req = mockReq({ body: Buffer.from("{}") });
  const res = mockRes();

  await stripeWebhookHandler(req, res, { env: configuredEnv });

  assert.equal(res.statusCode, 400);
  assert.equal(parseJson(res).error.code, "missing_stripe_signature");
});

test("webhook handler requires a verifier before reading Stripe event data", async () => {
  const req = mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from("{}"),
  });
  const res = mockRes();

  await stripeWebhookHandler(req, res, { env: configuredEnv });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "webhook_verifier_missing");
});

test("webhook handler verifies signature before handling event", async () => {
  const req = mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from("{\"id\":\"evt_123\",\"type\":\"checkout.session.completed\"}"),
  });
  const res = mockRes();
  let handledEventId = "";

  await stripeWebhookHandler(req, res, {
    env: configuredEnv,
    verifyStripeWebhookEvent({ rawBody, signature, signingSecret }) {
      assert.equal(rawBody.toString("utf8"), "{\"id\":\"evt_123\",\"type\":\"checkout.session.completed\"}");
      assert.equal(signature, "t=123,v1=test");
      assert.equal(signingSecret, configuredEnv.STRIPE_WEBHOOK_SIGNING_SECRET);
      return {
        id: "evt_123",
        type: "checkout.session.completed",
      };
    },
    handleStripeEvent({ event }) {
      handledEventId = event.id;
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(parseJson(res).received, true);
  assert.equal(handledEventId, "evt_123");
});
