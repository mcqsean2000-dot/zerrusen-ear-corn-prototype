"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const {
  createFirebaseAdminAuthenticator,
} = require("./admin-auth");
const {
  createFirestoreAdapter,
} = require("./firestore-adapter");
const {
  routeRequest,
} = require("./index");

const shippoApiToken = defineSecret("SHIPPO_API_TOKEN");

function runtimeEnv() {
  return {
    ...process.env,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || [
      "https://theosfarm.com",
      "https://www.theosfarm.com",
      "https://theos-farm-ear-corn.web.app",
    ].join(","),
    SHIPPO_API_TOKEN: shippoApiToken.value(),
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
  const authenticateAdminRequest = createFirebaseAdminAuthenticator({
    verifyIdToken(token) {
      return getAuth(app).verifyIdToken(token);
    },
  });

  return {
    authenticateAdminRequest,
    env,
    serverTimestamp,
    adminStatusDependencies: {
      updateAdminOrderStatus: firestoreAdapter.updateAdminOrderStatus,
    },
    shippingLabelDependencies: {
      prepareLabelPurchase: firestoreAdapter.prepareLabelPurchase,
      recordLabelPurchase: firestoreAdapter.recordLabelPurchase,
    },
  };
}

exports.api = onRequest({
  region: "us-central1",
  secrets: [shippoApiToken],
}, (req, res) => {
  return routeRequest(req, res, runtimeOptions());
});

module.exports = {
  firebaseApp,
  runtimeEnv,
  runtimeOptions,
  serverTimestamp,
};
