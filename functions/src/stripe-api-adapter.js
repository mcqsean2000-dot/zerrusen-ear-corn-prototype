"use strict";

function isFunction(value) {
  return typeof value === "function";
}

function requireStripeClient(stripe) {
  if (!stripe || typeof stripe !== "object") {
    const error = new Error("A Stripe-like client object is required.");
    error.code = "stripe_client_missing";
    throw error;
  }

  return stripe;
}

function checkoutSessionsCreate(stripe) {
  const client = requireStripeClient(stripe);
  const create = client.checkout
    && client.checkout.sessions
    && client.checkout.sessions.create;

  if (!isFunction(create)) {
    const error = new Error("Stripe-like client must provide checkout.sessions.create(params).");
    error.code = "stripe_checkout_sessions_create_missing";
    throw error;
  }

  return create.bind(client.checkout.sessions);
}

function webhookConstructEvent(stripe) {
  const client = requireStripeClient(stripe);
  const constructEvent = client.webhooks && client.webhooks.constructEvent;

  if (!isFunction(constructEvent)) {
    const error = new Error("Stripe-like client must provide webhooks.constructEvent(rawBody, signature, signingSecret).");
    error.code = "stripe_webhook_construct_event_missing";
    throw error;
  }

  return constructEvent.bind(client.webhooks);
}

function resolveStripeClient(args, fallback) {
  return args.stripe || args.stripeClient || args.client || fallback;
}

function requireNonEmptyString(value, code, message) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

function buildCheckoutSessionParams({
  env = {},
  orderRequestId,
  lineItems,
  metadata,
  successUrl,
  cancelUrl,
  params,
}) {
  if (params && typeof params === "object" && !Array.isArray(params)) {
    return params;
  }

  const resolvedSuccessUrl = successUrl || env.STRIPE_SUCCESS_URL;
  const resolvedCancelUrl = cancelUrl || env.STRIPE_CANCEL_URL;

  requireNonEmptyString(resolvedSuccessUrl, "stripe_success_url_missing", "A Stripe Checkout success URL is required.");
  requireNonEmptyString(resolvedCancelUrl, "stripe_cancel_url_missing", "A Stripe Checkout cancel URL is required.");

  if (!Array.isArray(lineItems) || !lineItems.length) {
    const error = new Error("Stripe Checkout line items are required.");
    error.code = "stripe_line_items_missing";
    throw error;
  }

  return {
    mode: "payment",
    success_url: resolvedSuccessUrl,
    cancel_url: resolvedCancelUrl,
    client_reference_id: String(orderRequestId || ""),
    line_items: lineItems,
    metadata: metadata || {},
  };
}

async function createStripeCheckoutSession(args = {}) {
  const create = checkoutSessionsCreate(resolveStripeClient(args));
  const sessionParams = buildCheckoutSessionParams(args);

  try {
    return await create(sessionParams);
  } catch (cause) {
    const error = new Error("Stripe Checkout Session creation failed.");
    error.code = cause && cause.code || "stripe_checkout_session_create_failed";
    throw error;
  }
}

async function verifyStripeWebhookEvent(args = {}) {
  const constructEvent = webhookConstructEvent(resolveStripeClient(args));

  if (!Buffer.isBuffer(args.rawBody) && typeof args.rawBody !== "string") {
    const error = new Error("Raw webhook body is required for Stripe signature verification.");
    error.code = "stripe_webhook_raw_body_missing";
    throw error;
  }

  requireNonEmptyString(args.signature, "stripe_webhook_signature_missing", "Stripe webhook signature is required.");
  requireNonEmptyString(args.signingSecret, "stripe_webhook_signing_secret_missing", "Stripe webhook signing secret is required.");

  try {
    return await constructEvent(args.rawBody, args.signature, args.signingSecret);
  } catch (cause) {
    const error = new Error("Stripe webhook signature verification failed.");
    error.code = cause && cause.code || "stripe_webhook_verification_failed";
    throw error;
  }
}

function createStripeApiAdapter(options = {}) {
  const stripe = resolveStripeClient(options);

  return {
    createStripeCheckoutSession(args = {}) {
      return createStripeCheckoutSession({
        ...args,
        stripe,
      });
    },
    verifyStripeWebhookEvent(args = {}) {
      return verifyStripeWebhookEvent({
        ...args,
        stripe,
      });
    },
  };
}

module.exports = {
  buildCheckoutSessionParams,
  createStripeApiAdapter,
  createStripeCheckoutSession,
  verifyStripeWebhookEvent,
};
