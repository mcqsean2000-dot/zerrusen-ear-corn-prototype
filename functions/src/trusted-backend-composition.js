"use strict";

const {
  SERVER_TIMESTAMP_SENTINEL,
  createFirestoreAdapter,
} = require("./firestore-adapter");
const {
  createStripeApiAdapter,
} = require("./stripe-api-adapter");

function isFunction(value) {
  return typeof value === "function";
}

function getMissingTrustedBackendClients(options = {}) {
  const missing = [];

  if (!options.firestore) missing.push("firestore");
  if (!options.stripe) missing.push("stripe");

  return missing;
}

function assertTrustedBackendClients(options) {
  const missing = getMissingTrustedBackendClients(options);

  if (missing.length) {
    const error = new Error("Trusted backend composition requires injected Firestore-like and Stripe-like clients.");
    error.code = "trusted_backend_composition_client_missing";
    error.missingClients = missing;
    throw error;
  }
}

function createServerTimestampProvider(options = {}) {
  if (isFunction(options.serverTimestamp)) {
    return options.serverTimestamp;
  }

  if (options.serverTimestamp !== undefined) {
    return () => options.serverTimestamp;
  }

  return () => SERVER_TIMESTAMP_SENTINEL;
}

function createTrustedBackendComposition(options = {}) {
  assertTrustedBackendClients(options);

  const serverTimestamp = createServerTimestampProvider(options);
  const firestoreAdapter = createFirestoreAdapter({
    firestore: options.firestore,
    orderCollection: options.orderCollection,
    stripeEventCollection: options.stripeEventCollection,
    serverTimestamp,
  });
  const stripeAdapter = createStripeApiAdapter({
    stripe: options.stripe,
  });

  return {
    serverTimestamp,
    verifyStripeWebhookEvent: stripeAdapter.verifyStripeWebhookEvent,
    checkoutAdapterDependencies: {
      createOrderRequest: firestoreAdapter.createOrderRequest,
      createStripeCheckoutSession: stripeAdapter.createStripeCheckoutSession,
      updateOrderRequest: firestoreAdapter.updateOrderRequest,
      markCheckoutSessionFailed: firestoreAdapter.markCheckoutSessionFailed,
    },
    stripeWebhookAdapterDependencies: {
      claimStripeEventProcessing: firestoreAdapter.claimStripeEventProcessing,
      markStripeEventProcessed: firestoreAdapter.markStripeEventProcessed,
      findOrderByCheckoutSessionId: firestoreAdapter.findOrderByCheckoutSessionId,
      findOrderByPaymentIntentId: firestoreAdapter.findOrderByPaymentIntentId,
      updateOrderRequest: firestoreAdapter.updateOrderRequest,
    },
  };
}

module.exports = {
  createServerTimestampProvider,
  createTrustedBackendComposition,
  getMissingTrustedBackendClients,
};
