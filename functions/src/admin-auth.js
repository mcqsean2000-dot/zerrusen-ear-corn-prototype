"use strict";

function getHeader(req, name) {
  const target = name.toLowerCase();
  const headers = req.headers || {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return "";
}

function authError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getBearerToken(req) {
  const authorization = String(getHeader(req, "authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function normalizeVerifiedAdmin(decodedToken) {
  const uid = String(decodedToken && decodedToken.uid || "").trim();
  const email = String(decodedToken && decodedToken.email || "").trim();
  const isAdmin = decodedToken && decodedToken.admin === true;

  if (!uid || email.length < 3 || email.length > 160 || !isAdmin) {
    throw authError("admin_forbidden", "Admin access requires a Firebase Auth token with the admin custom claim.");
  }

  return {
    email,
    uid,
  };
}

function createFirebaseAdminAuthenticator({ verifyIdToken }) {
  if (typeof verifyIdToken !== "function") {
    throw authError("admin_auth_dependency_missing", "Admin authentication requires a trusted Firebase ID token verifier.");
  }

  return async function authenticateAdminRequest({ req }) {
    const token = getBearerToken(req);
    if (!token) {
      throw authError("admin_auth_required", "Admin access requires a Firebase Auth bearer token.");
    }

    const decodedToken = await verifyIdToken(token);
    return normalizeVerifiedAdmin(decodedToken);
  };
}

module.exports = {
  createFirebaseAdminAuthenticator,
  getBearerToken,
  normalizeVerifiedAdmin,
};
