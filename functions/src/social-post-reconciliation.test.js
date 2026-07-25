"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createSocialPostReconciler,
  getMissingSocialReconciliationConfiguration,
} = require("./social-post-reconciliation");

test("stays disabled until recovery is explicitly enabled and injected", () => {
  assert.deepEqual(getMissingSocialReconciliationConfiguration(), [
    "SOCIAL_RECONCILIATION_ENABLED",
    "recoverStaleSocialPostClaims",
  ]);
  assert.equal(createSocialPostReconciler({}).enabled, false);
});

test("reconciles a bounded batch using a thirty-minute cutoff", async () => {
  const calls = [];
  const reconciler = createSocialPostReconciler({
    env: { SOCIAL_RECONCILIATION_ENABLED: "true" },
    limit: 10,
    now() {
      return new Date("2026-07-27T14:00:00.000Z");
    },
    async recoverStaleSocialPostClaims(input) {
      calls.push(input);
      return { published: 2, reconciliationRequired: 1 };
    },
  });

  assert.deepEqual(await reconciler.run(), {
    action: "reconciled",
    published: 2,
    reconciliationRequired: 1,
  });
  assert.deepEqual(calls, [{
    limit: 10,
    staleBefore: new Date("2026-07-27T13:30:00.000Z"),
  }]);
});

test("rejects untrusted clocks and impossible recovery counts", async () => {
  const reconciler = createSocialPostReconciler({
    env: { SOCIAL_RECONCILIATION_ENABLED: "true" },
    now() {
      return new Date("invalid");
    },
    async recoverStaleSocialPostClaims() {
      return { published: 0, reconciliationRequired: 0 };
    },
  });
  await assert.rejects(
    reconciler.run(),
    (error) => error.code === "social_post_reconciliation_clock_invalid",
  );

  const invalidResult = createSocialPostReconciler({
    env: { SOCIAL_RECONCILIATION_ENABLED: "true" },
    async recoverStaleSocialPostClaims() {
      return { published: 21, reconciliationRequired: 0 };
    },
  });
  await assert.rejects(
    invalidResult.run(),
    (error) => error.code === "social_post_reconciliation_result_invalid",
  );
});
