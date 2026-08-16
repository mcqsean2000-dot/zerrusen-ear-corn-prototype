"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createMetaGraphPublisher } = require("./meta-graph-adapter");

function response(body, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    async json() {
      return body;
    },
  };
}

function configuration(overrides = {}) {
  return {
    facebookPageId: "page_123",
    graphApiVersion: "v99.0",
    instagramAccountId: "ig_123",
    pageAccessToken: "test-token",
    ...overrides,
  };
}

function post(overrides = {}) {
  return {
    caption: "Packed to order. https://theosfarm.com",
    hashtags: ["#TheosFarm"],
    imageUrl: "https://theosfarm.com/assets/theos-both-bags.jpg",
    ...overrides,
  };
}

test("publishes a Facebook photo with injected version and credentials", async () => {
  const calls = [];
  const publish = createMetaGraphPublisher(configuration({
    async fetchImpl(url, init) {
      calls.push({ init, url });
      return response({ id: "fb_post_123" });
    },
  }));

  assert.deepEqual(await publish({ platform: "facebook", post: post() }), {
    platform: "facebook",
    providerPostId: "fb_post_123",
  });
  assert.equal(calls[0].url, "https://graph.facebook.com/v99.0/page_123/photos");
  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get("access_token"), "test-token");
  assert.equal(body.get("caption"), "Packed to order. https://theosfarm.com\n\n#TheosFarm");
});

test("waits for Instagram media processing before publishing", async () => {
  const urls = [];
  const sleeps = [];
  const publish = createMetaGraphPublisher(configuration({
    async fetchImpl(url) {
      urls.push(url);
      if (url.endsWith("/ig_123/media")) return response({ id: "container_123" });
      if (url.includes("/container_123?")) {
        return response({ status_code: urls.filter((value) => value.includes("/container_123?")).length === 1
          ? "IN_PROGRESS"
          : "FINISHED" });
      }
      return response({ id: "ig_post_123" });
    },
    mediaStatusDelayMs: 25,
    async sleepImpl(milliseconds) {
      sleeps.push(milliseconds);
    },
  }));

  assert.deepEqual(await publish({ platform: "instagram", post: post() }), {
    platform: "instagram",
    providerPostId: "ig_post_123",
  });
  assert.deepEqual(urls, [
    "https://graph.facebook.com/v99.0/ig_123/media",
    "https://graph.facebook.com/v99.0/container_123?fields=status_code&access_token=test-token",
    "https://graph.facebook.com/v99.0/container_123?fields=status_code&access_token=test-token",
    "https://graph.facebook.com/v99.0/ig_123/media_publish",
  ]);
  assert.deepEqual(sleeps, [25]);
});

test("fails safely when Instagram media processing does not finish", async () => {
  const publish = createMetaGraphPublisher(configuration({
    async fetchImpl(url) {
      if (url.endsWith("/ig_123/media")) return response({ id: "container_123" });
      return response({ status_code: "IN_PROGRESS" });
    },
    mediaStatusDelayMs: 0,
    mediaStatusMaxAttempts: 2,
    async sleepImpl() {},
  }));

  await assert.rejects(
    publish({ platform: "instagram", post: post() }),
    (error) => error.code === "meta_graph_media_processing_timeout" && error.permanent !== true,
  );
});

test("fails closed for missing configuration and sanitizes provider errors", async () => {
  assert.throws(
    () => createMetaGraphPublisher(),
    (error) => error.code === "meta_graph_configuration_missing" &&
      error.missingConfiguration.includes("META_PAGE_ACCESS_TOKEN"),
  );
  const publish = createMetaGraphPublisher(configuration({
    async fetchImpl() {
      return response({ error: { code: 190, message: "token detail" } }, { ok: false, status: 401 });
    },
  }));
  await assert.rejects(
    publish({ platform: "facebook", post: post() }),
    (error) => error.code === "meta_graph_190" && error.permanent === true &&
      !error.message.includes("token detail"),
  );
});
