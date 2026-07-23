"use strict";

const {
  createDailyFulfillmentScheduler,
} = require("./daily-fulfillment-scheduler");

function createFirebaseDailySummaryHandler(options = {}) {
  return async function handleDailySummary(event = {}) {
    const scheduler = createDailyFulfillmentScheduler({
      env: options.env,
      now() {
        return new Date(event.scheduleTime);
      },
      queueDailyFulfillmentSummary: options.queueDailyFulfillmentSummary,
    });

    if (!scheduler.enabled) {
      return {
        action: "disabled",
        missingConfiguration: scheduler.missingConfiguration,
      };
    }

    const result = await scheduler.run();
    return {
      action: result.created > 0 ? "queued" : "duplicate",
      created: Number(result.created) || 0,
      duplicates: Number(result.duplicates) || 0,
      idempotencyKey: result.job && result.job.idempotencyKey || "",
    };
  };
}

module.exports = {
  createFirebaseDailySummaryHandler,
};
