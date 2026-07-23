"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createNotificationDeliveryWorker,
  getMissingNotificationDeliveryDependencies,
} = require("./notification-delivery");

const idempotencyKey = "admin.paid_order_created:order_123:evt_123";

function claimedJob(attempt = 1) {
  return {
    attempt,
    job: {
      idempotencyKey,
      subject: "Paid order",
      text: "Trusted paid order summary",
      to: "theosfeedfarm@gmail.com",
    },
  };
}

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      claimNotificationJob(input) {
        calls.push({ type: "claim", ...input });
        return claimedJob();
      },
      sendNotification(input) {
        calls.push({ type: "send", ...input });
        return { providerMessageId: "message_123" };
      },
      recordNotificationSuccess(input) {
        calls.push({ type: "success", ...input });
      },
      recordNotificationFailure(input) {
        calls.push({ type: "failure", ...input });
      },
      ...overrides,
    },
  };
}

test("reports every trusted delivery dependency", () => {
  assert.deepEqual(getMissingNotificationDeliveryDependencies(), [
    "claimNotificationJob",
    "sendNotification",
    "recordNotificationSuccess",
    "recordNotificationFailure",
  ]);
});

test("claims, sends, and records one notification", async () => {
  const { calls, deps } = dependencies();
  const deliver = createNotificationDeliveryWorker(deps);

  assert.deepEqual(await deliver({ idempotencyKey }), {
    action: "sent",
    attempt: 1,
    idempotencyKey,
    providerMessageId: "message_123",
  });
  assert.deepEqual(calls.map((call) => call.type), ["claim", "send", "success"]);
  assert.deepEqual(calls[1], {
    type: "send",
    idempotencyKey,
    subject: "Paid order",
    text: "Trusted paid order summary",
    to: "theosfeedfarm@gmail.com",
  });
});

test("skips jobs that trusted persistence does not claim", async () => {
  const { calls, deps } = dependencies({ claimNotificationJob: () => null });
  const deliver = createNotificationDeliveryWorker(deps);

  assert.deepEqual(await deliver({ idempotencyKey }), {
    action: "skipped",
    idempotencyKey,
  });
  assert.equal(calls.length, 0);
});

test("records sanitized retryable provider failures", async () => {
  const { calls, deps } = dependencies({
    sendNotification() {
      const error = new Error("provider response with private details");
      error.code = "rate_limited";
      throw error;
    },
  });
  const deliver = createNotificationDeliveryWorker(deps, { maxAttempts: 3 });

  assert.deepEqual(await deliver({ idempotencyKey }), {
    action: "retry_scheduled",
    attempt: 1,
    errorCode: "rate_limited",
    idempotencyKey,
  });
  assert.deepEqual(calls.at(-1), {
    type: "failure",
    attempt: 1,
    errorCode: "rate_limited",
    idempotencyKey,
    retryable: true,
  });
});

test("stops retrying permanent failures and exhausted jobs", async () => {
  for (const scenario of [
    { attempt: 1, permanent: true },
    { attempt: 3, permanent: false },
  ]) {
    const { calls, deps } = dependencies({
      claimNotificationJob() {
        return claimedJob(scenario.attempt);
      },
      sendNotification() {
        const error = new Error("do not expose this message");
        error.code = "bad recipient data";
        error.permanent = scenario.permanent;
        throw error;
      },
    });
    const deliver = createNotificationDeliveryWorker(deps, { maxAttempts: 3 });
    const result = await deliver({ idempotencyKey });

    assert.equal(result.action, "failed");
    assert.equal(result.errorCode, "provider_send_failed");
    assert.equal(calls.at(-1).retryable, false);
  }
});

test("does not relabel success-recording failures as provider failures", async () => {
  const { calls, deps } = dependencies({
    recordNotificationSuccess() {
      throw new Error("firestore unavailable");
    },
  });
  const deliver = createNotificationDeliveryWorker(deps);

  await assert.rejects(
    deliver({ idempotencyKey }),
    /firestore unavailable/,
  );
  assert.deepEqual(calls.map((call) => call.type), ["claim", "send"]);
});
