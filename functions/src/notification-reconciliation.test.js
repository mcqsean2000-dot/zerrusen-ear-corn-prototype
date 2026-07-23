"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createNotificationReconciler,
  getMissingNotificationReconciliationConfiguration,
} = require("./notification-reconciliation");

test("stays disabled until reconciliation and delivery are explicitly enabled", () => {
  assert.deepEqual(getMissingNotificationReconciliationConfiguration(), [
    "NOTIFICATION_RECONCILIATION_ENABLED",
    "notificationDeliveryRuntime",
    "listPendingNotificationJobs",
  ]);
});

test("processes a bounded list and returns safe aggregate counts", async () => {
  const calls = [];
  const reconciler = createNotificationReconciler({
    env: { NOTIFICATION_RECONCILIATION_ENABLED: "true" },
    limit: 3,
    async listPendingNotificationJobs(input) {
      calls.push({ type: "list", input });
      return ["job-1", "job-2", "job-3"];
    },
    runtime: {
      enabled: true,
      async deliverNotification({ idempotencyKey }) {
        calls.push({ type: "deliver", idempotencyKey });
        return {
          action: idempotencyKey === "job-1"
            ? "sent"
            : idempotencyKey === "job-2" ? "retry_scheduled" : "skipped",
        };
      },
    },
  });

  assert.deepEqual(await reconciler.run(), {
    action: "reconciled",
    checked: 3,
    failed: 0,
    retryScheduled: 1,
    sent: 1,
    skipped: 1,
  });
  assert.deepEqual(calls[0], { type: "list", input: { limit: 3 } });
});

test("rejects unsafe, duplicate, or over-limit query results before delivery", async () => {
  let calls = 0;
  const reconciler = createNotificationReconciler({
    env: { NOTIFICATION_RECONCILIATION_ENABLED: "true" },
    limit: 2,
    async listPendingNotificationJobs() {
      return ["duplicate", "duplicate"];
    },
    runtime: {
      enabled: true,
      deliverNotification() {
        calls += 1;
      },
    },
  });

  await assert.rejects(
    () => reconciler.run(),
    (error) => error.code === "notification_reconciliation_job_id_invalid",
  );
  assert.equal(calls, 0);
});

test("Firebase runtime exports a disabled-by-default bounded reconciliation schedule", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-runtime.js"), "utf8");
  assert.match(source, /schedule: "\*\/10 \* \* \* \*"/);
  assert.match(source, /NOTIFICATION_RECONCILIATION_ENABLED: process\.env\.NOTIFICATION_RECONCILIATION_ENABLED/);
  assert.match(source, /notificationOutboxReconciliation,/);
  assert.match(source, /secrets: \[resendApiKey\]/);
});
