import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "admin.html",
  "admin.css",
  "admin.js",
  ".firebaserc.example",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "docs/firebase-hosting-readiness.md",
  "docs/firebase-order-foundation.md",
  "docs/admin-fulfillment-foundation.md",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of requiredFiles) {
  await access(file);
}

const firebaseConfig = JSON.parse(await readFile("firebase.json", "utf8"));
const firebaseProjectExample = JSON.parse(await readFile(".firebaserc.example", "utf8"));
const indexes = JSON.parse(await readFile("firestore.indexes.json", "utf8"));
const rules = await readFile("firestore.rules", "utf8");
const storefront = await readFile("index.html", "utf8");
const admin = await readFile("admin.html", "utf8");
const adminScript = await readFile("admin.js", "utf8");
const gitignore = await readFile(".gitignore", "utf8");
const hostingReadiness = await readFile("docs/firebase-hosting-readiness.md", "utf8");

assert(firebaseConfig.hosting?.public === ".", "Firebase Hosting should serve the static repo root.");
assert(firebaseConfig.hosting?.ignore?.includes(".firebaserc"), "Firebase Hosting should ignore local .firebaserc.");
assert(firebaseConfig.hosting?.ignore?.includes("**/.*"), "Firebase Hosting should ignore dotfiles.");
assert(firebaseConfig.hosting?.ignore?.includes("**/*.md"), "Firebase Hosting should not publish Markdown planning docs.");
assert(firebaseConfig.firestore?.rules === "firestore.rules", "Firebase config must point at firestore.rules.");
assert(firebaseConfig.firestore?.indexes === "firestore.indexes.json", "Firebase config must point at firestore.indexes.json.");
assert(
  firebaseProjectExample.projects?.default === "replace-with-your-firebase-project-id",
  ".firebaserc.example must not include a real project ID.",
);
assert(gitignore.includes(".firebaserc"), ".gitignore must keep local .firebaserc out of git.");
assert(gitignore.includes(".firebase/"), ".gitignore must keep Firebase local cache out of git.");
assert(hostingReadiness.includes("firebase emulators:start --only hosting"), "Hosting readiness doc must include local Firebase preview.");
assert(hostingReadiness.includes("firebase hosting:channel:deploy preview"), "Hosting readiness doc must include preview channel deploy.");
assert(hostingReadiness.includes("firebase deploy --only hosting"), "Hosting readiness doc must include hosting deploy command.");
assert(hostingReadiness.includes("Stripe Checkout"), "Hosting readiness doc must preserve Stripe Checkout payment boundary.");
assert(indexes.indexes?.some((index) => index.collectionGroup === "orderRequests"), "Missing orderRequests Firestore index.");
assert(rules.includes("match /orderRequests/{orderRequestId}"), "Firestore rules must define orderRequests access.");
assert(rules.includes("createdAt == request.time"), "Firestore rules should require server request time for createdAt.");
assert(rules.includes("allow create: if hasValidOrderShape();"), "Public order request create rule is missing.");
assert(rules.includes("allow read, update, delete: if isAdmin();"), "Admin-only read/update/delete rule is missing.");
assert(!storefront.toLowerCase().includes("local pickup"), "Storefront must not reintroduce local pickup.");
assert(storefront.includes("data-order-form"), "Storefront purchase request form is missing.");
assert(admin.includes("admin.js"), "Admin shell must load admin.js.");
assert(adminScript.includes("sampleOrders"), "Admin shell should use sample data only in this slice.");
assert(!adminScript.toLowerCase().includes("firebase"), "Admin shell must not connect to Firebase yet.");

console.log("Static prototype checks passed.");
