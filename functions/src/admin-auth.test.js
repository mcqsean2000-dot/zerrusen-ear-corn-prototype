"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createFirebaseAdminAuthenticator,
  getBearerToken,
  normalizeVerifiedAdmin,
} = require("./admin-auth");

test("getBearerToken extracts a Firebase bearer token case-insensitively", () => {
  const req = {
    headers: {
      Authorization: "Bearer firebase-id-token",
    },
  };

  assert.equal(getBearerToken(req), "firebase-id-token");
});

test("normalizeVerifiedAdmin requires the admin custom claim", () => {
  assert.deepEqual(normalizeVerifiedAdmin({
    admin: true,
    email: "admin@example.test",
    uid: "admin-user-001",
  }), {
    email: "admin@example.test",
    uid: "admin-user-001",
  });

  assert.throws(() => normalizeVerifiedAdmin({
    email: "user@example.test",
    uid: "plain-user",
  }), /admin custom claim/);

  assert.throws(() => normalizeVerifiedAdmin({
    admin: true,
    uid: "admin-user-001",
  }), /admin custom claim/);
});

test("createFirebaseAdminAuthenticator verifies the bearer token and returns the server-derived actor", async () => {
  const authenticate = createFirebaseAdminAuthenticator({
    verifyIdToken(token) {
      assert.equal(token, "firebase-id-token");
      return {
        admin: true,
        email: "admin@example.test",
        uid: "admin-user-001",
      };
    },
  });

  const actor = await authenticate({
    req: {
      headers: {
        authorization: "Bearer firebase-id-token",
      },
    },
  });

  assert.deepEqual(actor, {
    email: "admin@example.test",
    uid: "admin-user-001",
  });
});

test("createFirebaseAdminAuthenticator rejects missing bearer tokens before verification", async () => {
  const authenticate = createFirebaseAdminAuthenticator({
    verifyIdToken() {
      throw new Error("verifyIdToken should not run without a token.");
    },
  });

  await assert.rejects(
    () => authenticate({ req: { headers: {} } }),
    (error) => error.code === "admin_auth_required",
  );
});
