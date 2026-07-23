"use strict";

const {
  buildDailyFulfillmentSummary,
} = require("./daily-fulfillment-summary");

function getMissingDailyFulfillmentDependencies(deps = {}) {
  const missing = [];
  if (typeof deps.listPaidFulfillmentOrders !== "function") missing.push("listPaidFulfillmentOrders");
  if (typeof deps.enqueueNotificationJobs !== "function") missing.push("enqueueNotificationJobs");
  return missing;
}

function createDailyFulfillmentOutbox(deps = {}) {
  const missing = getMissingDailyFulfillmentDependencies(deps);
  if (missing.length) {
    const error = new Error("Daily fulfillment outbox dependencies are not configured.");
    error.code = "daily_fulfillment_outbox_dependency_missing";
    error.missingDependencies = missing;
    throw error;
  }

  return {
    async queueDailyFulfillmentSummary({ adminEmail, summaryDate } = {}) {
      const orders = await deps.listPaidFulfillmentOrders();
      const job = buildDailyFulfillmentSummary({ adminEmail, orders, summaryDate });
      const result = await deps.enqueueNotificationJobs({ jobs: [job] });

      return {
        job: {
          eventName: job.eventName,
          idempotencyKey: job.idempotencyKey,
          recipientCategory: job.recipientCategory,
          summaryDate: job.summaryDate,
        },
        ...result,
      };
    },
  };
}

module.exports = {
  createDailyFulfillmentOutbox,
  getMissingDailyFulfillmentDependencies,
};
