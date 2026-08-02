function environmentError(code, message) {
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
      throw environmentError("env_line_invalid", `Invalid environment entry on line ${index + 1}.`);
    }
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1).trim());
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw environmentError("env_key_invalid", `Invalid environment key on line ${index + 1}.`);
    }
    if (values.has(key)) {
      throw environmentError("env_key_duplicate", `Duplicate environment key: ${key}.`);
    }
    values.set(key, value);
  }

  return values;
}
