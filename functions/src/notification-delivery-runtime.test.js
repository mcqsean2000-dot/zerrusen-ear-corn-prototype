"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createNotificationDeliveryRuntime,
  getMissingNotificationRuntimeConfiguration,
} = require("./notification-delivery-runtime");

function persistence(overrides = {}) {
  return {
    claimNotificationJob() {
      return {
        attempt: 1,
        job: {
          idempotencyKey: "admin.paid_order_created:order_123:evt_123",
          subject: "Paid order",
          text: "Trusted summary",
          to: "theosfeedfarm@gmail.com",
        },
      };
    },
    recordNotificationFailure() {},
    recordNotificationSuccess() {},
    ...overrides,
  };
}

test("stays disabled until the explicit flag and all trusted dependencies exist", () => {
  const result = createNotificationDeliveryRuntime();

  assert.equal(result.enabled, false);
  assert.deepEqual(result.missingConfiguration, [
    "NOTIFICATION_DELIVERY_ENABLED",
    "RESEND_API_KEY",
    "NOTIFICATION_FROM_EMAIL",
    "fetchImpl",
    "claimNotificationJob",
    "recordNotificationSuccess",
    "recordNotificationFailure",
  ]);
  assert.equal(result.deliverNotification, undefined);
});

test("reports only the explicit opt-in when other configuration is ready", () => {
  assert.deepEqual(getMissingNotificationRuntimeConfiguration({
    env: {
      RESEND_API_KEY: "re_test_not_a_secret",
      NOTIFICATION_FROM_EMAIL: "orders@example.test",
    },
    fetchImpl() {},
    persistence: persistence(),
  }), ["NOTIFICATION_DELIVERY_ENABLED"]);
});

test("composes the provider and persistence only after explicit enablement", async () => {
  const calls = [];
  const runtime = createNotificationDeliveryRuntime({
    env: {
      NOTIFICATION_DELIVERY_ENABLED: "true",
      NOTIFICATION_FROM_EMAIL: "Theo's Farm <orders@example.test>",
      NOTIFICATION_REPLY_TO: "theosfeedfarm@gmail.com",
      RESEND_API_KEY: "re_test_not_a_secret",
    },
    async fetchImpl(url, options) {
      calls.push({ type: "provider", url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: "email_123" };
        },
      };
    },
    persistence: persistence({
      recordNotificationSuccess(input) {
        calls.push({ type: "success", ...input });
      },
    }),
  });

  assert.equal(runtime.enabled, true);
  assert.deepEqual(await runtime.deliverNotification({
    idempotencyKey: "admin.paid_order_created:order_123:evt_123",
  }), {
    action: "sent",
    attempt: 1,
    idempotencyKey: "admin.paid_order_created:order_123:evt_123",
    providerMessageId: "email_123",
  });
  assert.deepEqual(calls.map((call) => call.type), ["provider", "success"]);
});
