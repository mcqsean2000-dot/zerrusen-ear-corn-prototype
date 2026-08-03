import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  EXPECTED_PROJECT_ID,
  validateFirebaseAccountListing,
  validateFirebaseCliVersion,
  validateFirebaseProjectListing,
  validateFirebaseRc,
} from "./firebase-access-config.mjs";

function preflightError(code) {
  const error = new Error("Firebase access preflight could not run.");
  error.code = code;
  return error;
}

function run(command, args, code) {
  try {
    const useCommandShell = process.platform === "win32" && command.endsWith(".cmd");
    const executable = useCommandShell ? (process.env.ComSpec || "cmd.exe") : command;
    const executableArgs = useCommandShell
      ? ["/d", "/c", [command, ...args].join(" ")]
      : args;
    return execFileSync(executable, executableArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    throw preflightError(code);
  }
}

async function main() {
  if (process.argv.length !== 2) {
    throw preflightError("firebase_access_arguments_not_allowed");
  }

  const firebaseCommand = process.platform === "win32" ? "firebase.cmd" : "firebase";
  const gitCommand = process.platform === "win32" ? "git.exe" : "git";
  const cliVersion = validateFirebaseCliVersion(run(firebaseCommand, ["--version"], "firebase_cli_unavailable"));

  // The JSON form of login:list contains OAuth credentials in some CLI versions.
  validateFirebaseAccountListing(run(firebaseCommand, ["login:list"], "firebase_login_check_failed"));
  validateFirebaseProjectListing(run(
    firebaseCommand,
    ["projects:list", "--json"],
    "firebase_project_check_failed",
  ));
  validateFirebaseRc(await readFile(".firebaserc", "utf8").catch(() => {
    throw preflightError("firebaserc_missing");
  }));
  run(gitCommand, ["check-ignore", "--quiet", ".firebaserc"], "firebaserc_not_ignored");

  console.log(JSON.stringify({
    accountVerified: true,
    cliVersion,
    firebasercIgnored: true,
    projectId: EXPECTED_PROJECT_ID,
    projectVisible: true,
    readyForReadOnlyResourceChecks: true,
  }));
}

main().catch((error) => {
  const code = String(error && error.code || "firebase_access_preflight_failed")
    .replace(/[^a-z0-9_/-]/gi, "_");
  console.error(`Firebase access preflight failed (${code}).`);
  process.exitCode = 1;
});
