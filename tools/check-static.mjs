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
  "docs/godaddy-static-deploy.md",
  "tools/package-static.mjs",
  "tools/smoke-static-package.mjs",
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
const checkoutConfigScript = await readFile("checkout-config.js", "utf8");
const admin = await readFile("admin.html", "utf8");
const adminScript = await readFile("admin.js", "utf8");
const gitignore = await readFile(".gitignore", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const hostingReadiness = await readFile("docs/firebase-hosting-readiness.md", "utf8");
const stripeHandoff = await readFile("docs/stripe-checkout-handoff.md", "utf8");
const backendScaffold = await readFile("docs/backend-checkout-scaffold.md", "utf8");
const godaddyDeploy = await readFile("docs/godaddy-static-deploy.md", "utf8");
const packageStaticScript = await readFile("tools/package-static.mjs", "utf8");
const smokeStaticPackageScript = await readFile("tools/smoke-static-package.mjs", "utf8");
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
assert(godaddyDeploy.includes("dist/godaddy-static/"), "GoDaddy deploy doc must point to the generated static package folder.");
assert(godaddyDeploy.includes("checkoutEndpoint: \"\""), "GoDaddy deploy doc must keep checkout config blank by default.");
assert(godaddyDeploy.includes("pre-backend static package"), "GoDaddy deploy doc must explain the current blank endpoint gate.");
assert(godaddyDeploy.includes("npm run smoke:static"), "GoDaddy deploy doc must include the local package smoke check.");
assert(godaddyDeploy.includes("temporary local-only server"), "GoDaddy deploy doc must describe the smoke check hosting boundary.");
assert(godaddyDeploy.includes("Upload the contents of that folder, not the repo root."), "GoDaddy deploy doc must warn against uploading the repo root.");
assert(godaddyDeploy.includes("functions/"), "GoDaddy deploy doc must exclude backend functions from static hosting.");
assert(godaddyDeploy.includes("docs/"), "GoDaddy deploy doc must exclude planning docs from static hosting.");
assert(godaddyDeploy.includes(".env"), "GoDaddy deploy doc must exclude environment files from static hosting.");
assert(packageStaticScript.includes("storefrontFiles"), "Static package script must use an explicit storefront file allowlist.");
assert(packageStaticScript.includes("allowedAssetExtensions"), "Static package script must use an explicit asset type allowlist.");
assert(packageStaticScript.includes("dist\", \"godaddy-static"), "Static package script must write to dist/godaddy-static.");
assert(packageStaticScript.includes("TheosCheckoutConfig?.checkoutEndpoint === \"\""), "Static package script must evaluate and enforce blank checkout config by default.");
assert(packageStaticScript.includes("mkdtemp"), "Static package safety check must validate a generated package artifact.");
assert(packageStaticScript.includes("functions"), "Static package script must prevent backend functions from entering the deploy package.");
assert(packageStaticScript.includes("docs"), "Static package script must prevent docs from entering the deploy package.");
assert(packageStaticScript.includes("STRIPE_SECRET_KEY"), "Static package script must scan for Stripe secret-looking values.");
assert(smokeStaticPackageScript.includes("dist\", \"godaddy-static"), "Static smoke check must target dist/godaddy-static by default.");
assert(smokeStaticPackageScript.includes("createServer"), "Static smoke check must run against a local static server.");
assert(smokeStaticPackageScript.includes("checkoutEndpoint === \"\""), "Static smoke check must enforce blank checkout config by default.");
assert(smokeStaticPackageScript.includes("functions"), "Static smoke check must verify backend functions are not exposed.");
assert(smokeStaticPackageScript.includes("docs"), "Static smoke check must verify docs are not exposed.");
assert(smokeStaticPackageScript.includes("STRIPE_SECRET_KEY"), "Static smoke check must scan for Stripe secret-looking values.");
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
assert(storefrontScript.includes("buildOrderRequest"), "Storefront submit should use the order request builder.");
assert(checkoutConfigScript.includes("TheosCheckoutConfig"), "Checkout config must expose the public storefront config object.");
assert(checkoutConfigScript.includes("checkoutEndpoint"), "Checkout config must include a public checkout endpoint placeholder.");
{
  const sandbox = {};
  new Script(checkoutConfigScript, { filename: "checkout-config.js" }).runInContext(createContext(sandbox));
  assert(sandbox.TheosCheckoutConfig?.checkoutEndpoint === "", "Checkout endpoint should remain disabled until a trusted API URL is configured.");
}
assert(!checkoutConfigScript.includes("sk_"), "Checkout config must not include Stripe secret-looking values.");
assert(!checkoutConfigScript.includes("whsec_"), "Checkout config must not include webhook secret-looking values.");
assert(storefrontScript.includes("fetch(endpoint"), "Configured storefront checkout should call the trusted backend endpoint.");
assert(storefrontScript.includes("JSON.stringify({ orderRequest })"), "Configured storefront checkout should submit only the validated order request draft.");
assert(storefrontScript.includes("checkout.stripe.com"), "Storefront should only redirect to Stripe Checkout URLs.");
assert(storefrontScript.includes("checkoutFailureMessage"), "Storefront should show a safe checkout failure message.");
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
    scrollIntoView() {
      this.scrolled = true;
    },
    setAttribute(attribute, value) {
      this.attributes[attribute] = value;
    },
  };
}

function createStorefrontHarness({ checkoutEndpoint = "", fetchImpl } = {}) {
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
    orderSubmitButton: createFakeElement("orderSubmitButton"),
    orderInput: createFakeElement("orderInput"),
    delivery: createFakeElement("delivery"),
  };

  elements.orderForm.children = {
    'button[type="submit"]': elements.orderSubmitButton,
    input: elements.orderInput,
  };

  const addButtons = [
    createFakeElement("add20lb"),
    createFakeElement("add40lb"),
  ];
  addButtons[0].dataset = {
    sku: "ear-corn-20lb",
    name: "20 lb Ear Corn Bag",
    priceCents: "1600",
  };
  addButtons[1].dataset = {
    sku: "ear-corn-40lb",
    name: "40 lb Ear Corn Bag",
    priceCents: "2800",
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
        "#delivery": elements.delivery,
      }[selector] || null;
    },
    querySelectorAll(selector) {
      return selector === "[data-add-to-cart]" ? addButtons : [];
    },
  };

  const location = {
    href: "https://theos.example/",
    assignedUrl: "",
    assign(url) {
      this.assignedUrl = url;
    },
  };

  const window = {
    TheosCheckoutConfig: { checkoutEndpoint },
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
    async addFirstProductAndSubmit(values = {}) {
      addButtons[0].listeners.click[0]();
      elements.orderForm.values = {
        name: "Customer Name",
        contact: "customer@example.com",
        zip: "62401",
        contactMethod: "Email",
        note: "",
        ...values,
      };

      await elements.orderForm.listeners.submit[0]({
        preventDefault() {},
      });
    },
  };
}

{
  let fetchCalled = false;
  const harness = createStorefrontHarness({
    fetchImpl() {
      fetchCalled = true;
      throw new Error("Blank checkout config should not call fetch.");
    },
  });

  await harness.addFirstProductAndSubmit();

  assert(!fetchCalled, "Blank checkout config should preserve prototype behavior without calling the backend.");
  assert(harness.elements.orderStatus.textContent.includes("Live submission is disabled"), "Blank checkout config should show disabled prototype messaging.");
  assert(harness.location.assignedUrl === "", "Blank checkout config must not redirect.");
  assert(harness.elements.cartItems.innerHTML.includes("20 lb Ear Corn Bag"), "Blank checkout config must not clear the cart.");
}

{
  let requestUrl = "";
  let requestBody = {};
  const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test_valid";
  const harness = createStorefrontHarness({
    checkoutEndpoint: "https://api.theos.example/api/checkout-sessions",
    async fetchImpl(url, options) {
      requestUrl = url;
      requestBody = JSON.parse(options.body);
      assert(options.method === "POST", "Configured checkout should use POST.");
      assert(options.headers["content-type"] === "application/json", "Configured checkout should send JSON.");
      return {
        ok: true,
        async json() {
          return {
            orderRequestId: "order_123",
            checkoutSessionId: "cs_test_valid",
            checkoutUrl,
          };
        },
      };
    },
  });

  await harness.addFirstProductAndSubmit();

  assert(requestUrl === "https://api.theos.example/api/checkout-sessions", "Configured checkout should call the public trusted backend URL.");
  assert(requestBody.orderRequest.source === "static-storefront", "Configured checkout should post the validated order request draft.");
  assert(requestBody.orderRequest.items[0].sku === "ear-corn-20lb", "Configured checkout should include cart items in the order request.");
  assert(harness.location.assignedUrl === checkoutUrl, "Valid Stripe Checkout handoff should redirect.");
}

for (const response of [
  {
    ok: false,
    async json() {
      return {
        error: {
          code: "checkout_disabled",
          message: "Checkout session creation is not enabled yet.",
        },
      };
    },
  },
  {
    ok: true,
    async json() {
      return {
        orderRequestId: "order_123",
        checkoutSessionId: "cs_test_valid",
        checkoutUrl: "https://example.com/not-stripe-checkout",
      };
    },
  },
]) {
  const harness = createStorefrontHarness({
    checkoutEndpoint: "https://api.theos.example/api/checkout-sessions",
    async fetchImpl() {
      return response;
    },
  });

  await harness.addFirstProductAndSubmit();

  assert(harness.location.assignedUrl === "", "Failed or invalid checkout handoffs must not redirect.");
  assert(harness.elements.orderStatus.textContent === "Checkout could not be started. Please try again or contact Theo's Farm.", "Failed checkout should show a safe customer-facing message.");
  assert(harness.elements.orderSubmitButton.disabled === false, "Failed checkout should re-enable order submission.");
  assert(harness.elements.cartItems.innerHTML.includes("20 lb Ear Corn Bag"), "Failed checkout must not clear the cart.");
}

console.log("Static prototype checks passed.");
