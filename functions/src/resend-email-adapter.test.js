"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  RESEND_EMAILS_URL,
  createResendEmailSender,
} = require("./resend-email-adapter");

const notification = {
  idempotencyKey: "admin.paid_order_created:order_123:evt_123",
  subject: "Paid order ready for review",
  text: "Trusted paid order summary",
  to: "theosfeedfarm@gmail.com",
};

test("sends a trusted notification with Resend idempotency", async () => {
  let request;
  const sendNotification = createResendEmailSender({
    apiKey: "re_test_not_a_secret",
    from: "Theo's Farm <orders@example.test>",
    replyTo: "theosfeedfarm@gmail.com",
    async fetchImpl(url, options) {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: "email_123" };
        },
      };
    },
  });

  assert.deepEqual(await sendNotification(notification), {
    providerMessageId: "email_123",
  });
  assert.equal(request.url, RESEND_EMAILS_URL);
  assert.equal(request.options.headers.authorization, "Bearer re_test_not_a_secret");
  assert.equal(request.options.headers["idempotency-key"], notification.idempotencyKey);
  assert.deepEqual(JSON.parse(request.options.body), {
    from: "Theo's Farm <orders@example.test>",
    to: ["theosfeedfarm@gmail.com"],
    subject: notification.subject,
    text: notification.text,
    reply_to: "theosfeedfarm@gmail.com",
  });
});

test("fails closed when Resend configuration is incomplete", () => {
  assert.throws(
    () => createResendEmailSender({ apiKey: "", from: "", fetchImpl: null }),
    (error) => error.code === "resend_configuration_missing" &&
      error.missingConfiguration.includes("RESEND_API_KEY") &&
      error.missingConfiguration.includes("NOTIFICATION_FROM_EMAIL") &&
      error.missingConfiguration.includes("fetchImpl"),
  );
});

test("rejects malformed notification data before making a request", async () => {
  let called = false;
  const sendNotification = createResendEmailSender({
    apiKey: "re_test_not_a_secret",
    from: "orders@example.test",
    fetchImpl() {
      called = true;
    },
  });

  await assert.rejects(
    () => sendNotification({ ...notification, to: "not-an-email" }),
    (error) => error.code === "resend_notification_invalid" && error.permanent === true,
  );
  assert.equal(called, false);

  await assert.rejects(
    () => sendNotification({ ...notification, idempotencyKey: "x".repeat(257) }),
    (error) => error.code === "resend_notification_invalid" && error.permanent === true,
  );
  assert.equal(called, false);
});

test("classifies validation errors as permanent without exposing provider details", async () => {
  const sendNotification = createResendEmailSender({
    apiKey: "re_test_not_a_secret",
    from: "orders@example.test",
    async fetchImpl() {
      return {
        ok: false,
        status: 422,
        async json() {
          return { name: "invalid_from_address", message: "private provider detail" };
        },
      };
    },
  });

  await assert.rejects(
    () => sendNotification(notification),
    (error) => error.code === "resend_invalid_from_address" &&
      error.status === 422 &&
      error.permanent === true &&
      !error.message.includes("private provider detail"),
  );
});

test("keeps rate limits, concurrent idempotency, and network failures retryable", async () => {
  for (const scenario of [
    { status: 429, name: "rate_limit_exceeded" },
    { status: 409, name: "concurrent_idempotent_requests" },
  ]) {
    const sendNotification = createResendEmailSender({
      apiKey: "re_test_not_a_secret",
      from: "orders@example.test",
      async fetchImpl() {
        return {
          ok: false,
          status: scenario.status,
          async json() {
            return { name: scenario.name };
          },
        };
      },
    });

    await assert.rejects(
      () => sendNotification(notification),
      (error) => error.permanent === false,
    );
  }

  const sendNotification = createResendEmailSender({
    apiKey: "re_test_not_a_secret",
    from: "orders@example.test",
    async fetchImpl() {
      throw new Error("socket details");
    },
  });
  await assert.rejects(
    () => sendNotification(notification),
    (error) => error.code === "resend_network_error" && error.permanent !== true,
  );
});

test("rejects successful responses that omit the provider message ID", async () => {
  const sendNotification = createResendEmailSender({
    apiKey: "re_test_not_a_secret",
    from: "orders@example.test",
    async fetchImpl() {
      return {
        ok: true,
        status: 200,
        async json() {
          return {};
        },
      };
    },
  });

  await assert.rejects(
    () => sendNotification(notification),
    (error) => error.code === "resend_response_invalid",
  );
});
