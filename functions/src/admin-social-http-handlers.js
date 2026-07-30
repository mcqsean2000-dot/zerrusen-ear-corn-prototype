"use strict";

const { reportOperationalError } = require("./operational-logger");

function resolveAdminSocialReconciliationLister(options) {
  if (typeof options.listAdminSocialPostReconciliation === "function") {
    return options.listAdminSocialPostReconciliation;
  }
  if (
    options.adminSocialDependencies &&
    typeof options.adminSocialDependencies.listAdminSocialPostReconciliation === "function"
  ) {
    return options.adminSocialDependencies.listAdminSocialPostReconciliation;
  }
  return null;
}

function resolveAdminSocialReconciliationResolver(options) {
  if (typeof options.resolveAdminSocialPostReconciliation === "function") {
    return options.resolveAdminSocialPostReconciliation;
  }
  if (
    options.adminSocialDependencies &&
    typeof options.adminSocialDependencies.resolveAdminSocialPostReconciliation === "function"
  ) {
    return options.adminSocialDependencies.resolveAdminSocialPostReconciliation;
  }
  return null;
}

function resolveAdminSocialPostQueuer(options) {
  if (typeof options.queueApprovedSocialPost === "function") {
    return options.queueApprovedSocialPost;
  }
  if (
    options.adminSocialDependencies &&
    typeof options.adminSocialDependencies.queueApprovedSocialPost === "function"
  ) {
    return options.adminSocialDependencies.queueApprovedSocialPost;
  }
  return null;
}

function createAdminSocialHttpHandlers({
  buildCorsHeaders,
  readJsonBody,
  requireAuthenticatedAdmin,
  safeSetupDetails,
  sendCorsPreflight,
  sendJson,
}) {
  async function adminSocialReconciliationHandler(req, res, options = {}) {
    const env = options.env || process.env;
    const corsHeaders = buildCorsHeaders(req, env);
    if (req.method === "OPTIONS") return sendCorsPreflight(req, res, env);
    if (req.method !== "GET") {
      return sendJson(res, 405, {
        error: { code: "method_not_allowed", message: "Use GET to review social publishing exceptions." },
      }, { allow: "GET, OPTIONS", ...corsHeaders });
    }

    const admin = await requireAuthenticatedAdmin(req, res, options, corsHeaders);
    if (!admin) return null;
    const listPosts = resolveAdminSocialReconciliationLister(options);
    if (typeof listPosts !== "function") {
      return sendJson(res, 501, {
        error: {
          code: "admin_social_reconciliation_dependency_missing",
          message: "Social reconciliation requires trusted queue persistence.",
        },
        mock: true,
        ...safeSetupDetails(env, ["listAdminSocialPostReconciliation"]),
      }, corsHeaders);
    }

    const requestedLimit = Number(new URL(req.url, "http://localhost").searchParams.get("limit") || 25);
    try {
      const result = await listPosts({ admin, limit: requestedLimit });
      return sendJson(res, 200, { posts: result.posts, truncated: result.truncated }, corsHeaders);
    } catch (error) {
      if (error.code === "admin_actor_invalid" || error.code === "admin_social_reconciliation_limit_invalid") {
        return sendJson(res, 400, {
          error: { code: error.code, message: "Check the admin identity and reconciliation result limit." },
        }, corsHeaders);
      }
      reportOperationalError(options, "admin_social_reconciliation_failed", error, {
        method: req.method,
        path: "/api/admin/social-posts/reconciliation",
      });
      return sendJson(res, 502, {
        error: {
          code: "admin_social_reconciliation_failed",
          message: "Social publishing exceptions could not be loaded.",
        },
      }, corsHeaders);
    }
  }

  async function adminSocialReconciliationResolveHandler(req, res, options = {}) {
    const env = options.env || process.env;
    const corsHeaders = buildCorsHeaders(req, env);
    if (req.method === "OPTIONS") return sendCorsPreflight(req, res, env);
    if (req.method !== "POST") {
      return sendJson(res, 405, {
        error: { code: "method_not_allowed", message: "Use POST to resolve a social publishing exception." },
      }, { allow: "POST, OPTIONS", ...corsHeaders });
    }

    const admin = await requireAuthenticatedAdmin(req, res, options, corsHeaders);
    if (!admin) return null;
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, {
        error: { code: "invalid_json", message: "Send a valid JSON social reconciliation request." },
      }, corsHeaders);
    }

    const resolvePost = resolveAdminSocialReconciliationResolver(options);
    if (typeof resolvePost !== "function") {
      return sendJson(res, 501, {
        error: {
          code: "admin_social_reconciliation_dependency_missing",
          message: "Social reconciliation requires trusted queue persistence.",
        },
        mock: true,
        ...safeSetupDetails(env, ["resolveAdminSocialPostReconciliation"]),
      }, corsHeaders);
    }

    try {
      const result = await resolvePost({
        admin,
        postId: body.postId,
        providerPostIds: body.providerPostIds,
        resolution: body.resolution,
      });
      return sendJson(res, 200, {
        postId: result.id,
        resolution: result.resolution,
        status: result.status,
      }, corsHeaders);
    } catch (error) {
      if ([
        "admin_actor_invalid",
        "admin_social_post_id_invalid",
        "admin_social_provider_ids_invalid",
        "admin_social_provider_ids_incomplete",
        "admin_social_resolution_invalid",
      ].includes(error.code)) {
        return sendJson(res, 400, {
          error: { code: error.code, message: "Check the social post, resolution, and provider IDs." },
        }, corsHeaders);
      }
      if (error.code === "admin_social_post_not_found") {
        return sendJson(res, 404, {
          error: { code: error.code, message: "Social post was not found." },
        }, corsHeaders);
      }
      if (error.code === "admin_social_reconciliation_conflict") {
        return sendJson(res, 409, {
          error: { code: error.code, message: "Social post is no longer awaiting reconciliation." },
        }, corsHeaders);
      }
      reportOperationalError(options, "admin_social_reconciliation_update_failed", error, {
        method: req.method,
        path: "/api/admin/social-posts/reconciliation/resolve",
      });
      return sendJson(res, 502, {
        error: {
          code: "admin_social_reconciliation_update_failed",
          message: "Social publishing exception could not be resolved.",
        },
      }, corsHeaders);
    }
  }

  async function adminSocialPostQueueHandler(req, res, options = {}) {
    const env = options.env || process.env;
    const corsHeaders = buildCorsHeaders(req, env);
    if (req.method === "OPTIONS") return sendCorsPreflight(req, res, env);
    if (req.method !== "POST") {
      return sendJson(res, 405, {
        error: { code: "method_not_allowed", message: "Use POST to approve and queue a social post." },
      }, { allow: "POST, OPTIONS", ...corsHeaders });
    }

    const admin = await requireAuthenticatedAdmin(req, res, options, corsHeaders);
    if (!admin) return null;

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, {
        error: { code: "invalid_json", message: "Send a valid JSON social post." },
      }, corsHeaders);
    }

    const queuePost = resolveAdminSocialPostQueuer(options);
    if (typeof queuePost !== "function") {
      return sendJson(res, 501, {
        error: {
          code: "admin_social_queue_dependency_missing",
          message: "Social post approval requires trusted queue persistence.",
        },
        mock: true,
        ...safeSetupDetails(env, ["queueApprovedSocialPost"]),
      }, corsHeaders);
    }

    try {
      const result = await queuePost({
        approvedBy: admin,
        caption: body.caption,
        hashtags: body.hashtags,
        imageUrl: body.imageUrl,
        platforms: body.platforms,
        postId: body.postId,
        scheduledAt: body.scheduledAt,
        status: "approved",
      });
      return sendJson(res, result.created ? 201 : 200, {
        created: result.created,
        postId: result.postId,
        status: "approved",
      }, corsHeaders);
    } catch (error) {
      if (String(error.code || "").startsWith("social_post_")) {
        return sendJson(res, 400, {
          error: { code: error.code, message: "Check the social post content and schedule." },
        }, corsHeaders);
      }
      reportOperationalError(options, "admin_social_queue_failed", error, {
        method: req.method,
        path: "/api/admin/social-posts/queue",
      });
      return sendJson(res, 502, {
        error: {
          code: "admin_social_queue_failed",
          message: "The approved social post could not be queued.",
        },
      }, corsHeaders);
    }
  }

  return {
    adminSocialPostQueueHandler,
    adminSocialReconciliationHandler,
    adminSocialReconciliationResolveHandler,
  };
}

module.exports = {
  createAdminSocialHttpHandlers,
  resolveAdminSocialPostQueuer,
  resolveAdminSocialReconciliationLister,
  resolveAdminSocialReconciliationResolver,
};
