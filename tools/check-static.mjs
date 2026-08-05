import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createContext, Script } from "node:vm";

const require = createRequire(import.meta.url);
const orderRequests = require("../order-request.js");

const requiredFiles = [
  ".github/workflows/ci.yml",
  "index.html",
  "styles.css",
  "script.js",
  "analytics-config.js",
  "analytics.js",
  "order-request.js",
  "checkout-config.js",
  "seo-config.json",
  "admin.html",
  "admin.css",
  "admin-config.js",
  "admin-config.local.example.js",
  "admin.js",
  "admin-live.js",
  "social-weekly-drafts.js",
  "robots.txt",
  "sitemap.xml",
  "social-post-batches/2026-08-03.json",
  "ROADMAP.md",
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
  "docs/social-post-batch-2026-08-03.json",
  "tools/package-static.mjs",
  "tools/serve-static.mjs",
  "tools/smoke-static-package.mjs",
  "functions/.env.example",
  "functions/package.json",
  "functions/tools/check-source.mjs",
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
const roadmap = await readFile("ROADMAP.md", "utf8");
const jekyllConfig = await readFile("_config.yml", "utf8");
const storefrontScript = await readFile("script.js", "utf8");
const analyticsConfigScript = await readFile("analytics-config.js", "utf8");
const analyticsScript = await readFile("analytics.js", "utf8");
const orderRequestScript = await readFile("order-request.js", "utf8");
const checkoutConfigScript = await readFile("checkout-config.js", "utf8");
const admin = await readFile("admin.html", "utf8");
const adminStyles = await readFile("admin.css", "utf8");
const adminConfigScript = await readFile("admin-config.js", "utf8");
const adminLocalConfigExample = await readFile("admin-config.local.example.js", "utf8");
const adminScript = await readFile("admin.js", "utf8");
const adminLiveScript = await readFile("admin-live.js", "utf8");
const weeklySocialDraftScript = await readFile("social-weekly-drafts.js", "utf8");
const gitignore = await readFile(".gitignore", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const hostingReadiness = await readFile("docs/firebase-hosting-readiness.md", "utf8");
const stripeHandoff = await readFile("docs/stripe-checkout-handoff.md", "utf8");
const backendScaffold = await readFile("docs/backend-checkout-scaffold.md", "utf8");
const adminFulfillment = await readFile("docs/admin-fulfillment-foundation.md", "utf8");
const shippoPlan = await readFile("docs/shippo-shipping-plan.md", "utf8");
const godaddyDeploy = await readFile("docs/godaddy-static-deploy.md", "utf8");
const publicSocialBatch = JSON.parse(await readFile("social-post-batches/2026-08-03.json", "utf8"));
const reviewSocialBatch = JSON.parse(await readFile("docs/social-post-batch-2026-08-03.json", "utf8"));
const packageStaticScript = await readFile("tools/package-static.mjs", "utf8");
const serveStaticScript = await readFile("tools/serve-static.mjs", "utf8");
const smokeStaticPackageScript = await readFile("tools/smoke-static-package.mjs", "utf8");
const functionsPackage = JSON.parse(await readFile("functions/package.json", "utf8"));
const functionsCheckScript = await readFile("functions/tools/check-source.mjs", "utf8");
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
assert(!firebaseConfig.hosting?.ignore?.includes("admin.html"), "Firebase Hosting should publish the authenticated admin entry page.");
assert(!firebaseConfig.hosting?.ignore?.includes("admin.css"), "Firebase Hosting should publish admin styles.");
assert(!firebaseConfig.hosting?.ignore?.includes("admin-config.js"), "Firebase Hosting should publish the public admin config gate.");
assert(firebaseConfig.hosting?.ignore?.includes("admin-config.local.example.js"), "Firebase Hosting should not publish local admin config examples.");
assert(firebaseConfig.hosting?.ignore?.includes("admin-config.local.js"), "Firebase Hosting should not publish local admin config overrides.");
assert(!firebaseConfig.hosting?.ignore?.includes("admin.js"), "Firebase Hosting should publish the admin renderer.");
assert(!firebaseConfig.hosting?.ignore?.includes("admin-live.js"), "Firebase Hosting should publish the authenticated admin bridge.");
assert(!firebaseConfig.hosting?.ignore?.includes("social-weekly-drafts.js"), "Firebase Hosting should publish the weekly social draft generator.");
assert(!firebaseConfig.hosting?.ignore?.includes("social-post-batches/**"), "Firebase Hosting should publish reviewed social draft batches.");
assert(
  firebaseConfig.hosting?.headers?.some((entry) => (
    entry.source === "**/*.json" &&
    entry.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-cache")
  )),
  "Firebase Hosting must prevent stale cached social draft JSON.",
);
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
assert(gitignore.includes("admin-config.local.js"), ".gitignore must keep local admin config overrides out of git.");
assert(gitignore.includes("!**/.env.example"), ".gitignore must allow safe example env files.");
assert(gitignore.includes("dist/"), ".gitignore must keep generated static deploy packages out of git.");
assert(packageJson.scripts?.["package:static"] === "node tools/package-static.mjs", "Root package must include the static package script.");
assert(packageJson.scripts?.["check:analytics"] === "node tools/check-analytics.mjs", "Root package must include GA4 contract checks.");
assert(packageJson.scripts?.check?.includes("check:analytics"), "Root check must run GA4 contract checks.");
assert(analyticsConfigScript.includes('measurementId: "G-KQSFKF42YM"'), "GA4 config must use the approved Theo's Farm web-stream measurement ID.");
assert(analyticsScript.includes("checkout_error"), "Analytics runtime must include the checkout-error event.");
assert(!analyticsScript.includes("email:"), "Analytics payloads must not include email fields.");
assert(storefront.includes('<script src="analytics-config.js"></script>'), "Storefront must load analytics configuration.");
assert(storefront.includes('<script src="analytics.js"></script>'), "Storefront must load the analytics runtime.");
assert(packageJson.scripts?.["check:seo"] === "node tools/check-seo.mjs", "Root package must include the technical SEO audit.");
assert(packageJson.scripts?.check?.includes("check:seo"), "Root check must run the technical SEO audit.");
assert(packageJson.scripts?.["build:seo"] === "node tools/generate-seo-files.mjs", "Root package must generate crawler-control files.");
assert(packageJson.scripts?.["check:seo-files"] === "node tools/generate-seo-files.mjs --check", "Root package must check generated crawler-control files.");
assert(packageJson.scripts?.check?.includes("check:seo-files"), "Root check must reject generated SEO file drift.");
assert(admin.includes('name="robots" content="noindex, nofollow, noarchive"'), "Admin page must carry explicit noindex protection.");
assert(robots.includes("Disallow: /admin.html"), "robots.txt must disallow the public admin entry.");
assert(
  firebaseConfig.hosting?.headers?.some((entry) => (
    entry.source === "/admin.html" &&
    entry.headers?.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex"))
  )),
  "Firebase Hosting must send X-Robots-Tag noindex for the admin entry.",
);
assert(
  firebaseConfig.hosting?.headers?.some((entry) => (
    entry.source === "/checkout/**" &&
    entry.headers?.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex"))
  )),
  "Firebase Hosting must send X-Robots-Tag noindex for checkout return paths.",
);
assert(
  firebaseConfig.hosting?.rewrites?.some((entry) => entry.source === "/checkout/success" && entry.destination === "/index.html"),
  "Firebase Hosting must preserve the checkout success return route.",
);
assert(
  firebaseConfig.hosting?.rewrites?.some((entry) => entry.source === "/checkout/cancel" && entry.destination === "/index.html"),
  "Firebase Hosting must preserve the checkout cancel return route.",
);
assert(
  !firebaseConfig.hosting?.rewrites?.some((entry) => entry.source === "**"),
  "Firebase Hosting must not rewrite every unknown URL to the homepage.",
);
assert(packageJson.scripts?.["package:static:check"] === "node tools/package-static.mjs --check", "Root package must include the static package safety check.");
assert(packageJson.scripts?.preview === "node tools/serve-static.mjs --port 4173", "Root package must include a local preview script.");
assert(packageJson.scripts?.["preview:static"]?.includes("tools/serve-static.mjs --root dist/godaddy-static"), "Root package must include a packaged static preview script.");
assert(packageJson.scripts?.["smoke:static"] === "node tools/smoke-static-package.mjs", "Root package must include the static package smoke check.");
assert(packageJson.scripts?.check?.includes("package:static:check"), "Root check must include the static package safety check.");
assert(serveStaticScript.includes("createServer"), "Local preview tool must serve files with Node HTTP.");
assert(serveStaticScript.includes("allowedRoots"), "Local preview tool must constrain preview roots.");
assert(serveStaticScript.includes("cache-control"), "Local preview tool must prevent stale local browser caching.");
assert(serveStaticScript.includes("index.html"), "Local preview tool must serve index.html for the static storefront.");
assert(roadmap.includes("Google and email/password sign-in controls"), "Roadmap must reflect the hosted admin sign-in controls.");
assert(roadmap.includes("granting its custom claim"), "Roadmap must keep the trusted admin claim setup as a remaining gate.");
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
assert(godaddyDeploy.includes("checkoutEndpoint: \"/api/checkout-sessions\""), "GoDaddy deploy doc must point checkout config to the trusted Firebase API route.");
assert(godaddyDeploy.includes("Firebase Functions checkout route"), "GoDaddy deploy doc must explain the current trusted API route gate.");
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
assert(jekyllConfig.includes("admin-config.local.example.js"), "GitHub Pages preview must exclude local admin config examples.");
assert(jekyllConfig.includes("admin-live.js"), "GitHub Pages preview must exclude admin live bridge before admin launch.");
assert(packageStaticScript.includes("storefrontFiles"), "Static package script must use an explicit storefront file allowlist.");
assert(packageStaticScript.includes("allowedAssetExtensions"), "Static package script must use an explicit asset type allowlist.");
assert(packageStaticScript.includes("dist\", \"godaddy-static"), "Static package script must write to dist/godaddy-static.");
assert(packageStaticScript.includes("TheosCheckoutConfig?.checkoutEndpoint === \"/api/checkout-sessions\""), "Static package script must evaluate and enforce the trusted checkout route.");
assert(packageStaticScript.includes("mkdtemp"), "Static package safety check must validate a generated package artifact.");
assert(packageStaticScript.includes("functions"), "Static package script must prevent backend functions from entering the deploy package.");
assert(packageStaticScript.includes("docs"), "Static package script must prevent docs from entering the deploy package.");
assert(packageStaticScript.includes("admin-config.js"), "Static package script must prevent admin config from entering the storefront deploy package.");
assert(packageStaticScript.includes("admin-live.js"), "Static package script must prevent admin live bridge from entering the storefront deploy package.");
assert(packageStaticScript.includes("STRIPE_SECRET_KEY"), "Static package script must scan for Stripe secret-looking values.");
assert(smokeStaticPackageScript.includes("dist\", \"godaddy-static"), "Static smoke check must target dist/godaddy-static by default.");
assert(smokeStaticPackageScript.includes("createServer"), "Static smoke check must run against a local static server.");
assert(smokeStaticPackageScript.includes("checkoutEndpoint === \"/api/checkout-sessions\""), "Static smoke check must enforce the trusted checkout route.");
assert(smokeStaticPackageScript.includes("functions"), "Static smoke check must verify backend functions are not exposed.");
assert(smokeStaticPackageScript.includes("docs"), "Static smoke check must verify docs are not exposed.");
assert(smokeStaticPackageScript.includes("STRIPE_SECRET_KEY"), "Static smoke check must scan for Stripe secret-looking values.");
assert(packageJson.scripts?.check?.includes("npm run check:functions"), "Root check must run the backend check suite.");
assert(functionsPackage.scripts?.check === "node tools/check-source.mjs", "Backend package must use the source-discovering check module.");
assert(functionsCheckScript.includes('entry.name.endsWith(".js")'), "Backend check module must discover JavaScript source files.");
assert(functionsCheckScript.includes('filePath.endsWith(".test.js")'), "Backend check module must discover test files.");
assert(functionsCheckScript.includes('["--check", filePath]'), "Backend check module must syntax-check every discovered source file.");
assert(functionsCheckScript.includes('["--test", ...testFiles]'), "Backend check module must run every discovered test file.");
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
assert(storefront.includes('class="footer-admin-link"'), "Storefront footer must include the admin sign-in entry point.");
assert(storefront.includes('href="admin.html"'), "Storefront admin entry point must link to the hosted admin page.");
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
  assert(sandbox.TheosCheckoutConfig?.checkoutEndpoint === "/api/checkout-sessions", "Checkout endpoint should use the trusted Firebase Functions API route.");
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
assert(admin.includes("admin-config.local.js"), "Admin shell must load the optional local admin config override.");
assert(admin.includes("admin.js"), "Admin shell must load admin.js.");
assert(admin.includes("admin-live.js"), "Admin shell must load the optional live admin bridge.");
assert(admin.indexOf("admin-config.js") < admin.indexOf("admin-config.local.js"), "Local admin config override must load after the disabled default config.");
assert(admin.indexOf("admin-config.local.js") < admin.indexOf("admin.js"), "Admin config override must load before admin behavior.");
assert(admin.indexOf("admin.js") < admin.indexOf("admin-live.js"), "Admin sample renderer must load before the live bridge.");
assert(admin.includes("data-admin-auth-status"), "Admin shell must render auth state.");
assert(admin.includes("data-admin-auth-help"), "Admin shell must render live admin sign-in helper copy.");
assert(admin.includes("data-admin-action-status"), "Admin shell must render guarded action feedback.");
assert(admin.includes("data-admin-sign-in-form"), "Admin shell must render a Firebase admin sign-in form.");
assert(admin.includes("data-admin-google-sign-in"), "Admin shell must render a Google sign-in control.");
assert(admin.includes("data-admin-sign-in-email"), "Admin shell must render the admin sign-in email field.");
assert(admin.includes("data-admin-sign-in-password"), "Admin shell must render the admin sign-in password field.");
assert(admin.includes("data-admin-sign-out"), "Admin shell must render a sign-out control for configured live mode.");
assert(admin.includes("data-admin-content hidden"), "Admin shell must hide fulfillment content before admin authorization.");
assert(admin.includes("data-social-drafts"), "Admin shell must render the social draft review surface.");
assert(admin.includes("data-social-reconciliation-rows"), "Admin shell must render the social reconciliation queue.");
assert(admin.includes("data-packing-print"), "Admin shell must render the aggregate packing print control.");
assert(admin.includes('<th scope="col">Payment</th>'), "Admin shell must include a visible payment status column.");
assert(admin.includes("data-order-detail-dialog"), "Admin shell must render a native order detail dialog.");
assert(admin.includes("data-order-detail-close"), "Admin order detail dialog must include an explicit close control.");
assert(adminStyles.includes("@media print"), "Admin stylesheet must define a packing print layout.");
assert(adminStyles.includes(".admin-layout > :not(#packing)"), "Packing print layout must hide order details.");
assert(adminStyles.includes("#packing .admin-note"), "Packing print layout must hide non-count helper text.");
assert(adminConfigScript.includes("TheosAdminConfig"), "Admin config must expose the public admin config object.");
assert(adminConfigScript.includes("enabled: true"), "Admin live mode must be enabled for the Firebase-hosted admin route.");
assert(adminConfigScript.includes("autoConfig: true"), "Admin live mode must use Firebase Hosting public auto config.");
assert(adminConfigScript.includes("apiKey: \"\""), "Admin config must keep Firebase API key blank by default.");
assert(adminConfigScript.includes("projectId: \"\""), "Admin config must keep Firebase project ID blank by default.");
assert(adminConfigScript.includes("/api/admin/order-status"), "Admin config must point status actions at the trusted backend endpoint.");
assert(adminConfigScript.includes("/api/admin/order-notes"), "Admin config must point internal notes at the trusted backend endpoint.");
assert(adminConfigScript.includes("/api/admin/shippo-labels"), "Admin config must point label actions at the trusted backend endpoint.");
assert(adminConfigScript.includes("/api/admin/social-posts/queue"), "Admin config must point social approvals at the trusted backend endpoint.");
assert(adminConfigScript.includes("/api/admin/social-posts/reconciliation"), "Admin config must point social exception reads at the trusted backend endpoint.");
assert(adminConfigScript.includes("/api/admin/social-posts/reconciliation/resolve"), "Admin config must point social exception actions at the trusted backend endpoint.");
assert(!adminConfigScript.includes("sk_") && !adminConfigScript.includes("whsec_"), "Admin config must not include secret-looking values.");
assert(adminLocalConfigExample.includes("replace-with-public-firebase-web-api-key"), "Local admin config example must use placeholder Firebase web config.");
assert(adminLocalConfigExample.includes("enabled: true"), "Local admin config example must show how to intentionally enable local live mode.");
assert(!adminLocalConfigExample.includes("sk_") && !adminLocalConfigExample.includes("whsec_"), "Local admin config example must not include secret-looking values.");
assert(adminScript.includes("sampleOrders"), "Admin shell should use sample data only in this slice.");
assert(adminScript.includes("normalizeAdminOrder"), "Admin shell must centralize order normalization for future authenticated reads.");
assert(adminScript.includes("normalizeAdminShipping"), "Admin shell must centralize shipping normalization for future authenticated reads.");
assert(adminScript.includes("buildAdminOrderViewModel"), "Admin shell must centralize order view-model building.");
assert(adminScript.includes("buildAdminShippingViewModel"), "Admin shell must centralize shipping view-model building.");
assert(adminScript.includes("calculateAdminBagCounts"), "Admin shell must centralize bag-count calculations.");
assert(adminScript.includes("printPackingList"), "Admin shell must centralize the packing print action.");
assert(adminScript.includes("adminPaymentStatusLabels"), "Admin shell must use bounded trusted payment status labels.");
assert(adminScript.includes("adminShippingStatusLabels"), "Admin shell must use derived trusted shipping status labels.");
assert(adminScript.includes("buildAdminOrderDetailMarkup"), "Admin shell must centralize read-only order detail rendering.");
assert(adminScript.includes("normalizeAdminInternalNotes"), "Admin shell must defensively normalize internal notes.");
assert(adminScript.includes("adminStatusTransitions"), "Admin shell must define constrained status transitions before live status updates.");
assert(adminScript.includes("labelUrl"), "Admin shell should include trusted label URL display fields.");
assert(adminScript.includes("trackingNumber"), "Admin shell should include trusted tracking number display fields.");
assert(adminScript.includes("buildAdminLabelActionViewModel"), "Admin shell must centralize label action readiness before live wiring.");
assert(adminScript.includes("/api/admin/shippo-labels"), "Admin shell label action must target the trusted backend endpoint.");
assert(adminScript.includes("Auth required"), "Admin shell label action must stay gated until authenticated admin wiring exists.");
assert(adminScript.includes("setAdminActions"), "Admin shell must expose an authenticated action bridge setter for live admin wiring.");
assert(adminScript.includes("clearAdminActions"), "Admin shell must clear live admin actions on sign-out or denied reads.");
assert(adminScript.includes("setAdminActionStatus"), "Admin shell must expose safe action feedback for guarded admin controls.");
assert(adminScript.includes("approveSocialDraft"), "Admin shell must require an explicit social draft approval action.");
assert(adminScript.includes("approveSocialWeek"), "Admin shell must support one-confirmation weekly approval.");
assert(adminScript.includes("Approve all "), "Weekly social approval must describe the exact batch size before queueing.");
assert(adminScript.includes("retry_confirmed_not_published"), "Admin shell must expose the guarded confirmed-absent retry action.");
assert(adminScript.includes("mark_published"), "Admin shell must support verified provider IDs for already-published exceptions.");
assert(adminScript.includes("providerPostIds"), "Admin shell must send verified provider IDs only for mark-published reconciliation.");
assert(adminScript.includes("window.confirm"), "Admin social actions must require explicit operator confirmation.");
assert(adminScript.includes("data-status-action"), "Admin shell must render guarded status action controls.");
assert(!adminScript.includes("fetch("), "Admin shell must not call live backend endpoints before authenticated admin wiring exists.");
assert(!adminScript.toLowerCase().includes("firebase"), "Admin shell must not connect to Firebase yet.");
assert(adminLiveScript.includes("configuredFirebase"), "Admin live bridge must gate Firebase initialization behind config.");
assert(adminLiveScript.includes("resolveFirebaseConfig"), "Admin live bridge must resolve Firebase Hosting public config.");
assert(adminLiveScript.includes("/__/firebase/init.json"), "Admin live bridge must use Firebase Hosting auto configuration.");
assert(adminLiveScript.includes("getIdToken"), "Admin live bridge must use Firebase ID tokens for admin endpoint calls.");
assert(adminLiveScript.includes("getIdTokenResult"), "Admin live bridge must inspect authenticated token claims.");
assert(adminLiveScript.includes("claims.admin !== true"), "Admin live bridge must fail closed without the admin custom claim.");
assert(adminLiveScript.includes("GoogleAuthProvider"), "Admin live bridge must configure the Firebase Google provider.");
assert(adminLiveScript.includes("signInWithPopup"), "Admin live bridge must use Firebase Auth Google popup sign-in.");
assert(adminLiveScript.includes("signInWithEmailAndPassword"), "Admin live bridge must use Firebase Auth email/password sign-in when configured.");
assert(adminLiveScript.includes("signOut"), "Admin live bridge must wire Firebase Auth sign-out when configured.");
assert(adminLiveScript.includes("setSignInDisabled(true)"), "Admin live bridge must keep sign-in controls disabled when Firebase is not configured.");
assert(adminLiveScript.includes("Sign in with Google or a Firebase admin account"), "Admin live bridge must update helper copy when sign-in is configured.");
assert(adminLiveScript.includes("authorization"), "Admin live bridge must send Authorization headers to admin endpoints.");
assert(adminLiveScript.includes("orderRequests"), "Admin live bridge must read the orderRequests collection after sign-in.");
assert(adminLiveScript.includes("setOrders"), "Admin live bridge must hand authenticated reads to the existing renderer.");
assert(adminLiveScript.includes("setActions({"), "Admin live bridge must pass signed-in action wiring to the admin renderer.");
assert(adminLiveScript.includes("clearAdminActions()"), "Admin live bridge must clear action wiring when auth/read access fails.");
assert(adminLiveScript.includes("postAdminJson"), "Admin live bridge must centralize guarded admin endpoint calls.");
assert(adminLiveScript.includes("loadSocialDraftBatch"), "Admin live bridge must load the review-only social draft batch.");
assert(adminLiveScript.includes("TheosWeeklySocialDrafts"), "Admin live bridge must use the rotating weekly draft generator.");
assert(weeklySocialDraftScript.includes("America/Chicago"), "Weekly social drafts must use the farm's Central Time calendar.");
assert(weeklySocialDraftScript.includes("generateWeeklyBatch"), "Weekly social drafts must expose deterministic batch generation.");
assert(weeklySocialDraftScript.includes("facebook") && weeklySocialDraftScript.includes("instagram"), "Weekly drafts must target both configured platforms.");
assert(!adminLiveScript.includes("body.admin"), "Admin live bridge must not send request-provided admin identity.");
assert(!adminLiveScript.includes("sk_") && !adminLiveScript.includes("whsec_"), "Admin live bridge must not include secret-looking values.");

assert(
  JSON.stringify(publicSocialBatch) === JSON.stringify(reviewSocialBatch),
  "The public social draft batch must match the human-review source exactly.",
);
assert(publicSocialBatch.weekOf === "2026-08-03", "The public social batch must identify its review week.");
assert(publicSocialBatch.reviewStatus === "draft", "The public social batch must remain draft until an admin approves individual posts.");
assert(Array.isArray(publicSocialBatch.posts) && publicSocialBatch.posts.length === 7, "The public social batch must contain seven reviewed daily drafts.");
assert(
  new Set(publicSocialBatch.posts.map((post) => post.postId)).size === publicSocialBatch.posts.length,
  "The public social batch must use unique deterministic post IDs.",
);
for (const post of publicSocialBatch.posts) {
  assert(post.status === "draft", `${post.postId} must remain a draft before admin approval.`);
  assert(post.caption.includes("https://theosfarm.com"), `${post.postId} must link to the production storefront.`);
  assert(
    Array.isArray(post.platforms) &&
      post.platforms.join(",") === "facebook,instagram",
    `${post.postId} must target the reviewed Facebook and Instagram pair.`,
  );
  assert(Number.isFinite(new Date(post.scheduledAt).getTime()), `${post.postId} must have a valid schedule.`);
  const imageUrl = new URL(post.imageUrl);
  assert(imageUrl.origin === "https://theosfarm.com", `${post.postId} must use a public Theo's Farm image.`);
  await access(`.${imageUrl.pathname}`);
}

function createAdminFakeElement(name, value = "") {
  return {
    name,
    value,
    dataset: {},
    hidden: true,
    innerHTML: "",
    textContent: "",
    open: false,
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    },
    showModal() {
      this.hidden = false;
      this.open = true;
    },
    close() {
      this.hidden = true;
      this.open = false;
    },
  };
}

function createAdminHarness() {
  const elements = {
    summary: createAdminFakeElement("summary"),
    rows: createAdminFakeElement("rows"),
    packingList: createAdminFakeElement("packingList"),
    packingPrint: createAdminFakeElement("packingPrint"),
    orderDetailDialog: createAdminFakeElement("orderDetailDialog"),
    orderDetailTitle: createAdminFakeElement("orderDetailTitle"),
    orderDetailBody: createAdminFakeElement("orderDetailBody"),
    orderDetailClose: createAdminFakeElement("orderDetailClose"),
    statusFilter: createAdminFakeElement("statusFilter", "all"),
    actionStatus: createAdminFakeElement("actionStatus"),
  };
  const document = {
    querySelector(selector) {
      return {
        "[data-admin-summary]": elements.summary,
        "[data-order-rows]": elements.rows,
        "[data-packing-list]": elements.packingList,
        "[data-packing-print]": elements.packingPrint,
        "[data-order-detail-dialog]": elements.orderDetailDialog,
        "[data-order-detail-title]": elements.orderDetailTitle,
        "[data-order-detail-body]": elements.orderDetailBody,
        "[data-order-detail-close]": elements.orderDetailClose,
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
  assert(!helpers.canTransitionStatus("ready_to_pack", "canceled"), "Admin status transition should block webhook-owned canceled status.");
  assert(Object.isFrozen(helpers.allowedStatuses), "Admin allowed status list should be immutable from the exported helper surface.");
  assert(Object.isFrozen(helpers.statusLabels), "Admin status labels should be immutable from the exported helper surface.");
  assert(Object.isFrozen(helpers.paymentStatusLabels), "Admin payment status labels should be immutable from the exported helper surface.");
  assert(Object.isFrozen(helpers.shippingStatusLabels), "Admin shipping status labels should be immutable from the exported helper surface.");
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
  const normalizedSocialDraft = helpers.normalizeSocialDraft({
    caption: "Approved only after review. https://theosfarm.com",
    hashtags: ["#TheosFarm"],
    imageUrl: "https://theosfarm.com/assets/theos-both-bags.jpg",
    platforms: ["facebook", "instagram", "unsupported"],
    postId: "2026-08-03-review-test",
    scheduledAt: "2026-08-03T13:30:00.000Z",
    status: "draft",
  });
  assert(normalizedSocialDraft.state === "draft", "Admin social normalization must preserve the source draft status.");
  assert(normalizedSocialDraft.platforms.join(",") === "facebook,instagram", "Admin social normalization must discard unsupported platforms.");
  const normalizedSocialException = helpers.normalizeSocialException({
    facebookPostId: "facebook_verified",
    instagramPostId: "instagram_verified",
    lastErrorCode: "publishing_lease_expired",
    platforms: ["facebook", "instagram"],
    postId: "2026-08-03-review-test",
    publishAttempts: 2,
  });
  assert(normalizedSocialException.facebookPostId === "facebook_verified", "Admin reconciliation must preserve safe Facebook provider IDs.");
  assert(normalizedSocialException.instagramPostId === "instagram_verified", "Admin reconciliation must preserve safe Instagram provider IDs.");
  assert(normalizedSocialException.publishAttempts === 2, "Admin reconciliation must preserve bounded publish attempts.");
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
    internalNotes: [
      { body: " Admin-only packing note. ", createdByEmail: "admin@example.test", visibility: "admin" },
      { body: "Do not display this note.", visibility: "customer" },
      { body: "", visibility: "admin" },
    ],
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
  assert(normalized.internalNotes.length === 1, "Admin order normalization should keep only non-empty admin-visible notes.");
  assert(normalized.internalNotes[0].body === "Admin-only packing note.", "Admin internal note normalization should trim note bodies.");
  assert(helpers.normalizeOrder(normalized).internalNotes.length === 1, "Admin internal note normalization should be idempotent.");
  const boundedNotes = helpers.normalizeInternalNotes(Array.from({ length: 12 }, () => ({
    body: "x".repeat(600),
    createdByEmail: "admin@example.test",
    visibility: "admin",
  })));
  assert(boundedNotes.length === 10, "Admin internal note normalization should cap the rendered note count.");
  assert(boundedNotes[0].body.length === 500, "Admin internal note normalization should cap each rendered body.");
  assert(normalized.paymentStatus === "paid", "Admin order normalization should preserve payment status.");
  assert(normalized.shipping.carrier === "UPS", "Admin order normalization should preserve trusted shipping carrier.");
  assert(normalized.shipping.labelUrl === "https://example.com/label.pdf", "Admin order normalization should preserve safe label URLs.");
  assert(normalized.shipping.trackingNumber === "TRACK123", "Admin order normalization should preserve trusted tracking numbers.");
  assert(normalized.items.length === 2, "Admin order normalization should keep positive quantity line items.");
  assert(normalized.subtotalCents === 4589, "Admin order normalization should calculate subtotal when the source subtotal is absent.");

  const viewModel = helpers.buildOrderViewModel(normalized);
  assert(viewModel.statusLabel === "Needs review", "Admin view model should include status labels.");
  assert(viewModel.paymentStatusLabel === "Paid", "Admin view model should include a bounded trusted payment label.");
  assert(viewModel.itemSummary.includes("2 x 20 lb Ear Corn Bag"), "Admin view model should include item summaries.");
  assert(viewModel.shipping.carrierService === "UPS Ground", "Admin view model should include carrier and service labels.");
  assert(viewModel.shipping.amountLabel === "$18.42 shipping", "Admin view model should format shipping amount labels.");
  assert(viewModel.shipping.trackingLabel === "TRACK123", "Admin view model should include tracking labels.");
  assert(viewModel.shipping.status === "label_ready", "Admin view model should derive label-ready status from trusted shipping fields.");
  assert(viewModel.shipping.statusLabel === "Label ready", "Admin view model should label trusted shipping progress.");
  assert(viewModel.shipping.hasLabel, "Admin view model should mark orders with a trusted label URL.");
  assert(viewModel.labelAction.state === "complete", "Admin label action should show completed labels as non-purchasable.");
  assert(viewModel.subtotalLabel === "$45.89", "Admin view model should format subtotal labels.");
  const detailMarkup = helpers.buildOrderDetailMarkup({
    ...normalized,
    stripeCheckoutSessionId: "cs_secret_detail",
    stripePaymentIntentId: "pi_secret_detail",
  });
  assert(detailMarkup.includes("Payment"), "Admin order detail should include bounded payment status.");
  assert(detailMarkup.includes("Label ready"), "Admin order detail should include derived shipping progress.");
  assert(detailMarkup.includes("Admin-only packing note."), "Admin order detail should include normalized internal notes.");
  assert(!detailMarkup.includes("Do not display this note."), "Admin order detail must omit non-admin notes.");
  assert(!detailMarkup.includes("cs_secret_detail") && !detailMarkup.includes("pi_secret_detail"), "Admin order detail must omit raw Stripe identifiers.");
  assert(!detailMarkup.includes("data-admin-internal-note-form"), "Static admin order detail must not expose note writes before authentication.");
  const authenticatedDetailMarkup = helpers.buildOrderDetailMarkup(normalized, true);
  assert(authenticatedDetailMarkup.includes("data-admin-internal-note-form"), "Authenticated admin order detail should expose the trusted note form.");
  assert(authenticatedDetailMarkup.includes('maxlength="500"'), "Admin internal note input should enforce the backend body limit.");

  const unpaidLabelAction = helpers.buildLabelActionViewModel({ paymentStatus: "unpaid", shippingRateId: "rate_unpaid" });
  assert(unpaidLabelAction.state === "blocked", "Admin label action should block unpaid orders.");
  assert(unpaidLabelAction.label === "Payment required", "Admin label action should explain unpaid order blocking.");

  const refunded = helpers.normalizeOrder({
    id: "REFUNDED-ORDER",
    status: "ready_to_pack",
    fulfillmentStatus: "canceled",
    paymentStatus: "refunded",
    shippingRateId: "rate_refunded",
    items: [{ sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: 1, unitPriceCents: 1795 }],
  });
  const refundedViewModel = helpers.buildOrderViewModel(refunded);
  assert(refunded.status === "canceled", "Webhook-canceled orders should not remain ready to pack.");
  assert(refundedViewModel.statusLabel === "Canceled", "Canceled orders should have a clear fulfillment label.");
  assert(refundedViewModel.paymentStatusLabel === "Refunded", "Refunded orders should have a clear payment label.");
  assert(refundedViewModel.labelAction.state === "blocked", "Refunded orders must not allow label purchase.");
  assert(helpers.getPackableOrders([refunded]).length === 0, "Refunded orders must not appear on packing lists.");
  assert(helpers.buildFulfillmentSummary([refunded]).bagCounts.total === 0, "Refunded orders must not count toward bags today.");

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
  let printCalls = 0;
  assert(helpers.printPackingList(() => { printCalls += 1; }), "Admin packing print helper should invoke an available print implementation.");
  assert(printCalls === 1, "Admin packing print helper should invoke the print implementation exactly once.");
  assert(!helpers.printPackingList(null), "Admin packing print helper should fail safely when printing is unavailable.");
  assert(elements.packingPrint.listeners.click?.length === 1, "Admin packing print control should register one click handler.");

  assert(elements.summary.innerHTML.includes("Order requests"), "Admin script should render the offline summary.");
  assert(elements.rows.innerHTML.includes("REQ-1001"), "Admin script should render sample order rows.");
  assert(elements.rows.innerHTML.includes('data-label-action="auth_required"'), "Admin rows should render auth-gated label actions for paid rated orders.");
  assert(elements.rows.innerHTML.includes('data-label-endpoint="/api/admin/shippo-labels"'), "Admin rows should keep label action routing on the trusted backend endpoint.");
  assert(elements.rows.innerHTML.includes('<button class="admin-action" type="button" disabled'), "Admin label action buttons should remain disabled in the static shell.");
  assert(elements.rows.innerHTML.includes('data-status-action="update"'), "Admin rows should render guarded status action controls.");
  assert(elements.rows.innerHTML.includes('data-payment-status="paid"'), "Admin rows should render trusted paid status.");
  assert(elements.rows.innerHTML.includes('data-payment-status="unpaid"'), "Admin rows should render pending status for unpaid orders.");
  assert(!helpers.buildOrderViewModel({ paymentStatus: "<script>" }).paymentStatusLabel.includes("script"), "Admin payment labels must not echo unknown source values.");
  assert(elements.rows.innerHTML.includes('data-shipping-status="needs_rate"'), "Admin rows should identify orders that still need a trusted shipping rate.");
  assert(elements.rows.innerHTML.includes('data-shipping-status="rate_selected"'), "Admin rows should identify orders with a trusted selected rate.");
  assert(elements.rows.innerHTML.includes('data-shipping-status="label_ready"'), "Admin rows should identify orders with trusted label data.");
  const detailButton = { dataset: { orderDetail: "REQ-1002" } };
  elements.rows.listeners.click[0]({ target: detailButton });
  assert(elements.orderDetailDialog.open, "Admin order detail trigger should open the native dialog.");
  assert(elements.orderDetailTitle.textContent === "REQ-1002", "Admin order detail should identify the selected order.");
  assert(elements.orderDetailBody.innerHTML.includes("Rate selected"), "Admin order detail should render the selected order's shipping progress.");
  assert(elements.orderDetailBody.innerHTML.includes("Confirm the box count"), "Admin order detail should render bounded internal notes for the selected order.");
  elements.orderDetailClose.listeners.click[0]({ type: "click" });
  assert(!elements.orderDetailDialog.open, "Admin order detail close control should close the dialog.");
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
      internalNote: "/api/admin/order-notes",
      labelPurchase: "/api/admin/shippo-labels",
      statusUpdate: "/api/admin/order-status",
    },
    postAdminJson(request) {
      adminActionCalls.push(request);
      if (request.endpoint === "/api/admin/order-status") {
        return Promise.resolve({ orderRequestId: request.body.orderRequestId, status: request.body.status });
      }
      if (request.endpoint === "/api/admin/order-notes") {
        return Promise.resolve({
          orderRequestId: request.body.orderRequestId,
          note: {
            body: request.body.body,
            createdByEmail: "admin@example.test",
            visibility: "admin",
          },
        });
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

  helpers.openOrderDetail("REQ-1002");
  assert(elements.orderDetailBody.innerHTML.includes("data-admin-internal-note-form"), "Signed-in order detail should render the internal note form.");
  const noteInput = { value: "  Place on the top pallet.  " };
  const noteSubmit = { disabled: false };
  const noteForm = {
    dataset: { adminInternalNoteForm: "", orderId: "REQ-1002" },
    querySelector(selector) {
      return selector === "[data-admin-internal-note-body]" ? noteInput : noteSubmit;
    },
  };
  let noteDefaultPrevented = false;
  elements.orderDetailBody.listeners.submit[0]({
    target: noteForm,
    preventDefault() { noteDefaultPrevented = true; },
  });
  await flushAdminActions();
  const noteCall = adminActionCalls.find((call) => call.endpoint === "/api/admin/order-notes");
  assert(noteDefaultPrevented, "Admin internal note submit should prevent browser navigation.");
  assert(noteCall?.body.orderRequestId === "REQ-1002", "Admin internal note action should send only the selected order id.");
  assert(noteCall?.body.body === "Place on the top pallet.", "Admin internal note action should trim the bounded note body.");
  assert(noteCall?.body.admin === undefined, "Admin internal note action must not send a browser-supplied admin identity.");
  assert(elements.actionStatus.textContent === "Internal note saved.", "Admin internal note action should announce a successful save.");
  assert(elements.orderDetailBody.innerHTML.includes("Place on the top pallet."), "Saved internal note should appear in the open detail dialog.");

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
      internalNote: "/api/admin/order-notes",
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
  const authHelp = createAdminFakeElement("authHelp");
  const signInForm = createAdminFakeElement("signInForm");
  const signInEmail = createAdminFakeElement("signInEmail", "admin@example.com");
  const signInPassword = createAdminFakeElement("signInPassword", "password123");
  const signInSubmit = createAdminFakeElement("signInSubmit");
  const googleSignInButton = createAdminFakeElement("googleSignInButton");
  const signOutButton = createAdminFakeElement("signOutButton");
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
    querySelectorAll() {
      return [];
    },
    querySelector(selector) {
      return {
        "[data-admin-auth-status]": authStatus,
        "[data-admin-auth-help]": authHelp,
        "[data-admin-sign-in-form]": signInForm,
        "[data-admin-sign-in-email]": signInEmail,
        "[data-admin-sign-in-password]": signInPassword,
        "[data-admin-sign-in-submit]": signInSubmit,
        "[data-admin-google-sign-in]": googleSignInButton,
        "[data-admin-sign-out]": signOutButton,
      }[selector] || null;
    },
  };
  let authCallback = null;
  let liveOrders = null;
  let signInEmailValue = "";
  let signInPasswordValue = "";
  let googleSignInCalled = false;
  let googleProviderParameters = null;
  let signOutCalled = false;
  let signOutShouldReject = false;
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
          internalNote: "/api/admin/order-notes",
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
  let autoConfigRequest = null;
  const autoConfig = await sandbox.window.TheosAdminLive.resolveFirebaseConfig(
    { enabled: true, firebase: { autoConfig: true } },
    async (url) => {
      autoConfigRequest = url;
      return {
        ok: true,
        async json() {
          return {
            apiKey: "hosted-public-api-key",
            appId: "hosted-public-app-id",
            authDomain: "theos-project.firebaseapp.com",
            projectId: "theos-project",
          };
        },
      };
    },
  );
  assert(autoConfigRequest === "/__/firebase/init.json", "Admin live mode should request Firebase Hosting auto config.");
  assert(autoConfig.projectId === "theos-project", "Admin live mode should accept complete Firebase Hosting auto config.");
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
        class GoogleAuthProvider {
          setCustomParameters(parameters) {
            googleProviderParameters = parameters;
          }
        }
        return Promise.resolve({
          GoogleAuthProvider,
          getAuth() {
            return {};
          },
          onAuthStateChanged(auth, callback) {
            authCallback = callback;
          },
          signInWithEmailAndPassword(auth, email, password) {
            signInEmailValue = email;
            signInPasswordValue = password;
            return Promise.resolve({});
          },
          signInWithPopup() {
            googleSignInCalled = true;
            return Promise.resolve({});
          },
          signOut() {
            signOutCalled = true;
            return signOutShouldReject ? Promise.reject(new Error("sign-out-failed")) : Promise.resolve();
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
  assert(signInSubmit.disabled === false, "Configured admin live mode should enable the sign-in submit button.");
  assert(googleSignInButton.disabled === false, "Configured admin live mode should enable Google sign in.");
  assert(authHelp.textContent.includes("Firebase admin account"), "Configured admin live mode should update sign-in helper copy.");
  googleSignInButton.listeners.click[0]();
  await flushAdminActions();
  assert(googleSignInCalled, "Admin live Google control should open Firebase Auth popup sign-in.");
  assert(googleProviderParameters?.prompt === "select_account", "Admin Google sign-in should allow choosing the approved account.");
  signInForm.listeners.submit[0]({
    preventDefault() {},
  });
  await flushAdminActions();
  assert(signInEmailValue === "admin@example.com", "Admin live sign-in should pass the trimmed email to Firebase Auth.");
  assert(signInPasswordValue === "password123", "Admin live sign-in should pass the password to Firebase Auth.");
  assert(signInPassword.value === "", "Admin live sign-in should clear the password after a successful sign-in call.");
  await authCallback({
    getIdTokenResult(forceRefresh) {
      assert(forceRefresh === true, "Admin claim verification should refresh the Firebase ID token.");
      return Promise.resolve({ claims: { admin: true } });
    },
    getIdToken() {
      return Promise.resolve("not-admin-token");
    },
  });

  assert(authStatus.textContent === "Admin access denied", "Admin live bridge should fail closed when Firestore admin reads are denied.");
  assert(!documentElement.hasAttribute("data-admin-signed-in"), "Admin live bridge must not leave the page marked signed in after denied reads.");
  assert(signOutButton.hidden === false, "Denied authenticated users must be able to sign out and switch accounts.");
  assert(liveOrders === null, "Denied admin reads must not replace sample orders.");
  signOutShouldReject = true;
  signOutButton.listeners.click[0]();
  await flushAdminActions();
  assert(signOutCalled, "Admin live sign-out should call Firebase Auth signOut.");
  assert(authStatus.textContent === "Sign out failed", "Admin live sign-out should use generic failure feedback.");
  assert(documentElement.hasAttribute("data-admin-signed-in"), "Admin live sign-out failure should preserve signed-in UI state.");
  assert(signOutButton.hidden === false, "Admin live sign-out failure should leave the sign-out button available.");
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

function createStorefrontHarness({
  checkoutEndpoint = "",
  fetchImpl,
  href = "https://theos.example/",
  shippingRatesEndpoint = "/api/shipping-rates",
  storedCart = null,
  storedPendingCheckout = null,
} = {}) {
  const analyticsCalls = [];
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
    shippingModal: createFakeElement("shippingModal"),
    closeShippingModalButton: createFakeElement("closeShippingModalButton"),
    continueToCheckoutButton: createFakeElement("continueToCheckoutButton"),
    checkoutDetails: createFakeElement("checkoutDetails"),
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
        "[data-shipping-modal]": elements.shippingModal,
        "[data-close-shipping-modal]": elements.closeShippingModalButton,
        "[data-continue-to-checkout]": elements.continueToCheckoutButton,
        "[data-checkout-details]": elements.checkoutDetails,
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

  const storageValues = new Map();
  if (storedCart !== null) {
    storageValues.set("theos-farm-cart-v1", storedCart);
  }
  if (storedPendingCheckout !== null) {
    storageValues.set("theos-farm-pending-checkout-v1", storedPendingCheckout);
  }
  const localStorage = {
    getItem(key) {
      return storageValues.has(key) ? storageValues.get(key) : null;
    },
    removeItem(key) {
      storageValues.delete(key);
    },
    setItem(key, value) {
      storageValues.set(key, String(value));
    },
  };

  const window = {
    TheosAnalytics: {
      initialize: (...args) => analyticsCalls.push(["initialize", ...args]),
      pageView: (...args) => analyticsCalls.push(["page_view", ...args]),
      viewItem: (...args) => analyticsCalls.push(["view_item", ...args]),
      addToCart: (...args) => analyticsCalls.push(["add_to_cart", ...args]),
      beginCheckout: (...args) => analyticsCalls.push(["begin_checkout", ...args]),
      purchase: (...args) => analyticsCalls.push(["purchase", ...args]),
      checkoutError: (...args) => analyticsCalls.push(["checkout_error", ...args]),
    },
    TheosCheckoutConfig: { checkoutEndpoint, shippingRatesEndpoint },
    TheosOrderRequests: orderRequests,
    localStorage,
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
    analyticsCalls,
    elements,
    location,
    localStorage,
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
    async continueFromShippingModal() {
      await elements.continueToCheckoutButton.listeners.click[0]();
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
    storedCart: JSON.stringify([{ sku: "ear-corn-20lb", quantity: 2 }]),
  });

  assert(harness.elements.checkoutResult.hidden === false, "Checkout cancel return should reveal the status region.");
  assert(harness.elements.checkoutResultTitle.textContent.includes("cart is still here"), "Checkout cancel should tell the customer the cart can be reviewed.");
  assert(harness.elements.checkoutResultReference.hidden === true, "Checkout cancel should not show a Stripe reference.");
  assert(harness.elements.cartCount.textContent === 2, "Checkout cancel should restore the saved cart quantity.");
  assert(harness.elements.cartItems.innerHTML.includes("20 lb Ear Corn Bag"), "Checkout cancel should restore the saved product.");
}

{
  const harness = createStorefrontHarness({
    storedCart: JSON.stringify([
      { sku: "ear-corn-20lb", name: "Tampered name", unitPriceCents: 1, quantity: 1 },
      { sku: "ear-corn-20lb", quantity: 40 },
      { sku: "unknown", quantity: 1 },
    ]),
  });

  assert(harness.elements.cartItems.innerHTML.includes("20 lb Ear Corn Bag"), "Stored carts should restore product details from the trusted catalog.");
  assert(!harness.elements.cartItems.innerHTML.includes("Tampered name"), "Stored carts must ignore customer-controlled product names.");
  assert(harness.elements.cartTotal.textContent === "$17.95", "Stored carts must ignore customer-controlled prices.");
  assert(harness.elements.cartCount.textContent === 1, "Stored carts should ignore duplicate and unknown product lines.");
}

{
  const harness = createStorefrontHarness({
    href: "https://theos.example/checkout/success?session_id=cs_test_clear_cart",
    storedCart: JSON.stringify([{ sku: "ear-corn-40lb", quantity: 1 }]),
    storedPendingCheckout: JSON.stringify({
      version: 2,
      sessionId: "cs_test_clear_cart",
      items: [{
        sku: "ear-corn-40lb",
        quantity: 1,
        name: "customer@example.com",
        unitPriceCents: 1,
      }],
      shippingCents: 1842,
      customerEmail: "customer@example.com",
    }),
  });

  assert(harness.elements.cartCount.textContent === 0, "Matching checkout success returns should clear the saved cart.");
  assert(harness.localStorage.getItem("theos-farm-cart-v1") === "[]", "Matching checkout success returns should persist the cleared cart.");
  assert(harness.localStorage.getItem("theos-farm-pending-checkout-v1") === null, "Consumed checkout sessions should be removed.");
  const purchaseCall = harness.analyticsCalls.find(([eventName]) => eventName === "purchase");
  assert(purchaseCall?.[1] === "cs_test_clear_cart", "Checkout success should report the matching session to analytics.");
  assert(purchaseCall?.[2]?.[0]?.sku === "ear-corn-40lb", "Checkout success should report the canonical pending item snapshot.");
  assert(purchaseCall?.[2]?.[0]?.name === "40 lb Ear Corn Bag" && purchaseCall?.[2]?.[0]?.unitPriceCents === 2995, "Checkout success must restore canonical product facts instead of stored display data.");
  assert(!JSON.stringify(purchaseCall).includes("customer@example.com"), "Checkout success analytics must omit extra customer-controlled pending fields.");
  assert(purchaseCall?.[3] === 1842, "Checkout success should report the server-returned shipping amount.");
}

{
  const harness = createStorefrontHarness({
    href: "https://theos.example/checkout/success?session_id=cs_unrecognized_session",
    storedCart: JSON.stringify([{ sku: "ear-corn-40lb", quantity: 1 }]),
    storedPendingCheckout: "cs_expected_session",
  });

  assert(harness.elements.cartCount.textContent === 1, "Unrecognized checkout success URLs must preserve the saved cart.");
  assert(harness.localStorage.getItem("theos-farm-pending-checkout-v1") === "cs_expected_session", "Unrecognized checkout sessions must not consume the pending checkout.");
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
  assert(harness.elements.orderStatus.textContent.includes("Review estimated shipping"), "Shipping-rate flow should show ZIP-only estimates before checkout details.");
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
  await harness.continueFromShippingModal();
  await harness.submitOrder();
  await harness.continueFromShippingModal();

  assert(requests.length === 3, "Storefront should request ZIP estimates, full-address rates, then checkout.");
  assert(requests[1].url === "https://theos.example/api/shipping-rates", "Storefront should re-rate with the full address before checkout.");
  assert(requests[1].body.shippingAddress.addressLine1 === "123 Oak Street", "Full-address shipping request must include the street address.");
  assert(requests[2].url === "https://theos.example/api/checkout-sessions", "Storefront should call the trusted checkout endpoint after final rate selection.");
  assert(requests[2].body.orderRequest.subtotalCents === 1795, "Checkout request must include the prepared order request.");
  assert(requests[2].body.shippingAddress.zip === "62401", "Checkout request must include the shipping address used for re-rating.");
  assert(requests[2].body.selectedShippingRate.rateId === "[\"rate_20\",\"rate_40\"]", "Checkout request must include the selected shipping rate id.");
  assert(harness.location.assignedUrl === "https://checkout.stripe.com/c/pay/cs_test_123", "Valid checkout handoff should redirect to Stripe Checkout.");
  const pendingCheckout = JSON.parse(harness.localStorage.getItem("theos-farm-pending-checkout-v1"));
  assert(pendingCheckout.sessionId === "cs_test_123", "Checkout handoff should persist the matching session for return correlation.");
  assert(pendingCheckout.items.length === 1 && pendingCheckout.items[0].sku === "ear-corn-20lb", "Checkout handoff should persist only canonical SKU and quantity facts.");
  assert(pendingCheckout.shippingCents === 4342, "Checkout handoff should persist the selected server-returned shipping amount.");
  assert(!JSON.stringify(pendingCheckout).includes("Customer Name") && !JSON.stringify(pendingCheckout).includes("62401"), "Pending analytics state must omit customer and address data.");
}

assert(storefrontScript.includes("requestCheckoutSession"), "Storefront should retain the future Stripe Checkout handoff path.");
assert(storefrontScript.includes("selectedShippingRate"), "Storefront should require a selected shipping rate before future checkout.");

console.log("Static prototype checks passed.");
