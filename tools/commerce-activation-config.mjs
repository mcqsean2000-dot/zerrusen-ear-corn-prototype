const EXPECTED_CONFIG = Object.freeze({
  CORS_ALLOWED_ORIGINS: Object.freeze([
    "https://theosfarm.com",
    "https://www.theosfarm.com",
  ]),
  FIREBASE_PROJECT_ID: "theos-farm-ear-corn",
  FIRESTORE_ORDER_COLLECTION: "orderRequests",
  SHIP_FROM_STATE: "IL",
  SHIP_FROM_ZIP: "62467",
  STRIPE_CANCEL_URL: "https://theosfarm.com/#delivery",
  STRIPE_CURRENCY: "usd",
  STRIPE_SUCCESS_URL: "https://theosfarm.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
});
const DISABLED_FLAGS = Object.freeze([
  "NOTIFICATION_DELIVERY_ENABLED",
  "NOTIFICATION_RECONCILIATION_ENABLED",
  "DAILY_FULFILLMENT_SUMMARY_ENABLED",
  "SOCIAL_PUBLISHING_ENABLED",
  "SOCIAL_RECONCILIATION_ENABLED",
]);
const SECRET_KEYS = Object.freeze([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SIGNING_SECRET",
  "SHIPPO_API_TOKEN",
  "RESEND_API_KEY",
  "META_PAGE_ACCESS_TOKEN",
  "META_FACEBOOK_PAGE_ID",
  "META_INSTAGRAM_ACCOUNT_ID",
]);
const REQUIRED_PRIVATE_SENDER_KEYS = Object.freeze([
  "SHIP_FROM_NAME",
  "SHIP_FROM_STREET1",
  "SHIP_FROM_CITY",
]);

function activationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPlaceholder(value) {
  return !value || /^replace-with-|^<.*>$/i.test(value);
}

function normalizedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .sort();
}

export function validateTestCommerceConfig(values) {
  if (!(values instanceof Map)) {
    throw activationError("commerce_env_invalid", "Parsed commerce environment values are required.");
  }

  for (const key of SECRET_KEYS) {
    if (values.has(key)) {
      throw activationError(
        "commerce_secret_in_environment",
        `${key} must be stored in Firebase Secret Manager, not the environment file.`,
      );
    }
  }

  for (const flag of DISABLED_FLAGS) {
    if (values.get(flag) !== "false") {
      throw activationError("commerce_flag_not_disabled", `${flag} must be exactly false.`);
    }
  }

  const actualOrigins = normalizedOrigins(values.get("CORS_ALLOWED_ORIGINS"));
  const expectedOrigins = [...EXPECTED_CONFIG.CORS_ALLOWED_ORIGINS].sort();
  if (
    actualOrigins.length !== expectedOrigins.length ||
    actualOrigins.some((origin, index) => origin !== expectedOrigins[index])
  ) {
    throw activationError(
      "commerce_origins_mismatch",
      `CORS_ALLOWED_ORIGINS must contain only ${EXPECTED_CONFIG.CORS_ALLOWED_ORIGINS.join(",")}.`,
    );
  }

  for (const [key, expected] of Object.entries(EXPECTED_CONFIG)) {
    if (key === "CORS_ALLOWED_ORIGINS") continue;
    if (values.get(key) !== expected) {
      throw activationError("commerce_config_mismatch", `${key} must be exactly ${expected}.`);
    }
  }

  for (const key of REQUIRED_PRIVATE_SENDER_KEYS) {
    if (isPlaceholder(values.get(key))) {
      throw activationError("commerce_sender_incomplete", `${key} must contain the approved private sender value.`);
    }
  }

  return Object.freeze({
    currency: EXPECTED_CONFIG.STRIPE_CURRENCY,
    flagsDisabled: true,
    orderCollection: EXPECTED_CONFIG.FIRESTORE_ORDER_COLLECTION,
    origins: Object.freeze([...EXPECTED_CONFIG.CORS_ALLOWED_ORIGINS]),
    projectId: EXPECTED_CONFIG.FIREBASE_PROJECT_ID,
    senderRegion: `${EXPECTED_CONFIG.SHIP_FROM_STATE} ${EXPECTED_CONFIG.SHIP_FROM_ZIP}`,
  });
}

export {
  DISABLED_FLAGS,
  EXPECTED_CONFIG,
  REQUIRED_PRIVATE_SENDER_KEYS,
  SECRET_KEYS,
};
