"use strict";

const MAX_EVENT_LENGTH = 100;
const MAX_METADATA_DEPTH = 3;
const MAX_METADATA_KEYS = 20;
const MAX_STRING_LENGTH = 200;
const SENSITIVE_KEY_PATTERN = /(address|authorization|body|contact|cookie|customer|email|header|key|message|name|password|payload|secret|signature|token)/i;
const SECRET_VALUE_PATTERN = /(bearer\s+[a-z0-9._-]+|sk_(?:live|test)_[a-z0-9]+|whsec_[a-z0-9]+|ya29\.[a-z0-9._-]+)/i;

function cleanIdentifier(value, fallback, maxLength = MAX_EVENT_LENGTH) {
  const source = String(value || "").trim();
  if (SECRET_VALUE_PATTERN.test(source)) return fallback;
  const cleaned = source
    .replace(/[^A-Za-z0-9_.:-]+/g, "_")
    .slice(0, maxLength);
  return cleaned || fallback;
}

function sanitizeString(value) {
  const text = String(value || "").trim().slice(0, MAX_STRING_LENGTH);
  return SECRET_VALUE_PATTERN.test(text) ? "[redacted]" : text;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > MAX_METADATA_DEPTH || value === undefined) return undefined;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_KEYS)
      .map((item) => sanitizeMetadata(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return undefined;

  const safe = {};
  for (const [key, fieldValue] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    const sanitized = sanitizeMetadata(fieldValue, depth + 1);
    if (sanitized !== undefined) safe[cleanIdentifier(key, "field", 60)] = sanitized;
  }
  return safe;
}

function errorDetails(error) {
  return {
    errorCode: cleanIdentifier(error && error.code, "unknown", 80),
    errorName: cleanIdentifier(error && error.name, "Error", 80),
    ...(typeof (error && error.retryable) === "boolean" ? { retryable: error.retryable } : {}),
  };
}

function createReportableError(event, details) {
  const error = new Error(`${event} (${details.errorCode})`);
  error.name = details.errorName;
  return error;
}

function createSanitizedOperationalError(eventName, error) {
  const event = cleanIdentifier(eventName, "operational_error");
  return createReportableError(event, errorDetails(error));
}

function defaultErrorSink(event, _reportableError, details) {
  console.error(event, details);
}

function defaultInfoSink(event, details) {
  console.info(event, details);
}

function createOperationalLogger({
  writeError = defaultErrorSink,
  writeInfo = defaultInfoSink,
} = {}) {
  return {
    error(eventName, error, metadata = {}) {
      const event = cleanIdentifier(eventName, "operational_error");
      const details = {
        event,
        ...errorDetails(error),
        ...sanitizeMetadata(metadata),
      };
      const reportableError = createReportableError(event, details);
      try {
        writeError(event, reportableError, details);
      } catch {
        defaultErrorSink("operational_logging_failed", new Error("operational_logging_failed"), {
          event: "operational_logging_failed",
          failedEvent: event,
        });
      }
      return details;
    },

    info(eventName, metadata = {}) {
      const event = cleanIdentifier(eventName, "operational_info");
      const details = {
        event,
        ...sanitizeMetadata(metadata),
      };
      try {
        writeInfo(event, details);
      } catch {
        defaultErrorSink("operational_logging_failed", new Error("operational_logging_failed"), {
          event: "operational_logging_failed",
          failedEvent: event,
        });
      }
      return details;
    },
  };
}

const defaultLogger = createOperationalLogger();

function reportOperationalError(options, event, error, metadata) {
  const logger = options && options.logger;
  if (logger && typeof logger.error === "function") {
    return logger.error(event, error, metadata);
  }
  return defaultLogger.error(event, error, metadata);
}

module.exports = {
  createOperationalLogger,
  createSanitizedOperationalError,
  reportOperationalError,
  sanitizeMetadata,
};
