import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateTestCommerceConfig } from "./commerce-activation-config.mjs";
import { parseEnvironmentSource } from "./environment-config.mjs";

function preflightError(code) {
  const error = new Error("Commerce activation preflight could not run.");
  error.code = code;
  return error;
}

async function main() {
  if (process.argv.length !== 3) {
    throw preflightError("commerce_env_path_required");
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
    throw preflightError("commerce_env_path_invalid");
  }

  const result = validateTestCommerceConfig(
    parseEnvironmentSource(await readFile(target, "utf8")),
  );
  console.log(JSON.stringify({
    currency: result.currency,
    flagsDisabled: result.flagsDisabled,
    orderCollection: result.orderCollection,
    origins: result.origins,
    projectId: result.projectId,
    readyForTestDeployReview: true,
    senderRegion: result.senderRegion,
  }));
}

main().catch((error) => {
  const code = String(error && error.code || "commerce_activation_preflight_failed")
    .replace(/[^a-z0-9_/-]/gi, "_");
  console.error(`Commerce activation preflight failed (${code}).`);
  process.exitCode = 1;
});
