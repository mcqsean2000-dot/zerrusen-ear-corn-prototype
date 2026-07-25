"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createSocialPostPublisher } = require("./social-post-publisher");

function claimedPost(overrides = {}) {
  return {
    attempt: 1,
    post: {
      caption: "Packed to order. https://theosfarm.com",
      hashtags: ["#TheosFarm"],
      imageUrl: "https://theosfarm.com/assets/theos-both-bags.jpg",
      platforms: ["facebook", "instagram"],
      postId: "2026-07-27-farm-to-feeder",
      scheduledAt: new Date("2026-07-27T14:00:00.000Z"),
      ...overrides,
    },
  };
}

function dependencies(overrides = {}) {
  return {
    async claimDueSocialPost() {
      return claimedPost();
    },
    async completeSocialPostPublishing() {},
    async publishSocialPlatform({ platform }) {
      return { platform, providerPostId: `${platform}_123` };
    },
    async recordSocialPostFailure() {},
    async recordSocialPostPlatformSuccess() {},
    ...overrides,
  };
}

test("publishes each unfinished platform and completes the post", async () => {
  const calls = [];
  const publish = createSocialPostPublisher(dependencies({
    async claimDueSocialPost() {
      return claimedPost({ facebookPostId: "facebook_existing" });
    },
    async completeSocialPostPublishing(input) {
      calls.push(["complete", input]);
    },
    async publishSocialPlatform(input) {
      calls.push(["publish", input.platform]);
      return { platform: input.platform, providerPostId: "instagram_123" };
    },
    async recordSocialPostPlatformSuccess(input) {
      calls.push(["record", input]);
    },
  }));

  assert.deepEqual(await publish({ now: new Date() }), {
    action: "published",
    attempt: 1,
    postId: "2026-07-27-farm-to-feeder",
  });
  assert.deepEqual(calls.map(([name]) => name), ["publish", "record", "complete"]);
  assert.equal(calls[0][1], "instagram");
});

test("records retryable provider failure without completing", async () => {
  const calls = [];
  const publish = createSocialPostPublisher(dependencies({
    async completeSocialPostPublishing() {
      calls.push("unexpected_complete");
    },
    async publishSocialPlatform() {
      const error = new Error("provider detail");
      error.code = "meta_graph_network_error";
      throw error;
    },
    async recordSocialPostFailure(input) {
      calls.push(input);
    },
  }));

  assert.deepEqual(await publish({ now: new Date() }), {
    action: "retry_scheduled",
    attempt: 1,
    errorCode: "meta_graph_network_error",
    postId: "2026-07-27-farm-to-feeder",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].retryable, true);
});

test("does not retry a platform when its provider ID could not be persisted", async () => {
  let failureRecords = 0;
  const publish = createSocialPostPublisher(dependencies({
    async recordSocialPostFailure() {
      failureRecords += 1;
    },
    async recordSocialPostPlatformSuccess() {
      const error = new Error("Firestore unavailable");
      error.code = "firestore_unavailable";
      throw error;
    },
  }));

  await assert.rejects(
    publish({ now: new Date() }),
    (error) => error.code === "firestore_unavailable",
  );
  assert.equal(failureRecords, 0);
});

test("skips empty queues and fails closed without persistence", async () => {
  const publish = createSocialPostPublisher(dependencies({
    async claimDueSocialPost() {
      return null;
    },
  }));
  assert.deepEqual(await publish({ now: new Date() }), { action: "skipped" });
  assert.throws(
    () => createSocialPostPublisher({}),
    (error) => error.code === "social_post_publisher_dependency_missing",
  );
});
