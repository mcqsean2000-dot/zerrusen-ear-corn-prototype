"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const firebaseLogger = require("firebase-functions/logger");
const Stripe = require("stripe");
const {
  createFirebaseAdminAuthenticator,
} = require("./admin-auth");
const {
  createFirestoreAdapter,
} = require("./firestore-adapter");
const {
  createDailyFulfillmentOutbox,
} = require("./daily-fulfillment-outbox");
const {
  createFirebaseDailySummaryHandler,
} = require("./firebase-daily-summary-handler");
const {
  createFirebaseNotificationDeliveryHandler,
} = require("./firebase-notification-delivery-handler");
const {
  routeRequest,
} = require("./index");
const {
  createNotificationDeliveryRuntime,
} = require("./notification-delivery-runtime");
const {
  createOperationalLogger,
  createSanitizedOperationalError,
} = require("./operational-logger");
const {
  createNotificationReconciler,
} = require("./notification-reconciliation");
const {
  createSocialPostPublishingRuntime,
} = require("./social-post-publishing-runtime");
const {
  createSocialPostQueue,
} = require("./social-post-queue");
const {
  createSocialPostReconciler,
} = require("./social-post-reconciliation");
const {
  createTrustedBackendComposition,
} = require("./trusted-backend-composition");

const metaFacebookPageId = defineSecret("META_FACEBOOK_PAGE_ID");
const metaInstagramAccountId = defineSecret("META_INSTAGRAM_ACCOUNT_ID");
const metaPageAccessToken = defineSecret("META_PAGE_ACCESS_TOKEN");
const shippoApiToken = defineSecret("SHIPPO_API_TOKEN");
const resendApiKey = defineSecret("RESEND_API_KEY");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSigningSecret = defineSecret("STRIPE_WEBHOOK_SIGNING_SECRET");

let stripeClient;
const runtimeLogger = createOperationalLogger({
  writeError(event, reportableError, details) {
    firebaseLogger.error(event, reportableError, details);
  },
  writeInfo(event, details) {
    firebaseLogger.info(event, details);
  },
});

async function runLoggedOperation(event, operation) {
  try {
    const result = await operation();
    runtimeLogger.info(event, result);
    return result;
  } catch (error) {
    runtimeLogger.error(`${event}_failed`, error);
    throw createSanitizedOperationalError(`${event}_failed`, error);
  }
}

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
    STRIPE_WEBHOOK_SIGNING_SECRET: stripeWebhookSigningSecret.value(),
    STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || "https://theosfarm.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || "https://theosfarm.com/#delivery",
  };
}

function dailySummaryEnv() {
  return {
    DAILY_FULFILLMENT_SUMMARY_ENABLED: process.env.DAILY_FULFILLMENT_SUMMARY_ENABLED,
    DAILY_FULFILLMENT_TIME_ZONE: "America/Chicago",
    FIRESTORE_ORDER_COLLECTION: process.env.FIRESTORE_ORDER_COLLECTION,
    NOTIFICATION_ADMIN_EMAIL: process.env.NOTIFICATION_ADMIN_EMAIL || "theosfeedfarm@gmail.com",
  };
}

function notificationDeliveryEnv() {
  return {
    NOTIFICATION_DELIVERY_ENABLED: process.env.NOTIFICATION_DELIVERY_ENABLED,
    NOTIFICATION_FROM_EMAIL: process.env.NOTIFICATION_FROM_EMAIL,
    NOTIFICATION_REPLY_TO: process.env.NOTIFICATION_REPLY_TO,
    RESEND_API_KEY: resendApiKey.value(),
  };
}

function notificationReconciliationEnv() {
  return {
    ...notificationDeliveryEnv(),
    NOTIFICATION_RECONCILIATION_ENABLED: process.env.NOTIFICATION_RECONCILIATION_ENABLED,
  };
}

function socialPublishingEnv() {
  return {
    META_FACEBOOK_PAGE_ID: metaFacebookPageId.value(),
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
    META_INSTAGRAM_ACCOUNT_ID: metaInstagramAccountId.value(),
    META_PAGE_ACCESS_TOKEN: metaPageAccessToken.value(),
    SOCIAL_PUBLISHING_ENABLED: process.env.SOCIAL_PUBLISHING_ENABLED,
  };
}

function socialReconciliationEnv() {
  return {
    SOCIAL_RECONCILIATION_ENABLED: process.env.SOCIAL_RECONCILIATION_ENABLED,
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
  const socialPostQueue = createSocialPostQueue({
    enqueueApprovedSocialPost: firestoreAdapter.enqueueApprovedSocialPost,
  });

  return {
    authenticateAdminRequest,
    env,
    logger: runtimeLogger,
    serverTimestamp,
    ...trustedBackend,
    adminStatusDependencies: {
      updateAdminOrderStatus: firestoreAdapter.updateAdminOrderStatus,
    },
    adminNotificationDependencies: {
      listAdminNotificationJobs: firestoreAdapter.listAdminNotificationJobs,
      requeueAdminNotificationJob: firestoreAdapter.requeueAdminNotificationJob,
    },
    adminSocialDependencies: {
      listAdminSocialPostReconciliation: firestoreAdapter.listAdminSocialPostReconciliation,
      queueApprovedSocialPost: socialPostQueue.queueApprovedSocialPost,
      resolveAdminSocialPostReconciliation: firestoreAdapter.resolveAdminSocialPostReconciliation,
    },
    shippingLabelDependencies: {
      prepareLabelPurchase: firestoreAdapter.prepareLabelPurchase,
      recordLabelPurchase: firestoreAdapter.recordLabelPurchase,
    },
  };
}

const api = onRequest({
  region: "us-central1",
  secrets: [shippoApiToken, stripeSecretKey, stripeWebhookSigningSecret],
}, (req, res) => {
  return Promise.resolve(routeRequest(req, res, runtimeOptions())).catch((error) => {
    runtimeLogger.error("api_request_unhandled", error, {
      method: req.method,
      path: new URL(req.url, "http://localhost").pathname,
    });
    throw createSanitizedOperationalError("api_request_unhandled", error);
  });
});

const dailyFulfillmentSummary = onSchedule({
  region: "us-central1",
  schedule: "0 8 * * *",
  timeZone: "America/Chicago",
  retryCount: 2,
  maxRetrySeconds: 900,
}, async (event) => {
  return runLoggedOperation("daily_fulfillment_summary_schedule", async () => {
    const env = dailySummaryEnv();
    const app = firebaseApp();
    const firestoreAdapter = createFirestoreAdapter({
      firestore: getFirestore(app),
      orderCollection: env.FIRESTORE_ORDER_COLLECTION,
      serverTimestamp,
    });
    const outbox = createDailyFulfillmentOutbox({
      enqueueNotificationJobs: firestoreAdapter.enqueueNotificationJobs,
      listPaidFulfillmentOrders: firestoreAdapter.listPaidFulfillmentOrders,
    });
    const handler = createFirebaseDailySummaryHandler({
      env,
      queueDailyFulfillmentSummary: outbox.queueDailyFulfillmentSummary,
    });
    return handler(event);
  });
});

const notificationOutboxDelivery = onDocumentCreated({
  document: "notificationOutbox/{notificationId}",
  region: "us-central1",
  retry: true,
  secrets: [resendApiKey],
}, async (event) => {
  return runLoggedOperation("notification_outbox_delivery", async () => {
    const app = firebaseApp();
    const firestoreAdapter = createFirestoreAdapter({
      firestore: getFirestore(app),
      serverTimestamp,
    });
    const runtime = createNotificationDeliveryRuntime({
      env: notificationDeliveryEnv(),
      fetchImpl: globalThis.fetch,
      persistence: {
        claimNotificationJob: firestoreAdapter.claimNotificationJob,
        recordNotificationFailure: firestoreAdapter.recordNotificationFailure,
        recordNotificationSuccess: firestoreAdapter.recordNotificationSuccess,
      },
    });
    const handler = createFirebaseNotificationDeliveryHandler({ runtime });
    return handler(event);
  });
});

const notificationOutboxReconciliation = onSchedule({
  region: "us-central1",
  schedule: "*/10 * * * *",
  retryCount: 1,
  maxRetrySeconds: 600,
  secrets: [resendApiKey],
}, async () => {
  return runLoggedOperation("notification_outbox_reconciliation", async () => {
    const app = firebaseApp();
    const firestoreAdapter = createFirestoreAdapter({
      firestore: getFirestore(app),
      serverTimestamp,
    });
    const env = notificationReconciliationEnv();
    const runtime = createNotificationDeliveryRuntime({
      env,
      fetchImpl: globalThis.fetch,
      persistence: {
        claimNotificationJob: firestoreAdapter.claimNotificationJob,
        recordNotificationFailure: firestoreAdapter.recordNotificationFailure,
        recordNotificationSuccess: firestoreAdapter.recordNotificationSuccess,
      },
    });
    const reconciler = createNotificationReconciler({
      env,
      listPendingNotificationJobs: firestoreAdapter.listPendingNotificationJobs,
      recoverStaleNotificationJobs: firestoreAdapter.recoverStaleNotificationJobs,
      runtime,
    });
    return reconciler.enabled
      ? reconciler.run()
      : { action: "disabled", missingConfiguration: reconciler.missingConfiguration };
  });
});

const socialPostPublishing = onSchedule({
  region: "us-central1",
  schedule: "*/5 * * * *",
  retryCount: 0,
  secrets: [metaFacebookPageId, metaInstagramAccountId, metaPageAccessToken],
}, async (event) => {
  return runLoggedOperation("social_post_publishing", async () => {
    const app = firebaseApp();
    const firestoreAdapter = createFirestoreAdapter({
      firestore: getFirestore(app),
      serverTimestamp,
    });
    const runtime = createSocialPostPublishingRuntime({
      env: socialPublishingEnv(),
      fetchImpl: globalThis.fetch,
      persistence: {
        claimDueSocialPost: firestoreAdapter.claimDueSocialPost,
        completeSocialPostPublishing: firestoreAdapter.completeSocialPostPublishing,
        recordSocialPostFailure: firestoreAdapter.recordSocialPostFailure,
        recordSocialPostPlatformSuccess: firestoreAdapter.recordSocialPostPlatformSuccess,
      },
    });
    return runtime.enabled
      ? runtime.publishDueSocialPost({ now: new Date(event.scheduleTime) })
      : { action: "disabled", missingConfiguration: runtime.missingConfiguration };
  });
});

const socialPostReconciliation = onSchedule({
  region: "us-central1",
  schedule: "*/10 * * * *",
  retryCount: 0,
}, async () => {
  return runLoggedOperation("social_post_reconciliation", async () => {
    const app = firebaseApp();
    const firestoreAdapter = createFirestoreAdapter({
      firestore: getFirestore(app),
      serverTimestamp,
    });
    const reconciler = createSocialPostReconciler({
      env: socialReconciliationEnv(),
      recoverStaleSocialPostClaims: firestoreAdapter.recoverStaleSocialPostClaims,
    });
    return reconciler.enabled
      ? reconciler.run()
      : { action: "disabled", missingConfiguration: reconciler.missingConfiguration };
  });
});

module.exports = {
  api,
  dailyFulfillmentSummary,
  dailySummaryEnv,
  firebaseApp,
  notificationDeliveryEnv,
  notificationOutboxDelivery,
  notificationOutboxReconciliation,
  notificationReconciliationEnv,
  runtimeEnv,
  runtimeOptions,
  serverTimestamp,
  socialPostPublishing,
  socialPostReconciliation,
  socialPublishingEnv,
  socialReconciliationEnv,
};
