"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createSocialPostQueue,
  normalizeApprovedSocialPost,
} = require("./social-post-queue");

function approvedPost(overrides = {}) {
  return {
    approvedBy: { email: "ADMIN@example.test", uid: "admin-1" },
    caption: "Fresh ear corn, packed to order. https://theosfarm.com",
    hashtags: ["#TheosFarm", "#FarmToFeeder"],
    imageUrl: "https://theosfarm.com/assets/theos-both-bags.jpg",
    platforms: ["facebook", "instagram"],
    postId: "2026-07-27-farm-to-feeder",
    scheduledAt: "2026-07-27T14:00:00.000Z",
    status: "approved",
    ...overrides,
  };
}

test("normalizes a human-approved post for both supported platforms", () => {
  assert.deepEqual(normalizeApprovedSocialPost(approvedPost()), {
    approvedBy: { email: "admin@example.test", uid: "admin-1" },
    caption: "Fresh ear corn, packed to order. https://theosfarm.com",
    hashtags: ["#TheosFarm", "#FarmToFeeder"],
    imageUrl: "https://theosfarm.com/assets/theos-both-bags.jpg",
    platforms: ["facebook", "instagram"],
    postId: "2026-07-27-farm-to-feeder",
    scheduledAt: new Date("2026-07-27T14:00:00.000Z"),
    status: "approved",
  });
});

test("rejects unapproved, unreviewed, or unsupported post data", () => {
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ status: "draft" })),
    (error) => error.code === "social_post_not_approved",
  );
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ approvedBy: null })),
    (error) => error.code === "social_post_approver_invalid",
  );
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ accessToken: "secret" })),
    (error) => error.code === "social_post_untrusted_field" && error.untrustedFields.includes("accessToken"),
  );
});

test("requires the production website link and safe unique hashtags", () => {
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ caption: "Fresh ear corn" })),
    (error) => error.code === "social_post_caption_invalid",
  );
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ hashtags: ["#Corn", "#corn"] })),
    (error) => error.code === "social_post_hashtags_invalid",
  );
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ scheduledAt: null })),
    (error) => error.code === "social_post_schedule_invalid",
  );
});

test("requires a public Theo's Farm image for Instagram", () => {
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ imageUrl: "" })),
    (error) => error.code === "social_post_image_required",
  );
  assert.throws(
    () => normalizeApprovedSocialPost(approvedPost({ imageUrl: "https://example.com/post.jpg" })),
    (error) => error.code === "social_post_image_invalid",
  );
  assert.equal(
    normalizeApprovedSocialPost(approvedPost({ imageUrl: "", platforms: ["facebook"] })).imageUrl,
    "",
  );
});

test("delegates only normalized approved posts to persistence", async () => {
  const calls = [];
  const queue = createSocialPostQueue({
    async enqueueApprovedSocialPost(input) {
      calls.push(input);
      return { created: true, postId: input.post.postId };
    },
  });

  assert.deepEqual(await queue.queueApprovedSocialPost(approvedPost()), {
    created: true,
    postId: "2026-07-27-farm-to-feeder",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].post.approvedBy.email, "admin@example.test");
  assert.throws(
    () => createSocialPostQueue(),
    (error) => error.code === "social_post_queue_missing",
  );
});

test("queue foundation contains no SDK, environment, or Meta credential access", () => {
  const source = fs.readFileSync(path.join(__dirname, "social-post-queue.js"), "utf8");
  assert.doesNotMatch(source, /firebase-admin|firebase-functions|process\.env|META_PAGE_ACCESS_TOKEN/);
});
