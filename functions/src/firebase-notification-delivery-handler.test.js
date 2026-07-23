"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createFirebaseNotificationDeliveryHandler,
} = require("./firebase-notification-delivery-handler");

function event(id = "admin.paid_order_created:order_123:evt_123") {
  return {
    data: { id },
    params: { notificationId: id },
  };
}

test("returns a safe disabled result without attempting delivery", async () => {
  const handler = createFirebaseNotificationDeliveryHandler({
    runtime: {
      enabled: false,
      missingConfiguration: ["NOTIFICATION_DELIVERY_ENABLED", "RESEND_API_KEY"],
    },
  });

  assert.deepEqual(await handler(event()), {
    action: "disabled",
    missingConfiguration: ["NOTIFICATION_DELIVERY_ENABLED", "RESEND_API_KEY"],
  });
});

test("delivers only the trusted Firestore document id", async () => {
  const calls = [];
  const handler = createFirebaseNotificationDeliveryHandler({
    runtime: {
      enabled: true,
      async deliverNotification(input) {
        calls.push(input);
        return {
          action: "sent",
          attempt: 1,
          idempotencyKey: input.idempotencyKey,
          providerMessageId: "email_private_provider_value",
        };
      },
    },
  });

  assert.deepEqual(await handler(event()), { action: "sent", attempt: 1 });
  assert.deepEqual(calls, [{
    idempotencyKey: "admin.paid_order_created:order_123:evt_123",
  }]);
});

test("rejects missing or mismatched event ids before delivery", async () => {
  let calls = 0;
  const handler = createFirebaseNotificationDeliveryHandler({
    runtime: {
      enabled: true,
      deliverNotification() {
        calls += 1;
      },
    },
  });

  await assert.rejects(
    () => handler({ data: { id: "job-a" }, params: { notificationId: "job-b" } }),
    (error) => error.code === "notification_delivery_event_invalid",
  );
  assert.equal(calls, 0);
});

test("requests a Firebase retry only for retryable delivery outcomes", async () => {
  const handler = createFirebaseNotificationDeliveryHandler({
    runtime: {
      enabled: true,
      async deliverNotification() {
        return { action: "retry_scheduled", attempt: 2 };
      },
    },
  });

  await assert.rejects(
    () => handler(event()),
    (error) => error.code === "notification_delivery_retry_requested",
  );
});

test("handler module stays SDK-free and secret-free", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-notification-delivery-handler.js"), "utf8");
  assert.equal(source.includes("firebase-admin"), false);
  assert.equal(source.includes("firebase-functions"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("RESEND_API_KEY"), false);
});

test("Firebase runtime exports a guarded retrying Firestore delivery trigger", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-runtime.js"), "utf8");
  assert.match(source, /require\("firebase-functions\/v2\/firestore"\)/);
  assert.match(source, /defineSecret\("RESEND_API_KEY"\)/);
  assert.match(source, /document: "notificationOutbox\/\{notificationId\}"/);
  assert.match(source, /retry: true/);
  assert.match(source, /secrets: \[resendApiKey\]/);
  assert.match(source, /notificationOutboxDelivery,/);
});
