const EXPECTED_GRAPH_API_VERSION = "v26.0";
const DISABLED_FLAGS = Object.freeze([
  "SOCIAL_PUBLISHING_ENABLED",
  "SOCIAL_RECONCILIATION_ENABLED",
]);
const SECRET_KEYS = Object.freeze([
  "META_PAGE_ACCESS_TOKEN",
  "META_FACEBOOK_PAGE_ID",
  "META_INSTAGRAM_ACCOUNT_ID",
]);

function activationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function validateDisabledSocialConfig(values) {
  if (!(values instanceof Map)) {
    throw activationError("social_env_invalid", "Parsed social environment values are required.");
  }

  for (const key of SECRET_KEYS) {
    if (values.has(key)) {
      throw activationError(
        "social_secret_in_environment",
        `${key} must be stored in Firebase Secret Manager, not the environment file.`,
      );
    }
  }

  if (values.get("META_GRAPH_API_VERSION") !== EXPECTED_GRAPH_API_VERSION) {
    throw activationError(
      "social_graph_version_mismatch",
      `META_GRAPH_API_VERSION must be exactly ${EXPECTED_GRAPH_API_VERSION}.`,
    );
  }

  for (const flag of DISABLED_FLAGS) {
    if (values.get(flag) !== "false") {
      throw activationError("social_flag_not_disabled", `${flag} must be exactly false.`);
    }
  }

  return Object.freeze({
    flagsDisabled: true,
    graphApiVersion: EXPECTED_GRAPH_API_VERSION,
  });
}

export {
  DISABLED_FLAGS,
  EXPECTED_GRAPH_API_VERSION,
  SECRET_KEYS,
};
