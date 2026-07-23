"use strict";

const {
  DEFAULT_ADMIN_EMAIL,
  normalizeEmail,
} = require("./notification-builder");

const DEFAULT_FARM_TIME_ZONE = "America/Chicago";

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch (error) {
    return false;
  }
}

function farmBusinessDate(value, timeZone = DEFAULT_FARM_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || !isValidTimeZone(timeZone)) {
    const error = new Error("Daily fulfillment scheduler requires a valid clock and time zone.");
    error.code = "daily_fulfillment_schedule_time_invalid";
    throw error;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getMissingDailySchedulerConfiguration(options = {}) {
  const env = options.env || {};
  const missing = [];
  const timeZone = String(env.DAILY_FULFILLMENT_TIME_ZONE || DEFAULT_FARM_TIME_ZONE).trim();
  const adminEmail = env.NOTIFICATION_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

  if (env.DAILY_FULFILLMENT_SUMMARY_ENABLED !== "true") {
    missing.push("DAILY_FULFILLMENT_SUMMARY_ENABLED");
  }
  if (!isValidTimeZone(timeZone)) missing.push("DAILY_FULFILLMENT_TIME_ZONE");
  if (!normalizeEmail(adminEmail)) missing.push("NOTIFICATION_ADMIN_EMAIL");
  if (typeof options.queueDailyFulfillmentSummary !== "function") {
    missing.push("queueDailyFulfillmentSummary");
  }
  return missing;
}

function createDailyFulfillmentScheduler(options = {}) {
  const missingConfiguration = getMissingDailySchedulerConfiguration(options);
  if (missingConfiguration.length) {
    return {
      enabled: false,
      missingConfiguration,
    };
  }

  const env = options.env;
  const adminEmail = normalizeEmail(env.NOTIFICATION_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  const timeZone = String(env.DAILY_FULFILLMENT_TIME_ZONE || DEFAULT_FARM_TIME_ZONE).trim();
  const now = typeof options.now === "function" ? options.now : () => new Date();

  return {
    enabled: true,
    async run() {
      const summaryDate = farmBusinessDate(now(), timeZone);
      return options.queueDailyFulfillmentSummary({
        adminEmail,
        summaryDate,
      });
    },
  };
}

module.exports = {
  DEFAULT_FARM_TIME_ZONE,
  createDailyFulfillmentScheduler,
  farmBusinessDate,
  getMissingDailySchedulerConfiguration,
};
