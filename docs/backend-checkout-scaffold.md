# Backend Checkout Scaffold

This slice adds a local, host-neutral scaffold for the future trusted Theo's Farm checkout backend. It does not deploy anything, call Stripe, connect to Firebase, or include secrets.

## Boundary

Theo's Farm is the Farm to Feeder ear corn storefront for the 20 lb Ear Corn Bag and 40 lb Ear Corn Bag. Fulfillment is shipping/delivery only, with no local pickup. The public storefront can stay on GoDaddy or another static host, and the old Zerrusen Farms informational site should remain separate as its own business/site.

The checkout backend must run somewhere that can safely hold Stripe and Firebase credentials, such as Cloud Functions, Cloud Run, Render, Railway, Fly.io, or another approved trusted API host.

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
    "subtotalCents": 4400,
    "items": [
      {
        "name": "20 lb Ear Corn Bag",
        "sku": "ear-corn-20lb",
        "quantity": 1,
        "unitPriceCents": 1600
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

When configuration exists, the scaffold still requires a future trusted adapter to create the Firestore document, create the Stripe Checkout Session, persist trusted Stripe IDs, and return:

```json
{
  "orderRequestId": "firestore-document-id",
  "checkoutSessionId": "cs_test_...",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

The scaffold uses a `FIRESTORE_SERVER_TIMESTAMP_REQUIRED` sentinel unless a future adapter provides the platform's real Firestore server timestamp value, such as `FieldValue.serverTimestamp()`. Do not replace this with a browser timestamp or local clock value for production writes.

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

Webhook updates should be idempotent. Store the latest processed Stripe event ID on the order document or maintain a separate event log.

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
