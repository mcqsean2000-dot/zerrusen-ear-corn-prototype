"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildCheckoutSessionParams,
  createStripeApiAdapter,
  createStripeCheckoutSession,
  verifyStripeWebhookEvent,
} = require("./stripe-api-adapter");

const env = {
  STRIPE_CANCEL_URL: "https://theos.example/#cart",
  STRIPE_SUCCESS_URL: "https://theos.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
};

const lineItems = [
  {
    quantity: 2,
    price_data: {
      currency: "usd",
      unit_amount: 1600,
      product_data: {
        name: "20 lb Ear Corn Bag",
        metadata: {
          sku: "ear-corn-20lb",
        },
      },
    },
  },
];

const metadata = {
  orderRequestId: "order_123",
  source: "static-storefront",
  storefront: "theos-farm",
  schemaVersion: "2026-06-28",
  subtotalCents: "3200",
  itemsSummary: "ear-corn-20lb:2",
  shippingZip: "62401",
};

test("builds hosted Checkout params from boundary arguments without payment-method overrides", () => {
  const params = buildCheckoutSessionParams({
    env,
    orderRequestId: "order_123",
    lineItems,
    metadata,
  });

  assert.equal(params.mode, "payment");
  assert.equal(params.success_url, env.STRIPE_SUCCESS_URL);
  assert.equal(params.cancel_url, env.STRIPE_CANCEL_URL);
  assert.equal(params.client_reference_id, "order_123");
  assert.equal(params.line_items, lineItems);
  assert.equal(params.metadata, metadata);
  assert.equal(Object.prototype.hasOwnProperty.call(params, "payment_method_types"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(params, "payment_method_options"), false);
});

test("passes existing checkout adapter params through to checkout.sessions.create", async () => {
  const calls = [];
  const params = {
    mode: "payment",
    success_url: env.STRIPE_SUCCESS_URL,
    cancel_url: env.STRIPE_CANCEL_URL,
    client_reference_id: "order_123",
    line_items: lineItems,
    metadata,
    customer_email: "customer@example.com",
  };
  const stripe = {
    checkout: {
      sessions: {
        create(receivedParams) {
          calls.push(receivedParams);
          return {
            id: "cs_test_123",
            url: "https://checkout.stripe.com/c/pay/cs_test_123",
          };
        },
      },
    },
  };

  const session = await createStripeCheckoutSession({
    stripe,
    env,
    orderRequestId: "order_123",
    params,
  });

  assert.deepEqual(session, {
    id: "cs_test_123",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0], params);
});

test("createStripeApiAdapter exposes checkout dependency function for injection", async () => {
  let receivedParams;
  const adapter = createStripeApiAdapter({
    stripe: {
      checkout: {
        sessions: {
          create(params) {
            receivedParams = params;
            return {
              id: "cs_test_456",
              url: "https://checkout.stripe.com/c/pay/cs_test_456",
            };
          },
        },
      },
    },
  });

  const result = await adapter.createStripeCheckoutSession({
    env,
    orderRequestId: "order_456",
    lineItems,
    metadata: {
      ...metadata,
      orderRequestId: "order_456",
    },
  });

  assert.equal(result.id, "cs_test_456");
  assert.equal(receivedParams.success_url, env.STRIPE_SUCCESS_URL);
  assert.equal(receivedParams.cancel_url, env.STRIPE_CANCEL_URL);
  assert.equal(receivedParams.metadata.orderRequestId, "order_456");
});

test("wraps checkout session creation errors without exposing secrets in messages", async () => {
  const stripe = {
    checkout: {
      sessions: {
        create() {
          const error = new Error("No such API key: fake-api-key-redacted");
          error.code = "authentication_error";
          throw error;
        },
      },
    },
  };

  await assert.rejects(
    createStripeCheckoutSession({
      stripe,
      env,
      orderRequestId: "order_123",
      lineItems,
      metadata,
    }),
    (error) => {
      assert.equal(error.code, "authentication_error");
      assert.equal(error.message, "Stripe Checkout Session creation failed.");
      assert.equal(Object.prototype.hasOwnProperty.call(error, "cause"), false);
      return true;
    },
  );
});

test("validates missing checkout dependencies before calling a Stripe client", async () => {
  await assert.rejects(
    createStripeCheckoutSession({
      env,
      orderRequestId: "order_123",
      lineItems,
      metadata,
    }),
    (error) => {
      assert.equal(error.code, "stripe_client_missing");
      return true;
    },
  );

  await assert.rejects(
    createStripeCheckoutSession({
      stripe: {},
      env,
      orderRequestId: "order_123",
      lineItems,
      metadata,
    }),
    (error) => {
      assert.equal(error.code, "stripe_checkout_sessions_create_missing");
      return true;
    },
  );
});

test("verifies webhook events by forwarding raw body, signature, and signing secret", async () => {
  const rawBody = Buffer.from("{\"id\":\"evt_123\"}");
  const calls = [];
  const stripe = {
    webhooks: {
      constructEvent(receivedRawBody, signature, signingSecret) {
        calls.push({ rawBody: receivedRawBody, signature, signingSecret });
        return {
          id: "evt_123",
          type: "checkout.session.completed",
        };
      },
    },
  };

  const event = await verifyStripeWebhookEvent({
    stripe,
    rawBody,
    signature: "t=123,v1=test",
    signingSecret: "fake-webhook-signing-secret",
  });

  assert.deepEqual(event, {
    id: "evt_123",
    type: "checkout.session.completed",
  });
  assert.deepEqual(calls, [
    {
      rawBody,
      signature: "t=123,v1=test",
      signingSecret: "fake-webhook-signing-secret",
    },
  ]);
});

test("createStripeApiAdapter exposes webhook verifier dependency function for injection", async () => {
  const adapter = createStripeApiAdapter({
    stripe: {
      webhooks: {
        constructEvent() {
          return {
            id: "evt_456",
            type: "payment_intent.payment_failed",
          };
        },
      },
    },
  });

  const event = await adapter.verifyStripeWebhookEvent({
    rawBody: Buffer.from("{}"),
    signature: "t=456,v1=test",
    signingSecret: "fake-webhook-signing-secret",
  });

  assert.equal(event.id, "evt_456");
});

test("validates missing webhook verifier dependencies", async () => {
  await assert.rejects(
    verifyStripeWebhookEvent({
      rawBody: Buffer.from("{}"),
      signature: "t=123,v1=test",
      signingSecret: "fake-webhook-signing-secret",
    }),
    (error) => {
      assert.equal(error.code, "stripe_client_missing");
      return true;
    },
  );

  await assert.rejects(
    verifyStripeWebhookEvent({
      stripe: {},
      rawBody: Buffer.from("{}"),
      signature: "t=123,v1=test",
      signingSecret: "fake-webhook-signing-secret",
    }),
    (error) => {
      assert.equal(error.code, "stripe_webhook_construct_event_missing");
      return true;
    },
  );
});

test("wraps webhook verification errors with a safe message", async () => {
  const stripe = {
    webhooks: {
      constructEvent() {
        const error = new Error("No signatures found matching the expected signature for payload.");
        error.code = "signature_verification_failed";
        throw error;
      },
    },
  };

  await assert.rejects(
    verifyStripeWebhookEvent({
      stripe,
      rawBody: Buffer.from("{}"),
      signature: "t=123,v1=bad",
      signingSecret: "fake-webhook-signing-secret",
    }),
    (error) => {
      assert.equal(error.code, "signature_verification_failed");
      assert.equal(error.message, "Stripe webhook signature verification failed.");
      return true;
    },
  );
});
