"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  APPLY_CONFIRMATION,
  createAdminClaimOperation,
  mergedAdminClaims,
  parseAdminClaimArgs,
  uidSuffix,
  validateTargetUser,
} = require("./admin-claim-tool");

const baseArgs = [
  "--project", "theos-farm-ear-corn",
  "--uid", "firebase-admin-uid-123456",
  "--email", "theosfeedfarm@gmail.com",
];

test("parses an exact dry-run admin claim target", () => {
  assert.deepEqual(parseAdminClaimArgs(baseArgs), {
    apply: false,
    email: "theosfeedfarm@gmail.com",
    projectId: "theos-farm-ear-corn",
    uid: "firebase-admin-uid-123456",
  });
});

test("requires the approved project, email, UID, and apply confirmation", () => {
  assert.throws(() => parseAdminClaimArgs([
    ...baseArgs.slice(0, 1), "another-project", ...baseArgs.slice(2),
  ]), /Project must be/);
  assert.throws(() => parseAdminClaimArgs([
    ...baseArgs.slice(0, 5), "somebody@example.com",
  ]), /Email must be/);
  assert.throws(() => parseAdminClaimArgs(baseArgs.filter((value, index) => index < 2 || index > 3)), /UID is required/);
  assert.throws(() => parseAdminClaimArgs([...baseArgs, "--apply"]), /requires --confirm/);
  assert.doesNotThrow(() => parseAdminClaimArgs([
    ...baseArgs,
    "--apply",
    "--confirm", APPLY_CONFIRMATION,
  ]));
});

test("rejects unknown, positional, duplicate, and missing option values", () => {
  assert.throws(() => parseAdminClaimArgs([...baseArgs, "--force"]), /Unsupported option/);
  assert.throws(() => parseAdminClaimArgs([...baseArgs, "extra"]), /Unexpected argument/);
  assert.throws(() => parseAdminClaimArgs([...baseArgs, "--uid", "another-uid"]), /Duplicate option/);
  assert.throws(() => parseAdminClaimArgs([...baseArgs, "--apply", "--apply"]), /Duplicate option/);
  assert.throws(() => parseAdminClaimArgs([...baseArgs, "--confirm"]), /requires a value/);
});

test("requires the fetched Firebase user to match and have verified email", () => {
  const plan = parseAdminClaimArgs(baseArgs);
  assert.throws(() => validateTargetUser({
    email: "other@example.com",
    emailVerified: true,
    uid: plan.uid,
  }, plan), /does not match/);
  assert.throws(() => validateTargetUser({
    email: plan.email,
    emailVerified: false,
    uid: plan.uid,
  }, plan), /must be verified/);
});

test("dry run verifies the user without writing claims", async () => {
  let writes = 0;
  const plan = parseAdminClaimArgs(baseArgs);
  const run = createAdminClaimOperation({
    async getUser() {
      return {
        customClaims: { fulfillment: true },
        email: plan.email,
        emailVerified: true,
        uid: plan.uid,
      };
    },
    async setCustomUserClaims() {
      writes += 1;
    },
  });

  assert.deepEqual(await run(plan), { changed: false, status: "dry_run_ready" });
  assert.equal(writes, 0);
});

test("apply mode preserves existing claims and grants admin once", async () => {
  let written;
  const plan = parseAdminClaimArgs([
    ...baseArgs,
    "--apply",
    "--confirm", APPLY_CONFIRMATION,
  ]);
  const run = createAdminClaimOperation({
    async getUser() {
      return {
        customClaims: { fulfillment: true },
        email: plan.email,
        emailVerified: true,
        uid: plan.uid,
      };
    },
    async setCustomUserClaims(uid, claims) {
      written = { claims, uid };
    },
  });

  assert.deepEqual(await run(plan), { changed: true, status: "admin_granted" });
  assert.deepEqual(written, {
    claims: { admin: true, fulfillment: true },
    uid: plan.uid,
  });
});

test("already-admin apply is idempotent and safe output masks the UID", async () => {
  let writes = 0;
  const plan = parseAdminClaimArgs([
    ...baseArgs,
    "--apply",
    "--confirm", APPLY_CONFIRMATION,
  ]);
  const run = createAdminClaimOperation({
    async getUser() {
      return {
        customClaims: { admin: true },
        email: plan.email,
        emailVerified: true,
        uid: plan.uid,
      };
    },
    async setCustomUserClaims() {
      writes += 1;
    },
  });

  assert.deepEqual(await run(plan), { changed: false, status: "already_admin" });
  assert.equal(writes, 0);
  assert.equal(uidSuffix(plan.uid), "123456");
  assert.deepEqual(mergedAdminClaims({ fulfillment: true }), {
    admin: true,
    fulfillment: true,
  });
});
