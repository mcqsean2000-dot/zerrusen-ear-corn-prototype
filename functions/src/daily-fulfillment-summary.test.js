"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_FOLLOW_UP_ORDERS,
  MAX_SUMMARY_ORDERS,
  buildDailyFulfillmentSummary,
} = require("./daily-fulfillment-summary");

function order(id, status, overrides = {}) {
  return {
    id,
    customer: {
      contact: "private@example.test",
      name: `Customer ${id}`,
      note: "Private note that must not appear",
    },
    items: [
      { quantity: 2, sku: "ear-corn-20lb" },
      { quantity: 1, sku: "ear-corn-40lb" },
    ],
    paymentStatus: "paid",
    status,
    stripeCheckoutSessionId: "cs_private_value",
    ...overrides,
  };
}

test("builds deterministic admin totals from trusted fulfillment orders", () => {
  const job = buildDailyFulfillmentSummary({
    summaryDate: "2026-07-23",
    orders: [
      order("order_1", "needs_review"),
      order("order_2", "ready_to_pack", {
        items: [{ quantity: 3, sku: "ear-corn-40lb" }],
      }),
      order("order_3", "packed", {
        items: [{ quantity: 1, sku: "ear-corn-20lb" }],
      }),
    ],
  });

  assert.equal(job.eventName, "admin.daily_fulfillment_summary");
  assert.equal(job.idempotencyKey, "admin.daily_fulfillment_summary:2026-07-23");
  assert.equal(job.to, "theosfeedfarm@gmail.com");
  assert.match(job.text, /Needs review: 1/);
  assert.match(job.text, /Ready to pack: 1/);
  assert.match(job.text, /Packed: 1/);
  assert.match(job.text, /20 lb bags: 3/);
  assert.match(job.text, /40 lb bags: 4/);
  assert.match(job.text, /- order_1: Customer order_1/);
});

test("builds a zero-state summary for an empty trusted result", () => {
  const job = buildDailyFulfillmentSummary({
    summaryDate: "2026-07-23",
    orders: [],
  });

  assert.match(job.text, /Needs review: 0/);
  assert.match(job.text, /20 lb bags: 0/);
  assert.match(job.text, /Orders needing follow-up:\n- None$/);
});

test("omits private customer and Stripe fields", () => {
  const serialized = JSON.stringify(buildDailyFulfillmentSummary({
    summaryDate: "2026-07-23",
    orders: [order("order_1", "needs_review")],
  }));

  assert.equal(serialized.includes("private@example.test"), false);
  assert.equal(serialized.includes("Private note that must not appear"), false);
  assert.equal(serialized.includes("cs_private_value"), false);
});

test("keeps customer display names on one bounded summary line", () => {
  const job = buildDailyFulfillmentSummary({
    summaryDate: "2026-07-23",
    orders: [order("order_1", "needs_review", {
      customer: { name: "Customer\nPacked: 999" },
    })],
  });

  assert.match(job.text, /- order_1: Customer Packed: 999/);
  assert.equal(job.text.includes("Customer\nPacked: 999"), false);
});

test("caps the follow-up list while preserving the full count", () => {
  const orders = Array.from(
    { length: MAX_FOLLOW_UP_ORDERS + 2 },
    (_, index) => order(`order_${index + 1}`, "needs_review"),
  );
  const job = buildDailyFulfillmentSummary({ summaryDate: "2026-07-23", orders });

  assert.match(job.text, new RegExp(`Needs review: ${MAX_FOLLOW_UP_ORDERS + 2}`));
  assert.match(job.text, /2 additional order\(s\) omitted/);
  assert.equal(job.text.includes(`order_${MAX_FOLLOW_UP_ORDERS + 1}:`), false);
});

test("rejects invalid dates, recipients, order lists, and trusted order shapes", () => {
  for (const summaryDate of ["", "2026-02-30", "07-23-2026"]) {
    assert.throws(
      () => buildDailyFulfillmentSummary({ summaryDate, orders: [] }),
      (error) => error.code === "notification_summary_date_invalid",
    );
  }
  assert.throws(
    () => buildDailyFulfillmentSummary({
      adminEmail: "not-an-email",
      summaryDate: "2026-07-23",
      orders: [],
    }),
    (error) => error.code === "notification_admin_email_invalid",
  );
  assert.throws(
    () => buildDailyFulfillmentSummary({
      summaryDate: "2026-07-23",
      orders: Array(MAX_SUMMARY_ORDERS + 1).fill({}),
    }),
    (error) => error.code === "notification_summary_orders_invalid",
  );
  for (const invalidOrder of [
    null,
    order("order_1", "shipped"),
    order("order_1", "needs_review", { paymentStatus: "unpaid" }),
    order("orders/order_1", "needs_review"),
    order("x".repeat(161), "needs_review"),
    order("order_1", "needs_review", { items: [{ quantity: 1, sku: "unknown" }] }),
  ]) {
    assert.throws(
      () => buildDailyFulfillmentSummary({
        summaryDate: "2026-07-23",
        orders: [invalidOrder],
      }),
      (error) => error.code === "notification_summary_order_invalid",
    );
  }
});
