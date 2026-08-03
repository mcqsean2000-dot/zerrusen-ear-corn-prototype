import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateFirebaseAccountListing,
  validateFirebaseCliVersion,
  validateFirebaseProjectListing,
  validateFirebaseRc,
} from "./firebase-access-config.mjs";

test("accepts supported Firebase CLI versions", () => {
  assert.equal(validateFirebaseCliVersion("15.23.0\n"), "15.23.0");
  assert.equal(validateFirebaseCliVersion("16.0.1"), "16.0.1");
  assert.throws(() => validateFirebaseCliVersion("15.22.9"), /at least 15\.23\.0/);
  assert.throws(() => validateFirebaseCliVersion("not-a-version"), /at least 15\.23\.0/);
});

test("requires the approved Firebase account in plain login output", () => {
  assert.equal(validateFirebaseAccountListing("Logged in as crhags@gmail.com"), true);
  assert.throws(() => validateFirebaseAccountListing("Logged in as other@example.com"), /crhags@gmail\.com/);
});

test("requires the approved project in a successful project listing", () => {
  assert.equal(validateFirebaseProjectListing(JSON.stringify({
    status: "success",
    result: [{ projectId: "theos-farm-ear-corn", displayName: "Theo's Farm" }],
  })), true);
  assert.throws(
    () => validateFirebaseProjectListing(JSON.stringify({ status: "success", result: [] })),
    /not visible/,
  );
  assert.throws(() => validateFirebaseProjectListing("not-json"), /valid JSON/);
});

test("requires the ignored local Firebase target to use the production project", () => {
  assert.equal(validateFirebaseRc(JSON.stringify({
    projects: { default: "theos-farm-ear-corn" },
  })), true);
  assert.throws(
    () => validateFirebaseRc(JSON.stringify({ projects: { default: "wrong-project" } })),
    /default project must be/,
  );
  assert.throws(() => validateFirebaseRc("not-json"), /valid JSON/);
});

test("access preflight never requests JSON login credentials or echoes raw output", async () => {
  const source = await readFile(new URL("./check-firebase-access.mjs", import.meta.url), "utf8");
  assert.match(source, /\["login:list"\]/);
  assert.doesNotMatch(source, /\["login:list",\s*"--json"\]/);
  assert.match(source, /stdio:\s*\["ignore",\s*"pipe",\s*"pipe"\]/);
  assert.doesNotMatch(source, /console\.log\([^)]*run\(/);
});
