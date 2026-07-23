"use strict";

const { buildPaidOrderNotifications } = require("./notification-builder");

function createNotificationOutbox(deps = {}) {
  if (typeof deps.enqueueNotificationJobs !== "function") {
    const error = new Error("Notification outbox persistence is not configured.");
    error.code = "notification_outbox_dependency_missing";
    throw error;
  }

  return {
    async queuePaidOrderNotifications(input) {
      const jobs = buildPaidOrderNotifications(input);
      const result = await deps.enqueueNotificationJobs({ jobs });

      return {
        jobs: jobs.map((job) => ({
          eventName: job.eventName,
          idempotencyKey: job.idempotencyKey,
          recipientCategory: job.recipientCategory,
        })),
        ...result,
      };
    },
  };
}

module.exports = {
  createNotificationOutbox,
};
