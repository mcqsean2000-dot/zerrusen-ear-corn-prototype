"use strict";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeErrorType(value) {
  const type = cleanText(value, 80);
  return /^[A-Za-z0-9_.-]+$/.test(type) ? type : "request_failed";
}

function requireConfiguration({ apiKey, fetchImpl, from }) {
  const missing = [];
  if (!apiKey || /^replace-with-/i.test(apiKey)) missing.push("RESEND_API_KEY");
  if (!cleanText(from, 320)) missing.push("NOTIFICATION_FROM_EMAIL");
  if (typeof fetchImpl !== "function") missing.push("fetchImpl");

  if (missing.length) {
    const error = new Error("Resend email delivery is not configured.");
    error.code = "resend_configuration_missing";
    error.missingConfiguration = missing;
    throw error;
  }
}

function trustedNotification(notification = {}) {
  const rawIdempotencyKey = String(notification.idempotencyKey || "").trim();
  const idempotencyKey = cleanText(rawIdempotencyKey, 256);
  const subject = cleanText(notification.subject, 200);
  const text = cleanText(notification.text, 10000);
  const to = cleanText(notification.to, 254).toLowerCase();

  if (
    !idempotencyKey ||
    rawIdempotencyKey.length > 256 ||
    !subject ||
    !text ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  ) {
    const error = new Error("Resend requires a trusted notification payload.");
    error.code = "resend_notification_invalid";
    error.permanent = true;
    throw error;
  }

  return { idempotencyKey, subject, text, to };
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function providerError(response, body) {
  const type = safeErrorType(body && (body.name || body.type));
  const error = new Error("Resend email request failed.");
  error.code = `resend_${type}`;
  error.status = Number(response && response.status) || 0;
  error.permanent = error.status >= 400 && error.status < 500 &&
    ![408, 429].includes(error.status) &&
    type !== "concurrent_idempotent_requests";
  return error;
}

function createResendEmailSender(options = {}) {
  const apiKey = options.apiKey;
  const fetchImpl = options.fetchImpl;
  const from = cleanText(options.from, 320);
  const replyTo = cleanText(options.replyTo, 254);
  requireConfiguration({ apiKey, fetchImpl, from });

  return async function sendNotification(input) {
    const notification = trustedNotification(input);
    let response;

    try {
      response = await fetchImpl(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": notification.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [notification.to],
          subject: notification.subject,
          text: notification.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
    } catch (cause) {
      const error = new Error("Resend email request could not be completed.");
      error.code = "resend_network_error";
      throw error;
    }

    const body = await parseJsonResponse(response);
    if (!response.ok) {
      throw providerError(response, body);
    }

    const providerMessageId = cleanText(body && body.id, 200);
    if (!providerMessageId) {
      const error = new Error("Resend response did not include a message ID.");
      error.code = "resend_response_invalid";
      throw error;
    }

    return { providerMessageId };
  };
}

module.exports = {
  RESEND_EMAILS_URL,
  createResendEmailSender,
  providerError,
};
