import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { generateWeeklyBatch } = require("../social-weekly-drafts.js");

const summer = generateWeeklyBatch(new Date("2026-07-30T12:00:00Z"));
assert.equal(summer.weekOf, "2026-08-03");
assert.equal(summer.reviewStatus, "draft");
assert.equal(summer.posts.length, 7);
assert.equal(new Set(summer.posts.map((post) => post.postId)).size, 7);
assert.deepEqual(summer.posts.map((post) => post.scheduledAt), [
  "2026-08-03T13:30:00.000Z",
  "2026-08-04T13:30:00.000Z",
  "2026-08-05T13:30:00.000Z",
  "2026-08-06T13:30:00.000Z",
  "2026-08-07T13:30:00.000Z",
  "2026-08-08T13:30:00.000Z",
  "2026-08-09T13:30:00.000Z",
]);

const winter = generateWeeklyBatch(new Date("2026-12-03T12:00:00Z"));
assert.equal(winter.weekOf, "2026-12-07");
assert(winter.posts.every((post) => post.scheduledAt.endsWith("T14:30:00.000Z")));

for (const post of [...summer.posts, ...winter.posts]) {
  assert.deepEqual(post.platforms, ["facebook", "instagram"]);
  assert.equal(post.status, "draft");
  assert(post.caption.includes("https://theosfarm.com"));
  assert(/^https:\/\/theosfarm\.com\/assets\//.test(post.imageUrl));
  assert(post.hashtags.length > 0 && post.hashtags.length <= 12);
}

const rotations = [0, 1, 2, 3].map((week) => (
  generateWeeklyBatch(new Date(Date.UTC(2026, 0, 5 + (week * 7), 12)))
));
assert.equal(new Set(rotations.flatMap((batch) => batch.posts.map((post) => post.caption))).size, 28);

console.log("Weekly social draft generator passed: rotating seven-post batches validated.");
