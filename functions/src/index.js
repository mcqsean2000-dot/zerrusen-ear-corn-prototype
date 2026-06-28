"use strict";

const http = require("node:http");
const {
  buildStripeMetadata,
  buildTrustedOrderRequestForCreate,
  validateOrderRequestDraft,
} = require("./order-validation");

const CHECKOUT_ENV_KEYS = [
  "CORS_ALLOWED_ORIGINS",
  "FIREBASE_PROJECT_ID",
  "STRIPE_CANCEL_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_SUCCESS_URL",
];

const WEBHOOK_ENV_KEYS = [
  "STRIPE_WEBHOOK_SIGNING_SECRET",
];

function isPlaceholder(value) {
  return !value || /^replace-with-/i.test(value) || /^https:\/\/example\.com\b/i.test(value);
}

function getMissingEnv(env, keys) {
  return keys.filter((key) => isPlaceholder(env[key]));
}

function getHeader(req, name) {
  const target = name.toLowerCase();
  const headers = req.headers || {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return "";
}

function getAllowedOrigins(env) {
  return String(env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => !isPlaceholder(origin));
}

function isLocalDevelopmentOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function buildCorsHeaders(req, env) {
  const origin = getHeader(req, "origin");
  const allowedOrigins = getAllowedOrigins(env);

  if (!origin) {
    return {};
  }

  if (allowedOrigins.includes(origin) || (env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(origin))) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, stripe-signature",
      "access-control-max-age": "300",
      vary: "Origin",
    };
  }

  return {
    vary: "Origin",
  };
}

function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  const responseHeaders = {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  };

  if (typeof res.status === "function" && typeof res.json === "function") {
    res.status(statusCode);
    for (const [key, value] of Object.entries(responseHeaders)) {
      if (typeof res.set === "function") {
        res.set(key, value);
      }
    }
    res.json(payload);
    return;
  }

  res.writeHead(statusCode, responseHeaders);
  res.end(body);
}

function sendCorsPreflight(req, res, env) {
  const corsHeaders = buildCorsHeaders(req, env);
  const origin = getHeader(req, "origin");

  if (origin && !corsHeaders["access-control-allow-origin"]) {
    return sendJson(res, 403, {
      error: {
        code: "origin_not_allowed",
        message: "This storefront origin is not allowed to call the checkout backend.",
      },
    }, corsHeaders);
  }

  if (typeof res.status === "function" && typeof res.end === "function") {
    res.status(204);
    for (const [key, value] of Object.entries(corsHeaders)) {
      if (typeof res.set === "function") {
        res.set(key, value);
      }
    }
    res.end();
    return;
  }

  res.writeHead(204, corsHeaders);
  res.end();
}

function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) {
    return Promise.resolve(req.rawBody);
  }

  if (typeof req.body === "string") {
    return Promise.resolve(Buffer.from(req.body));
  }

  if (Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }

  if (req.body && typeof req.body === "object") {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const rawBody = await readRawBody(req);
  if (!rawBody.length) {
    return {};
  }

  return JSON.parse(rawBody.toString("utf8"));
}

function safeSetupDetails(env, missingEnv) {
  if (env.NODE_ENV === "production") {
    return {};
  }

  return {
    setupRequired: missingEnv,
  };
}

async function checkoutSessionsHandler(req, res, options = {}) {
  const env = options.env || process.env;
  const corsHeaders = buildCorsHeaders(req, env);

  if (req.method === "OPTIONS") {
    return sendCorsPreflight(req, res, env);
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: {
        code: "method_not_allowed",
        message: "Use POST to request a checkout session.",
      },
    }, { allow: "POST, OPTIONS", ...corsHeaders });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, {
      error: {
        code: "invalid_json",
        message: "Send a valid JSON checkout request.",
      },
    }, corsHeaders);
  }

  const validation = validateOrderRequestDraft(body.orderRequest);
  if (!validation.ok) {
    return sendJson(res, 400, {
      error: {
        code: "invalid_order_request",
        message: "Adjust the cart quantity before requesting checkout.",
      },
    }, corsHeaders);
  }

  const missingEnv = getMissingEnv(env, CHECKOUT_ENV_KEYS);
  if (missingEnv.length) {
    return sendJson(res, 503, {
      error: {
        code: "checkout_disabled",
        message: "Checkout session creation is not enabled yet.",
      },
      mock: true,
      ...safeSetupDetails(env, missingEnv),
    }, corsHeaders);
  }

  if (typeof options.createCheckoutSession !== "function") {
    return sendJson(res, 501, {
      error: {
        code: "checkout_adapter_missing",
        message: "Checkout session creation requires trusted Stripe and Firestore adapters.",
      },
      mock: true,
    }, corsHeaders);
  }

  try {
    const serverTimestamp = typeof options.serverTimestamp === "function"
      ? options.serverTimestamp()
      : "FIRESTORE_SERVER_TIMESTAMP_REQUIRED";
    const trustedOrderRequest = buildTrustedOrderRequestForCreate(validation.orderRequest, {
      serverTimestamp,
    });

    const result = await options.createCheckoutSession({
      env,
      orderRequest: trustedOrderRequest,
      buildStripeMetadata,
    });

    return sendJson(res, 200, {
      orderRequestId: result.orderRequestId,
      checkoutSessionId: result.checkoutSessionId,
      checkoutUrl: result.checkoutUrl,
    }, corsHeaders);
  } catch (error) {
    return sendJson(res, 502, {
      error: {
        code: "checkout_creation_failed",
        message: "Checkout could not be started. Please try again or contact Theo's Farm.",
      },
    }, corsHeaders);
  }
}

async function stripeWebhookHandler(req, res, options = {}) {
  const env = options.env || process.env;
  const corsHeaders = buildCorsHeaders(req, env);

  if (req.method === "OPTIONS") {
    return sendCorsPreflight(req, res, env);
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: {
        code: "method_not_allowed",
        message: "Use POST for Stripe webhooks.",
      },
    }, { allow: "POST, OPTIONS", ...corsHeaders });
  }

  const missingEnv = getMissingEnv(env, WEBHOOK_ENV_KEYS);
  if (missingEnv.length) {
    return sendJson(res, 503, {
      error: {
        code: "webhook_disabled",
        message: "Stripe webhook handling is not enabled yet.",
      },
      mock: true,
      ...safeSetupDetails(env, missingEnv),
    }, corsHeaders);
  }

  const signature = getHeader(req, "stripe-signature");
  if (!signature) {
    return sendJson(res, 400, {
      error: {
        code: "missing_stripe_signature",
        message: "Stripe webhook signature is required.",
      },
    }, corsHeaders);
  }

  if (typeof options.verifyStripeWebhookEvent !== "function") {
    return sendJson(res, 501, {
      error: {
        code: "webhook_verifier_missing",
        message: "Webhook processing requires Stripe signature verification before reading event data.",
      },
      mock: true,
    }, corsHeaders);
  }

  try {
    const rawBody = await readRawBody(req);
    const event = await options.verifyStripeWebhookEvent({
      rawBody,
      signature,
      signingSecret: env.STRIPE_WEBHOOK_SIGNING_SECRET,
    });

    if (typeof options.handleStripeEvent === "function") {
      await options.handleStripeEvent({ event, env });
    }

    return sendJson(res, 200, {
      received: true,
      eventId: event.id,
      eventType: event.type,
    }, corsHeaders);
  } catch (error) {
    return sendJson(res, 400, {
      error: {
        code: "invalid_stripe_webhook",
        message: "Stripe webhook verification failed.",
      },
    }, corsHeaders);
  }
}

function routeRequest(req, res, options = {}) {
  const path = new URL(req.url, "http://localhost").pathname;

  if (path === "/api/checkout-sessions") {
    return checkoutSessionsHandler(req, res, options);
  }

  if (path === "/api/stripe/webhook") {
    return stripeWebhookHandler(req, res, options);
  }

  return sendJson(res, 404, {
    error: {
      code: "not_found",
      message: "Unknown backend scaffold route.",
    },
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  http.createServer((req, res) => {
    Promise.resolve(routeRequest(req, res)).catch(() => {
      sendJson(res, 500, {
        error: {
          code: "internal_error",
          message: "Backend scaffold failed to handle the request.",
        },
      });
    });
  }).listen(port, () => {
    console.log(`Theo's Farm checkout scaffold listening on http://localhost:${port}`);
  });
}

module.exports = {
  buildCorsHeaders,
  checkoutSessionsHandler,
  readJsonBody,
  readRawBody,
  routeRequest,
  stripeWebhookHandler,
};
