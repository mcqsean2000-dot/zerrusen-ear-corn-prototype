"use strict";

const {
  createTrustedBackendComposition,
} = require("./trusted-backend-composition");

const REQUIRED_CHECKOUT_ENV_KEYS = [
  "CORS_ALLOWED_ORIGINS",
  "FIREBASE_PROJECT_ID",
  "STRIPE_CANCEL_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_SUCCESS_URL",
];

const REQUIRED_WEBHOOK_ENV_KEYS = [
  "STRIPE_WEBHOOK_SIGNING_SECRET",
];

const REQUIRED_FIREBASE_FUNCTIONS_RUNTIME_ENV_KEYS = [
  ...REQUIRED_CHECKOUT_ENV_KEYS,
  ...REQUIRED_WEBHOOK_ENV_KEYS,
];

function isFunction(value) {
  return typeof value === "function";
}

function isPlaceholder(value) {
  return !value || /^replace-with-/i.test(value) || /^https:\/\/example\.com\b/i.test(value);
}

function nestedValue(source, path) {
  return path.split(".").reduce((current, key) => current && current[key], source);
}

function getMissingRuntimeEnv(env = {}, keys = REQUIRED_FIREBASE_FUNCTIONS_RUNTIME_ENV_KEYS) {
  return keys.filter((key) => isPlaceholder(env[key]));
}

function getMissingRuntimeClientCapabilities(options = {}) {
  const missing = [];
  const firestore = options.firestore;
  const stripe = options.stripe;

  if (!firestore) {
    missing.push("firestore");
  } else {
    if (!isFunction(firestore.collection)) missing.push("firestore.collection");
    if (!isFunction(firestore.runTransaction)) missing.push("firestore.runTransaction");
  }

  if (!stripe) {
    missing.push("stripe");
  } else {
    if (!isFunction(nestedValue(stripe, "checkout.sessions.create"))) {
      missing.push("stripe.checkout.sessions.create");
    }
    if (!isFunction(nestedValue(stripe, "webhooks.constructEvent"))) {
      missing.push("stripe.webhooks.constructEvent");
    }
  }

  if (!isFunction(options.serverTimestamp)) {
    missing.push("serverTimestamp");
  }

  return missing;
}

function runtimeGuardError(missingEnv, missingRuntime) {
  const error = new Error("Firebase Functions runtime wiring is incomplete.");
  error.code = "firebase_functions_runtime_guard_failed";
  error.missingEnv = missingEnv;
  error.missingRuntime = missingRuntime;
  return error;
}

function assertFirebaseFunctionsRuntime(options = {}) {
  const missingEnv = getMissingRuntimeEnv(options.env || {});
  const missingRuntime = getMissingRuntimeClientCapabilities(options);

  if (missingEnv.length || missingRuntime.length) {
    throw runtimeGuardError(missingEnv, missingRuntime);
  }
}

function createFirebaseFunctionsRuntime(options = {}) {
  assertFirebaseFunctionsRuntime(options);

  return {
    env: options.env,
    ...createTrustedBackendComposition({
      firestore: options.firestore,
      stripe: options.stripe,
      orderCollection: options.orderCollection || options.env.FIRESTORE_ORDER_COLLECTION,
      stripeEventCollection: options.stripeEventCollection || options.env.STRIPE_EVENT_COLLECTION,
      serverTimestamp: options.serverTimestamp,
    }),
  };
}

module.exports = {
  REQUIRED_CHECKOUT_ENV_KEYS,
  REQUIRED_FIREBASE_FUNCTIONS_RUNTIME_ENV_KEYS,
  REQUIRED_WEBHOOK_ENV_KEYS,
  assertFirebaseFunctionsRuntime,
  createFirebaseFunctionsRuntime,
  getMissingRuntimeClientCapabilities,
  getMissingRuntimeEnv,
};
