import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseEnvironmentSource } from "./environment-config.mjs";
import { validateDisabledSocialConfig } from "./social-activation-config.mjs";

const validSource = `
META_GRAPH_API_VERSION=v26.0
SOCIAL_PUBLISHING_ENABLED=false
SOCIAL_RECONCILIATION_ENABLED=false
`;

test("accepts the approved Graph version with both social gates disabled", () => {
  assert.deepEqual(validateDisabledSocialConfig(parseEnvironmentSource(validSource)), {
    flagsDisabled: true,
    graphApiVersion: "v26.0",
  });
});

test("keeps the committed environment example safe for disabled deployment", async () => {
  const source = await readFile(new URL("../functions/.env.example", import.meta.url), "utf8");
  assert.equal(validateDisabledSocialConfig(parseEnvironmentSource(source)).flagsDisabled, true);
});

test("rejects missing, placeholder, and mismatched Graph versions", () => {
  for (const version of ["", "vXX.X", "v25.0"]) {
    assert.throws(
      () => validateDisabledSocialConfig(parseEnvironmentSource(
        validSource.replace("META_GRAPH_API_VERSION=v26.0", `META_GRAPH_API_VERSION=${version}`),
      )),
      /META_GRAPH_API_VERSION must be exactly v26\.0/,
    );
  }
});

test("rejects either social gate unless it is exactly false", () => {
  for (const flag of ["SOCIAL_PUBLISHING_ENABLED", "SOCIAL_RECONCILIATION_ENABLED"]) {
    assert.throws(
      () => validateDisabledSocialConfig(parseEnvironmentSource(
        validSource.replace(`${flag}=false`, `${flag}=true`),
      )),
      new RegExp(`${flag} must be exactly false`),
    );
  }
});

test("rejects Meta tokens and IDs in environment config", () => {
  for (const key of [
    "META_PAGE_ACCESS_TOKEN",
    "META_FACEBOOK_PAGE_ID",
    "META_INSTAGRAM_ACCOUNT_ID",
  ]) {
    assert.throws(
      () => validateDisabledSocialConfig(parseEnvironmentSource(`${validSource}\n${key}=not-a-real-secret`)),
      /Firebase Secret Manager/,
    );
  }
});
