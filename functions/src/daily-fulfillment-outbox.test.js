"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createDailyFulfillmentOutbox,
  getMissingDailyFulfillmentDependencies,
} = require("./daily-fulfillment-outbox");

function paidOrder() {
  return {
    id: "order_123",
    customer: { name: "Customer Name" },
    items: [{ quantity: 2, sku: "ear-corn-20lb" }],
    paymentStatus: "paid",
    status: "needs_review",
  };
}

test("reports missing trusted query and persistence dependencies", () => {
  assert.deepEqual(getMissingDailyFulfillmentDependencies(), [
    "listPaidFulfillmentOrders",
    "enqueueNotificationJobs",
  ]);
  assert.throws(
    () => createDailyFulfillmentOutbox(),
    (error) => error.code === "daily_fulfillment_outbox_dependency_missing",
  );
});

test("queries trusted orders and enqueues one deterministic daily job", async () => {
  const calls = [];
  const outbox = createDailyFulfillmentOutbox({
    async listPaidFulfillmentOrders() {
      calls.push({ type: "query" });
      return [paidOrder()];
    },
    async enqueueNotificationJobs({ jobs }) {
      calls.push({ type: "enqueue", jobs });
      return { created: 1, duplicates: 0 };
    },
  });

  const result = await outbox.queueDailyFulfillmentSummary({
    summaryDate: "2026-07-23",
  });

  assert.deepEqual(calls.map((call) => call.type), ["query", "enqueue"]);
  assert.equal(calls[1].jobs.length, 1);
  assert.equal(calls[1].jobs[0].idempotencyKey, "admin.daily_fulfillment_summary:2026-07-23");
  assert.deepEqual(result, {
    created: 1,
    duplicates: 0,
    job: {
      eventName: "admin.daily_fulfillment_summary",
      idempotencyKey: "admin.daily_fulfillment_summary:2026-07-23",
      recipientCategory: "admin",
      summaryDate: "2026-07-23",
    },
  });
});

test("does not enqueue when the trusted query or builder fails", async () => {
  let enqueueCalls = 0;
  const outbox = createDailyFulfillmentOutbox({
    async listPaidFulfillmentOrders() {
      return [{ ...paidOrder(), paymentStatus: "unpaid" }];
    },
    async enqueueNotificationJobs() {
      enqueueCalls += 1;
    },
  });

  await assert.rejects(
    () => outbox.queueDailyFulfillmentSummary({ summaryDate: "2026-07-23" }),
    (error) => error.code === "notification_summary_order_invalid",
  );
  assert.equal(enqueueCalls, 0);
});
