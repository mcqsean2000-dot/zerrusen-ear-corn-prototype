"use strict";

const DEFAULT_RECONCILIATION_LIMIT = 20;

function safeJobId(value) {
  const id = String(value || "").trim();
  return id && id.length <= 500 && !id.includes("/") ? id : "";
}

function reconciliationLimit(value) {
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= 50
    ? limit
    : DEFAULT_RECONCILIATION_LIMIT;
}

function getMissingNotificationReconciliationConfiguration(options = {}) {
  const missing = [];
  if (!options.env || options.env.NOTIFICATION_RECONCILIATION_ENABLED !== "true") {
    missing.push("NOTIFICATION_RECONCILIATION_ENABLED");
  }
  if (!options.runtime || options.runtime.enabled !== true) {
    missing.push(...options.runtime && options.runtime.missingConfiguration || ["notificationDeliveryRuntime"]);
  }
  if (typeof options.listPendingNotificationJobs !== "function") {
    missing.push("listPendingNotificationJobs");
  }
  return [...new Set(missing)];
}

function createNotificationReconciler(options = {}) {
  const missingConfiguration = getMissingNotificationReconciliationConfiguration(options);
  if (missingConfiguration.length) {
    return { enabled: false, missingConfiguration };
  }

  const limit = reconciliationLimit(options.limit);
  return {
    enabled: true,
    async run() {
      const rawIds = await options.listPendingNotificationJobs({ limit });
      if (!Array.isArray(rawIds) || rawIds.length > limit) {
        const error = new Error("Notification reconciliation query returned an invalid result.");
        error.code = "notification_reconciliation_result_invalid";
        throw error;
      }

      const ids = rawIds.map(safeJobId);
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        const error = new Error("Notification reconciliation requires unique safe job IDs.");
        error.code = "notification_reconciliation_job_id_invalid";
        throw error;
      }

      const counts = { failed: 0, retryScheduled: 0, sent: 0, skipped: 0 };
      for (const idempotencyKey of ids) {
        const result = await options.runtime.deliverNotification({ idempotencyKey });
        if (result.action === "sent") counts.sent += 1;
        else if (result.action === "retry_scheduled") counts.retryScheduled += 1;
        else if (result.action === "failed") counts.failed += 1;
        else counts.skipped += 1;
      }

      return { action: "reconciled", checked: ids.length, ...counts };
    },
  };
}

module.exports = {
  DEFAULT_RECONCILIATION_LIMIT,
  createNotificationReconciler,
  getMissingNotificationReconciliationConfiguration,
  reconciliationLimit,
};
