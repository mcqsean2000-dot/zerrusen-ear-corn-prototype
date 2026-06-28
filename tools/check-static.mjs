import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const orderRequests = require("../order-request.js");

const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "order-request.js",
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
  "docs/stripe-checkout-handoff.md",
  "docs/backend-checkout-scaffold.md",
  "functions/.env.example",
  "functions/package.json",
  "functions/src/index.js",
  "functions/src/index.test.js",
  "functions/src/order-validation.js",
  "functions/src/order-validation.test.js",
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
const storefrontScript = await readFile("script.js", "utf8");
const orderRequestScript = await readFile("order-request.js", "utf8");
const admin = await readFile("admin.html", "utf8");
const adminScript = await readFile("admin.js", "utf8");
const gitignore = await readFile(".gitignore", "utf8");
const hostingReadiness = await readFile("docs/firebase-hosting-readiness.md", "utf8");
const stripeHandoff = await readFile("docs/stripe-checkout-handoff.md", "utf8");
const backendScaffold = await readFile("docs/backend-checkout-scaffold.md", "utf8");
const functionsPackage = JSON.parse(await readFile("functions/package.json", "utf8"));
const functionsEnvExample = await readFile("functions/.env.example", "utf8");
const functionsIndex = await readFile("functions/src/index.js", "utf8");
const functionsValidation = await readFile("functions/src/order-validation.js", "utf8");

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
assert(gitignore.includes("!**/.env.example"), ".gitignore must allow safe example env files.");
assert(hostingReadiness.includes("firebase emulators:start --only hosting"), "Hosting readiness doc must include local Firebase preview.");
assert(hostingReadiness.includes("firebase hosting:channel:deploy preview"), "Hosting readiness doc must include preview channel deploy.");
assert(hostingReadiness.includes("firebase deploy --only hosting"), "Hosting readiness doc must include hosting deploy command.");
assert(hostingReadiness.includes("Stripe Checkout"), "Hosting readiness doc must preserve Stripe Checkout payment boundary.");
assert(stripeHandoff.includes("POST /api/checkout-sessions"), "Stripe handoff must document checkout session endpoint.");
assert(stripeHandoff.includes("POST /api/stripe/webhook"), "Stripe handoff must document webhook endpoint.");
assert(backendScaffold.includes("checkoutSessionsHandler"), "Backend scaffold doc must name the checkout session handler.");
assert(backendScaffold.includes("stripeWebhookHandler"), "Backend scaffold doc must name the Stripe webhook handler.");
assert(functionsPackage.scripts?.check?.includes("node --test"), "Backend package must include a local test check.");
assert(functionsIndex.includes("checkoutSessionsHandler"), "Backend scaffold must export checkout session handling.");
assert(functionsIndex.includes("stripeWebhookHandler"), "Backend scaffold must export Stripe webhook handling.");
assert(functionsIndex.includes("CORS_ALLOWED_ORIGINS"), "Backend scaffold must include configurable CORS origin handling.");
assert(functionsValidation.includes("validateOrderRequestDraft"), "Backend scaffold must include order request validation helpers.");
assert(functionsValidation.includes("FIRESTORE_SERVER_TIMESTAMP_REQUIRED"), "Backend scaffold must preserve Firestore server timestamp boundary.");
assert(!functionsEnvExample.includes("sk_live_"), "Example backend env file must not include live Stripe secret keys.");
assert(!functionsEnvExample.includes("whsec_"), "Example backend env file must not include webhook signing secret-looking values.");
assert(!functionsEnvExample.includes("https://example.com"), "Example backend env URLs should remain obvious placeholders.");
assert(!functionsEnvExample.includes("-----BEGIN PRIVATE KEY-----"), "Example backend env file must not include service account private keys.");
assert(indexes.indexes?.some((index) => index.collectionGroup === "orderRequests"), "Missing orderRequests Firestore index.");
assert(rules.includes("match /orderRequests/{orderRequestId}"), "Firestore rules must define orderRequests access.");
assert(rules.includes("createdAt == request.time"), "Firestore rules should require server request time for createdAt.");
assert(rules.includes("allow create: if hasValidOrderShape();"), "Public order request create rule is missing.");
assert(rules.includes("allow read, update, delete: if isAdmin();"), "Admin-only read/update/delete rule is missing.");
assert(!storefront.toLowerCase().includes("local pickup"), "Storefront must not reintroduce local pickup.");
assert(storefront.includes("data-order-form"), "Storefront purchase request form is missing.");
assert(storefront.includes("order-request.js"), "Storefront must load the order request integration layer.");
assert(
  storefront.indexOf("order-request.js") < storefront.indexOf("script.js"),
  "Order request integration must load before storefront behavior.",
);
assert(storefront.includes('data-sku="ear-corn-20lb"'), "20 lb product must expose a stable order SKU.");
assert(storefront.includes('data-sku="ear-corn-40lb"'), "40 lb product must expose a stable order SKU.");
assert(storefrontScript.includes("buildOrderRequest"), "Storefront submit should use the order request builder.");
assert(
  !storefrontScript.toLowerCase().includes("firebase") && !orderRequestScript.toLowerCase().includes("firebase"),
  "Storefront order request layer must not perform live Firebase writes in this slice.",
);
assert(
  !storefrontScript.includes("card") && !orderRequestScript.includes("card"),
  "Storefront must not collect or handle raw card details.",
);
assert(admin.includes("admin.js"), "Admin shell must load admin.js.");
assert(adminScript.includes("sampleOrders"), "Admin shell should use sample data only in this slice.");
assert(!adminScript.toLowerCase().includes("firebase"), "Admin shell must not connect to Firebase yet.");

const validOrderRequest = orderRequests.buildOrderRequest({
  cart: [
    { sku: "ear-corn-20lb", quantity: 2 },
    { sku: "ear-corn-40lb", quantity: 1 },
  ],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    shippingZip: "62401",
    preferredContact: "Email",
    note: "Leave near the side door.",
  },
});

assert(validOrderRequest.ok, "Valid storefront order request should build successfully.");
assert(validOrderRequest.payload.source === "static-storefront", "Order request source should match Firestore rules.");
assert(validOrderRequest.payload.status === "needs_review", "Order request should start in needs_review status.");
assert(!("createdAt" in validOrderRequest.payload), "Static order request draft must not fake a Firestore server timestamp.");
assert(validOrderRequest.firestoreWrite.collection === "orderRequests", "Order request should identify the Firestore collection for the backend.");
assert(validOrderRequest.firestoreWrite.createdAt === "server_timestamp_required", "Order request should require backend server timestamp handling.");
assert(validOrderRequest.firestoreWrite.trustedWriterRequired, "Order request should require a trusted writer before Firestore submission.");
assert(validOrderRequest.payload.subtotalCents === 6000, "Order request subtotal should be calculated in cents.");
assert(validOrderRequest.payload.items[0].sku === "ear-corn-20lb", "Order request should include the 20 lb SKU.");
assert(validOrderRequest.payload.items[1].sku === "ear-corn-40lb", "Order request should include the 40 lb SKU.");
assert(validOrderRequest.payload.customer.preferredContact === "email", "Order request should normalize preferred contact.");
assert(validOrderRequest.handoff.mode === "backend_required", "Stripe Checkout handoff should require a trusted backend.");
assert(!("stripeCheckoutSessionId" in validOrderRequest.payload), "Public order request must not include Stripe Checkout IDs.");
assert(!("stripePaymentIntentId" in validOrderRequest.payload), "Public order request must not include Stripe payment intent IDs.");

const invalidZip = orderRequests.buildOrderRequest({
  cart: [{ sku: "ear-corn-20lb", quantity: 1 }],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    shippingZip: "bad",
    preferredContact: "Email",
  },
});

assert(!invalidZip.ok, "Invalid ZIP should fail order request validation.");

const unknownProduct = orderRequests.buildOrderRequest({
  cart: [{ sku: "unknown", quantity: 1 }],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    shippingZip: "62401",
    preferredContact: "Email",
  },
});

assert(!unknownProduct.ok, "Unknown products should fail order request validation.");

const overlongNote = orderRequests.buildOrderRequest({
  cart: [{ sku: "ear-corn-20lb", quantity: 1 }],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    shippingZip: "62401",
    preferredContact: "Email",
    note: "x".repeat(1001),
  },
});

assert(!overlongNote.ok, "Overlong notes should fail order request validation.");

const tooManyCartLines = orderRequests.buildOrderRequest({
  cart: [
    { sku: "ear-corn-20lb", quantity: 1 },
    { sku: "ear-corn-40lb", quantity: 1 },
    { sku: "ear-corn-20lb", quantity: 1 },
  ],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    shippingZip: "62401",
    preferredContact: "Email",
  },
});

assert(!tooManyCartLines.ok, "More than two cart lines should fail order request validation.");

console.log("Static prototype checks passed.");
