import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasExactDisabledFlag(source, name) {
  return new RegExp(`^${name}=false$`, "m").test(source);
}

const [
  envExample,
  firebaseConfigSource,
  functionsRuntime,
  gitignore,
  indexSource,
  runbook,
] = await Promise.all([
  readFile("functions/.env.example", "utf8"),
  readFile("firebase.json", "utf8"),
  readFile("functions/src/firebase-runtime.js", "utf8"),
  readFile(".gitignore", "utf8"),
  readFile("firestore.indexes.json", "utf8"),
  readFile("docs/notification-production-activation.md", "utf8"),
]);

const firebaseConfig = JSON.parse(firebaseConfigSource);
const indexes = JSON.parse(indexSource);

for (const flag of [
  "DAILY_FULFILLMENT_SUMMARY_ENABLED",
  "NOTIFICATION_DELIVERY_ENABLED",
  "NOTIFICATION_RECONCILIATION_ENABLED",
]) {
  assert(hasExactDisabledFlag(envExample, flag), `${flag} must default to false in functions/.env.example.`);
}

assert(
  !/^RESEND_API_KEY=/m.test(envExample),
  "RESEND_API_KEY must be stored in Firebase Secret Manager, not the environment example.",
);
assert(gitignore.includes(".env.*"), "Project-specific Firebase environment files must stay ignored.");
assert(firebaseConfig.functions?.runtime === "nodejs22", "Firebase Functions must use the reviewed Node.js 22 runtime.");
assert(
  firebaseConfig.firestore?.indexes === "firestore.indexes.json",
  "Firebase deploy config must include the reviewed Firestore index file.",
);

for (const sourceText of [
  'defineSecret("RESEND_API_KEY")',
  "dailyFulfillmentSummary",
  "notificationOutboxDelivery",
  "notificationOutboxReconciliation",
]) {
  assert(functionsRuntime.includes(sourceText), `Firebase runtime is missing notification release boundary: ${sourceText}`);
}

const dailySummaryBlock = functionsRuntime.slice(
  functionsRuntime.indexOf("const dailyFulfillmentSummary"),
  functionsRuntime.indexOf("const notificationOutboxDelivery"),
);
const deliveryBlock = functionsRuntime.slice(
  functionsRuntime.indexOf("const notificationOutboxDelivery"),
  functionsRuntime.indexOf("const notificationOutboxReconciliation"),
);
const reconciliationBlock = functionsRuntime.slice(
  functionsRuntime.indexOf("const notificationOutboxReconciliation"),
  functionsRuntime.indexOf("module.exports"),
);
assert(!dailySummaryBlock.includes("secrets:"), "Daily summary must not receive the Resend secret.");
assert(deliveryBlock.includes("secrets: [resendApiKey]"), "Outbox delivery must bind RESEND_API_KEY.");
assert(reconciliationBlock.includes("secrets: [resendApiKey]"), "Outbox reconciliation must bind RESEND_API_KEY.");

const hasLeaseIndex = indexes.indexes?.some((index) => (
  index.collectionGroup === "notificationOutbox" &&
  index.queryScope === "COLLECTION" &&
  index.fields?.some((field) => field.fieldPath === "status" && field.order === "ASCENDING") &&
  index.fields?.some((field) => field.fieldPath === "lastAttemptAt" && field.order === "ASCENDING")
));
assert(hasLeaseIndex, "Firestore indexes must include notification processing-lease recovery.");

const activationSteps = [
  "Keep all three enable flags false",
  "functions/.env.<project-id>",
  "npm run notification:preflight",
  "Do not use it as `NOTIFICATION_FROM_EMAIL`",
  "firebase functions:secrets:set RESEND_API_KEY",
  "firebase deploy --only firestore:indexes",
  "firebase deploy --only functions",
  "Enable `NOTIFICATION_DELIVERY_ENABLED` first",
  "Enable `NOTIFICATION_RECONCILIATION_ENABLED`",
  "Enable `DAILY_FULFILLMENT_SUMMARY_ENABLED`",
];
for (const step of activationSteps) {
  assert(runbook.includes(step), `Notification activation runbook is missing: ${step}`);
}

console.log("Notification release guard passed.");
console.log("Repository defaults remain disabled; this check does not inspect or deploy production secrets.");
