"use strict";

const { normalizeApprovedSocialPost } = require("./social-post-queue");

function isFunction(value) {
  return typeof value === "function";
}

function cleanText(value) {
  return String(value || "").trim();
}

function createFirestoreSocialPostPersistence({
  collectionRef,
  firestore,
  normalizeSnapshot,
  queryByConstraints,
  queryByFields,
  timestamp,
  timestampMillis,
  validateAdminActor,
}) {
  async function enqueueApprovedSocialPost({ collection, post }) {
    const trustedPost = normalizeApprovedSocialPost(post);
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for social post queueing.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const posts = collectionRef(collection);
    const ref = posts.doc(trustedPost.postId);
    return firestore.runTransaction(async (transaction) => {
      const existing = normalizeSnapshot(await transaction.get(ref));
      if (existing) return { created: false, postId: trustedPost.postId };

      transaction.set(ref, {
        ...trustedPost,
        approvedAt: timestamp(),
        createdAt: timestamp(),
        publishAttempts: 0,
      });
      return { created: true, postId: trustedPost.postId };
    });
  }

  async function claimDueSocialPost({ collection, maxAttempts = 3, now }) {
    const nowMillis = timestampMillis(now);
    const attemptLimit = Number(maxAttempts);
    if (!Number.isFinite(nowMillis)) {
      const error = new Error("Social post claiming requires a trusted current time.");
      error.code = "social_post_claim_time_invalid";
      throw error;
    }
    if (!Number.isInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 5) {
      const error = new Error("Social post claiming requires maxAttempts from 1 to 5.");
      error.code = "social_post_claim_attempts_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for social post claiming.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const posts = collectionRef(collection);
    const candidates = await queryByConstraints(posts, [
      ["status", "==", "approved"],
      ["scheduledAt", "<=", now],
    ], 1);
    if (!candidates.length) return null;

    const postId = cleanText(candidates[0].id);
    const ref = posts.doc(postId);
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      const attempts = Number(data && data.publishAttempts || 0);
      if (
        !data ||
        data.status !== "approved" ||
        !Number.isFinite(timestampMillis(data.scheduledAt)) ||
        timestampMillis(data.scheduledAt) > nowMillis ||
        !Number.isInteger(attempts) ||
        attempts >= attemptLimit
      ) {
        return null;
      }

      transaction.update(ref, {
        lastPublishAttemptAt: timestamp(),
        publishAttempts: attempts + 1,
        status: "publishing",
      });
      return {
        attempt: attempts + 1,
        post: {
          caption: cleanText(data.caption),
          ...(cleanText(data.facebookPostId) ? { facebookPostId: cleanText(data.facebookPostId) } : {}),
          hashtags: Array.isArray(data.hashtags) ? [...data.hashtags] : [],
          imageUrl: cleanText(data.imageUrl),
          ...(cleanText(data.instagramPostId) ? { instagramPostId: cleanText(data.instagramPostId) } : {}),
          platforms: Array.isArray(data.platforms) ? [...data.platforms] : [],
          postId,
          scheduledAt: data.scheduledAt,
        },
      };
    });
  }

  async function recordSocialPostPlatformSuccess({ attempt, platform, postId, providerPostId }) {
    const id = cleanText(postId);
    const attemptNumber = Number(attempt);
    const target = cleanText(platform).toLowerCase();
    const providerId = cleanText(providerPostId);
    if (
      !/^[a-z0-9][a-z0-9_-]{2,79}$/.test(id) ||
      !Number.isInteger(attemptNumber) || attemptNumber < 1 || attemptNumber > 5 ||
      !["facebook", "instagram"].includes(target) ||
      !/^[A-Za-z0-9_.:-]{1,200}$/.test(providerId)
    ) {
      const error = new Error("Social platform success requires safe bounded result fields.");
      error.code = "social_post_platform_result_invalid";
      throw error;
    }

    const ref = collectionRef().doc(id);
    const idField = target === "facebook" ? "facebookPostId" : "instagramPostId";
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      if (!data || data.status !== "publishing" || data.publishAttempts !== attemptNumber) {
        const error = new Error("Social platform success does not match the active publish attempt.");
        error.code = "social_post_publish_state_conflict";
        throw error;
      }
      if (cleanText(data[idField]) && cleanText(data[idField]) !== providerId) {
        const error = new Error("Social platform already has a different provider post ID.");
        error.code = "social_post_provider_id_conflict";
        throw error;
      }
      transaction.update(ref, {
        [idField]: providerId,
        lastPublishProgressAt: timestamp(),
      });
      return true;
    });
  }

  async function completeSocialPostPublishing({ attempt, postId }) {
    const id = cleanText(postId);
    const attemptNumber = Number(attempt);
    if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(id) || !Number.isInteger(attemptNumber)) {
      const error = new Error("Social post completion requires a safe post and attempt.");
      error.code = "social_post_completion_invalid";
      throw error;
    }

    const ref = collectionRef().doc(id);
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      const platforms = Array.isArray(data && data.platforms) ? data.platforms : [];
      const complete = platforms.length > 0 && platforms.every((platform) => (
        platform === "facebook" ? cleanText(data.facebookPostId) :
          platform === "instagram" ? cleanText(data.instagramPostId) : ""
      ));
      if (!data || data.status !== "publishing" || data.publishAttempts !== attemptNumber || !complete) {
        const error = new Error("Social post completion does not match a fully published active attempt.");
        error.code = "social_post_publish_state_conflict";
        throw error;
      }
      transaction.update(ref, {
        lastErrorCode: "",
        lastPublishFinishedAt: timestamp(),
        publishedAt: timestamp(),
        status: "published",
      });
      return true;
    });
  }

  async function recordSocialPostFailure({ attempt, errorCode, maxAttempts, postId, retryable }) {
    const id = cleanText(postId);
    const attemptNumber = Number(attempt);
    const attemptLimit = Number(maxAttempts);
    const code = cleanText(errorCode);
    if (
      !/^[a-z0-9][a-z0-9_-]{2,79}$/.test(id) ||
      !Number.isInteger(attemptNumber) || attemptNumber < 1 ||
      !Number.isInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 5 ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(code) ||
      typeof retryable !== "boolean"
    ) {
      const error = new Error("Social post failure requires safe bounded result fields.");
      error.code = "social_post_failure_result_invalid";
      throw error;
    }

    const ref = collectionRef().doc(id);
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      if (!data || data.status !== "publishing" || data.publishAttempts !== attemptNumber) {
        const error = new Error("Social post failure does not match the active publish attempt.");
        error.code = "social_post_publish_state_conflict";
        throw error;
      }
      const canRetry = retryable && attemptNumber < attemptLimit;
      transaction.update(ref, {
        lastErrorCode: code,
        lastPublishFinishedAt: timestamp(),
        status: canRetry ? "approved" : "failed",
      });
      return { retryable: canRetry };
    });
  }

  async function recoverStaleSocialPostClaims({ collection, limit = 20, staleBefore } = {}) {
    const resultLimit = Number(limit);
    const cutoffMillis = timestampMillis(staleBefore);
    if (!Number.isInteger(resultLimit) || resultLimit < 1 || resultLimit > 50) {
      const error = new Error("Social post lease recovery requires a limit from 1 to 50.");
      error.code = "social_post_lease_limit_invalid";
      throw error;
    }
    if (!Number.isFinite(cutoffMillis)) {
      const error = new Error("Social post lease recovery requires a trusted cutoff time.");
      error.code = "social_post_lease_cutoff_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for social post recovery.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const posts = collectionRef(collection);
    const candidates = await queryByConstraints(posts, [
      ["status", "==", "publishing"],
      ["lastPublishAttemptAt", "<=", staleBefore],
    ], resultLimit);
    const result = { published: 0, reconciliationRequired: 0 };

    for (const candidate of candidates) {
      const ref = posts.doc(cleanText(candidate.id));
      const action = await firestore.runTransaction(async (transaction) => {
        const data = normalizeSnapshot(await transaction.get(ref));
        const attemptMillis = timestampMillis(data && data.lastPublishAttemptAt);
        const progressMillis = timestampMillis(data && data.lastPublishProgressAt);
        const latestActivityMillis = Number.isFinite(progressMillis)
          ? Math.max(attemptMillis, progressMillis)
          : attemptMillis;
        if (
          !data ||
          data.status !== "publishing" ||
          !Number.isFinite(latestActivityMillis) ||
          latestActivityMillis > cutoffMillis
        ) {
          return "skipped";
        }

        const platforms = Array.isArray(data.platforms) ? data.platforms : [];
        const fullyRecorded = platforms.length > 0 && platforms.every((platform) => (
          platform === "facebook" ? cleanText(data.facebookPostId) :
            platform === "instagram" ? cleanText(data.instagramPostId) : ""
        ));
        transaction.update(ref, fullyRecorded ? {
          lastErrorCode: "",
          lastPublishFinishedAt: timestamp(),
          publishedAt: timestamp(),
          status: "published",
        } : {
          lastErrorCode: "publishing_lease_expired",
          lastPublishFinishedAt: timestamp(),
          reconciliationRequiredAt: timestamp(),
          status: "needs_reconciliation",
        });
        return fullyRecorded ? "published" : "reconciliation_required";
      });

      if (action === "published") result.published += 1;
      if (action === "reconciliation_required") result.reconciliationRequired += 1;
    }

    return result;
  }

  async function listAdminSocialPostReconciliation({ admin, collection, limit = 25 } = {}) {
    validateAdminActor(admin);
    const resultLimit = Number(limit);
    if (!Number.isInteger(resultLimit) || resultLimit < 1 || resultLimit > 50) {
      const error = new Error("Admin social reconciliation requires a limit from 1 to 50.");
      error.code = "admin_social_reconciliation_limit_invalid";
      throw error;
    }

    const posts = collectionRef(collection);
    const matches = await queryByFields(posts, [["status", "needs_reconciliation"]], resultLimit + 1);
    return {
      posts: matches.slice(0, resultLimit).map((post) => ({
        caption: cleanText(post.caption).slice(0, 2000),
        facebookPostId: cleanText(post.facebookPostId).slice(0, 200),
        imageUrl: cleanText(post.imageUrl).slice(0, 2048),
        instagramPostId: cleanText(post.instagramPostId).slice(0, 200),
        lastErrorCode: cleanText(post.lastErrorCode).slice(0, 80),
        platforms: Array.isArray(post.platforms)
          ? post.platforms.filter((platform) => ["facebook", "instagram"].includes(platform))
          : [],
        postId: cleanText(post.id).slice(0, 80),
        publishAttempts: Number.isInteger(Number(post.publishAttempts)) ? Number(post.publishAttempts) : 0,
        reconciliationRequiredAtMillis: timestampMillis(post.reconciliationRequiredAt),
        scheduledAtMillis: timestampMillis(post.scheduledAt),
        status: "needs_reconciliation",
      })),
      truncated: matches.length > resultLimit,
    };
  }

  async function resolveAdminSocialPostReconciliation({
    admin,
    collection,
    postId,
    providerPostIds = {},
    resolution,
  }) {
    const actor = validateAdminActor(admin);
    const id = cleanText(postId);
    const action = cleanText(resolution);
    const suppliedIds = providerPostIds && typeof providerPostIds === "object" && !Array.isArray(providerPostIds)
      ? providerPostIds
      : {};
    const unexpectedIdFields = Object.keys(suppliedIds).filter((field) => (
      !["facebookPostId", "instagramPostId"].includes(field)
    ));
    const facebookPostId = cleanText(suppliedIds.facebookPostId);
    const instagramPostId = cleanText(suppliedIds.instagramPostId);
    if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(id)) {
      const error = new Error("Admin social reconciliation requires a safe post ID.");
      error.code = "admin_social_post_id_invalid";
      throw error;
    }
    if (!["mark_published", "retry_confirmed_not_published", "skip"].includes(action)) {
      const error = new Error("Admin social reconciliation used an unsupported resolution.");
      error.code = "admin_social_resolution_invalid";
      throw error;
    }
    if (
      unexpectedIdFields.length ||
      [facebookPostId, instagramPostId].some((providerId) => (
        providerId && !/^[A-Za-z0-9_.:-]{1,200}$/.test(providerId)
      )) ||
      (action !== "mark_published" && (facebookPostId || instagramPostId))
    ) {
      const error = new Error("Admin social reconciliation provider IDs are invalid.");
      error.code = "admin_social_provider_ids_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for social reconciliation.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const ref = collectionRef(collection).doc(id);
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      if (!data) {
        const error = new Error("Social post was not found.");
        error.code = "admin_social_post_not_found";
        throw error;
      }
      if (data.status !== "needs_reconciliation") {
        const error = new Error("Social post is not awaiting reconciliation.");
        error.code = "admin_social_reconciliation_conflict";
        throw error;
      }

      const fields = {
        reconciledAt: timestamp(),
        reconciledByEmail: actor.email,
        reconciledByUid: actor.uid,
        reconciliationResolution: action,
      };
      if (action === "mark_published") {
        const platforms = Array.isArray(data.platforms) ? data.platforms : [];
        const resolvedFacebookId = facebookPostId || cleanText(data.facebookPostId);
        const resolvedInstagramId = instagramPostId || cleanText(data.instagramPostId);
        const complete = platforms.length > 0 && platforms.every((platform) => (
          platform === "facebook" ? resolvedFacebookId :
            platform === "instagram" ? resolvedInstagramId : ""
        ));
        if (!complete) {
          const error = new Error("Marking a post published requires every selected platform ID.");
          error.code = "admin_social_provider_ids_incomplete";
          throw error;
        }
        Object.assign(fields, {
          ...(resolvedFacebookId ? { facebookPostId: resolvedFacebookId } : {}),
          ...(resolvedInstagramId ? { instagramPostId: resolvedInstagramId } : {}),
          lastErrorCode: "",
          lastPublishFinishedAt: timestamp(),
          publishedAt: timestamp(),
          status: "published",
        });
      } else if (action === "retry_confirmed_not_published") {
        Object.assign(fields, {
          lastErrorCode: "admin_confirmed_not_published",
          publishAttempts: 0,
          status: "approved",
        });
      } else {
        Object.assign(fields, {
          lastErrorCode: "admin_skipped_ambiguous_post",
          status: "skipped",
        });
      }

      transaction.update(ref, fields);
      return { id, resolution: action, status: fields.status };
    });
  }

  return {
    claimDueSocialPost,
    completeSocialPostPublishing,
    enqueueApprovedSocialPost,
    listAdminSocialPostReconciliation,
    recordSocialPostFailure,
    recordSocialPostPlatformSuccess,
    recoverStaleSocialPostClaims,
    resolveAdminSocialPostReconciliation,
  };
}

module.exports = {
  createFirestoreSocialPostPersistence,
};
