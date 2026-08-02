"use strict";

const { applicationDefault, deleteApp, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  createAdminClaimOperation,
  parseAdminClaimArgs,
  uidSuffix,
} = require("../src/admin-claim-tool");

async function main() {
  const plan = parseAdminClaimArgs(process.argv.slice(2));
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: plan.projectId,
  }, "theos-farm-admin-claim-tool");

  try {
    const auth = getAuth(app);
    const runAdminClaim = createAdminClaimOperation({
      getUser: (uid) => auth.getUser(uid),
      setCustomUserClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),
    });
    const result = await runAdminClaim(plan);
    console.log(JSON.stringify({
      apply: plan.apply,
      email: plan.email,
      projectId: plan.projectId,
      status: result.status,
      uidSuffix: uidSuffix(plan.uid),
    }));
  } finally {
    await deleteApp(app);
  }
}

main().catch((error) => {
  const code = String(error && error.code || "admin_claim_failed").replace(/[^a-z0-9_/-]/gi, "_");
  console.error(`Admin claim operation failed (${code}).`);
  process.exitCode = 1;
});
