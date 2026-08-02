import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnvironmentSource } from "./environment-config.mjs";
import { validateDisabledSocialConfig } from "./social-activation-config.mjs";

function preflightError(code) {
  const error = new Error("Social activation preflight could not run.");
  error.code = code;
  return error;
}

async function main() {
  if (process.argv.length !== 3) {
    throw preflightError("social_env_path_required");
  }

  const functionsRoot = path.resolve("functions");
  const target = path.resolve(process.argv[2]);
  const relative = path.relative(functionsRoot, target);
  const name = path.basename(target);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !/^\.env\.[a-z0-9-]+$/i.test(name) ||
    name === ".env.example"
  ) {
    throw preflightError("social_env_path_invalid");
  }

  const result = validateDisabledSocialConfig(
    parseEnvironmentSource(await readFile(target, "utf8")),
  );
  console.log(JSON.stringify({
    flagsDisabled: result.flagsDisabled,
    graphApiVersion: result.graphApiVersion,
    readyForDisabledDeployReview: true,
  }));
}

main().catch((error) => {
  const code = String(error && error.code || "social_activation_preflight_failed")
    .replace(/[^a-z0-9_/-]/gi, "_");
  console.error(`Social activation preflight failed (${code}).`);
  process.exitCode = 1;
});
