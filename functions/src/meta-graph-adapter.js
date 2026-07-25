"use strict";

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function configurationError(missingConfiguration) {
  const error = new Error("Meta Graph publishing is not configured.");
  error.code = "meta_graph_configuration_missing";
  error.missingConfiguration = missingConfiguration;
  return error;
}

function requireConfiguration(options) {
  const missing = [];
  if (typeof options.fetchImpl !== "function") missing.push("fetchImpl");
  if (!options.pageAccessToken || /^replace-with-/i.test(options.pageAccessToken)) {
    missing.push("META_PAGE_ACCESS_TOKEN");
  }
  if (!/^[A-Za-z0-9_]{1,80}$/.test(cleanText(options.facebookPageId, 80))) {
    missing.push("META_FACEBOOK_PAGE_ID");
  }
  if (!/^[A-Za-z0-9_]{1,80}$/.test(cleanText(options.instagramAccountId, 80))) {
    missing.push("META_INSTAGRAM_ACCOUNT_ID");
  }
  if (!/^v\d{1,3}\.\d{1,2}$/.test(cleanText(options.graphApiVersion, 16))) {
    missing.push("META_GRAPH_API_VERSION");
  }
  if (missing.length) throw configurationError(missing);
}

function trustedPublishInput(input = {}) {
  const platform = cleanText(input.platform, 20).toLowerCase();
  const post = input.post && typeof input.post === "object" ? input.post : {};
  const caption = cleanText(post.caption, 2000);
  const imageUrl = cleanText(post.imageUrl, 2048);
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags.map((tag) => cleanText(tag, 42)) : [];

  if (
    !["facebook", "instagram"].includes(platform) ||
    !caption ||
    hashtags.length > 12 ||
    hashtags.some((tag) => !/^#[A-Za-z0-9_]{1,40}$/.test(tag)) ||
    (platform === "instagram" && !imageUrl)
  ) {
    const error = new Error("Meta Graph publishing requires a trusted social post payload.");
    error.code = "meta_graph_post_invalid";
    error.permanent = true;
    throw error;
  }

  return {
    caption: [caption, hashtags.join(" ")].filter(Boolean).join("\n\n"),
    imageUrl,
    platform,
  };
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function metaRequestError(response, body) {
  const providerCode = cleanText(body && body.error && body.error.code, 24);
  const status = Number(response && response.status) || 0;
  const error = new Error("Meta Graph publishing request failed.");
  error.code = /^\d+$/.test(providerCode) ? `meta_graph_${providerCode}` : "meta_graph_request_failed";
  error.status = status;
  error.permanent = status >= 400 && status < 500 && ![408, 429].includes(status);
  return error;
}

function createMetaGraphPublisher(options = {}) {
  requireConfiguration(options);
  const fetchImpl = options.fetchImpl;
  const token = options.pageAccessToken;
  const facebookPageId = cleanText(options.facebookPageId, 80);
  const instagramAccountId = cleanText(options.instagramAccountId, 80);
  const graphRoot = `https://graph.facebook.com/${cleanText(options.graphApiVersion, 16)}`;

  async function request(path, fields) {
    let response;
    try {
      response = await fetchImpl(`${graphRoot}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...fields, access_token: token }).toString(),
      });
    } catch {
      const error = new Error("Meta Graph publishing request could not be completed.");
      error.code = "meta_graph_network_error";
      throw error;
    }

    const body = await parseJson(response);
    if (!response.ok) throw metaRequestError(response, body);
    const id = cleanText(body && body.id, 200);
    if (!id) {
      const error = new Error("Meta Graph response did not include an ID.");
      error.code = "meta_graph_response_invalid";
      throw error;
    }
    return id;
  }

  return async function publishSocialPlatform(input) {
    const post = trustedPublishInput(input);
    if (post.platform === "facebook") {
      const id = post.imageUrl
        ? await request(`${facebookPageId}/photos`, { caption: post.caption, url: post.imageUrl })
        : await request(`${facebookPageId}/feed`, { link: "https://theosfarm.com", message: post.caption });
      return { platform: "facebook", providerPostId: id };
    }

    const creationId = await request(`${instagramAccountId}/media`, {
      caption: post.caption,
      image_url: post.imageUrl,
    });
    const id = await request(`${instagramAccountId}/media_publish`, { creation_id: creationId });
    return { platform: "instagram", providerPostId: id };
  };
}

module.exports = {
  createMetaGraphPublisher,
  metaRequestError,
};
