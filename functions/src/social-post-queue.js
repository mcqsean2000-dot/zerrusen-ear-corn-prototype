"use strict";

const SOCIAL_WEBSITE_URL = "https://theosfarm.com";
const SOCIAL_PLATFORMS = Object.freeze(["facebook", "instagram"]);
const SOCIAL_POST_FIELDS = Object.freeze([
  "approvedBy",
  "caption",
  "hashtags",
  "imageUrl",
  "platforms",
  "postId",
  "scheduledAt",
  "status",
]);

function socialPostError(message, code, details) {
  const error = new Error(message);
  error.code = code;
  if (details) Object.assign(error, details);
  return error;
}

function cleanText(value) {
  return String(value || "").trim();
}

function validateApprovedBy(value) {
  const approvedBy = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const unexpectedFields = Object.keys(approvedBy).filter((field) => !["email", "uid"].includes(field));
  const uid = cleanText(approvedBy.uid);
  const email = cleanText(approvedBy.email).toLowerCase();

  if (
    unexpectedFields.length ||
    !/^[A-Za-z0-9_.:-]{1,160}$/.test(uid) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 160
  ) {
    throw socialPostError(
      "An approved social post requires a trusted reviewer uid and email.",
      "social_post_approver_invalid",
    );
  }

  return { email, uid };
}

function validateScheduledAt(value) {
  if (value === null || value === undefined || value === "") {
    throw socialPostError(
      "An approved social post requires a valid scheduledAt time.",
      "social_post_schedule_invalid",
    );
  }
  const scheduledAt = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(scheduledAt.getTime())) {
    throw socialPostError(
      "An approved social post requires a valid scheduledAt time.",
      "social_post_schedule_invalid",
    );
  }
  return scheduledAt;
}

function validatePlatforms(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > SOCIAL_PLATFORMS.length) {
    throw socialPostError(
      "An approved social post requires at least one supported platform.",
      "social_post_platforms_invalid",
    );
  }

  const platforms = value.map((platform) => cleanText(platform).toLowerCase());
  if (
    new Set(platforms).size !== platforms.length ||
    platforms.some((platform) => !SOCIAL_PLATFORMS.includes(platform))
  ) {
    throw socialPostError(
      "Social post platforms must be unique Facebook or Instagram values.",
      "social_post_platforms_invalid",
    );
  }
  return platforms;
}

function validateHashtags(value) {
  if (!Array.isArray(value) || value.length > 12) {
    throw socialPostError(
      "Social post hashtags must be an array with no more than 12 entries.",
      "social_post_hashtags_invalid",
    );
  }

  const hashtags = value.map(cleanText);
  if (
    new Set(hashtags.map((tag) => tag.toLowerCase())).size !== hashtags.length ||
    hashtags.some((tag) => !/^#[A-Za-z0-9_]{1,40}$/.test(tag))
  ) {
    throw socialPostError(
      "Social post hashtags must be unique safe hashtag values.",
      "social_post_hashtags_invalid",
    );
  }
  return hashtags;
}

function validateImageUrl(value, platforms) {
  const imageUrl = cleanText(value);
  if (!imageUrl && platforms.includes("instagram")) {
    throw socialPostError(
      "Instagram posts require a public Theo's Farm image URL.",
      "social_post_image_required",
    );
  }
  if (!imageUrl) return "";

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw socialPostError("Social post imageUrl must be a valid URL.", "social_post_image_invalid");
  }

  if (
    parsed.protocol !== "https:" ||
    !["theosfarm.com", "www.theosfarm.com"].includes(parsed.hostname.toLowerCase())
  ) {
    throw socialPostError(
      "Social post images must use a public HTTPS Theo's Farm URL.",
      "social_post_image_invalid",
    );
  }
  return parsed.toString();
}

function normalizeApprovedSocialPost(value) {
  const post = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const unexpectedFields = Object.keys(post).filter((field) => !SOCIAL_POST_FIELDS.includes(field));
  if (unexpectedFields.length) {
    throw socialPostError(
      "Approved social post includes unsupported fields.",
      "social_post_untrusted_field",
      { untrustedFields: unexpectedFields },
    );
  }

  const postId = cleanText(post.postId);
  const caption = cleanText(post.caption);
  if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(postId)) {
    throw socialPostError("Social post postId must be a safe deterministic ID.", "social_post_id_invalid");
  }
  if (post.status !== "approved") {
    throw socialPostError(
      "Only human-approved social posts can enter the publish queue.",
      "social_post_not_approved",
    );
  }
  if (!caption || caption.length > 2000 || !caption.includes(SOCIAL_WEBSITE_URL)) {
    throw socialPostError(
      `Social post caption must be 1 to 2000 characters and include ${SOCIAL_WEBSITE_URL}.`,
      "social_post_caption_invalid",
    );
  }

  const platforms = validatePlatforms(post.platforms);
  return {
    approvedBy: validateApprovedBy(post.approvedBy),
    caption,
    hashtags: validateHashtags(post.hashtags),
    imageUrl: validateImageUrl(post.imageUrl, platforms),
    platforms,
    postId,
    scheduledAt: validateScheduledAt(post.scheduledAt),
    status: "approved",
  };
}

function createSocialPostQueue(options = {}) {
  if (typeof options.enqueueApprovedSocialPost !== "function") {
    throw socialPostError(
      "Social post queue persistence is not configured.",
      "social_post_queue_missing",
    );
  }

  return {
    queueApprovedSocialPost(input) {
      return options.enqueueApprovedSocialPost({
        post: normalizeApprovedSocialPost(input),
      });
    },
  };
}

module.exports = {
  SOCIAL_PLATFORMS,
  SOCIAL_WEBSITE_URL,
  createSocialPostQueue,
  normalizeApprovedSocialPost,
};
