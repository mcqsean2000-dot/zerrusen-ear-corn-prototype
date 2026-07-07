"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  adminOrderStatusHandler,
  adminShippingLabelsHandler,
  checkoutSessionsHandler,
  shippingRatesHandler,
  stripeWebhookHandler,
} = require("./index");

const validOrderRequest = {
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

const configuredShippingEnv = {
  CORS_ALLOWED_ORIGINS: "https://theos.example",
  SHIPPO_API_TOKEN: "shippo_test_configured_for_unit_tests",
  SHIP_FROM_STREET1: "456 Farm Road",
  SHIP_FROM_CITY: "Teutopolis",
  SHIP_FROM_STATE: "IL",
  SHIP_FROM_ZIP: "62467",
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

function validShippingCheckoutFields(selectedRateId = "rate_ground") {
  return {
    shippingAddress: {
      addressLine1: "123 Oak Street",
      city: "Effingham",
      state: "IL",
      zip: "62401",
    },
    selectedShippingRate: {
      rateId: selectedRateId,
    },
  };
}

function createFakeShippingRates() {
  return {
    shippingAddress: validShippingCheckoutFields().shippingAddress,
    rates: [
      {
        rateId: "rate_ground",
        provider: "UPS",
        serviceName: "Ground",
        amountCents: 4342,
        currency: "USD",
        estimatedDays: 2,
        durationTerms: "2 business days",
        packageRateIds: ["rate_20", "rate_40"],
        packageCount: 2,
      },
    ],
  };
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
  const req = mockReq({ body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    createShippingRates: createFakeShippingRates,
    createCheckoutSession({ orderRequest }) {
      assert.equal(orderRequest.createdAt, "FIRESTORE_SERVER_TIMESTAMP_REQUIRED");
      assert.equal(orderRequest.checkoutCreatedAt, "FIRESTORE_SERVER_TIMESTAMP_REQUIRED");
      assert.equal(orderRequest.shippingAmountCents, 4342);
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
  const req = mockReq({ body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    createShippingRates: createFakeShippingRates,
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

test("checkout handler re-rates selected shipping before creating checkout", async () => {
  const req = mockReq({
    body: {
      orderRequest: validOrderRequest,
      shippingAddress: {
        addressLine1: "123 Oak Street",
        city: "Effingham",
        state: "IL",
        zip: "62401",
      },
      selectedShippingRate: {
        rateId: "rate_ground",
        amountCents: 1,
      },
    },
  });
  const res = mockRes();
  let trustedOrderRequest;

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
    createShippingRates({ orderRequestDraft, shippingAddress }) {
      assert.equal(orderRequestDraft.subtotalCents, 4790);
      assert.equal(shippingAddress.zip, "62401");
      return {
        shippingAddress,
        rates: [
          {
            rateId: "rate_ground",
            provider: "UPS",
            serviceName: "Ground",
            amountCents: 4342,
            currency: "USD",
            estimatedDays: 2,
            durationTerms: "2 business days",
            packageRateIds: ["rate_20", "rate_40"],
            packageCount: 2,
          },
        ],
      };
    },
    createCheckoutSession({ orderRequest }) {
      trustedOrderRequest = orderRequest;
      return {
        orderRequestId: "order_123",
        checkoutSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      };
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(trustedOrderRequest.shippingAmountCents, 4342);
  assert.equal(trustedOrderRequest.shippingCarrier, "UPS");
  assert.deepEqual(trustedOrderRequest.shippingPackageRateIds, ["rate_20", "rate_40"]);
});

test("checkout handler rejects selected rates that are not returned by the server", async () => {
  const req = mockReq({
    body: {
      orderRequest: validOrderRequest,
      shippingAddress: {
        addressLine1: "123 Oak Street",
        city: "Effingham",
        state: "IL",
        zip: "62401",
      },
      selectedShippingRate: {
        rateId: "tampered_rate",
      },
    },
  });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    createShippingRates() {
      return {
        shippingAddress: req.body.shippingAddress,
        rates: [
          {
            rateId: "rate_ground",
            provider: "UPS",
            serviceName: "Ground",
            amountCents: 4342,
            currency: "USD",
          },
        ],
      };
    },
    createCheckoutSession() {
      throw new Error("Checkout should not start for a tampered shipping rate.");
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(parseJson(res).error.code, "checkout_shipping_rate_unavailable");
});

test("webhook handler returns disabled mock response when signing secret is missing", async () => {
  const req = mockReq({ body: Buffer.from("{}") });
  const res = mockRes();

  await stripeWebhookHandler(req, res, { env: {} });

  assert.equal(res.statusCode, 503);
  assert.equal(parseJson(res).error.code, "webhook_disabled");
});

test("shipping rates handler returns disabled response when Shippo token is missing", async () => {
  const req = mockReq({
    body: {
      orderRequest: validOrderRequest,
      shippingAddress: {
        addressLine1: "123 Oak Street",
        city: "Effingham",
        state: "IL",
        zip: "62401",
      },
    },
  });
  const res = mockRes();

  await shippingRatesHandler(req, res, { env: {} });

  assert.equal(res.statusCode, 503);
  assert.equal(parseJson(res).error.code, "shipping_rates_disabled");
});

test("shipping rates handler requires sender address before live Shippo lookup", async () => {
  const req = mockReq({
    body: {
      orderRequest: validOrderRequest,
      shippingAddress: {
        addressLine1: "123 Oak Street",
        city: "Effingham",
        state: "IL",
        zip: "62401",
      },
    },
  });
  const res = mockRes();

  await shippingRatesHandler(req, res, {
    env: {
      SHIPPO_API_TOKEN: "shippo_test_configured_for_unit_tests",
    },
  });

  assert.equal(res.statusCode, 503);
  assert.equal(parseJson(res).error.code, "shipping_rates_disabled");
  assert.deepEqual(parseJson(res).setupRequired, [
    "SHIP_FROM_STREET1",
    "SHIP_FROM_CITY",
    "SHIP_FROM_STATE",
    "SHIP_FROM_ZIP",
  ]);
});

test("shipping rates handler returns customer-safe Shippo rate options", async () => {
  const req = mockReq({
    headers: { origin: "https://theos.example" },
    body: {
      orderRequest: validOrderRequest,
      shippingAddress: {
        addressLine1: "123 Oak Street",
        city: "Effingham",
        state: "IL",
        zip: "62401",
      },
    },
  });
  const res = mockRes();

  await shippingRatesHandler(req, res, {
    env: configuredShippingEnv,
    shippingRateDependencies: {
      createShippoShipment({ payload }) {
        assert.equal(payload.address_from.zip, "62467");
        assert.equal(payload.address_to.zip, "62401");
        return {
          rates: [
            {
              object_id: "rate_123",
              provider: "UPS",
              servicelevel: {
                name: "Ground",
                token: "ups_ground",
              },
              amount: "18.42",
              currency: "USD",
              estimated_days: 2,
              duration_terms: "2 business days",
            },
          ],
        };
      },
    },
  });

  const body = parseJson(res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["access-control-allow-origin"], "https://theos.example");
  assert.equal(body.rates[0].rateId, "[\"rate_123\",\"rate_123\"]");
  assert.equal(body.rates[0].amountCents, 3684);
});

test("admin shipping label handler returns disabled response when Shippo token is missing", async () => {
  const req = mockReq({
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      rateId: "rate_123",
    },
  });
  const res = mockRes();

  await adminShippingLabelsHandler(req, res, { env: {} });

  assert.equal(res.statusCode, 503);
  assert.equal(parseJson(res).error.code, "shipping_label_purchase_disabled");
});

test("admin order status handler reports missing trusted persistence dependency", async () => {
  const req = mockReq({
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      status: "ready_to_pack",
    },
  });
  const res = mockRes();

  await adminOrderStatusHandler(req, res, { env: { NODE_ENV: "development" } });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "admin_status_dependency_missing");
  assert.deepEqual(parseJson(res).setupRequired, ["updateAdminOrderStatus"]);
});

test("admin order status handler updates through trusted dependency", async () => {
  const req = mockReq({
    headers: { origin: "https://theos.example" },
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      status: "ready_to_pack",
    },
  });
  const res = mockRes();
  let updateArgs = null;

  await adminOrderStatusHandler(req, res, {
    env: {
      CORS_ALLOWED_ORIGINS: "https://theos.example",
    },
    adminStatusDependencies: {
      updateAdminOrderStatus(args) {
        updateArgs = args;
        return {
          audit: {
            lastAction: "status_changed",
            updatedByEmail: args.admin.email,
            updatedByUid: args.admin.uid,
          },
          fromStatus: "needs_review",
          id: args.orderRequestId,
          status: args.status,
        };
      },
    },
  });

  const body = parseJson(res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["access-control-allow-origin"], "https://theos.example");
  assert.equal(updateArgs.orderRequestId, "order_123");
  assert.equal(updateArgs.status, "ready_to_pack");
  assert.equal(body.orderRequestId, "order_123");
  assert.equal(body.fromStatus, "needs_review");
  assert.equal(body.status, "ready_to_pack");
  assert.equal(body.audit.updatedByUid, "admin-user-001");
});

test("admin order status handler maps invalid transitions to safe errors", async () => {
  const req = mockReq({
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      status: "packed",
    },
  });
  const res = mockRes();

  await adminOrderStatusHandler(req, res, {
    env: {},
    updateAdminOrderStatus() {
      const error = new Error("Invalid transition.");
      error.code = "admin_status_transition_invalid";
      throw error;
    },
  });

  assert.equal(res.statusCode, 409);
  assert.equal(parseJson(res).error.code, "admin_status_transition_invalid");
});

test("admin shipping label handler reports missing trusted persistence dependency", async () => {
  const req = mockReq({
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      rateId: "rate_123",
    },
  });
  const res = mockRes();

  await adminShippingLabelsHandler(req, res, {
    env: {
      SHIPPO_API_TOKEN: "shippo_test_configured_for_unit_tests",
      NODE_ENV: "development",
    },
  });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "shipping_label_dependency_missing");
  assert.deepEqual(parseJson(res).setupRequired, [
    "prepareLabelPurchase",
    "recordLabelPurchase",
  ]);
});

test("admin shipping label handler buys label through trusted dependencies", async () => {
  const req = mockReq({
    headers: { origin: "https://theos.example" },
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      rateId: "rate_123",
    },
  });
  const res = mockRes();
  let recordedFields = null;

  await adminShippingLabelsHandler(req, res, {
    env: {
      CORS_ALLOWED_ORIGINS: "https://theos.example",
      SHIPPO_API_TOKEN: "shippo_test_configured_for_unit_tests",
    },
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
    shippingLabelDependencies: {
      createShippoTransaction({ rateId }) {
        assert.equal(rateId, "rate_123");
        return {
          object_id: "transaction_123",
          label_url: "https://shippo.example/label.pdf",
          tracking_number: "9400100000000000000000",
          tracking_url_provider: "https://carrier.example/track/9400",
        };
      },
      prepareLabelPurchase({ orderRequestId, rateId }) {
        assert.equal(orderRequestId, "order_123");
        assert.equal(rateId, "rate_123");
      },
      recordLabelPurchase({ fields, orderRequestId }) {
        recordedFields = fields;
        return {
          id: orderRequestId,
          ...fields,
        };
      },
    },
  });

  const body = parseJson(res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["access-control-allow-origin"], "https://theos.example");
  assert.equal(body.orderRequestId, "order_123");
  assert.equal(body.shippoTransactionId, "transaction_123");
  assert.equal(body.labelUrl, "https://shippo.example/label.pdf");
  assert.equal(recordedFields.trustedUpdatedAt, "SERVER_TIMESTAMP");
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

test("webhook handler requires a trusted adapter after verifier is configured", async () => {
  const req = mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from("{\"id\":\"evt_123\",\"type\":\"checkout.session.completed\"}"),
  });
  const res = mockRes();

  await stripeWebhookHandler(req, res, {
    env: configuredEnv,
    verifyStripeWebhookEvent() {
      throw new Error("verifier should not run without adapter");
    },
  });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "stripe_webhook_adapter_missing");
});

test("webhook handler reports incomplete injected webhook adapter setup", async () => {
  const req = mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from("{\"id\":\"evt_123\",\"type\":\"checkout.session.completed\"}"),
  });
  const res = mockRes();

  await stripeWebhookHandler(req, res, {
    env: {
      ...configuredEnv,
      NODE_ENV: "development",
    },
    verifyStripeWebhookEvent() {
      throw new Error("verifier should not run without complete adapter dependencies");
    },
    stripeWebhookAdapterDependencies: {
      claimStripeEventProcessing() {},
    },
  });

  assert.equal(res.statusCode, 501);
  assert.equal(parseJson(res).error.code, "stripe_webhook_adapter_dependency_missing");
  assert.deepEqual(parseJson(res).setupRequired, [
    "markStripeEventProcessed",
    "findOrderByCheckoutSessionId",
    "findOrderByPaymentIntentId",
    "updateOrderRequest",
  ]);
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

test("webhook handler can use injected webhook adapter dependencies", async () => {
  const req = mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from("{\"id\":\"evt_123\",\"type\":\"checkout.session.completed\"}"),
  });
  const res = mockRes();
  let updateFields;

  await stripeWebhookHandler(req, res, {
    env: configuredEnv,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
    verifyStripeWebhookEvent() {
      return {
        id: "evt_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_intent: "pi_test_123",
            payment_status: "paid",
            client_reference_id: "order_123",
            metadata: {
              orderRequestId: "order_123",
            },
          },
        },
      };
    },
    stripeWebhookAdapterDependencies: {
      claimStripeEventProcessing() {
        return true;
      },
      markStripeEventProcessed() {},
      findOrderByCheckoutSessionId() {
        return { id: "order_123" };
      },
      findOrderByPaymentIntentId() {
        throw new Error("payment intent lookup should not be used");
      },
      updateOrderRequest({ fields }) {
        updateFields = fields;
      },
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(parseJson(res).received, true);
  assert.equal(updateFields.paymentStatus, "paid");
  assert.equal(updateFields.trustedUpdatedAt, "SERVER_TIMESTAMP");
});
