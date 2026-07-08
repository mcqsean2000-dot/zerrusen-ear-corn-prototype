import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createContext, Script } from "node:vm";

const require = createRequire(import.meta.url);
const orderRequests = require("../order-request.js");

const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "order-request.js",
  "checkout-config.js",
  "admin.html",
  "admin.css",
  "admin-config.js",
  "admin.js",
  "admin-live.js",
  "robots.txt",
  "sitemap.xml",
  "_config.yml",
  ".firebaserc.example",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "docs/firebase-hosting-readiness.md",
  "docs/firebase-order-foundation.md",
  "docs/admin-fulfillment-foundation.md",
  "docs/stripe-checkout-handoff.md",
  "docs/backend-checkout-scaffold.md",
  "docs/shippo-shipping-plan.md",
  "docs/godaddy-static-deploy.md",
  "tools/package-static.mjs",
  "tools/smoke-static-package.mjs",
  "functions/.env.example",
  "functions/package.json",
  "functions/src/index.js",
  "functions/src/admin-auth.js",
  "functions/src/firebase-runtime.js",
  "functions/src/index.test.js",
  "functions/src/admin-auth.test.js",
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
const robots = await readFile("robots.txt", "utf8");
const sitemap = await readFile("sitemap.xml", "utf8");
const jekyllConfig = await readFile("_config.yml", "utf8");
const storefrontScript = await readFile("script.js", "utf8");
const orderRequestScript = await readFile("order-request.js", "utf8");
const checkoutConfigScript = await readFile("checkout-config.js", "utf8");
const admin = await readFile("admin.html", "utf8");
const adminConfigScript = await readFile("admin-config.js", "utf8");
const adminScript = await readFile("admin.js", "utf8");
const adminLiveScript = await readFile("admin-live.js", "utf8");
const gitignore = await readFile(".gitignore", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const hostingReadiness = await readFile("docs/firebase-hosting-readiness.md", "utf8");
const stripeHandoff = await readFile("docs/stripe-checkout-handoff.md", "utf8");
const backendScaffold = await readFile("docs/backend-checkout-scaffold.md", "utf8");
const adminFulfillment = await readFile("docs/admin-fulfillment-foundation.md", "utf8");
const shippoPlan = await readFile("docs/shippo-shipping-plan.md", "utf8");
const godaddyDeploy = await readFile("docs/godaddy-static-deploy.md", "utf8");
const packageStaticScript = await readFile("tools/package-static.mjs", "utf8");
const smokeStaticPackageScript = await readFile("tools/smoke-static-package.mjs", "utf8");
const functionsPackage = JSON.parse(await readFile("functions/package.json", "utf8"));
const functionsEnvExample = await readFile("functions/.env.example", "utf8");
const functionsIndex = await readFile("functions/src/index.js", "utf8");
const functionsAdminAuth = await readFile("functions/src/admin-auth.js", "utf8");
const functionsRuntime = await readFile("functions/src/firebase-runtime.js", "utf8");
const functionsValidation = await readFile("functions/src/order-validation.js", "utf8");

assert(firebaseConfig.hosting?.public === ".", "Firebase Hosting should serve the static repo root.");
assert(firebaseConfig.hosting?.ignore?.includes(".firebaserc"), "Firebase Hosting should ignore local .firebaserc.");
assert(firebaseConfig.hosting?.ignore?.includes("**/.*"), "Firebase Hosting should ignore dotfiles.");
assert(firebaseConfig.hosting?.ignore?.includes("**/*.md"), "Firebase Hosting should not publish Markdown planning docs.");
assert(firebaseConfig.hosting?.ignore?.includes("docs/**"), "Firebase Hosting should not publish planning docs.");
assert(firebaseConfig.hosting?.ignore?.includes("functions/**"), "Firebase Hosting should not publish backend function source.");
assert(firebaseConfig.hosting?.ignore?.includes("admin.html"), "Firebase Hosting should not publish the unauthenticated admin prototype.");
assert(firebaseConfig.hosting?.ignore?.includes("admin-config.js"), "Firebase Hosting should not publish admin config before admin launch.");
assert(firebaseConfig.hosting?.ignore?.includes("admin-live.js"), "Firebase Hosting should not publish admin live bridge before admin launch.");
assert(firebaseConfig.hosting?.ignore?.includes("**/*.zip"), "Firebase Hosting should not publish local ZIP artifacts.");
assert(firebaseConfig.hosting?.ignore?.includes("dist/**"), "Firebase Hosting should not publish generated package artifacts.");
assert(firebaseConfig.firestore?.rules === "firestore.rules", "Firebase config must point at firestore.rules.");
assert(firebaseConfig.firestore?.indexes === "firestore.indexes.json", "Firebase config must point at firestore.indexes.json.");
assert(
  firebaseProjectExample.projects?.default === "replace-with-your-firebase-project-id",
  ".firebaserc.example must not include a real project ID.",
);
assert(gitignore.includes(".firebaserc"), ".gitignore must keep local .firebaserc out of git.");
assert(gitignore.includes(".firebase/"), ".gitignore must keep Firebase local cache out of git.");
assert(gitignore.includes("!**/.env.example"), ".gitignore must allow safe example env files.");
assert(gitignore.includes("dist/"), ".gitignore must keep generated static deploy packages out of git.");
assert(packageJson.scripts?.["package:static"] === "node tools/package-static.mjs", "Root package must include the static package script.");
assert(packageJson.scripts?.["package:static:check"] === "node tools/package-static.mjs --check", "Root package must include the static package safety check.");
assert(packageJson.scripts?.["smoke:static"] === "node tools/smoke-static-package.mjs", "Root package must include the static package smoke check.");
assert(packageJson.scripts?.check?.includes("package:static:check"), "Root check must include the static package safety check.");
assert(hostingReadiness.includes("firebase emulators:start --only hosting"), "Hosting readiness doc must include local Firebase preview.");
assert(hostingReadiness.includes("firebase hosting:channel:deploy preview"), "Hosting readiness doc must include preview channel deploy.");
assert(hostingReadiness.includes("firebase deploy --only hosting"), "Hosting readiness doc must include hosting deploy command.");
assert(hostingReadiness.includes("Stripe Checkout"), "Hosting readiness doc must preserve Stripe Checkout payment boundary.");
assert(stripeHandoff.includes("POST /api/checkout-sessions"), "Stripe handoff must document checkout session endpoint.");
assert(stripeHandoff.includes("POST /api/stripe/webhook"), "Stripe handoff must document webhook endpoint.");
assert(backendScaffold.includes("checkoutSessionsHandler"), "Backend scaffold doc must name the checkout session handler.");
assert(backendScaffold.includes("stripeWebhookHandler"), "Backend scaffold doc must name the Stripe webhook handler.");
assert(backendScaffold.includes("adminShippingLabelsHandler"), "Backend scaffold doc must name the admin shipping label handler.");
assert(backendScaffold.includes("adminOrderStatusHandler"), "Backend scaffold doc must name the admin order status handler.");
assert(backendScaffold.includes("POST /api/admin/shippo-labels"), "Backend scaffold doc must document the admin Shippo label endpoint.");
assert(backendScaffold.includes("POST /api/admin/order-status"), "Backend scaffold doc must document the admin order status endpoint.");
assert(backendScaffold.includes("order is paid"), "Backend scaffold doc must document paid-order validation before label purchase.");
assert(backendScaffold.includes("belongs to the order"), "Backend scaffold doc must document owned Shippo rate validation before label purchase.");
assert(backendScaffold.includes("Firebase Auth admin custom claim"), "Backend scaffold doc must document the admin custom-claim boundary.");
assert(backendScaffold.includes("admin_status_dependency_missing"), "Backend scaffold doc must document disabled admin status endpoint behavior.");
assert(backendScaffold.includes("derived from the verified Firebase ID token"), "Backend scaffold doc must preserve the server-derived admin actor boundary.");
assert(adminFulfillment.includes("POST /api/admin/shippo-labels"), "Admin fulfillment doc must point future UI work at the trusted label endpoint.");
assert(adminFulfillment.includes("No browser-side Shippo label purchase"), "Admin fulfillment doc must reject browser-side Shippo label purchase.");
assert(shippoPlan.includes("POST /api/admin/shippo-labels"), "Shippo plan must document the admin label endpoint.");
assert(shippoPlan.includes("one label for one owned Shippo rate ID"), "Shippo plan must document the current one-label-per-owned-rate boundary.");
assert(godaddyDeploy.includes("dist/godaddy-static/"), "GoDaddy deploy doc must point to the generated static package folder.");
assert(godaddyDeploy.includes("checkoutEndpoint: \"\""), "GoDaddy deploy doc must keep checkout config blank by default.");
assert(godaddyDeploy.includes("pre-backend static package"), "GoDaddy deploy doc must explain the current blank endpoint gate.");
assert(godaddyDeploy.includes("npm run smoke:static"), "GoDaddy deploy doc must include the local package smoke check.");
assert(godaddyDeploy.includes("temporary local-only server"), "GoDaddy deploy doc must describe the smoke check hosting boundary.");
assert(godaddyDeploy.includes("Upload the contents of that folder, not the repo root."), "GoDaddy deploy doc must warn against uploading the repo root.");
assert(godaddyDeploy.includes("functions/"), "GoDaddy deploy doc must exclude backend functions from static hosting.");
assert(godaddyDeploy.includes("docs/"), "GoDaddy deploy doc must exclude planning docs from static hosting.");
assert(godaddyDeploy.includes(".env"), "GoDaddy deploy doc must exclude environment files from static hosting.");
assert(jekyllConfig.includes("exclude:"), "GitHub Pages Jekyll config must define an explicit exclude list.");
assert(jekyllConfig.includes("docs/"), "GitHub Pages preview must exclude planning docs.");
assert(jekyllConfig.includes("functions/"), "GitHub Pages preview must exclude backend function source.");
assert(jekyllConfig.includes("tools/"), "GitHub Pages preview must exclude repo tooling.");
assert(jekyllConfig.includes("firebase.json"), "GitHub Pages preview must exclude Firebase config.");
assert(jekyllConfig.includes("firestore.rules"), "GitHub Pages preview must exclude Firestore rules.");
assert(jekyllConfig.includes("admin.html"), "GitHub Pages preview must exclude the unauthenticated admin prototype.");
assert(jekyllConfig.includes("admin-config.js"), "GitHub Pages preview must exclude admin config before admin launch.");
assert(jekyllConfig.includes("admin-live.js"), "GitHub Pages preview must exclude admin live bridge before admin launch.");
assert(packageStaticScript.includes("storefrontFiles"), "Static package script must use an explicit storefront file allowlist.");
assert(packageStaticScript.includes("allowedAssetExtensions"), "Static package script must use an explicit asset type allowlist.");
assert(packageStaticScript.includes("dist\", \"godaddy-static"), "Static package script must write to dist/godaddy-static.");
assert(packageStaticScript.includes("TheosCheckoutConfig?.checkoutEndpoint === \"\""), "Static package script must evaluate and enforce blank checkout config by default.");
assert(packageStaticScript.includes("mkdtemp"), "Static package safety check must validate a generated package artifact.");
assert(packageStaticScript.includes("functions"), "Static package script must prevent backend functions from entering the deploy package.");
assert(packageStaticScript.includes("docs"), "Static package script must prevent docs from entering the deploy package.");
assert(packageStaticScript.includes("admin-config.js"), "Static package script must prevent admin config from entering the storefront deploy package.");
assert(packageStaticScript.includes("admin-live.js"), "Static package script must prevent admin live bridge from entering the storefront deploy package.");
assert(packageStaticScript.includes("STRIPE_SECRET_KEY"), "Static package script must scan for Stripe secret-looking values.");
assert(smokeStaticPackageScript.includes("dist\", \"godaddy-static"), "Static smoke check must target dist/godaddy-static by default.");
assert(smokeStaticPackageScript.includes("createServer"), "Static smoke check must run against a local static server.");
assert(smokeStaticPackageScript.includes("checkoutEndpoint === \"\""), "Static smoke check must enforce blank checkout config by default.");
assert(smokeStaticPackageScript.includes("functions"), "Static smoke check must verify backend functions are not exposed.");
assert(smokeStaticPackageScript.includes("docs"), "Static smoke check must verify docs are not exposed.");
assert(smokeStaticPackageScript.includes("STRIPE_SECRET_KEY"), "Static smoke check must scan for Stripe secret-looking values.");
assert(functionsPackage.scripts?.check?.includes("node --test"), "Backend package must include a local test check.");
assert(functionsPackage.scripts?.check?.includes("src/admin-auth.js"), "Backend package check must include admin auth helper syntax checks.");
assert(functionsPackage.scripts?.check?.includes("src/admin-auth.test.js"), "Backend package check must include admin auth tests.");
assert(functionsIndex.includes("checkoutSessionsHandler"), "Backend scaffold must export checkout session handling.");
assert(functionsIndex.includes("stripeWebhookHandler"), "Backend scaffold must export Stripe webhook handling.");
assert(functionsIndex.includes("adminOrderStatusHandler"), "Backend scaffold must export admin order status handling.");
assert(functionsIndex.includes("/api/admin/order-status"), "Backend scaffold must route admin order status updates.");
assert(functionsIndex.includes("admin_status_dependency_missing"), "Backend scaffold must keep admin status writes disabled without trusted persistence.");
assert(functionsIndex.includes("admin_auth_dependency_missing"), "Admin endpoints must fail closed when auth verification is not injected.");
assert(functionsIndex.includes("authenticateAdminRequest({ req })"), "Admin endpoints must derive the admin actor from the authenticated request.");
assert(!/admin:\s*body\.admin/.test(functionsIndex), "Admin endpoints must not trust request-provided admin identity.");
assert(functionsAdminAuth.includes("createFirebaseAdminAuthenticator"), "Backend must include a Firebase admin custom-claim authenticator.");
assert(functionsAdminAuth.includes("verifyIdToken"), "Admin auth helper must verify Firebase ID tokens.");
assert(functionsAdminAuth.includes("decodedToken.admin === true"), "Admin auth helper must require the admin custom claim.");
assert(functionsRuntime.includes("getAuth"), "Firebase runtime must use Firebase Admin Auth for admin endpoints.");
assert(functionsRuntime.includes("createFirebaseAdminAuthenticator"), "Firebase runtime must inject the admin custom-claim authenticator.");
assert(functionsRuntime.includes("adminStatusDependencies"), "Firebase runtime may wire admin status updates only after admin auth verification is injected.");
assert(functionsRuntime.includes("updateAdminOrderStatus: firestoreAdapter.updateAdminOrderStatus"), "Firebase runtime must wire admin status updates through the trusted Firestore adapter.");
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
const orderRequestRulesBlock = rules.match(/match \/orderRequests\/\{orderRequestId\} \{[\s\S]*?\n    \}/)?.[0] || "";
assert(orderRequestRulesBlock, "Could not inspect orderRequests Firestore rule block.");
assert(!rules.includes("allow read, update, delete: if isAdmin();"), "Admin order access must not use a blanket read/update/delete grant.");
assert(
  !/allow\s+(read,\s*)?update(,\s*delete)?\s*:\s*if\s+isAdmin\(\);/.test(orderRequestRulesBlock),
  "Admin order updates must not have an additive broad isAdmin update grant.",
);
assert(
  !/allow\s+(write|read,\s*write)\s*:\s*if\s+isAdmin\(\);/.test(orderRequestRulesBlock),
  "Admin order writes must not have an additive broad isAdmin write grant.",
);
assert(rules.includes("allow read: if isAdmin();"), "Admin order read rule is missing.");
assert(rules.includes("allow update: if hasValidAdminOrderUpdate();"), "Admin order update rule must use the constrained update helper.");
assert(rules.includes("allow delete: if false;"), "Admin order deletes should remain disabled until a deletion policy exists.");
assert(rules.includes("function hasOnlyAdminEditableOrderChanges()"), "Admin editable order field boundary helper is missing.");
assert(
  /hasOnlyAdminEditableOrderChanges\(\)[\s\S]*?hasOnly\(\[\s*'audit',\s*'internalNotes',\s*'status'\s*\]\);/.test(rules),
  "Admin order updates must be limited to status, audit, and internalNotes.",
);
assert(
  /hasValidAdminStatusChange\(\)[\s\S]*?'needs_review'[\s\S]*?'packed'[\s\S]*?'ready_to_pack'/.test(rules),
  "Admin status updates must stay limited to the initial fulfillment statuses.",
);
assert(rules.includes("request.resource.data.audit.updatedAt == request.time"), "Admin audit updates should require server request time.");
assert(rules.includes("request.resource.data.audit.updatedByUid == request.auth.uid"), "Admin audit updates should bind updatedByUid to the signed-in admin.");
assert(rules.includes("request.resource.data.internalNotes is list"), "Admin internal notes updates should preserve a list shape.");
assert(
  !/hasOnlyAdminEditableOrderChanges\(\)[\s\S]*?hasOnly\(\[[\s\S]*?(paymentStatus|stripeCheckoutSessionId|stripePaymentIntentId|stripeCustomerId|paidAt|refundedAt|refundId)[\s\S]*?\]\);/.test(rules),
  "Admin-client editable fields must not include backend-only payment or Stripe fields.",
);
assert(!storefront.toLowerCase().includes("local pickup"), "Storefront must not reintroduce local pickup.");
assert(storefront.includes('<link rel="canonical" href="https://theosfarm.com/">'), "Storefront must define the production canonical URL.");
assert(storefront.includes('property="og:image" content="https://theosfarm.com/assets/theos-both-bags.jpg"'), "Storefront must define a product photo Open Graph image.");
assert(storefront.includes('type="application/ld+json"'), "Storefront must include structured data.");
assert(storefront.includes('"@type": "Organization"'), "Structured data must describe Theo's Farm as an organization.");
assert(storefront.includes('"@type": "Product"'), "Structured data must describe the two ear corn products.");
assert(storefront.includes('"sku": "ear-corn-20lb"'), "Structured data must include the 20 lb SKU.");
assert(storefront.includes('"sku": "ear-corn-40lb"'), "Structured data must include the 40 lb SKU.");
assert(robots.includes("Sitemap: https://theosfarm.com/sitemap.xml"), "robots.txt must point crawlers at the production sitemap.");
assert(sitemap.includes("<loc>https://theosfarm.com/</loc>"), "sitemap.xml must list the production storefront URL.");
assert(storefront.includes("data-order-form"), "Storefront purchase request form is missing.");
assert(storefront.includes("data-checkout-result"), "Storefront checkout return status region is missing.");
assert(storefront.includes("order-request.js"), "Storefront must load the order request integration layer.");
assert(storefront.includes("checkout-config.js"), "Storefront must load the public checkout config placeholder.");
assert(
  storefront.indexOf("order-request.js") < storefront.indexOf("script.js"),
  "Order request integration must load before storefront behavior.",
);
assert(
  storefront.indexOf("checkout-config.js") < storefront.indexOf("script.js"),
  "Checkout config must load before storefront behavior.",
);
assert(storefront.includes('data-sku="ear-corn-20lb"'), "20 lb product must expose a stable order SKU.");
assert(storefront.includes('data-sku="ear-corn-40lb"'), "40 lb product must expose a stable order SKU.");
assert(storefrontScript.includes("buildShippingRateRequest"), "Storefront submit should use the shipping rate request builder.");
assert(checkoutConfigScript.includes("TheosCheckoutConfig"), "Checkout config must expose the public storefront config object.");
assert(checkoutConfigScript.includes("checkoutEndpoint"), "Checkout config must include a public checkout endpoint placeholder.");
{
  const sandbox = {};
  new Script(checkoutConfigScript, { filename: "checkout-config.js" }).runInContext(createContext(sandbox));
  assert(sandbox.TheosCheckoutConfig?.checkoutEndpoint === "", "Checkout endpoint should remain disabled until a trusted API URL is configured.");
}
assert(!checkoutConfigScript.includes("sk_"), "Checkout config must not include Stripe secret-looking values.");
assert(!checkoutConfigScript.includes("whsec_"), "Checkout config must not include webhook secret-looking values.");
assert(storefrontScript.includes("requestShippingRates"), "Storefront should request trusted shipping rates before checkout.");
assert(storefrontScript.includes("shippingRatesEndpoint"), "Storefront should use a public shipping rates endpoint config.");
assert(storefrontScript.includes("fetch(endpoint"), "Configured storefront checkout should call trusted backend endpoints.");
assert(storefrontScript.includes("checkout.stripe.com"), "Storefront should only redirect to Stripe Checkout URLs.");
assert(storefrontScript.includes("checkoutFailureMessage"), "Storefront should show a safe checkout failure message.");
assert(storefrontScript.includes("renderCheckoutReturnState"), "Storefront should render Stripe Checkout return status.");
assert(storefrontScript.includes("/checkout/success"), "Storefront should recognize the Stripe success return path.");
assert(storefrontScript.includes("/checkout/cancel"), "Storefront should recognize the Stripe cancel return path.");
assert(
  !storefrontScript.toLowerCase().includes("firebase") &&
    !orderRequestScript.toLowerCase().includes("firebase") &&
    !checkoutConfigScript.toLowerCase().includes("firebase"),
  "Storefront order request layer must not perform live Firebase writes in this slice.",
);
assert(
  !storefrontScript.includes("card") &&
    !orderRequestScript.includes("card") &&
    !checkoutConfigScript.includes("card"),
  "Storefront must not collect or handle raw payment details.",
);
assert(admin.includes("admin-config.js"), "Admin shell must load the public admin config gate.");
assert(admin.includes("admin.js"), "Admin shell must load admin.js.");
assert(admin.includes("admin-live.js"), "Admin shell must load the optional live admin bridge.");
assert(admin.indexOf("admin-config.js") < admin.indexOf("admin.js"), "Admin config must load before admin behavior.");
assert(admin.indexOf("admin.js") < admin.indexOf("admin-live.js"), "Admin sample renderer must load before the live bridge.");
assert(admin.includes("data-admin-auth-status"), "Admin shell must render auth state.");
assert(admin.includes("data-admin-action-status"), "Admin shell must render guarded action feedback.");
assert(adminConfigScript.includes("TheosAdminConfig"), "Admin config must expose the public admin config object.");
assert(adminConfigScript.includes("enabled: false"), "Admin live mode must stay disabled until Firebase config is intentionally filled.");
assert(adminConfigScript.includes("apiKey: \"\""), "Admin config must keep Firebase API key blank by default.");
assert(adminConfigScript.includes("projectId: \"\""), "Admin config must keep Firebase project ID blank by default.");
assert(adminConfigScript.includes("/api/admin/order-status"), "Admin config must point status actions at the trusted backend endpoint.");
assert(adminConfigScript.includes("/api/admin/shippo-labels"), "Admin config must point label actions at the trusted backend endpoint.");
assert(!adminConfigScript.includes("sk_") && !adminConfigScript.includes("whsec_"), "Admin config must not include secret-looking values.");
assert(adminScript.includes("sampleOrders"), "Admin shell should use sample data only in this slice.");
assert(adminScript.includes("normalizeAdminOrder"), "Admin shell must centralize order normalization for future authenticated reads.");
assert(adminScript.includes("normalizeAdminShipping"), "Admin shell must centralize shipping normalization for future authenticated reads.");
assert(adminScript.includes("buildAdminOrderViewModel"), "Admin shell must centralize order view-model building.");
assert(adminScript.includes("buildAdminShippingViewModel"), "Admin shell must centralize shipping view-model building.");
assert(adminScript.includes("calculateAdminBagCounts"), "Admin shell must centralize bag-count calculations.");
assert(adminScript.includes("adminStatusTransitions"), "Admin shell must define constrained status transitions before live status updates.");
assert(adminScript.includes("labelUrl"), "Admin shell should include trusted label URL display fields.");
assert(adminScript.includes("trackingNumber"), "Admin shell should include trusted tracking number display fields.");
assert(adminScript.includes("buildAdminLabelActionViewModel"), "Admin shell must centralize label action readiness before live wiring.");
assert(adminScript.includes("/api/admin/shippo-labels"), "Admin shell label action must target the trusted backend endpoint.");
assert(adminScript.includes("Auth required"), "Admin shell label action must stay gated until authenticated admin wiring exists.");
assert(adminScript.includes("setAdminActions"), "Admin shell must expose an authenticated action bridge setter for live admin wiring.");
assert(adminScript.includes("clearAdminActions"), "Admin shell must clear live admin actions on sign-out or denied reads.");
assert(adminScript.includes("setAdminActionStatus"), "Admin shell must expose safe action feedback for guarded admin controls.");
assert(adminScript.includes("data-status-action"), "Admin shell must render guarded status action controls.");
assert(!adminScript.includes("fetch("), "Admin shell must not call live backend endpoints before authenticated admin wiring exists.");
assert(!adminScript.toLowerCase().includes("firebase"), "Admin shell must not connect to Firebase yet.");
assert(adminLiveScript.includes("configuredFirebase"), "Admin live bridge must gate Firebase initialization behind config.");
assert(adminLiveScript.includes("getIdToken"), "Admin live bridge must use Firebase ID tokens for admin endpoint calls.");
assert(adminLiveScript.includes("authorization"), "Admin live bridge must send Authorization headers to admin endpoints.");
assert(adminLiveScript.includes("orderRequests"), "Admin live bridge must read the orderRequests collection after sign-in.");
assert(adminLiveScript.includes("setOrders"), "Admin live bridge must hand authenticated reads to the existing renderer.");
assert(adminLiveScript.includes("setActions({"), "Admin live bridge must pass signed-in action wiring to the admin renderer.");
assert(adminLiveScript.includes("clearAdminActions()"), "Admin live bridge must clear action wiring when auth/read access fails.");
assert(adminLiveScript.includes("postAdminJson"), "Admin live bridge must centralize guarded admin endpoint calls.");
assert(!adminLiveScript.includes("body.admin"), "Admin live bridge must not send request-provided admin identity.");
assert(!adminLiveScript.includes("sk_") && !adminLiveScript.includes("whsec_"), "Admin live bridge must not include secret-looking values.");

function createAdminFakeElement(name, value = "") {
  return {
    name,
    value,
    dataset: {},
    innerHTML: "",
    textContent: "",
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    },
  };
}

function createAdminHarness() {
  const elements = {
    summary: createAdminFakeElement("summary"),
    rows: createAdminFakeElement("rows"),
    packingList: createAdminFakeElement("packingList"),
    statusFilter: createAdminFakeElement("statusFilter", "all"),
    actionStatus: createAdminFakeElement("actionStatus"),
  };
  const document = {
    querySelector(selector) {
      return {
        "[data-admin-summary]": elements.summary,
        "[data-order-rows]": elements.rows,
        "[data-packing-list]": elements.packingList,
        "[data-status-filter]": elements.statusFilter,
        "[data-admin-action-status]": elements.actionStatus,
        "[data-admin-auth-status]": createAdminFakeElement("authStatus"),
      }[selector] || null;
    },
  };
  const sandbox = {
    Intl,
    Number,
    Object,
    console,
    document,
    window: {},
  };

  new Script(adminScript, { filename: "admin.js" }).runInContext(createContext(sandbox));

  return {
    elements,
    helpers: sandbox.window.TheosAdminOrders,
  };
}

function flushAdminActions() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

{
  const { elements, helpers } = createAdminHarness();

  assert(helpers, "Admin helper boundary must be exposed for offline checks.");
  assert(helpers.allowedStatuses.join(",") === "needs_review,ready_to_pack,packed", "Admin statuses should stay limited to the initial fulfillment statuses.");
  assert(helpers.statusLabels.needs_review === "Needs review", "Admin status labels should expose a human-readable needs_review label.");
  assert(helpers.canTransitionStatus("needs_review", "ready_to_pack"), "Admin status transition should allow needs_review to ready_to_pack.");
  assert(helpers.canTransitionStatus("ready_to_pack", "packed"), "Admin status transition should allow ready_to_pack to packed.");
  assert(helpers.canTransitionStatus("packed", "ready_to_pack"), "Admin status transition should allow packed correction back to ready_to_pack.");
  assert(!helpers.canTransitionStatus("needs_review", "packed"), "Admin status transition should block skipping from needs_review to packed.");
  assert(!helpers.canTransitionStatus("ready_to_pack", "refunded"), "Admin status transition should block statuses outside the current boundary.");
  assert(Object.isFrozen(helpers.allowedStatuses), "Admin allowed status list should be immutable from the exported helper surface.");
  assert(Object.isFrozen(helpers.statusLabels), "Admin status labels should be immutable from the exported helper surface.");
  assert(Object.isFrozen(helpers.statusTransitions), "Admin status transitions should be immutable from the exported helper surface.");
  assert(Object.isFrozen(helpers.statusTransitions.needs_review), "Admin status transition arrays should be immutable from the exported helper surface.");
  try {
    helpers.allowedStatuses.push("refunded");
    helpers.statusLabels.refunded = "Refunded";
    helpers.statusTransitions.needs_review.push("refunded");
  } catch {
    // Frozen objects may throw in strict contexts; either way, the boundary must remain unchanged.
  }
  assert(!helpers.allowedStatuses.includes("refunded"), "Admin exported status list should not be expandable by mutating helper objects.");
  assert(!helpers.canTransitionStatus("needs_review", "refunded"), "Admin transitions should not be expandable by mutating helper objects.");
  elements.statusFilter.value = "needs_review";
  elements.statusFilter.listeners.change[0]({ type: "change" });
  assert(elements.rows.innerHTML.includes("REQ-1001"), "Admin status filter listener should render current orders, not the browser event object.");
  elements.statusFilter.value = "all";
  elements.statusFilter.listeners.change[0]({ type: "change" });

  const normalized = helpers.normalizeOrder({
    id: " firestore-doc-id ",
    status: "paid",
    subtotalCents: 0,
    customer: {
      name: " Future Customer ",
      contact: "future@example.com",
      preferredContact: "Text",
      shippingZip: "62401",
      note: "<script>alert(1)</script>",
    },
    paymentStatus: "paid",
    shippingCarrier: "UPS",
    shippingService: "Ground",
    shippingAmountCents: 1842,
    shippingPackageCount: 1,
    labelUrl: "https://example.com/label.pdf",
    trackingNumber: "TRACK123",
    trackingUrl: "https://carrier.example/track/TRACK123",
    items: [
      { sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: "2", unitPriceCents: "1795" },
      { sku: "unknown", name: "Ignored count product", quantity: 1, unitPriceCents: 999 },
      { sku: "ear-corn-40lb", name: "40 lb Ear Corn Bag", quantity: 0, unitPriceCents: 2995 },
    ],
  });

  assert(normalized.id === "firestore-doc-id", "Admin order normalization should trim document IDs.");
  assert(normalized.status === "needs_review", "Unknown admin order statuses should normalize back to needs_review.");
  assert(normalized.customer.preferredContact === "text", "Admin order normalization should lower-case contact preference.");
  assert(normalized.paymentStatus === "paid", "Admin order normalization should preserve payment status.");
  assert(normalized.shipping.carrier === "UPS", "Admin order normalization should preserve trusted shipping carrier.");
  assert(normalized.shipping.labelUrl === "https://example.com/label.pdf", "Admin order normalization should preserve safe label URLs.");
  assert(normalized.shipping.trackingNumber === "TRACK123", "Admin order normalization should preserve trusted tracking numbers.");
  assert(normalized.items.length === 2, "Admin order normalization should keep positive quantity line items.");
  assert(normalized.subtotalCents === 4589, "Admin order normalization should calculate subtotal when the source subtotal is absent.");

  const viewModel = helpers.buildOrderViewModel(normalized);
  assert(viewModel.statusLabel === "Needs review", "Admin view model should include status labels.");
  assert(viewModel.itemSummary.includes("2 x 20 lb Ear Corn Bag"), "Admin view model should include item summaries.");
  assert(viewModel.shipping.carrierService === "UPS Ground", "Admin view model should include carrier and service labels.");
  assert(viewModel.shipping.amountLabel === "$18.42 shipping", "Admin view model should format shipping amount labels.");
  assert(viewModel.shipping.trackingLabel === "TRACK123", "Admin view model should include tracking labels.");
  assert(viewModel.shipping.hasLabel, "Admin view model should mark orders with a trusted label URL.");
  assert(viewModel.labelAction.state === "complete", "Admin label action should show completed labels as non-purchasable.");
  assert(viewModel.subtotalLabel === "$45.89", "Admin view model should format subtotal labels.");

  const unpaidLabelAction = helpers.buildLabelActionViewModel({ paymentStatus: "unpaid", shippingRateId: "rate_unpaid" });
  assert(unpaidLabelAction.state === "blocked", "Admin label action should block unpaid orders.");
  assert(unpaidLabelAction.label === "Payment required", "Admin label action should explain unpaid order blocking.");

  const missingRateLabelAction = helpers.buildLabelActionViewModel({ paymentStatus: "paid" });
  assert(missingRateLabelAction.state === "blocked", "Admin label action should block orders without trusted rates.");
  assert(missingRateLabelAction.label === "Rate required", "Admin label action should explain missing-rate blocking.");

  const readyLabelAction = helpers.buildLabelActionViewModel({
    id: "REQ-2000",
    paymentStatus: "paid",
    shippingPackageRateIds: ["rate_a", "rate_b"],
  });
  assert(readyLabelAction.state === "auth_required", "Admin label action should gate ready label purchase behind auth wiring.");
  assert(readyLabelAction.endpoint === "/api/admin/shippo-labels", "Admin label action should point to the trusted label endpoint.");
  assert(readyLabelAction.requestBody.orderRequestId === "REQ-2000", "Admin label action should prepare the order id for trusted backend calls.");
  assert(readyLabelAction.requestBody.rateId === "rate_a", "Admin label action should prepare one owned rate id at a time.");

  const counts = helpers.calculateBagCounts([
    normalized,
    {
      status: "ready_to_pack",
      items: [{ sku: "ear-corn-40lb", name: "40 lb Ear Corn Bag", quantity: 3, unitPriceCents: 2995 }],
    },
  ]);

  assert(counts.twenty === 2, "Admin bag counts should sum 20 lb bag quantities by SKU.");
  assert(counts.forty === 3, "Admin bag counts should sum 40 lb bag quantities by SKU.");
  assert(counts.total === 5, "Admin bag counts should include total bag quantities.");

  const fulfillmentSummary = helpers.buildFulfillmentSummary([
    normalized,
    { status: "ready_to_pack", items: [{ sku: "ear-corn-40lb", quantity: 2 }] },
    { status: "packed", items: [{ sku: "ear-corn-20lb", quantity: 1 }] },
  ]);

  assert(fulfillmentSummary.orderCount === 3, "Admin fulfillment summary should count normalized orders.");
  assert(fulfillmentSummary.needsReviewCount === 1, "Admin fulfillment summary should count needs_review orders.");
  assert(fulfillmentSummary.readyToPackCount === 1, "Admin fulfillment summary should count ready_to_pack orders.");
  assert(fulfillmentSummary.packedCount === 1, "Admin fulfillment summary should count packed orders.");
  assert(helpers.getPackableOrders([{ status: "needs_review" }, { status: "packed" }]).length === 1, "Admin packing list should exclude needs_review orders.");

  assert(elements.summary.innerHTML.includes("Order requests"), "Admin script should render the offline summary.");
  assert(elements.rows.innerHTML.includes("REQ-1001"), "Admin script should render sample order rows.");
  assert(elements.rows.innerHTML.includes('data-label-action="auth_required"'), "Admin rows should render auth-gated label actions for paid rated orders.");
  assert(elements.rows.innerHTML.includes('data-label-endpoint="/api/admin/shippo-labels"'), "Admin rows should keep label action routing on the trusted backend endpoint.");
  assert(elements.rows.innerHTML.includes('<button class="admin-action" type="button" disabled'), "Admin label action buttons should remain disabled in the static shell.");
  assert(elements.rows.innerHTML.includes('data-status-action="update"'), "Admin rows should render guarded status action controls.");
  assert(elements.rows.innerHTML.includes('data-status-endpoint="/api/admin/order-status"'), "Admin status controls should point at the trusted backend endpoint.");
  assert(elements.rows.innerHTML.includes("Tracking pending"), "Admin script should render label/tracking status in sample rows.");
  assert(elements.rows.innerHTML.includes("9400100000000000000000"), "Admin script should render trusted tracking numbers in sample rows.");
  assert(!elements.rows.innerHTML.includes("Â·"), "Admin rows should avoid mojibake separators.");
}

{
  const { elements, helpers } = createAdminHarness();
  const adminActionCalls = [];
  helpers.setActions({
    endpoints: {
      labelPurchase: "/api/admin/shippo-labels",
      statusUpdate: "/api/admin/order-status",
    },
    postAdminJson(request) {
      adminActionCalls.push(request);
      if (request.endpoint === "/api/admin/order-status") {
        return Promise.resolve({ orderRequestId: request.body.orderRequestId, status: request.body.status });
      }
      return Promise.resolve({
        orderRequestId: request.body.orderRequestId,
        labelUrl: "https://example.com/live-label.pdf",
        shippoTransactionId: "shippo_txn_live",
        trackingNumber: "TRACK-LIVE",
        trackingUrl: "https://carrier.example/TRACK-LIVE",
      });
    },
    user: {
      uid: "admin-user",
    },
  });

  assert(helpers.hasActions(), "Admin helper should report live actions after authenticated wiring is set.");
  assert(elements.rows.innerHTML.includes('<button class="admin-action" type="button" data-label-action="auth_required"'), "Auth-ready label buttons should be enabled only after live admin wiring is set.");
  assert(!elements.rows.innerHTML.includes('data-current-status="ready_to_pack" data-status-endpoint="/api/admin/order-status" disabled'), "Auth-ready status controls should be enabled after live admin wiring is set.");

  elements.rows.listeners.change[0]({
    target: {
      dataset: {
        currentStatus: "ready_to_pack",
        orderId: "REQ-1002",
        statusAction: "update",
      },
      value: "packed",
    },
  });
  await flushAdminActions();
  assert(adminActionCalls.some((call) => call.endpoint === "/api/admin/order-status" && call.body.orderRequestId === "REQ-1002" && call.body.status === "packed"), "Admin status controls should call the trusted status endpoint through the live bridge.");
  assert(elements.actionStatus.textContent === "Order status updated.", "Admin status controls should announce successful status updates.");

  elements.rows.listeners.click[0]({
    target: {
      dataset: {
        labelAction: "auth_required",
        labelPayload: JSON.stringify({ orderRequestId: "REQ-1002", rateId: "rate_large_1" }),
      },
      disabled: false,
    },
  });
  await flushAdminActions();
  assert(adminActionCalls.some((call) => call.endpoint === "/api/admin/shippo-labels" && call.body.orderRequestId === "REQ-1002" && call.body.rateId === "rate_large_1"), "Admin label controls should call the trusted label endpoint through the live bridge.");
  assert(elements.actionStatus.textContent === "Shipping label saved.", "Admin label controls should announce successful label purchase.");
  helpers.clearActions();
  assert(elements.actionStatus.textContent === "", "Admin helper should clear action feedback when live actions are cleared.");
  assert(!helpers.hasActions(), "Admin helper should clear live actions after sign-out or denied reads.");
}

{
  const { elements, helpers } = createAdminHarness();
  helpers.setActions({
    endpoints: {
      labelPurchase: "/api/admin/shippo-labels",
      statusUpdate: "/api/admin/order-status",
    },
    postAdminJson() {
      return Promise.reject(new Error("denied"));
    },
    user: {
      uid: "admin-user",
    },
  });

  elements.rows.listeners.change[0]({
    target: {
      dataset: {
        currentStatus: "ready_to_pack",
        orderId: "REQ-1002",
        statusAction: "update",
      },
      value: "packed",
    },
  });
  await flushAdminActions();
  assert(elements.actionStatus.textContent === "Status update failed. Check admin access and try again.", "Admin status controls should announce a safe failure message.");
  assert(elements.actionStatus.dataset.tone === "error", "Admin status failures should be marked with an error tone.");
}

{
  const authStatus = createAdminFakeElement("authStatus");
  const documentElement = {
    attributes: new Set(),
    toggleAttribute(name, enabled) {
      if (enabled) {
        this.attributes.add(name);
      } else {
        this.attributes.delete(name);
      }
    },
    hasAttribute(name) {
      return this.attributes.has(name);
    },
  };
  const document = {
    readyState: "loading",
    documentElement,
    addEventListener() {},
    querySelector(selector) {
      return selector === "[data-admin-auth-status]" ? authStatus : null;
    },
  };
  let authCallback = null;
  let liveOrders = null;
  const sandbox = {
    Error,
    JSON,
    Object,
    Promise,
    document,
    fetch() {},
    window: {
      TheosAdminConfig: {
        enabled: true,
        firebase: {
          apiKey: "public-api-key",
          appId: "public-app-id",
          authDomain: "theos.example",
          projectId: "theos-project",
        },
        endpoints: {
          labelPurchase: "/api/admin/shippo-labels",
          statusUpdate: "/api/admin/order-status",
        },
      },
      TheosAdminOrders: {
        setOrders(orders) {
          liveOrders = orders;
        },
      },
    },
  };

  new Script(adminLiveScript, { filename: "admin-live.js" }).runInContext(createContext(sandbox));
  await sandbox.window.TheosAdminLive.initializeAdminLive({
    importModule(specifier) {
      if (specifier.includes("firebase-app")) {
        return Promise.resolve({
          initializeApp() {
            return {};
          },
        });
      }
      if (specifier.includes("firebase-auth")) {
        return Promise.resolve({
          getAuth() {
            return {};
          },
          onAuthStateChanged(auth, callback) {
            authCallback = callback;
          },
        });
      }
      if (specifier.includes("firebase-firestore")) {
        return Promise.resolve({
          collection() {
            return {};
          },
          getFirestore() {
            return {};
          },
          getDocs() {
            return Promise.reject(new Error("permission-denied"));
          },
          limit(value) {
            return value;
          },
          orderBy(field, direction) {
            return [field, direction];
          },
          query() {
            return {};
          },
        });
      }
      return Promise.reject(new Error("Unexpected import " + specifier));
    },
  });
  await authCallback({
    getIdToken() {
      return Promise.resolve("not-admin-token");
    },
  });

  assert(authStatus.textContent === "Admin access denied", "Admin live bridge should fail closed when Firestore admin reads are denied.");
  assert(!documentElement.hasAttribute("data-admin-signed-in"), "Admin live bridge must not leave the page marked signed in after denied reads.");
  assert(liveOrders === null, "Denied admin reads must not replace sample orders.");
}

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
assert(validOrderRequest.payload.subtotalCents === 6585, "Order request subtotal should be calculated in cents.");
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

function createFakeElement(name) {
  return {
    name,
    dataset: {},
    disabled: false,
    innerHTML: "",
    textContent: "",
    attributes: {},
    listeners: {},
    classList: {
      values: new Set(),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
    },
    addEventListener(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    },
    focus() {
      this.focused = true;
    },
    querySelector(selector) {
      return this.children?.[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-remove-cart-item]") {
        return [...this.innerHTML.matchAll(/data-remove-cart-item="([^"]+)"/g)].map((match) => {
          const element = createFakeElement(`remove-${match[1]}`);
          element.dataset.removeCartItem = match[1];
          return element;
        });
      }
      return [];
    },
    scrollIntoView() {
      this.scrolled = true;
    },
    setAttribute(attribute, value) {
      this.attributes[attribute] = value;
    },
  };
}

function createStorefrontHarness({ checkoutEndpoint = "", href = "https://theos.example/", shippingRatesEndpoint = "/api/shipping-rates", fetchImpl } = {}) {
  const elements = {
    cartDrawer: createFakeElement("cartDrawer"),
    cartItems: createFakeElement("cartItems"),
    cartCount: createFakeElement("cartCount"),
    cartTotal: createFakeElement("cartTotal"),
    openCartButton: createFakeElement("openCartButton"),
    closeCartButton: createFakeElement("closeCartButton"),
    checkoutButton: createFakeElement("checkoutButton"),
    orderForm: createFakeElement("orderForm"),
    orderSummary: createFakeElement("orderSummary"),
    orderStatus: createFakeElement("orderStatus"),
    shippingRates: createFakeElement("shippingRates"),
    checkoutResult: createFakeElement("checkoutResult"),
    checkoutResultKicker: createFakeElement("checkoutResultKicker"),
    checkoutResultTitle: createFakeElement("checkoutResultTitle"),
    checkoutResultCopy: createFakeElement("checkoutResultCopy"),
    checkoutResultReference: createFakeElement("checkoutResultReference"),
    orderSubmitButton: createFakeElement("orderSubmitButton"),
    orderInput: createFakeElement("orderInput"),
    delivery: createFakeElement("delivery"),
  };

  elements.orderForm.children = {
    'button[type="submit"]': elements.orderSubmitButton,
    input: elements.orderInput,
  };
  elements.shippingRates.querySelectorAll = () => [];
  elements.checkoutResult.hidden = true;
  elements.checkoutResultReference.hidden = true;

  const addButtons = [
    createFakeElement("add20lb"),
    createFakeElement("add40lb"),
  ];
  addButtons[0].dataset = {
    sku: "ear-corn-20lb",
    name: "20 lb Ear Corn Bag",
    priceCents: "1795",
  };
  addButtons[1].dataset = {
    sku: "ear-corn-40lb",
    name: "40 lb Ear Corn Bag",
    priceCents: "2995",
  };

  const document = {
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    },
    querySelector(selector) {
      return {
        "[data-cart]": elements.cartDrawer,
        "[data-cart-items]": elements.cartItems,
        "[data-cart-count]": elements.cartCount,
        "[data-cart-total]": elements.cartTotal,
        "[data-open-cart]": elements.openCartButton,
        "[data-close-cart]": elements.closeCartButton,
        "[data-checkout-button]": elements.checkoutButton,
        "[data-order-form]": elements.orderForm,
        "[data-order-summary]": elements.orderSummary,
        "[data-order-status]": elements.orderStatus,
        "[data-shipping-rates]": elements.shippingRates,
        "[data-checkout-result]": elements.checkoutResult,
        "[data-checkout-result-kicker]": elements.checkoutResultKicker,
        "[data-checkout-result-title]": elements.checkoutResultTitle,
        "[data-checkout-result-copy]": elements.checkoutResultCopy,
        "[data-checkout-result-reference]": elements.checkoutResultReference,
        "#delivery": elements.delivery,
      }[selector] || null;
    },
    querySelectorAll(selector) {
      return selector === "[data-add-to-cart]" ? addButtons : [];
    },
  };

  const location = {
    href,
    assignedUrl: "",
    assign(url) {
      this.assignedUrl = url;
    },
  };

  const window = {
    TheosCheckoutConfig: { checkoutEndpoint, shippingRatesEndpoint },
    TheosOrderRequests: orderRequests,
    location,
  };

  class FakeFormData {
    constructor(form) {
      this.values = form.values || {};
    }

    get(name) {
      return this.values[name] || "";
    }
  }

  const sandbox = {
    FormData: FakeFormData,
    Intl,
    URL,
    console,
    document,
    fetch: fetchImpl || (() => {
      throw new Error("Unexpected checkout fetch");
    }),
    window,
  };

  new Script(storefrontScript, { filename: "script.js" }).runInContext(createContext(sandbox));

  return {
    addButtons,
    elements,
    location,
    async submitOrder(values = {}) {
      elements.orderForm.values = {
        name: "Customer Name",
        contact: "customer@example.com",
        addressLine1: "123 Oak Street",
        addressLine2: "",
        city: "Effingham",
        state: "IL",
        zip: "62401",
        contactMethod: "Email",
        note: "",
        ...values,
      };

      await elements.orderForm.listeners.submit[0]({
        preventDefault() {},
      });
    },
    async addFirstProductAndSubmit(values = {}) {
      addButtons[0].listeners.click[0]();
      await this.submitOrder(values);
    },
  };
}

{
  const harness = createStorefrontHarness();

  assert(harness.elements.checkoutResult.hidden === true, "Checkout return status should stay hidden on the storefront home page.");
}

{
  const harness = createStorefrontHarness({
    href: "https://theos.example/zerrusen-ear-corn-prototype/checkout/success?session_id=cs_test_1234567890abcdef",
  });

  assert(harness.elements.checkoutResult.hidden === false, "Checkout success return should reveal the status region.");
  assert(harness.elements.checkoutResult.scrolled === true, "Checkout success return should scroll the status region into view.");
  assert(harness.elements.checkoutResult.focused === true, "Checkout success return should focus the status region for accessibility.");
  assert(harness.elements.checkoutResultTitle.textContent.includes("payment is being confirmed"), "Checkout success should explain payment confirmation.");
  assert(harness.elements.checkoutResultReference.textContent.includes("90abcdef"), "Checkout success should show only a short Stripe reference.");
}

{
  const harness = createStorefrontHarness({
    href: "https://theos.example/checkout/cancel",
  });

  assert(harness.elements.checkoutResult.hidden === false, "Checkout cancel return should reveal the status region.");
  assert(harness.elements.checkoutResultTitle.textContent.includes("cart is still here"), "Checkout cancel should tell the customer the cart can be reviewed.");
  assert(harness.elements.checkoutResultReference.hidden === true, "Checkout cancel should not show a Stripe reference.");
}

{
  let requestUrl = "";
  const harness = createStorefrontHarness({
    async fetchImpl(url) {
      requestUrl = url;
      return {
        ok: true,
        async json() {
          return {
            rates: [
              {
                rateId: "rate_ground",
                provider: "UPS",
                serviceName: "Ground",
                amountCents: 1842,
                currency: "USD",
                durationTerms: "2 business days",
              },
            ],
          };
        },
      };
    },
  });

  await harness.addFirstProductAndSubmit();

  assert(requestUrl === "https://theos.example/api/shipping-rates", "Configured shipping should call the trusted shipping rates endpoint before checkout.");
  assert(harness.elements.orderStatus.textContent.includes("Choose a shipping option"), "Shipping-rate flow should ask the customer to choose a rate before checkout.");
  assert(harness.location.assignedUrl === "", "Blank checkout config must not redirect.");
  assert(harness.elements.cartItems.innerHTML.includes("20 lb Ear Corn Bag"), "Blank checkout config must not clear the cart.");
}

{
  const requests = [];
  const harness = createStorefrontHarness({
    checkoutEndpoint: "/api/checkout-sessions",
    async fetchImpl(url, options) {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url.endsWith("/api/shipping-rates")) {
        return {
          ok: true,
          async json() {
            return {
              rates: [
                {
                  rateId: "[\"rate_20\",\"rate_40\"]",
                  provider: "UPS",
                  serviceName: "Ground",
                  amountCents: 4342,
                  currency: "USD",
                  durationTerms: "2 business days",
                },
              ],
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            orderRequestId: "order_123",
            checkoutSessionId: "cs_test_123",
            checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
          };
        },
      };
    },
  });

  await harness.addFirstProductAndSubmit();
  await harness.submitOrder();

  assert(requests.length === 2, "Storefront should request rates before requesting checkout.");
  assert(requests[1].url === "https://theos.example/api/checkout-sessions", "Storefront should call the trusted checkout endpoint after rate selection.");
  assert(requests[1].body.orderRequest.subtotalCents === 1795, "Checkout request must include the prepared order request.");
  assert(requests[1].body.shippingAddress.zip === "62401", "Checkout request must include the shipping address used for re-rating.");
  assert(requests[1].body.selectedShippingRate.rateId === "[\"rate_20\",\"rate_40\"]", "Checkout request must include the selected shipping rate id.");
  assert(harness.location.assignedUrl === "https://checkout.stripe.com/c/pay/cs_test_123", "Valid checkout handoff should redirect to Stripe Checkout.");
}

assert(storefrontScript.includes("requestCheckoutSession"), "Storefront should retain the future Stripe Checkout handoff path.");
assert(storefrontScript.includes("selectedShippingRate"), "Storefront should require a selected shipping rate before future checkout.");

console.log("Static prototype checks passed.");
