# Backend Checkout Scaffold

This slice adds a local, host-neutral scaffold for the future trusted Theo's Farm checkout backend. It does not deploy anything, call Stripe, connect to Firebase, or include secrets.

## Boundary

Theo's Farm is the Farm to Feeder ear corn storefront for the 20 lb Ear Corn Bag and 40 lb Ear Corn Bag. Fulfillment is shipping/delivery only, with no local pickup. The public storefront production direction is Firebase Hosting, and the old Zerrusen Farms informational site should remain separate as its own business/site.

The checkout backend must run somewhere that can safely hold Stripe and Firebase credentials. The selected direction is Firebase Cloud Functions, with Cloud Run or another approved trusted API host as a fallback if Firebase Functions does not fit a later requirement.

Because the storefront and trusted API may be on different origins, the backend scaffold includes `OPTIONS` preflight handling and origin-based CORS headers. Production should set `CORS_ALLOWED_ORIGINS` to the approved storefront origin, for example the Theo's Farm production domain.

The static storefront should submit the draft from `order-request.js` to:

```text
POST /api/checkout-sessions
```

Stripe should send webhooks to:

```text
POST /api/stripe/webhook
```

## Files

- `functions/src/order-validation.js` keeps the server-owned product catalog, validates storefront drafts, recalculates subtotals, rejects client-supplied trusted fields, and builds safe Stripe metadata.
- `functions/src/index.js` exports lightweight route handlers for checkout sessions and Stripe webhooks. They are disabled by default unless environment configuration and future trusted adapters are provided.
- `functions/src/checkout-adapter.js` builds the production-adjacent Stripe Checkout handoff using injected trusted storage and Stripe functions only. It does not import Stripe, Firebase, or make network calls by itself.
- `functions/src/stripe-api-adapter.js` provides the SDK-agnostic Stripe API boundary for future injection. It wraps a Stripe-like client passed in by trusted runtime code, forwards hosted Checkout Session params to `checkout.sessions.create`, and forwards raw webhook payloads to `webhooks.constructEvent` without importing Stripe or storing secrets.
- `functions/src/stripe-webhook-adapter.js` maps already-verified Stripe webhook events to trusted order update fields using injected order lookup, update, and event idempotency functions only. It does not import Stripe, Firebase, or make network calls by itself.
- `functions/src/firestore-adapter.js` provides an SDK-free Firestore adapter boundary for the injected checkout and webhook dependencies. It expects a Firestore-like backend object to be passed in and does not import Firebase Admin, load credentials, or make network calls by itself.
- `functions/src/trusted-backend-composition.js` composes the Firestore adapter and Stripe API adapter into the exact dependency shapes expected by the checkout and webhook handlers. It accepts injected Firestore-like and Stripe-like clients plus optional collection names and server timestamp provider; it does not import Firebase Admin, Firebase Functions, Stripe SDK, read secrets, initialize clients, deploy, or call the network by itself.
- `functions/src/firebase-functions-runtime-guard.js` is the SDK-free guard for the future Firebase Functions entrypoint. It checks that runtime wiring provided the required environment keys, Firestore-like client, Stripe-like client, and server timestamp provider before handing those injected pieces to `createTrustedBackendComposition`.
- `functions/src/stripe-api-adapter.test.js` checks the Stripe API boundary with in-memory fake Stripe clients only. These tests do not import Stripe, call the network, or require secrets.
- `functions/src/trusted-backend-composition.test.js` checks the composition boundary with in-memory fake Firestore and Stripe clients only, including handler-level checkout and webhook flows.
- `functions/src/firebase-functions-runtime-guard.test.js` checks missing runtime/env reporting and proves the guard can compose the existing checkout and webhook handlers with in-memory fake clients only.
- `functions/src/order-validation.test.js` checks catalog alignment, validation, trusted field rejection, subtotal recalculation, and metadata safety.
- `functions/.env.example` documents local placeholders only. Do not commit real `.env` files, Stripe secrets, webhook signing secrets, or Firebase service-account JSON.

## Checkout Session Handler

Stripe Checkout owns payment collection. Google Pay, Apple Pay, and Link availability should be configured through Stripe Checkout where available rather than through public storefront JavaScript.

`checkoutSessionsHandler` expects:

```json
{
  "orderRequest": {
    "source": "static-storefront",
    "status": "needs_review",
    "subtotalCents": 4790,
    "items": [
      {
        "name": "20 lb Ear Corn Bag",
        "sku": "ear-corn-20lb",
        "quantity": 1,
        "unitPriceCents": 1795
      }
    ],
    "customer": {
      "name": "Customer Name",
      "contact": "customer@example.com",
      "preferredContact": "email",
      "shippingZip": "62401",
      "note": "Delivery timing or address notes"
    }
  }
}
```

The handler rejects `createdAt`, Stripe IDs, payment status, checkout status, webhook event IDs, and fulfillment transition fields from public clients. Future trusted code should add those fields itself.

When configuration is missing, the route returns a disabled response instead of calling Stripe:

```json
{
  "error": {
    "code": "checkout_disabled",
    "message": "Checkout session creation is not enabled yet."
  },
  "mock": true
}
```

When configuration exists, the scaffold still requires injected trusted dependencies to create the Firestore document, create the Stripe Checkout Session, persist trusted Stripe IDs, and return:

```json
{
  "orderRequestId": "firestore-document-id",
  "checkoutSessionId": "cs_test_...",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

The scaffold uses a `FIRESTORE_SERVER_TIMESTAMP_REQUIRED` sentinel unless a future adapter provides the platform's real Firestore server timestamp value, such as `FieldValue.serverTimestamp()`. Do not replace this with a browser timestamp or local clock value for production writes.

The adapter boundary is:

```js
const { createCheckoutSessionAdapter } = require("./src/checkout-adapter");

const createCheckoutSession = createCheckoutSessionAdapter({
  createOrderRequest,
  createStripeCheckoutSession,
  updateOrderRequest,
  markCheckoutSessionFailed,
});
```

`createOrderRequest` receives the trusted order request with backend-owned timestamp and checkout fields. `createStripeCheckoutSession` receives server-generated `params` containing Checkout line items, redirect URLs, `client_reference_id`, and safe metadata. `updateOrderRequest` stores trusted Stripe identifiers such as `stripeCheckoutSessionId`. `markCheckoutSessionFailed` is optional and can record backend-owned failure state if Stripe session creation fails after the trusted order document was created. If session creation succeeds but the trusted order update fails, the adapter preserves the Checkout Session ID in the failure marker and leaves `checkoutStatus` open for reconciliation.

The handler can also receive `checkoutAdapterDependencies` and will build the adapter locally. If these dependencies are absent, the route remains disabled or returns `checkout_adapter_missing` instead of attempting Stripe or Firestore work.

## Future Firebase Functions Runtime Wiring

The runtime guard is not a deployable Firebase Function by itself. When real dependencies are intentionally installed later, the Firebase Functions entrypoint should initialize Firebase Admin/Firestore and Stripe in trusted runtime code, then pass only those initialized clients and `FieldValue.serverTimestamp` into:

```js
const {
  createFirebaseFunctionsRuntime,
} = require("./src/firebase-functions-runtime-guard");

const runtime = createFirebaseFunctionsRuntime({
  env: process.env,
  firestore,
  stripe,
  serverTimestamp: FieldValue.serverTimestamp,
});
```

The guard expects the future runtime to provide `CORS_ALLOWED_ORIGINS`, `FIREBASE_PROJECT_ID`, `STRIPE_CANCEL_URL`, `STRIPE_SECRET_KEY`, `STRIPE_SUCCESS_URL`, and `STRIPE_WEBHOOK_SIGNING_SECRET` from backend configuration. It reports missing key names and client capabilities only; it must not log secret values. Keep real secret loading, Firebase Admin initialization, Stripe SDK initialization, and `firebase-functions` exports outside this SDK-free scaffold until the live Functions integration is reviewed.

## Webhook Handler

`stripeWebhookHandler` requires the raw request body and the `Stripe-Signature` header. Production webhook processing must verify the signature before reading event data.

The scaffold does not parse unverified event JSON. A future adapter should use the Stripe SDK equivalent of:

```js
stripe.webhooks.constructEvent(rawBody, signature, signingSecret)
```

Version-one events to handle:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

After verification, `stripeWebhookHandler` can receive `stripeWebhookAdapterDependencies` and build the SDK-free verified event adapter locally. The adapter requires injected `claimStripeEventProcessing`, `markStripeEventProcessed`, `findOrderByCheckoutSessionId`, `findOrderByPaymentIntentId`, and `updateOrderRequest` functions. `claimStripeEventProcessing` should atomically reserve an event ID before order mutation so concurrent deliveries cannot both update an order. Without those functions, the route remains disabled or returns `stripe_webhook_adapter_dependency_missing` instead of attempting trusted storage work.

Webhook updates should be idempotent. Store processed Stripe event IDs through a separate event log or an equivalent trusted backend mechanism. The adapter records no-op outcomes for unsupported events so replays do not repeatedly touch order records. Supported events that cannot yet map to a known order remain retryable instead of being marked processed.

## Trusted Firestore Ownership

Public storefront JavaScript may send only the draft fields documented in `docs/stripe-checkout-handoff.md`.

Trusted backend and webhook code own:

- `createdAt`
- `stripeCheckoutSessionId`
- `stripePaymentIntentId`
- `stripeCustomerId`
- `paymentStatus`
- `stripePaymentStatus`
- `checkoutStatus`
- `paidAt`
- `checkoutCreatedAt`
- `checkoutCompletedAt`
- `checkoutErrorCode`
- `lastStripeEventId`
- `lastStripeEventAt`
- `trustedUpdatedAt`
- fulfillment transition fields such as `readyToPackAt`, `packedAt`, `shippedAt`, `deliveredAt`, and `refundedAt`

Do not store raw card numbers, CVV, bank details, or full Stripe payment method payloads in Firestore.

## Local Checks

```bash
npm --prefix functions run check
```

Optional local scaffold server:

```bash
node functions/src/index.js
```

Then POST to `http://localhost:8787/api/checkout-sessions` or `http://localhost:8787/api/stripe/webhook`. Without real local configuration and adapters, the routes intentionally return disabled or not-implemented responses.
