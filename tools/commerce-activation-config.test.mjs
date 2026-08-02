import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateTestCommerceConfig } from "./commerce-activation-config.mjs";
import { parseEnvironmentSource } from "./environment-config.mjs";

const validSource = `
CORS_ALLOWED_ORIGINS=https://theosfarm.com,https://www.theosfarm.com
FIREBASE_PROJECT_ID=theos-farm-ear-corn
FIRESTORE_ORDER_COLLECTION=orderRequests
STRIPE_SUCCESS_URL=https://theosfarm.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://theosfarm.com/#delivery
STRIPE_CURRENCY=usd
SHIP_FROM_NAME=Approved Farm Sender
SHIP_FROM_STREET1=100 Approved Test Road
SHIP_FROM_CITY=Approved City
SHIP_FROM_STATE=IL
SHIP_FROM_ZIP=62467
NOTIFICATION_DELIVERY_ENABLED=false
NOTIFICATION_RECONCILIATION_ENABLED=false
DAILY_FULFILLMENT_SUMMARY_ENABLED=false
SOCIAL_PUBLISHING_ENABLED=false
SOCIAL_RECONCILIATION_ENABLED=false
`;

test("accepts the approved test-commerce config with unrelated services disabled", () => {
  assert.deepEqual(validateTestCommerceConfig(parseEnvironmentSource(validSource)), {
    currency: "usd",
    flagsDisabled: true,
    orderCollection: "orderRequests",
    origins: ["https://theosfarm.com", "https://www.theosfarm.com"],
    projectId: "theos-farm-ear-corn",
    senderRegion: "IL 62467",
  });
});

test("keeps all known provider secrets out of the committed environment example", async () => {
  const source = await readFile(new URL("../functions/.env.example", import.meta.url), "utf8");
  const values = parseEnvironmentSource(source);
  for (const key of [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SIGNING_SECRET",
    "SHIPPO_API_TOKEN",
    "RESEND_API_KEY",
    "META_PAGE_ACCESS_TOKEN",
    "META_FACEBOOK_PAGE_ID",
    "META_INSTAGRAM_ACCOUNT_ID",
  ]) {
    assert.equal(values.has(key), false, `${key} must not appear in functions/.env.example`);
  }
});

test("rejects provider secrets in the project environment file", () => {
  for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SIGNING_SECRET", "SHIPPO_API_TOKEN"]) {
    assert.throws(
      () => validateTestCommerceConfig(parseEnvironmentSource(`${validSource}\n${key}=not-a-real-secret`)),
      /Firebase Secret Manager/,
    );
  }
});

test("rejects any unrelated service gate that is not exactly false", () => {
  for (const flag of [
    "NOTIFICATION_DELIVERY_ENABLED",
    "NOTIFICATION_RECONCILIATION_ENABLED",
    "DAILY_FULFILLMENT_SUMMARY_ENABLED",
    "SOCIAL_PUBLISHING_ENABLED",
    "SOCIAL_RECONCILIATION_ENABLED",
  ]) {
    assert.throws(
      () => validateTestCommerceConfig(parseEnvironmentSource(
        validSource.replace(`${flag}=false`, `${flag}=true`),
      )),
      new RegExp(`${flag} must be exactly false`),
    );
  }
});

test("rejects wrong project, route, collection, currency, and sender region values", () => {
  for (const [original, replacement] of [
    ["FIREBASE_PROJECT_ID=theos-farm-ear-corn", "FIREBASE_PROJECT_ID=wrong-project"],
    ["STRIPE_CANCEL_URL=https://theosfarm.com/#delivery", "STRIPE_CANCEL_URL=https://example.com"],
    ["FIRESTORE_ORDER_COLLECTION=orderRequests", "FIRESTORE_ORDER_COLLECTION=orders"],
    ["STRIPE_CURRENCY=usd", "STRIPE_CURRENCY=eur"],
    ["SHIP_FROM_STATE=IL", "SHIP_FROM_STATE=MO"],
    ["SHIP_FROM_ZIP=62467", "SHIP_FROM_ZIP=00000"],
  ]) {
    assert.throws(
      () => validateTestCommerceConfig(parseEnvironmentSource(validSource.replace(original, replacement))),
      /must be exactly/,
    );
  }
});

test("rejects extra origins and placeholder private sender fields", () => {
  assert.throws(
    () => validateTestCommerceConfig(parseEnvironmentSource(
      validSource.replace(
        "CORS_ALLOWED_ORIGINS=https://theosfarm.com,https://www.theosfarm.com",
        "CORS_ALLOWED_ORIGINS=https://theosfarm.com,https://www.theosfarm.com,https://example.com",
      ),
    )),
    /must contain only/,
  );
  assert.throws(
    () => validateTestCommerceConfig(parseEnvironmentSource(
      validSource.replace("SHIP_FROM_STREET1=100 Approved Test Road", "SHIP_FROM_STREET1=replace-with-ship-from-street"),
    )),
    /approved private sender value/,
  );
});
