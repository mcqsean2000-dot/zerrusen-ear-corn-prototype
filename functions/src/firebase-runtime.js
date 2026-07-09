"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const Stripe = require("stripe");
const {
  createFirebaseAdminAuthenticator,
} = require("./admin-auth");
const {
  createFirestoreAdapter,
} = require("./firestore-adapter");
const {
  routeRequest,
} = require("./index");
const {
  createTrustedBackendComposition,
} = require("./trusted-backend-composition");

const shippoApiToken = defineSecret("SHIPPO_API_TOKEN");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

let stripeClient;

function getStripeClient() {
  const secretKey = stripeSecretKey.value();
  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

function runtimeEnv() {
  return {
    ...process.env,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || [
      "https://theosfarm.com",
      "https://www.theosfarm.com",
      "https://theos-farm-ear-corn.web.app",
    ].join(","),
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
    SHIPPO_API_TOKEN: shippoApiToken.value(),
    STRIPE_SECRET_KEY: stripeSecretKey.value(),
    STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || "https://theosfarm.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || "https://theosfarm.com/#delivery",
  };
}

function firebaseApp() {
  return getApps()[0] || initializeApp();
}

function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

function runtimeOptions(env = runtimeEnv()) {
  const app = firebaseApp();
  const firestoreAdapter = createFirestoreAdapter({
    firestore: getFirestore(app),
    orderCollection: env.FIRESTORE_ORDER_COLLECTION,
    serverTimestamp,
  });
  const stripe = getStripeClient();
  const trustedBackend = stripe
    ? createTrustedBackendComposition({
      firestore: getFirestore(app),
      stripe,
      orderCollection: env.FIRESTORE_ORDER_COLLECTION,
      stripeEventCollection: env.STRIPE_EVENT_COLLECTION,
      serverTimestamp,
    })
    : {};
  const authenticateAdminRequest = createFirebaseAdminAuthenticator({
    verifyIdToken(token) {
      return getAuth(app).verifyIdToken(token);
    },
  });

  return {
    authenticateAdminRequest,
    env,
    serverTimestamp,
    ...trustedBackend,
    adminStatusDependencies: {
      updateAdminOrderStatus: firestoreAdapter.updateAdminOrderStatus,
    },
    shippingLabelDependencies: {
      prepareLabelPurchase: firestoreAdapter.prepareLabelPurchase,
      recordLabelPurchase: firestoreAdapter.recordLabelPurchase,
    },
  };
}

const api = onRequest({
  region: "us-central1",
  secrets: [shippoApiToken, stripeSecretKey],
}, (req, res) => {
  return routeRequest(req, res, runtimeOptions());
});

module.exports = {
  api,
  firebaseApp,
  runtimeEnv,
  runtimeOptions,
  serverTimestamp,
};
