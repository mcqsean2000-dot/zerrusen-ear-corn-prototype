const EXPECTED_ACCOUNT = "crhags@gmail.com";
const EXPECTED_PROJECT_ID = "theos-farm-ear-corn";
const MINIMUM_FIREBASE_CLI_VERSION = Object.freeze([15, 23, 0]);

function accessError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseVersion(value) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

export function validateFirebaseCliVersion(source) {
  const parsed = parseVersion(source);
  if (!parsed || !versionAtLeast(parsed, MINIMUM_FIREBASE_CLI_VERSION)) {
    throw accessError(
      "firebase_cli_version_unsupported",
      `Firebase CLI must be at least ${MINIMUM_FIREBASE_CLI_VERSION.join(".")}.`,
    );
  }
  return parsed.join(".");
}

export function validateFirebaseAccountListing(source) {
  const emails = String(source || "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  if (!emails.includes(EXPECTED_ACCOUNT)) {
    throw accessError("firebase_account_not_active", `Firebase CLI must be logged in as ${EXPECTED_ACCOUNT}.`);
  }
  return true;
}

export function validateFirebaseProjectListing(source) {
  let payload;
  try {
    payload = JSON.parse(String(source || ""));
  } catch {
    throw accessError("firebase_projects_response_invalid", "Firebase project listing was not valid JSON.");
  }
  if (payload?.status !== "success" || !Array.isArray(payload.result)) {
    throw accessError("firebase_projects_response_invalid", "Firebase project listing did not succeed.");
  }
  const projectIds = payload.result
    .map((project) => String(project?.projectId || project?.project_id || "").trim())
    .filter(Boolean);
  if (!projectIds.includes(EXPECTED_PROJECT_ID)) {
    throw accessError(
      "firebase_project_not_visible",
      `Firebase project ${EXPECTED_PROJECT_ID} is not visible to the active account.`,
    );
  }
  return true;
}

export function validateFirebaseRc(source) {
  let payload;
  try {
    payload = JSON.parse(String(source || ""));
  } catch {
    throw accessError("firebaserc_invalid", ".firebaserc must contain valid JSON.");
  }
  if (payload?.projects?.default !== EXPECTED_PROJECT_ID) {
    throw accessError(
      "firebaserc_project_mismatch",
      `.firebaserc default project must be ${EXPECTED_PROJECT_ID}.`,
    );
  }
  return true;
}

export {
  EXPECTED_ACCOUNT,
  EXPECTED_PROJECT_ID,
  MINIMUM_FIREBASE_CLI_VERSION,
};
