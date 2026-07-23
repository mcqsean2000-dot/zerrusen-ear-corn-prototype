"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DEFAULT_FARM_TIME_ZONE,
  createDailyFulfillmentScheduler,
  farmBusinessDate,
  getMissingDailySchedulerConfiguration,
} = require("./daily-fulfillment-scheduler");

test("defaults the farm business date to America/Chicago", () => {
  assert.equal(DEFAULT_FARM_TIME_ZONE, "America/Chicago");
  assert.equal(farmBusinessDate("2026-07-23T04:30:00Z"), "2026-07-22");
  assert.equal(farmBusinessDate("2026-07-23T05:30:00Z"), "2026-07-23");
});

test("stays disabled without explicit enablement and a trusted queue", () => {
  assert.deepEqual(getMissingDailySchedulerConfiguration(), [
    "DAILY_FULFILLMENT_SUMMARY_ENABLED",
    "queueDailyFulfillmentSummary",
  ]);
  const scheduler = createDailyFulfillmentScheduler();
  assert.equal(scheduler.enabled, false);
  assert.equal(scheduler.run, undefined);
});

test("rejects invalid time zone and admin configuration before scheduling", () => {
  const missing = getMissingDailySchedulerConfiguration({
    env: {
      DAILY_FULFILLMENT_SUMMARY_ENABLED: "true",
      DAILY_FULFILLMENT_TIME_ZONE: "Not/A_Real_Zone",
      NOTIFICATION_ADMIN_EMAIL: "not-an-email",
    },
    queueDailyFulfillmentSummary() {},
  });
  assert.deepEqual(missing, [
    "DAILY_FULFILLMENT_TIME_ZONE",
    "NOTIFICATION_ADMIN_EMAIL",
  ]);
});

test("derives the business date internally and invokes the trusted queue once", async () => {
  const calls = [];
  const scheduler = createDailyFulfillmentScheduler({
    env: {
      DAILY_FULFILLMENT_SUMMARY_ENABLED: "true",
      DAILY_FULFILLMENT_TIME_ZONE: "America/Chicago",
      NOTIFICATION_ADMIN_EMAIL: "theosfeedfarm@gmail.com",
    },
    now() {
      return new Date("2026-07-23T14:00:00Z");
    },
    async queueDailyFulfillmentSummary(input) {
      calls.push(input);
      return { created: 1, duplicates: 0 };
    },
  });

  assert.equal(scheduler.enabled, true);
  assert.deepEqual(await scheduler.run(), { created: 1, duplicates: 0 });
  assert.deepEqual(calls, [{
    adminEmail: "theosfeedfarm@gmail.com",
    summaryDate: "2026-07-23",
  }]);
});

test("rejects an invalid injected clock before calling the trusted queue", async () => {
  let calls = 0;
  const scheduler = createDailyFulfillmentScheduler({
    env: { DAILY_FULFILLMENT_SUMMARY_ENABLED: "true" },
    now() {
      return "not-a-date";
    },
    queueDailyFulfillmentSummary() {
      calls += 1;
    },
  });

  await assert.rejects(
    () => scheduler.run(),
    (error) => error.code === "daily_fulfillment_schedule_time_invalid",
  );
  assert.equal(calls, 0);
});
