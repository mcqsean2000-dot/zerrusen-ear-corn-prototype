"use strict";

function safeDeliveryResult(result = {}) {
  return {
    action: String(result.action || "skipped"),
    attempt: Number(result.attempt) || 0,
  };
}

function createFirebaseNotificationDeliveryHandler(options = {}) {
  return async function handleNotificationDelivery(event = {}) {
    const notificationId = String(event.params && event.params.notificationId || "").trim();
    const snapshotId = String(event.data && event.data.id || "").trim();

    if (!notificationId || notificationId.includes("/") || snapshotId !== notificationId) {
      const error = new Error("Notification delivery event is invalid.");
      error.code = "notification_delivery_event_invalid";
      throw error;
    }

    if (!options.runtime || options.runtime.enabled !== true) {
      return {
        action: "disabled",
        missingConfiguration: options.runtime && options.runtime.missingConfiguration || [],
      };
    }

    const result = await options.runtime.deliverNotification({
      idempotencyKey: notificationId,
    });

    if (result.action === "retry_scheduled") {
      const error = new Error("Notification delivery retry requested.");
      error.code = "notification_delivery_retry_requested";
      throw error;
    }

    return safeDeliveryResult(result);
  };
}

module.exports = {
  createFirebaseNotificationDeliveryHandler,
  safeDeliveryResult,
};
