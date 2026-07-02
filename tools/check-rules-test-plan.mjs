import { readFile } from "node:fs/promises";

const plan = await readFile("docs/admin-emulator-test-plan.md", "utf8");
const rules = await readFile("firestore.rules", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesAll(source, values, label) {
  for (const value of values) {
    assert(source.includes(value), `${label} is missing: ${value}`);
  }
}

const backendOnlyFields = [
  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "stripeCustomerId",
  "paymentStatus",
  "paidAt",
  "refundedAt",
  "refundId",
];

includesAll(plan, [
  "planning only",
  "npm run test:rules",
  "no deploy",
  "no live Firebase project",
  "no secrets",
  "Public customers can create valid `orderRequests` documents.",
  "Authenticated admins with `admin: true` can read orders.",
  "Authenticated admin updates are constrained to `status`, `audit`, and `internalNotes`.",
  "Authenticated admins cannot write backend-only payment or Stripe fields.",
  "Authenticated admins cannot delete orders.",
], "Admin emulator test plan");

includesAll(plan, backendOnlyFields, "Admin emulator test plan backend-only field coverage");

includesAll(rules, [
  "function isAdmin()",
  "request.auth.token.admin == true",
  "function hasValidOrderShape()",
  "function hasValidAdminOrderUpdate()",
  "match /orderRequests/{orderRequestId}",
  "allow create: if hasValidOrderShape();",
  "allow read: if isAdmin();",
  "allow update: if hasValidAdminOrderUpdate();",
  "allow delete: if false;",
  "createdAt == request.time",
  "request.resource.data.audit.updatedAt == request.time",
  "request.resource.data.audit.updatedByUid == request.auth.uid",
], "Firestore rules boundary");

const orderRequestRulesBlock = rules.match(/match \/orderRequests\/\{orderRequestId\} \{[\s\S]*?\n    \}/)?.[0] || "";
assert(orderRequestRulesBlock, "Could not inspect orderRequests Firestore rule block.");
assert(
  !/allow\s+(read,\s*)?update(,\s*delete)?\s*:\s*if\s+isAdmin\(\);/.test(orderRequestRulesBlock),
  "Admin order updates must not use a broad isAdmin grant.",
);
assert(
  !/allow\s+(write|read,\s*write)\s*:\s*if\s+isAdmin\(\);/.test(orderRequestRulesBlock),
  "Admin order writes must not use a broad isAdmin grant.",
);

assert(
  /hasOnlyAdminEditableOrderChanges\(\)[\s\S]*?hasOnly\(\[\s*'audit',\s*'internalNotes',\s*'status'\s*\]\);/.test(rules),
  "Admin order updates must stay limited to status, audit, and internalNotes.",
);
assert(
  /hasValidAdminStatusChange\(\)[\s\S]*?'needs_review'[\s\S]*?'packed'[\s\S]*?'ready_to_pack'/.test(rules),
  "Admin status updates must stay limited to the initial fulfillment statuses.",
);

for (const field of backendOnlyFields) {
  assert(
    !new RegExp(`hasOnlyAdminEditableOrderChanges\\(\\)[\\s\\S]*?${field}`).test(rules),
    `Admin-client editable fields must not include backend-only field: ${field}`,
  );
}

console.log("Rules test command scaffold passed.");
console.log("Executable Firebase emulator rule tests are not implemented yet.");
console.log("This offline check validates the documented rules-test plan and current Firestore rule boundary references.");
