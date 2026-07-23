"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createFirebaseDailySummaryHandler,
} = require("./firebase-daily-summary-handler");

test("returns a safe disabled result without calling the trusted queue", async () => {
  let calls = 0;
  const handler = createFirebaseDailySummaryHandler({
    env: {},
    queueDailyFulfillmentSummary() {
      calls += 1;
    },
  });

  assert.deepEqual(await handler({ scheduleTime: "2026-07-23T13:00:00Z" }), {
    action: "disabled",
    missingConfiguration: ["DAILY_FULFILLMENT_SUMMARY_ENABLED"],
  });
  assert.equal(calls, 0);
});

test("queues the Central Time business date from the trusted schedule event", async () => {
  const calls = [];
  const handler = createFirebaseDailySummaryHandler({
    env: { DAILY_FULFILLMENT_SUMMARY_ENABLED: "true" },
    async queueDailyFulfillmentSummary(input) {
      calls.push(input);
      return {
        created: 1,
        duplicates: 0,
        job: { idempotencyKey: `admin.daily_fulfillment_summary:${input.summaryDate}` },
      };
    },
  });

  assert.deepEqual(await handler({ scheduleTime: "2026-07-23T04:30:00Z" }), {
    action: "queued",
    created: 1,
    duplicates: 0,
    idempotencyKey: "admin.daily_fulfillment_summary:2026-07-22",
  });
  assert.deepEqual(calls, [{
    adminEmail: "theosfeedfarm@gmail.com",
    summaryDate: "2026-07-22",
  }]);
});

test("reports idempotent schedule retries as duplicates", async () => {
  const handler = createFirebaseDailySummaryHandler({
    env: { DAILY_FULFILLMENT_SUMMARY_ENABLED: "true" },
    async queueDailyFulfillmentSummary() {
      return {
        created: 0,
        duplicates: 1,
        job: { idempotencyKey: "admin.daily_fulfillment_summary:2026-07-23" },
      };
    },
  });

  assert.equal((await handler({ scheduleTime: "2026-07-23T13:00:00Z" })).action, "duplicate");
});

test("rejects missing or invalid scheduler event time before queueing", async () => {
  let calls = 0;
  const handler = createFirebaseDailySummaryHandler({
    env: { DAILY_FULFILLMENT_SUMMARY_ENABLED: "true" },
    queueDailyFulfillmentSummary() {
      calls += 1;
    },
  });

  await assert.rejects(
    () => handler({}),
    (error) => error.code === "daily_fulfillment_schedule_time_invalid",
  );
  assert.equal(calls, 0);
});

test("handler module stays SDK-free and secret-free", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-daily-summary-handler.js"), "utf8");
  assert.equal(source.includes("firebase-admin"), false);
  assert.equal(source.includes("firebase-functions"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("RESEND_API_KEY"), false);
  assert.equal(source.includes("STRIPE_SECRET_KEY"), false);
});

test("Firebase runtime exports a disabled-by-default 8 AM Central schedule", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-runtime.js"), "utf8");
  assert.match(source, /require\("firebase-functions\/v2\/scheduler"\)/);
  assert.match(source, /schedule: "0 8 \* \* \*"/);
  assert.match(source, /timeZone: "America\/Chicago"/);
  assert.match(source, /dailyFulfillmentSummary,/);
  assert.match(source, /DAILY_FULFILLMENT_SUMMARY_ENABLED: process\.env\.DAILY_FULFILLMENT_SUMMARY_ENABLED/);
  const scheduleBlock = source.slice(
    source.indexOf("const dailyFulfillmentSummary"),
    source.indexOf("const notificationOutboxDelivery"),
  );
  assert.equal(scheduleBlock.includes("secrets:"), false);
});
