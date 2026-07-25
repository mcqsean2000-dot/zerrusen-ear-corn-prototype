"use strict";

const DEFAULT_SOCIAL_RECONCILIATION_LIMIT = 20;
const SOCIAL_PUBLISHING_LEASE_MS = 30 * 60 * 1000;

function reconciliationLimit(value) {
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= 50
    ? limit
    : DEFAULT_SOCIAL_RECONCILIATION_LIMIT;
}

function getMissingSocialReconciliationConfiguration(options = {}) {
  const missing = [];
  if (!options.env || options.env.SOCIAL_RECONCILIATION_ENABLED !== "true") {
    missing.push("SOCIAL_RECONCILIATION_ENABLED");
  }
  if (typeof options.recoverStaleSocialPostClaims !== "function") {
    missing.push("recoverStaleSocialPostClaims");
  }
  return missing;
}

function createSocialPostReconciler(options = {}) {
  const missingConfiguration = getMissingSocialReconciliationConfiguration(options);
  if (missingConfiguration.length) return { enabled: false, missingConfiguration };

  const limit = reconciliationLimit(options.limit);
  return {
    enabled: true,
    async run() {
      const currentTime = options.now ? options.now() : new Date();
      const currentTimeMillis = currentTime instanceof Date ? currentTime.getTime() : Number.NaN;
      if (!Number.isFinite(currentTimeMillis)) {
        const error = new Error("Social post reconciliation requires a trusted clock.");
        error.code = "social_post_reconciliation_clock_invalid";
        throw error;
      }

      const result = await options.recoverStaleSocialPostClaims({
        limit,
        staleBefore: new Date(currentTimeMillis - SOCIAL_PUBLISHING_LEASE_MS),
      });
      if (
        !result ||
        !Number.isInteger(result.published) || result.published < 0 ||
        !Number.isInteger(result.reconciliationRequired) || result.reconciliationRequired < 0 ||
        result.published + result.reconciliationRequired > limit
      ) {
        const error = new Error("Social post lease recovery returned an invalid result.");
        error.code = "social_post_reconciliation_result_invalid";
        throw error;
      }
      return {
        action: "reconciled",
        published: result.published,
        reconciliationRequired: result.reconciliationRequired,
      };
    },
  };
}

module.exports = {
  DEFAULT_SOCIAL_RECONCILIATION_LIMIT,
  SOCIAL_PUBLISHING_LEASE_MS,
  createSocialPostReconciler,
  getMissingSocialReconciliationConfiguration,
  reconciliationLimit,
};
