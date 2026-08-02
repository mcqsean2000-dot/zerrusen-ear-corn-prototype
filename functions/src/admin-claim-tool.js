"use strict";

const EXPECTED_PROJECT_ID = "theos-farm-ear-corn";
const EXPECTED_ADMIN_EMAIL = "theosfeedfarm@gmail.com";
const APPLY_CONFIRMATION = `${EXPECTED_PROJECT_ID}:${EXPECTED_ADMIN_EMAIL}`;

function toolError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseAdminClaimArgs(argv = []) {
  const valueOptions = new Set(["--confirm", "--email", "--project", "--uid"]);
  const values = new Map();
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = String(argv[index] || "").trim();
    if (argument === "--apply") {
      if (apply) {
        throw toolError("admin_claim_argument_duplicate", "Duplicate option: --apply");
      }
      apply = true;
      continue;
    }
    if (!valueOptions.has(argument)) {
      const label = argument.startsWith("--") ? "Unsupported option" : "Unexpected argument";
      throw toolError("admin_claim_argument_unknown", `${label}: ${argument}`);
    }
    if (values.has(argument)) {
      throw toolError("admin_claim_argument_duplicate", `Duplicate option: ${argument}`);
    }

    const value = String(argv[index + 1] || "").trim();
    if (!value || value.startsWith("--")) {
      throw toolError("admin_claim_argument_missing", `${argument} requires a value.`);
    }
    values.set(argument, value);
    index += 1;
  }

  const projectId = values.get("--project") || "";
  const uid = values.get("--uid") || "";
  const email = String(values.get("--email") || "").toLowerCase();
  const confirmation = values.get("--confirm") || "";

  if (projectId !== EXPECTED_PROJECT_ID) {
    throw toolError("admin_claim_project_mismatch", `Project must be ${EXPECTED_PROJECT_ID}.`);
  }
  if (email !== EXPECTED_ADMIN_EMAIL) {
    throw toolError("admin_claim_email_mismatch", `Email must be ${EXPECTED_ADMIN_EMAIL}.`);
  }
  if (!uid || uid.length > 128 || /\s/.test(uid)) {
    throw toolError("admin_claim_uid_invalid", "A valid Firebase Auth UID is required.");
  }
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw toolError(
      "admin_claim_confirmation_mismatch",
      `Apply mode requires --confirm ${APPLY_CONFIRMATION}.`,
    );
  }

  return Object.freeze({
    apply,
    email,
    projectId,
    uid,
  });
}

function validateTargetUser(user, plan) {
  const uid = String(user && user.uid || "").trim();
  const email = String(user && user.email || "").trim().toLowerCase();
  if (uid !== plan.uid || email !== plan.email) {
    throw toolError("admin_claim_user_mismatch", "Firebase Auth user does not match the approved UID and email.");
  }
  if (user.emailVerified !== true) {
    throw toolError("admin_claim_email_unverified", "The approved Firebase Auth email must be verified first.");
  }
  return user;
}

function mergedAdminClaims(customClaims) {
  const existing = customClaims && typeof customClaims === "object" && !Array.isArray(customClaims)
    ? customClaims
    : {};
  return {
    ...existing,
    admin: true,
  };
}

function createAdminClaimOperation({ getUser, setCustomUserClaims }) {
  if (typeof getUser !== "function" || typeof setCustomUserClaims !== "function") {
    throw toolError("admin_claim_dependency_missing", "Trusted Firebase Admin Auth dependencies are required.");
  }

  return async function runAdminClaim(plan) {
    const user = validateTargetUser(await getUser(plan.uid), plan);
    const alreadyAdmin = user.customClaims && user.customClaims.admin === true;

    if (!plan.apply) {
      return Object.freeze({
        changed: false,
        status: alreadyAdmin ? "already_admin" : "dry_run_ready",
      });
    }
    if (alreadyAdmin) {
      return Object.freeze({
        changed: false,
        status: "already_admin",
      });
    }

    await setCustomUserClaims(plan.uid, mergedAdminClaims(user.customClaims));
    return Object.freeze({
      changed: true,
      status: "admin_granted",
    });
  };
}

function uidSuffix(uid) {
  const value = String(uid || "");
  return value.slice(-6);
}

module.exports = {
  APPLY_CONFIRMATION,
  EXPECTED_ADMIN_EMAIL,
  EXPECTED_PROJECT_ID,
  createAdminClaimOperation,
  mergedAdminClaims,
  parseAdminClaimArgs,
  uidSuffix,
  validateTargetUser,
};
