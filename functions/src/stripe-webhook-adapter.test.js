"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createStripeWebhookEventAdapter,
} = require("./stripe-webhook-adapter");

const env = {
  FIRESTORE_ORDER_COLLECTION: "orderRequests",
};

function baseDeps(overrides = {}) {
  const calls = [];

  return {
    calls,
    deps: {
      claimStripeEventProcessing({ eventId, eventType }) {
        calls.push({ type: "claimStripeEventProcessing", eventId, eventType });
        return true;
      },
      markStripeEventProcessed({ eventId, eventType, result }) {
        calls.push({ type: "markStripeEventProcessed", eventId, eventType, result });
      },
      findOrderByCheckoutSessionId({ collection, stripeCheckoutSessionId, orderRequestId }) {
        calls.push({ type: "findOrderByCheckoutSessionId", collection, stripeCheckoutSessionId, orderRequestId });
        return { id: orderRequestId || "order_123" };
      },
      findOrderByPaymentIntentId({ collection, stripePaymentIntentId }) {
        calls.push({ type: "findOrderByPaymentIntentId", collection, stripePaymentIntentId });
        return { id: "order_123" };
      },
      updateOrderRequest({ collection, orderRequestId, fields }) {
        calls.push({ type: "updateOrderRequest", collection, orderRequestId, fields });
      },
      ...overrides,
    },
  };
}

function checkoutSessionEvent(type, overrides = {}) {
  return {
    id: `evt_${type.replace(/\./g, "_")}`,
    type,
    data: {
      object: {
        id: "cs_test_123",
        payment_intent: "pi_test_123",
        customer: { id: "cus_test_123" },
        payment_status: "paid",
        client_reference_id: "order_123",
        metadata: {
          orderRequestId: "order_123",
        },
        ...overrides,
      },
    },
  };
}

test("webhook adapter is disabled without injected trusted dependencies", async () => {
  const adapter = createStripeWebhookEventAdapter();

  await assert.rejects(
    adapter({
      event: checkoutSessionEvent("checkout.session.completed"),
      env,
    }),
    (error) => {
      assert.equal(error.code, "stripe_webhook_adapter_dependency_missing");
      assert.deepEqual(error.missingDependencies, [
        "claimStripeEventProcessing",
        "markStripeEventProcessed",
        "findOrderByCheckoutSessionId",
        "findOrderByPaymentIntentId",
        "updateOrderRequest",
      ]);
      return true;
    },
  );
});

test("maps checkout.session.completed to trusted paid and complete fields", async () => {
  const { calls, deps } = baseDeps();
  const adapter = createStripeWebhookEventAdapter(deps);

  const result = await adapter({
    event: checkoutSessionEvent("checkout.session.completed"),
    env,
    serverTimestamp: "SERVER_TIMESTAMP",
  });

  assert.deepEqual(result, {
    eventId: "evt_checkout_session_completed",
    eventType: "checkout.session.completed",
    action: "updated_order",
    orderRequestId: "order_123",
  });
  assert.deepEqual(calls[2], {
    type: "updateOrderRequest",
    collection: "orderRequests",
    orderRequestId: "order_123",
    fields: {
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_test_123",
      stripeCustomerId: "cus_test_123",
      paymentStatus: "paid",
      stripePaymentStatus: "paid",
      checkoutStatus: "complete",
      paidAt: "SERVER_TIMESTAMP",
      checkoutCompletedAt: "SERVER_TIMESTAMP",
      lastStripeEventId: "evt_checkout_session_completed",
      lastStripeEventAt: "SERVER_TIMESTAMP",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });
});

test("maps checkout.session.expired to trusted expired and unpaid fields", async () => {
  const { calls, deps } = baseDeps();
  const adapter = createStripeWebhookEventAdapter(deps);

  await adapter({
    event: checkoutSessionEvent("checkout.session.expired", {
      payment_status: "unpaid",
      payment_intent: null,
      customer: null,
    }),
    env,
    serverTimestamp: "SERVER_TIMESTAMP",
  });

  assert.deepEqual(calls[2], {
    type: "updateOrderRequest",
    collection: "orderRequests",
    orderRequestId: "order_123",
    fields: {
      stripeCheckoutSessionId: "cs_test_123",
      paymentStatus: "unpaid",
      stripePaymentStatus: "unpaid",
      checkoutStatus: "expired",
      lastStripeEventId: "evt_checkout_session_expired",
      lastStripeEventAt: "SERVER_TIMESTAMP",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });
});

test("maps payment_intent.payment_failed to trusted failed fields when an order is known", async () => {
  const { calls, deps } = baseDeps();
  const adapter = createStripeWebhookEventAdapter(deps);

  await adapter({
    event: {
      id: "evt_payment_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_test_123",
          status: "requires_payment_method",
          last_payment_error: {
            code: "card_declined",
          },
        },
      },
    },
    env,
    serverTimestamp: "SERVER_TIMESTAMP",
  });

  assert.deepEqual(calls[2], {
    type: "updateOrderRequest",
    collection: "orderRequests",
    orderRequestId: "order_123",
    fields: {
      stripePaymentIntentId: "pi_test_123",
      paymentStatus: "failed",
      stripePaymentStatus: "unpaid",
      checkoutErrorCode: "card_declined",
      lastStripeEventId: "evt_payment_failed",
      lastStripeEventAt: "SERVER_TIMESTAMP",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });
});

test("replayed Stripe events do not update orders after an atomic claim miss", async () => {
  const { calls, deps } = baseDeps({
    claimStripeEventProcessing({ eventId, eventType }) {
      calls.push({ type: "claimStripeEventProcessing", eventId, eventType });
      return false;
    },
  });
  const adapter = createStripeWebhookEventAdapter(deps);

  const result = await adapter({
    event: checkoutSessionEvent("checkout.session.completed"),
    env,
  });

  assert.deepEqual(result, {
    action: "replayed_event",
    eventId: "evt_checkout_session_completed",
    eventType: "checkout.session.completed",
  });
  assert.deepEqual(calls, [
    {
      type: "findOrderByCheckoutSessionId",
      collection: "orderRequests",
      stripeCheckoutSessionId: "cs_test_123",
      orderRequestId: "order_123",
    },
    {
      type: "claimStripeEventProcessing",
      eventId: "evt_checkout_session_completed",
      eventType: "checkout.session.completed",
    },
  ]);
});

test("unknown Stripe events are marked processed without updating orders", async () => {
  const { calls, deps } = baseDeps();
  const adapter = createStripeWebhookEventAdapter(deps);

  const result = await adapter({
    event: {
      id: "evt_unknown",
      type: "customer.created",
      data: {
        object: {
          id: "cus_test_123",
        },
      },
    },
    env,
  });

  assert.deepEqual(result, {
    eventId: "evt_unknown",
    eventType: "customer.created",
    action: "no_op",
    reason: "unsupported_event_type",
  });
  assert.equal(calls.some((call) => call.type === "updateOrderRequest"), false);
  assert.equal(calls.at(-1).type, "markStripeEventProcessed");
});

test("checkout session reference mismatch stays retryable and does not mark processed", async () => {
  const { calls, deps } = baseDeps({
    findOrderByCheckoutSessionId({ collection, stripeCheckoutSessionId, orderRequestId }) {
      calls.push({ type: "findOrderByCheckoutSessionId", collection, stripeCheckoutSessionId, orderRequestId });
      return { id: "different_order" };
    },
  });
  const adapter = createStripeWebhookEventAdapter(deps);

  const result = await adapter({
    event: checkoutSessionEvent("checkout.session.completed"),
    env,
  });

  assert.deepEqual(result, {
    eventId: "evt_checkout_session_completed",
    eventType: "checkout.session.completed",
    action: "retry_later",
    reason: "order_not_found_or_mismatched",
  });
  assert.equal(calls.some((call) => call.type === "updateOrderRequest"), false);
  assert.equal(calls.some((call) => call.type === "markStripeEventProcessed"), false);
});

test("adapter updates only trusted webhook-owned order fields", async () => {
  const { calls, deps } = baseDeps();
  const adapter = createStripeWebhookEventAdapter(deps);

  await adapter({
    event: checkoutSessionEvent("checkout.session.completed"),
    env,
  });

  const updatedFields = Object.keys(calls.find((call) => call.type === "updateOrderRequest").fields);
  assert.deepEqual(updatedFields.sort(), [
    "checkoutCompletedAt",
    "checkoutStatus",
    "lastStripeEventAt",
    "lastStripeEventId",
    "paidAt",
    "paymentStatus",
    "stripeCheckoutSessionId",
    "stripeCustomerId",
    "stripePaymentIntentId",
    "stripePaymentStatus",
    "trustedUpdatedAt",
  ].sort());
});
