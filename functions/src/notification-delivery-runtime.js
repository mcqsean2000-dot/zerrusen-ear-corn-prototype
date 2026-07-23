"use strict";

const {
  createNotificationDeliveryWorker,
  getMissingNotificationDeliveryDependencies,
} = require("./notification-delivery");
const {
  createResendEmailSender,
} = require("./resend-email-adapter");

function getMissingNotificationRuntimeConfiguration(options = {}) {
  const env = options.env || {};
  const missing = [];

  if (env.NOTIFICATION_DELIVERY_ENABLED !== "true") missing.push("NOTIFICATION_DELIVERY_ENABLED");
  if (!env.RESEND_API_KEY || /^replace-with-/i.test(env.RESEND_API_KEY)) missing.push("RESEND_API_KEY");
  if (!String(env.NOTIFICATION_FROM_EMAIL || "").trim()) missing.push("NOTIFICATION_FROM_EMAIL");
  if (typeof options.fetchImpl !== "function") missing.push("fetchImpl");
  missing.push(...getMissingNotificationDeliveryDependencies({
    ...options.persistence,
    sendNotification() {},
  }));

  return [...new Set(missing)];
}

function createNotificationDeliveryRuntime(options = {}) {
  const missingConfiguration = getMissingNotificationRuntimeConfiguration(options);
  if (missingConfiguration.length) {
    return {
      enabled: false,
      missingConfiguration,
    };
  }

  const env = options.env;
  const sendNotification = createResendEmailSender({
    apiKey: env.RESEND_API_KEY,
    fetchImpl: options.fetchImpl,
    from: env.NOTIFICATION_FROM_EMAIL,
    replyTo: env.NOTIFICATION_REPLY_TO,
  });

  return {
    enabled: true,
    deliverNotification: createNotificationDeliveryWorker({
      ...options.persistence,
      sendNotification,
    }, {
      maxAttempts: options.maxAttempts,
    }),
  };
}

module.exports = {
  createNotificationDeliveryRuntime,
  getMissingNotificationRuntimeConfiguration,
};
