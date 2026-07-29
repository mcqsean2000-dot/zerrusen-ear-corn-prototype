"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createOperationalLogger,
  createSanitizedOperationalError,
  reportOperationalError,
  sanitizeMetadata,
} = require("./operational-logger");

test("writes bounded structured errors without raw messages or sensitive context", () => {
  const writes = [];
  const logger = createOperationalLogger({
    writeError(event, reportableError, details) {
      writes.push({ event, reportableError, details });
    },
  });
  const sourceError = new Error("Customer customer@example.test used sk_live_do_not_log");
  sourceError.code = "shippo/provider-timeout";
  sourceError.retryable = true;

  const details = logger.error("shipping rates failed", sourceError, {
    method: "POST",
    path: "/api/shipping-rates",
    customerEmail: "customer@example.test",
    authorization: "Bearer should-not-appear",
    nested: { status: "provider_timeout", secretKey: "sk_live_do_not_log" },
  });

  assert.deepEqual(details, {
    errorCode: "shippo_provider-timeout",
    errorName: "Error",
    event: "shipping_rates_failed",
    method: "POST",
    nested: { status: "provider_timeout" },
    path: "/api/shipping-rates",
    retryable: true,
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].reportableError instanceof Error, true);
  assert.equal(writes[0].reportableError.message, "shipping_rates_failed (shippo_provider-timeout)");
  const serialized = JSON.stringify(writes);
  assert.equal(serialized.includes("customer@example.test"), false);
  assert.equal(serialized.includes("sk_live_do_not_log"), false);
  assert.equal(serialized.includes("should-not-appear"), false);
});

test("sanitizes arrays, nested objects, secret-like values, and unsupported fields", () => {
  assert.deepEqual(sanitizeMetadata({
    count: 2,
    enabled: false,
    missingConfiguration: ["FLAG_ONE", "FLAG_TWO"],
    providerValue: "whsec_do_not_log",
    fn() {},
  }), {
    count: 2,
    enabled: false,
    missingConfiguration: ["FLAG_ONE", "FLAG_TWO"],
    providerValue: "[redacted]",
  });
});

test("uses an injected request logger when reporting an operational error", () => {
  let received = null;
  const result = reportOperationalError({
    logger: {
      error(event, error, metadata) {
        received = { event, error, metadata };
        return { recorded: true };
      },
    },
  }, "checkout_creation_failed", { code: "stripe_timeout" }, { method: "POST" });

  assert.deepEqual(result, { recorded: true });
  assert.deepEqual(received, {
    error: { code: "stripe_timeout" },
    event: "checkout_creation_failed",
    metadata: { method: "POST" },
  });
});

test("replaces secret-shaped error identifiers before writing", () => {
  let written = null;
  const logger = createOperationalLogger({
    writeError(_event, _reportableError, details) {
      written = details;
    },
  });

  logger.error("provider_failed", {
    code: "sk_live_do_not_log",
    name: "whsec_do_not_log",
  });

  assert.deepEqual(written, {
    errorCode: "unknown",
    errorName: "Error",
    event: "provider_failed",
  });
});

test("creates a sanitized error for Firebase retry propagation", () => {
  const source = new Error("Provider response contained customer@example.test and sk_live_do_not_log");
  source.code = "provider_timeout";

  const sanitized = createSanitizedOperationalError("social_post_publishing_failed", source);

  assert.equal(sanitized.name, "Error");
  assert.equal(sanitized.message, "social_post_publishing_failed (provider_timeout)");
  assert.equal(sanitized.message.includes("customer@example.test"), false);
  assert.equal(sanitized.message.includes("sk_live_do_not_log"), false);
});
