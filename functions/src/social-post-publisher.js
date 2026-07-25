"use strict";

const DEFAULT_SOCIAL_MAX_ATTEMPTS = 3;

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function missingDependencies(deps = {}) {
  return [
    "claimDueSocialPost",
    "completeSocialPostPublishing",
    "publishSocialPlatform",
    "recordSocialPostFailure",
    "recordSocialPostPlatformSuccess",
  ].filter((name) => typeof deps[name] !== "function");
}

function safeProviderError(error) {
  const code = cleanText(error && error.code, 80);
  return /^[A-Za-z0-9_.-]+$/.test(code) ? code : "social_provider_failed";
}

function normalizeClaim(claim, maxAttempts) {
  if (!claim) return null;
  const attempt = Number(claim.attempt);
  const post = claim.post && typeof claim.post === "object" ? claim.post : {};
  const postId = cleanText(post.postId, 80);
  const platforms = Array.isArray(post.platforms) ? [...post.platforms] : [];
  if (
    !Number.isInteger(attempt) || attempt < 1 || attempt > maxAttempts ||
    !/^[a-z0-9][a-z0-9_-]{2,79}$/.test(postId) ||
    !platforms.length || new Set(platforms).size !== platforms.length ||
    platforms.some((platform) => !["facebook", "instagram"].includes(platform))
  ) {
    const error = new Error("Claimed social post is invalid.");
    error.code = "social_post_claim_invalid";
    throw error;
  }
  return {
    attempt,
    post: {
      caption: cleanText(post.caption, 2000),
      facebookPostId: cleanText(post.facebookPostId, 200),
      hashtags: Array.isArray(post.hashtags) ? [...post.hashtags] : [],
      imageUrl: cleanText(post.imageUrl, 2048),
      instagramPostId: cleanText(post.instagramPostId, 200),
      platforms,
      postId,
      scheduledAt: post.scheduledAt,
    },
  };
}

function createSocialPostPublisher(deps = {}, options = {}) {
  const missing = missingDependencies(deps);
  if (missing.length) {
    const error = new Error("Social post publishing dependencies are not configured.");
    error.code = "social_post_publisher_dependency_missing";
    error.missingDependencies = missing;
    throw error;
  }
  const configuredMax = Number(options.maxAttempts);
  const maxAttempts = Number.isInteger(configuredMax) && configuredMax >= 1 && configuredMax <= 5
    ? configuredMax
    : DEFAULT_SOCIAL_MAX_ATTEMPTS;

  return async function publishDueSocialPost({ now } = {}) {
    const claim = normalizeClaim(await deps.claimDueSocialPost({ maxAttempts, now }), maxAttempts);
    if (!claim) return { action: "skipped" };

    const completed = {
      facebook: Boolean(claim.post.facebookPostId),
      instagram: Boolean(claim.post.instagramPostId),
    };
    for (const platform of claim.post.platforms) {
      if (completed[platform]) continue;
      let result;
      try {
        result = await deps.publishSocialPlatform({ platform, post: claim.post });
        const providerPostId = cleanText(result && result.providerPostId, 200);
        if (!providerPostId || result.platform !== platform) {
          const error = new Error("Social provider response did not include a matching post ID.");
          error.code = "social_provider_response_invalid";
          throw error;
        }
      } catch (error) {
        const retryable = error && error.permanent === true ? false : claim.attempt < maxAttempts;
        const errorCode = safeProviderError(error);
        await deps.recordSocialPostFailure({
          attempt: claim.attempt,
          errorCode,
          maxAttempts,
          postId: claim.post.postId,
          retryable,
        });
        return {
          action: retryable ? "retry_scheduled" : "failed",
          attempt: claim.attempt,
          errorCode,
          postId: claim.post.postId,
        };
      }

      await deps.recordSocialPostPlatformSuccess({
        attempt: claim.attempt,
        platform,
        postId: claim.post.postId,
        providerPostId: result.providerPostId,
      });
      completed[platform] = true;
    }

    await deps.completeSocialPostPublishing({
      attempt: claim.attempt,
      postId: claim.post.postId,
    });
    return { action: "published", attempt: claim.attempt, postId: claim.post.postId };
  };
}

module.exports = {
  DEFAULT_SOCIAL_MAX_ATTEMPTS,
  createSocialPostPublisher,
  missingDependencies,
  safeProviderError,
};
