"use strict";

const { createMetaGraphPublisher } = require("./meta-graph-adapter");
const { createSocialPostPublisher, missingDependencies } = require("./social-post-publisher");

function getMissingSocialPublishingConfiguration(options = {}) {
  const env = options.env || {};
  const missing = [];
  if (env.SOCIAL_PUBLISHING_ENABLED !== "true") missing.push("SOCIAL_PUBLISHING_ENABLED");
  if (!env.META_PAGE_ACCESS_TOKEN || /^replace-with-/i.test(env.META_PAGE_ACCESS_TOKEN)) {
    missing.push("META_PAGE_ACCESS_TOKEN");
  }
  if (!String(env.META_FACEBOOK_PAGE_ID || "").trim()) missing.push("META_FACEBOOK_PAGE_ID");
  if (!String(env.META_INSTAGRAM_ACCOUNT_ID || "").trim()) missing.push("META_INSTAGRAM_ACCOUNT_ID");
  if (!String(env.META_GRAPH_API_VERSION || "").trim()) missing.push("META_GRAPH_API_VERSION");
  if (typeof options.fetchImpl !== "function") missing.push("fetchImpl");
  missing.push(...missingDependencies({
    ...options.persistence,
    publishSocialPlatform() {},
  }));
  return [...new Set(missing)];
}

function createSocialPostPublishingRuntime(options = {}) {
  const missingConfiguration = getMissingSocialPublishingConfiguration(options);
  if (missingConfiguration.length) return { enabled: false, missingConfiguration };

  const env = options.env;
  const publishSocialPlatform = createMetaGraphPublisher({
    facebookPageId: env.META_FACEBOOK_PAGE_ID,
    fetchImpl: options.fetchImpl,
    graphApiVersion: env.META_GRAPH_API_VERSION,
    instagramAccountId: env.META_INSTAGRAM_ACCOUNT_ID,
    pageAccessToken: env.META_PAGE_ACCESS_TOKEN,
  });
  return {
    enabled: true,
    publishDueSocialPost: createSocialPostPublisher({
      ...options.persistence,
      publishSocialPlatform,
    }, { maxAttempts: options.maxAttempts }),
  };
}

module.exports = {
  createSocialPostPublishingRuntime,
  getMissingSocialPublishingConfiguration,
};
