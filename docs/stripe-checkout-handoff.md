# Stripe Checkout Handoff Contract

This contract defines the future trusted backend boundary between the static Theo's Farm storefront draft and Stripe-hosted Checkout. It does not add card collection, live Stripe calls, secrets, deployment, or storefront behavior.

## Hosting Boundary

The public static storefront may be hosted on GoDaddy or another static host. This contract does not require Firebase Hosting and should not assume the public site is served by Firebase.

The trusted checkout endpoint and Stripe webhook can run on any approved backend platform. Firestore/Firebase references in this document describe the order data model, rules, and backend storage foundation only.

## Scope

In scope for the future backend:

- accept a validated storefront order request draft
- add the Firestore server timestamp
- create the `orderRequests` document through trusted code
- create a Stripe Checkout Session
- return the hosted Checkout redirect URL to the client
- receive Stripe webhooks and update trusted payment fields

Out of scope for the static storefront:

- collecting card numbers, CVV, bank details, or raw payment details
- writing Stripe IDs or payment status
- faking Firestore server timestamps
- calling Stripe directly
- storing Stripe secrets or webhook signing secrets

## Storefront Draft Alignment

`order-request.js` builds a draft payload for trusted backend submission. The draft intentionally omits `createdAt`; the backend must add the Firestore server timestamp when it creates the `orderRequests` document.

The current draft shape is:

```json
{
  "source": "static-storefront",
  "status": "needs_review",
  "subtotalCents": 4400,
  "items": [
    {
      "name": "20 lb Ear Corn Bag",
      "sku": "ear-corn-20lb",
      "quantity": 1,
      "unitPriceCents": 1600
    },
    {
      "name": "40 lb Ear Corn Bag",
      "sku": "ear-corn-40lb",
      "quantity": 1,
      "unitPriceCents": 2800
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
```

The companion handoff metadata from `order-request.js` currently declares:

```json
{
  "firestoreWrite": {
    "collection": "orderRequests",
    "createdAt": "server_timestamp_required",
    "trustedWriterRequired": true
  },
  "handoff": {
    "type": "stripe_checkout",
    "mode": "backend_required"
  }
}
```

## Checkout Session Request

Future endpoint:

```text
POST /api/checkout-sessions
```

Request body:

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

Backend validation must mirror the product, customer, and subtotal constraints from the Firestore public create rules and `order-request.js`. The exception is `createdAt`: the browser draft omits it, and the backend adds the server timestamp.

- `source` must be `static-storefront`
- initial `status` must be `needs_review`
- `items` must contain one or two supported SKUs
- quantities must be integers from 1 through 50 per product
- unit prices and subtotal must be recalculated server-side
- `subtotalCents` must match the server-side recalculation
- customer name, contact, preferred contact, shipping ZIP, and note limits must be enforced
- client-supplied `createdAt`, Stripe IDs, payment status, or trusted fulfillment fields must be ignored or rejected

## Checkout Session Response

Success response:

```json
{
  "orderRequestId": "firestore-document-id",
  "checkoutSessionId": "cs_test_...",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

The client should redirect to `checkoutUrl`. It should not persist `checkoutSessionId` or attempt to write payment fields directly.

Validation or checkout creation failure response:

```json
{
  "error": {
    "code": "invalid_order_request",
    "message": "Adjust the cart quantity before requesting checkout."
  }
}
```

Keep error messages safe for customers. Do not expose Stripe secrets, webhook details, stack traces, or internal Firestore paths.

## Backend Create Sequence

1. Receive the storefront draft.
2. Recalculate catalog item names, unit prices, quantities, and subtotal from server-owned product data.
3. Create an `orderRequests` document with `createdAt` set to the Firestore server timestamp.
4. Create a Stripe Checkout Session in `payment` mode using server-owned line items.
5. Attach the Firestore document ID and order summary metadata to the Checkout Session.
6. Save the trusted Checkout Session ID to the order document.
7. Return the Checkout URL to the client.

The backend may create the Firestore document before the Stripe session so the session can include the Firestore ID in metadata. If Stripe session creation fails, mark the order request for review or delete the abandoned draft through trusted backend policy; never ask the public client to clean up trusted fields.

## Stripe Checkout Session Settings

Recommended session configuration:

- `mode`: `payment`
- `ui_mode`: hosted Checkout redirect
- `line_items`: server-generated from the supported product catalog
- `payment_method_types`: let Stripe determine available methods, including Google Pay, Apple Pay, and Link when enabled in Stripe
- `success_url`: production storefront success page with the Checkout Session ID placeholder
- `cancel_url`: production storefront cart or checkout page
- `customer_email`: use only when the contact value is a valid email address
- `metadata`: include the order reference fields below

Do not send raw card data, CVV, or bank data to the backend or Firestore. Stripe-hosted Checkout owns payment collection.

## Stripe Metadata

Every Checkout Session should include stable metadata for webhook reconciliation:

```json
{
  "orderRequestId": "firestore-document-id",
  "source": "static-storefront",
  "storefront": "theos-farm",
  "schemaVersion": "2026-06-28",
  "subtotalCents": "4400",
  "itemsSummary": "ear-corn-20lb:1,ear-corn-40lb:1",
  "shippingZip": "62401"
}
```

Stripe metadata values are strings, so numeric values should be stringified. Do not put full addresses, notes, card details, or sensitive customer data in metadata.

## Trusted Firestore Fields

Public storefront code may provide only the draft order fields documented in `docs/firebase-order-foundation.md`. Trusted backend or webhook code owns these fields:

```json
{
  "createdAt": "server timestamp",
  "stripeCheckoutSessionId": "cs_test_...",
  "stripePaymentIntentId": "pi_...",
  "stripeCustomerId": "cus_...",
  "paymentStatus": "unpaid | paid | failed | refunded",
  "stripePaymentStatus": "unpaid | paid | no_payment_required",
  "checkoutStatus": "open | complete | expired",
  "paidAt": "server timestamp",
  "checkoutCreatedAt": "server timestamp",
  "checkoutCompletedAt": "server timestamp",
  "lastStripeEventId": "evt_...",
  "lastStripeEventAt": "server timestamp",
  "trustedUpdatedAt": "server timestamp"
}
```

Current `firestore.rules` already rejects public creates that include `stripeCheckoutSessionId` or `stripePaymentIntentId`. Future rules and admin tooling should preserve that boundary for every trusted payment field, even if field names expand.

## Webhook Expectations

Future endpoint:

```text
POST /api/stripe/webhook
```

The webhook handler must verify Stripe signatures before reading event data. It should be idempotent by storing the latest processed Stripe event ID or maintaining a separate event log.

Required events for version one:

- `checkout.session.completed`: mark the order paid only after confirming the session belongs to the expected `orderRequestId`; persist Checkout Session ID, Payment Intent ID, payment status, checkout status, and completion timestamps.
- `checkout.session.expired`: mark the checkout as expired without marking the order paid.
- `payment_intent.payment_failed`: mark payment as failed when the Payment Intent maps to a known order.

Optional later events:

- `charge.refunded` or `refund.updated` for refund tracking
- `payment_intent.succeeded` as a secondary reconciliation signal

Webhook updates must never trust a customer-supplied order ID alone. Reconcile using Stripe object IDs plus the metadata written by the backend when it created the Checkout Session.

The local scaffold now includes an SDK-free verified-event adapter boundary for these three version-one events. `stripeWebhookHandler` still verifies the Stripe signature before handing an event to the adapter; the adapter receives only the verified event plus injected trusted lookup, update, and event-idempotency functions.

## Admin And Fulfillment Boundary

The admin queue should use trusted payment fields as read-only payment facts. Admin users may update fulfillment statuses and notes after authentication exists, but they should not manually set Stripe IDs or payment facts from the browser.

Suggested first paid-order flow:

1. Order starts as `needs_review` while Checkout is open.
2. Webhook confirms payment and records payment fields.
3. Trusted backend or admin workflow moves fulfillment status toward `ready_to_pack`.
4. Admin tools show payment facts alongside packing and shipping status.

## Implementation Notes For Future Slice

- Keep Stripe secret keys and webhook signing secrets in backend environment configuration only.
- Use Stripe test mode until product prices, shipping/delivery handling, taxes, and receipt language are approved.
- Confirm whether shipping price is known before Checkout or requires a quote workflow.
- Add backend tests for subtotal recalculation, unsupported SKU rejection, client-supplied trusted-field rejection, Stripe metadata creation, and webhook idempotency.
- Update Firestore rules only when the backend/admin field model is finalized.
