const EXPECTED_BUSINESS_EMAIL = "theosfeedfarm@gmail.com";
const EXPECTED_SENDING_DOMAIN = "theosfarm.com";
const DISABLED_FLAGS = Object.freeze([
  "DAILY_FULFILLMENT_SUMMARY_ENABLED",
  "NOTIFICATION_DELIVERY_ENABLED",
  "NOTIFICATION_RECONCILIATION_ENABLED",
]);

function activationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function unquote(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseEnvironmentSource(source) {
  const values = new Map();
  const lines = String(source || "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw activationError("notification_env_line_invalid", `Invalid environment entry on line ${index + 1}.`);
    }
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1).trim());
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw activationError("notification_env_key_invalid", `Invalid environment key on line ${index + 1}.`);
    }
    if (values.has(key)) {
      throw activationError("notification_env_key_duplicate", `Duplicate environment key: ${key}.`);
    }
    values.set(key, value);
  }

  return values;
}

function normalizedEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  const displayMatch = text.match(/<([^<>]+)>$/);
  const email = displayMatch ? displayMatch[1].trim() : text;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function isExpectedSendingDomain(domain) {
  return domain === EXPECTED_SENDING_DOMAIN || domain.endsWith(`.${EXPECTED_SENDING_DOMAIN}`);
}

export function validateDisabledNotificationConfig(values) {
  if (!(values instanceof Map)) {
    throw activationError("notification_env_invalid", "Parsed notification environment values are required.");
  }
  if (values.has("RESEND_API_KEY")) {
    throw activationError(
      "notification_secret_in_environment",
      "RESEND_API_KEY must be stored in Firebase Secret Manager, not the environment file.",
    );
  }

  for (const flag of DISABLED_FLAGS) {
    if (values.get(flag) !== "false") {
      throw activationError("notification_flag_not_disabled", `${flag} must be exactly false.`);
    }
  }

  const adminEmail = normalizedEmail(values.get("NOTIFICATION_ADMIN_EMAIL"));
  const replyTo = normalizedEmail(values.get("NOTIFICATION_REPLY_TO"));
  const sender = normalizedEmail(values.get("NOTIFICATION_FROM_EMAIL"));
  if (adminEmail !== EXPECTED_BUSINESS_EMAIL) {
    throw activationError("notification_admin_email_mismatch", `NOTIFICATION_ADMIN_EMAIL must be ${EXPECTED_BUSINESS_EMAIL}.`);
  }
  if (replyTo !== EXPECTED_BUSINESS_EMAIL) {
    throw activationError("notification_reply_to_mismatch", `NOTIFICATION_REPLY_TO must be ${EXPECTED_BUSINESS_EMAIL}.`);
  }
  if (!sender) {
    throw activationError("notification_sender_invalid", "NOTIFICATION_FROM_EMAIL must contain a valid address.");
  }

  const senderDomain = sender.split("@")[1];
  if (!isExpectedSendingDomain(senderDomain)) {
    throw activationError(
      "notification_sender_domain_mismatch",
      `NOTIFICATION_FROM_EMAIL must use ${EXPECTED_SENDING_DOMAIN} or its verified subdomain.`,
    );
  }

  return Object.freeze({
    adminEmail,
    flagsDisabled: true,
    replyTo,
    senderDomain,
  });
}

export {
  DISABLED_FLAGS,
  EXPECTED_BUSINESS_EMAIL,
  EXPECTED_SENDING_DOMAIN,
};
