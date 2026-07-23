"use strict";

const DEFAULT_MAX_ATTEMPTS = 5;

function isFunction(value) {
  return typeof value === "function";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function getMissingNotificationDeliveryDependencies(deps = {}) {
  const missing = [];
  if (!isFunction(deps.claimNotificationJob)) missing.push("claimNotificationJob");
  if (!isFunction(deps.sendNotification)) missing.push("sendNotification");
  if (!isFunction(deps.recordNotificationSuccess)) missing.push("recordNotificationSuccess");
  if (!isFunction(deps.recordNotificationFailure)) missing.push("recordNotificationFailure");
  return missing;
}

function assertDependencies(deps) {
  const missing = getMissingNotificationDeliveryDependencies(deps);
  if (missing.length) {
    const error = new Error("Notification delivery dependencies are not configured.");
    error.code = "notification_delivery_dependency_missing";
    error.missingDependencies = missing;
    throw error;
  }
}

function normalizeMaxAttempts(value) {
  const attempts = Number(value);
  return Number.isInteger(attempts) && attempts >= 1 && attempts <= 10
    ? attempts
    : DEFAULT_MAX_ATTEMPTS;
}

function normalizeClaim(claim, idempotencyKey, maxAttempts) {
  if (!claim) return null;
  const attempt = Number(claim.attempt);
  const job = claim.job && typeof claim.job === "object" ? claim.job : {};
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > maxAttempts ||
    cleanText(job.idempotencyKey, 500) !== idempotencyKey ||
    !cleanText(job.to, 254) ||
    !cleanText(job.subject, 200) ||
    !cleanText(job.text, 10000)
  ) {
    const error = new Error("Claimed notification job is invalid.");
    error.code = "notification_delivery_claim_invalid";
    throw error;
  }

  return {
    attempt,
    job: {
      idempotencyKey,
      subject: cleanText(job.subject, 200),
      text: cleanText(job.text, 10000),
      to: cleanText(job.to, 254).toLowerCase(),
    },
  };
}

function safeProviderError(error) {
  const code = cleanText(error && error.code, 80);
  return /^[A-Za-z0-9_.-]+$/.test(code) ? code : "provider_send_failed";
}

function createNotificationDeliveryWorker(deps = {}, options = {}) {
  assertDependencies(deps);
  const maxAttempts = normalizeMaxAttempts(options.maxAttempts);

  return async function deliverNotification({ idempotencyKey: rawKey } = {}) {
    const idempotencyKey = cleanText(rawKey, 500);
    if (!idempotencyKey || idempotencyKey.includes("/")) {
      const error = new Error("Notification delivery requires a safe idempotency key.");
      error.code = "notification_delivery_key_invalid";
      throw error;
    }

    const claim = normalizeClaim(
      await deps.claimNotificationJob({ idempotencyKey, maxAttempts }),
      idempotencyKey,
      maxAttempts,
    );
    if (!claim) {
      return { action: "skipped", idempotencyKey };
    }

    let sent;
    try {
      sent = await deps.sendNotification(claim.job);
    } catch (error) {
      const retryable = error && error.permanent === true
        ? false
        : claim.attempt < maxAttempts;
      const errorCode = safeProviderError(error);
      await deps.recordNotificationFailure({
        attempt: claim.attempt,
        errorCode,
        idempotencyKey,
        retryable,
      });
      return {
        action: retryable ? "retry_scheduled" : "failed",
        attempt: claim.attempt,
        errorCode,
        idempotencyKey,
      };
    }

    const providerMessageId = cleanText(sent && sent.providerMessageId, 200);
    if (!providerMessageId) {
      const errorCode = "provider_message_id_missing";
      const retryable = claim.attempt < maxAttempts;
      await deps.recordNotificationFailure({
        attempt: claim.attempt,
        errorCode,
        idempotencyKey,
        retryable,
      });
      return {
        action: retryable ? "retry_scheduled" : "failed",
        attempt: claim.attempt,
        errorCode,
        idempotencyKey,
      };
    }

    await deps.recordNotificationSuccess({
      attempt: claim.attempt,
      idempotencyKey,
      providerMessageId,
    });
    return {
      action: "sent",
      attempt: claim.attempt,
      idempotencyKey,
      providerMessageId,
    };
  };
}

module.exports = {
  DEFAULT_MAX_ATTEMPTS,
  createNotificationDeliveryWorker,
  getMissingNotificationDeliveryDependencies,
  safeProviderError,
};
