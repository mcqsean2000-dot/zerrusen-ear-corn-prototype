"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createSocialPostPublishingRuntime,
  getMissingSocialPublishingConfiguration,
} = require("./social-post-publishing-runtime");

function persistence() {
  return {
    async claimDueSocialPost() {
      return null;
    },
    async completeSocialPostPublishing() {},
    async recordSocialPostFailure() {},
    async recordSocialPostPlatformSuccess() {},
  };
}

function enabledOptions() {
  return {
    env: {
      META_FACEBOOK_PAGE_ID: "page_123",
      META_GRAPH_API_VERSION: "v99.0",
      META_INSTAGRAM_ACCOUNT_ID: "ig_123",
      META_PAGE_ACCESS_TOKEN: "test-token",
      SOCIAL_PUBLISHING_ENABLED: "true",
    },
    async fetchImpl() {
      throw new Error("not expected for empty queue");
    },
    persistence: persistence(),
  };
}

test("runtime remains disabled until every explicit setting is present", () => {
  const missing = getMissingSocialPublishingConfiguration({});
  assert.ok(missing.includes("SOCIAL_PUBLISHING_ENABLED"));
  assert.ok(missing.includes("META_PAGE_ACCESS_TOKEN"));
  assert.deepEqual(createSocialPostPublishingRuntime({}).enabled, false);
});

test("runtime composes only after explicit enablement and complete injection", async () => {
  const runtime = createSocialPostPublishingRuntime(enabledOptions());
  assert.equal(runtime.enabled, true);
  assert.deepEqual(await runtime.publishDueSocialPost({ now: new Date() }), { action: "skipped" });
});

test("Firebase runtime exports a guarded five-minute social publisher", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-runtime.js"), "utf8");
  assert.match(source, /defineSecret\("META_PAGE_ACCESS_TOKEN"\)/);
  assert.match(source, /schedule: "\*\/5 \* \* \* \*"/);
  assert.match(source, /SOCIAL_PUBLISHING_ENABLED: process\.env\.SOCIAL_PUBLISHING_ENABLED/);
  assert.match(source, /socialPostPublishing,/);
  assert.match(source, /secrets: \[metaFacebookPageId, metaInstagramAccountId, metaPageAccessToken\]/);
});
