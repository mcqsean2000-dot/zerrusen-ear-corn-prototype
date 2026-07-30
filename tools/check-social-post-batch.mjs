import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { normalizeApprovedSocialPost } = require("../functions/src/social-post-queue.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const batchPath = path.join(root, "docs", "social-post-batch-2026-08-03.json");
const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));

if (batch.reviewStatus !== "draft" || !Array.isArray(batch.posts) || batch.posts.length !== 7) {
  throw new Error("Weekly social batch must contain exactly seven review-only drafts.");
}

const ids = new Set();
for (const draft of batch.posts) {
  if (draft.status !== "draft") throw new Error(`${draft.postId} must remain draft before review.`);
  if (ids.has(draft.postId)) throw new Error(`Duplicate social post ID: ${draft.postId}`);
  ids.add(draft.postId);

  const normalized = normalizeApprovedSocialPost({
    ...draft,
    approvedBy: { email: "dry-run@theosfarm.test", uid: "social-batch-dry-run" },
    status: "approved",
  });
  const imagePath = new URL(normalized.imageUrl).pathname.replace(/^\//, "");
  if (!fs.existsSync(path.join(root, imagePath))) {
    throw new Error(`${draft.postId} references a missing local website image.`);
  }
}

console.log(`Social batch dry run passed: ${batch.posts.length} drafts validated; nothing queued or published.`);
