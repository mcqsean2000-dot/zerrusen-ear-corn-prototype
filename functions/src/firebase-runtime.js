"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const {
  routeRequest,
} = require("./index");

const shippoApiToken = defineSecret("SHIPPO_API_TOKEN");

function runtimeEnv() {
  return {
    ...process.env,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || [
      "https://theosfarm.com",
      "https://www.theosfarm.com",
      "https://theos-farm-ear-corn.web.app",
    ].join(","),
    SHIPPO_API_TOKEN: shippoApiToken.value(),
  };
}

exports.api = onRequest({
  region: "us-central1",
  secrets: [shippoApiToken],
}, (req, res) => {
  return routeRequest(req, res, {
    env: runtimeEnv(),
  });
});
