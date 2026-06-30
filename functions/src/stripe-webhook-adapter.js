"use strict";

const { TRUSTED_ORDER_FIELDS } = require("./order-validation");

const DEFAULT_ORDER_COLLECTION = "orderRequests";

function isFunction(value) {
  return typeof value === "function";
}

function getOrderCollection(env) {
  return String(env.FIRESTORE_ORDER_COLLECTION || DEFAULT_ORDER_COLLECTION).trim() || DEFAULT_ORDER_COLLECTION;
}

function normalizeStripeId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return "";
}

function normalizeOrderId(order) {
  if (typeof order === "string") return order;
  if (order && typeof order.id === "string") return order.id;
  if (order && typeof order.orderRequestId === "string") return order.orderRequestId;
  return "";
}

function eventObject(event) {
  return event && event.data && event.data.object && typeof event.data.object === "object"
    ? event.data.object
    : {};
}

function metadataOrderId(stripeObject) {
  return String(stripeObject.metadata && stripeObject.metadata.orderRequestId || "").trim();
}

function getMissingStripeWebhookAdapterDependencies(deps = {}) {
  const missing = [];

  if (!isFunction(deps.claimStripeEventProcessing)) missing.push("claimStripeEventProcessing");
  if (!isFunction(deps.markStripeEventProcessed)) missing.push("markStripeEventProcessed");
  if (!isFunction(deps.findOrderByCheckoutSessionId)) missing.push("findOrderByCheckoutSessionId");
  if (!isFunction(deps.findOrderByPaymentIntentId)) missing.push("findOrderByPaymentIntentId");
  if (!isFunction(deps.updateOrderRequest)) missing.push("updateOrderRequest");

  return missing;
}

function assertAdapterDependencies(deps) {
  const missing = getMissingStripeWebhookAdapterDependencies(deps);

  if (missing.length) {
    const error = new Error("Stripe webhook adapter dependencies are not configured.");
    error.code = "stripe_webhook_adapter_dependency_missing";
    error.missingDependencies = missing;
    throw error;
  }
}

function withoutUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}

function assertTrustedFields(fields) {
  const untrustedFields = Object.keys(fields).filter((field) => !TRUSTED_ORDER_FIELDS.includes(field));

  if (untrustedFields.length) {
    const error = new Error("Stripe webhook adapter tried to update non-trusted order fields.");
    error.code = "stripe_webhook_untrusted_field";
    error.untrustedFields = untrustedFields;
    throw error;
  }
}

function sessionCompletionFields({ event, session, timestamp }) {
  const paymentIntentId = normalizeStripeId(session.payment_intent);

  return withoutUndefinedFields({
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId || undefined,
    stripeCustomerId: normalizeStripeId(session.customer) || undefined,
    paymentStatus: "paid",
    stripePaymentStatus: session.payment_status || "paid",
    checkoutStatus: "complete",
    paidAt: timestamp,
    checkoutCompletedAt: timestamp,
    lastStripeEventId: event.id,
    lastStripeEventAt: timestamp,
    trustedUpdatedAt: timestamp,
  });
}

function sessionExpiredFields({ event, session, timestamp }) {
  return withoutUndefinedFields({
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: normalizeStripeId(session.payment_intent) || undefined,
    stripeCustomerId: normalizeStripeId(session.customer) || undefined,
    paymentStatus: "unpaid",
    stripePaymentStatus: session.payment_status || "unpaid",
    checkoutStatus: "expired",
    lastStripeEventId: event.id,
    lastStripeEventAt: timestamp,
    trustedUpdatedAt: timestamp,
  });
}

function paymentFailedFields({ event, paymentIntent, timestamp }) {
  const errorCode = paymentIntent.last_payment_error && paymentIntent.last_payment_error.code;

  return withoutUndefinedFields({
    stripePaymentIntentId: paymentIntent.id,
    paymentStatus: "failed",
    stripePaymentStatus: "unpaid",
    checkoutErrorCode: errorCode || "payment_intent_payment_failed",
    lastStripeEventId: event.id,
    lastStripeEventAt: timestamp,
    trustedUpdatedAt: timestamp,
  });
}

function orderMatchesStripeReference(order, stripeObject) {
  const orderRequestId = normalizeOrderId(order);
  const metadataId = metadataOrderId(stripeObject);
  const clientReferenceId = String(stripeObject.client_reference_id || "").trim();

  if (!orderRequestId) return false;
  if (metadataId && metadataId !== orderRequestId) return false;
  if (clientReferenceId && clientReferenceId !== orderRequestId) return false;

  return true;
}

async function markProcessed({ deps, event, result }) {
  await deps.markStripeEventProcessed({
    eventId: event.id,
    eventType: event.type,
    result,
  });
}

async function claimEvent({ deps, event }) {
  const claimed = await deps.claimStripeEventProcessing({
    eventId: event.id,
    eventType: event.type,
  });

  return claimed !== false;
}

async function handleCheckoutSessionEvent({ deps, collection, event, timestamp }) {
  const session = eventObject(event);
  const checkoutSessionId = String(session.id || "").trim();

  if (!checkoutSessionId) {
    return { action: "no_op", reason: "checkout_session_id_missing" };
  }

  const order = await deps.findOrderByCheckoutSessionId({
    collection,
    stripeCheckoutSessionId: checkoutSessionId,
    orderRequestId: metadataOrderId(session) || undefined,
  });

  if (!order || !orderMatchesStripeReference(order, session)) {
    return { action: "retry_later", reason: "order_not_found_or_mismatched" };
  }

  const claimed = await claimEvent({ deps, event });
  if (!claimed) {
    return { action: "replayed_event", eventId: event.id };
  }

  const orderRequestId = normalizeOrderId(order);
  const fields = event.type === "checkout.session.completed"
    ? sessionCompletionFields({ event, session, timestamp })
    : sessionExpiredFields({ event, session, timestamp });

  assertTrustedFields(fields);

  await deps.updateOrderRequest({
    collection,
    orderRequestId,
    fields,
  });

  return { action: "updated_order", orderRequestId };
}

async function handlePaymentIntentFailed({ deps, collection, event, timestamp }) {
  const paymentIntent = eventObject(event);
  const paymentIntentId = String(paymentIntent.id || "").trim();

  if (!paymentIntentId) {
    return { action: "no_op", reason: "payment_intent_id_missing" };
  }

  const order = await deps.findOrderByPaymentIntentId({
    collection,
    stripePaymentIntentId: paymentIntentId,
  });

  if (!order) {
    return { action: "retry_later", reason: "order_not_found" };
  }

  const orderRequestId = normalizeOrderId(order);
  if (!orderRequestId) {
    return { action: "retry_later", reason: "order_request_id_missing" };
  }

  const claimed = await claimEvent({ deps, event });
  if (!claimed) {
    return { action: "replayed_event", eventId: event.id };
  }

  const fields = paymentFailedFields({ event, paymentIntent, timestamp });
  assertTrustedFields(fields);

  await deps.updateOrderRequest({
    collection,
    orderRequestId,
    fields,
  });

  return { action: "updated_order", orderRequestId };
}

function createStripeWebhookEventAdapter(deps = {}) {
  return async function handleVerifiedStripeEvent({ event, env = {}, serverTimestamp } = {}) {
    assertAdapterDependencies(deps);

    if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
      const error = new Error("Stripe webhook adapter requires a verified Stripe event.");
      error.code = "stripe_event_invalid";
      throw error;
    }

    const collection = getOrderCollection(env);
    const timestamp = serverTimestamp || "FIRESTORE_SERVER_TIMESTAMP_REQUIRED";
    let result;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
      result = await handleCheckoutSessionEvent({ deps, collection, event, timestamp });
    } else if (event.type === "payment_intent.payment_failed") {
      result = await handlePaymentIntentFailed({ deps, collection, event, timestamp });
    } else {
      const claimed = await claimEvent({ deps, event });
      if (!claimed) {
        return { action: "replayed_event", eventId: event.id };
      }

      result = { action: "no_op", reason: "unsupported_event_type" };
    }

    if (result.action !== "retry_later" && result.action !== "replayed_event") {
      await markProcessed({ deps, event, result });
    }

    return { eventId: event.id, eventType: event.type, ...result };
  };
}

module.exports = {
  createStripeWebhookEventAdapter,
  getMissingStripeWebhookAdapterDependencies,
};
