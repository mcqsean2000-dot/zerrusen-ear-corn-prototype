"use strict";

const DEFAULT_RECONCILIATION_LIMIT = 20;
const PROCESSING_LEASE_MS = 15 * 60 * 1000;

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
  if (typeof options.recoverStaleNotificationJobs !== "function") {
    missing.push("recoverStaleNotificationJobs");
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
      const currentTime = options.now ? options.now() : new Date();
      const currentTimeMillis = currentTime instanceof Date ? currentTime.getTime() : Number.NaN;
      if (!Number.isFinite(currentTimeMillis)) {
        const error = new Error("Notification reconciliation requires a trusted clock.");
        error.code = "notification_reconciliation_clock_invalid";
        throw error;
      }
      const leaseResult = await options.recoverStaleNotificationJobs({
        limit,
        staleBefore: new Date(currentTimeMillis - PROCESSING_LEASE_MS),
      });
      if (
        !leaseResult ||
        !Number.isInteger(leaseResult.failed) ||
        !Number.isInteger(leaseResult.recovered) ||
        leaseResult.failed < 0 ||
        leaseResult.recovered < 0 ||
        leaseResult.failed + leaseResult.recovered > limit
      ) {
        const error = new Error("Notification lease recovery returned an invalid result.");
        error.code = "notification_lease_result_invalid";
        throw error;
      }

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

      return {
        action: "reconciled",
        checked: ids.length,
        leaseFailed: leaseResult.failed,
        leaseRecovered: leaseResult.recovered,
        ...counts,
      };
    },
  };
}

module.exports = {
  DEFAULT_RECONCILIATION_LIMIT,
  PROCESSING_LEASE_MS,
  createNotificationReconciler,
  getMissingNotificationReconciliationConfiguration,
  reconciliationLimit,
};
