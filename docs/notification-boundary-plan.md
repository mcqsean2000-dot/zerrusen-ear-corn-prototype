# Notification Boundary Plan

This plan defines the first Theo's Farm notification boundary. Provider-neutral paid-order builders, Firestore outbox persistence, and the trusted paid-webhook integration are implemented. No email provider is installed, no email is sent, nothing is deployed by this work, and no secrets are introduced.

Approved farm/admin email account: `theosfeedfarm@gmail.com`. Use this account for business email setup and as the initial admin notification recipient once a provider and trusted backend send path are approved.

## Implementation Status

Implemented:

- `functions/src/notification-builder.js` builds customer order confirmation and admin paid-order jobs only from trusted paid-order summaries.
- Invalid or missing customer email addresses skip the customer job while preserving the admin job.
- Free-form customer note text and raw Stripe fields are excluded.
- `functions/src/notification-outbox.js` delegates built jobs to trusted persistence.
- `functions/src/firestore-adapter.js` creates backend-only `notificationOutbox` documents with deterministic idempotency keys and treats repeated keys as duplicates.
- `checkout.session.completed` handling builds notifications from the trusted stored order plus server-owned payment fields.
- The paid order update, outbox writes, and Stripe event completion happen in one Firestore transaction. A repeated event returns as a replay without duplicating jobs.
- The trusted backend composition also exposes `queuePaidOrderNotifications` for future trusted notification workflows.
- `functions/src/notification-delivery.js` processes one claimed job through injected trusted persistence and provider functions. It records provider message IDs on success, sanitizes failure codes, caps retries, and stops retrying permanent failures.
- `functions/src/firestore-adapter.js` transactionally claims pending/retry jobs, increments attempts, prevents concurrent claims, rejects stale result writers, and records `sent`, `retry_pending`, or terminal `failed` state without storing provider error messages.
- The trusted backend composition exposes these persistence functions separately from the provider sender, so production remains disabled until both a provider and trigger are intentionally wired.

Not yet implemented:

- Provider selection, credentials, a trusted trigger, or live sends.
- Scheduled daily fulfillment summary generation.

Firestore rules currently deny public reads and writes to `notificationOutbox`; only trusted backend Admin SDK code can use this boundary.

## Scope

Version one should cover three notification jobs:

- Customer order confirmation
- Admin new order notification
- Admin daily fulfillment summary

Later notifications can add shipping confirmation, delivery notification, recurring order reminders, and low inventory alerts after the order and fulfillment model is live.

## Trigger Events

Use trusted backend or authenticated admin events only. Public storefront JavaScript should not send production email directly.

| Event | Trigger owner | Timing | Recipient |
| --- | --- | --- | --- |
| `customer.order_confirmation` | Trusted checkout/webhook backend | After Stripe Checkout confirms payment and the matching order is updated to paid | Customer contact email, only when contact is a valid email address |
| `admin.paid_order_created` | Trusted checkout/webhook backend | After Stripe Checkout confirms payment and the matching order is updated to paid | Farm/admin notification address (`theosfeedfarm@gmail.com`) |
| `admin.daily_fulfillment_summary` | Scheduled trusted backend job | Once per operating day after order status updates settle | Farm/admin notification address (`theosfeedfarm@gmail.com`) |

For version one, send customer and admin order notifications after the trusted webhook marks the order paid. That avoids confirming or queueing an order that never completed Stripe Checkout. If the farm wants an earlier "request received" email for unpaid drafts, treat that as a separate `admin.order_request_received` event with different wording and no payment/fulfillment promise.

## Payload Boundary

Notification payloads should be derived from trusted Firestore order data and server-owned catalog data. They should not pass raw Stripe objects, credentials, or public client drafts directly to a provider.

Safe customer confirmation fields:

- Order reference ID
- Customer name
- Supported item names, SKUs, quantities, and formatted subtotal
- Shipping or delivery ZIP/region summary
- Current payment/checkout status label
- Theo's Farm contact instructions

Safe admin new-order fields:

- Order reference ID
- Customer name, preferred contact method, contact value, shipping ZIP, and whether a customer note exists
- Product quantities and bag counts
- Payment status and checkout status labels
- Fulfillment status
- Link or instruction for opening the future admin dashboard

Safe daily summary fields:

- Total orders needing review
- Total orders ready to pack
- Total packed orders
- Total 20 lb bag count
- Total 40 lb bag count
- Orders needing follow-up, with order IDs and customer display names only

Do not include:

- Stripe secret keys, webhook signing secrets, API request IDs, or raw webhook payloads
- Full card numbers, CVV, bank details, or payment method payloads
- Firebase service-account data or private project credentials
- Full internal stack traces or provider error payloads
- Any public-client-supplied field that has not been normalized by trusted backend/admin code
- Free-form customer note text in email; include a "note present" flag and link to the authenticated admin dashboard instead

## Provider-Neutral Integration Shape

A future email adapter can use Resend, Postmark, or another approved provider. Keep the core notification builder independent from the provider SDK:

```js
const notification = buildCustomerOrderConfirmation({
  order,
  catalog,
  storeContact,
});

await sendEmail({
  to: notification.to,
  subject: notification.subject,
  text: notification.text,
  html: notification.html,
  idempotencyKey: notification.idempotencyKey,
});
```

The trusted runtime should inject the provider client, sender address, reply-to address, and environment configuration. Do not read provider secrets from public storefront code or commit them to the repo.

## Idempotency And Logging

Each notification send should have a stable idempotency key:

- `customer.order_confirmation:{orderRequestId}:{paidEventId}`
- `admin.paid_order_created:{orderRequestId}:{paidEventId}`
- `admin.daily_fulfillment_summary:{yyyy-mm-dd}`

Store notification send attempts in a trusted backend collection or equivalent log with:

- Event name
- Order ID or summary date
- Recipient category, not necessarily the full recipient address when unnecessary
- Provider message ID
- Send status
- Created timestamp
- Last error code/message, sanitized

Retry only from trusted backend code. Never ask public storefront JavaScript to retry or reconcile notification sends.

## Checks

Current focused tests verify:

- Customer and admin builders omit Stripe secrets and raw payment payloads.
- Invalid or missing customer email skips customer confirmation instead of sending to a malformed address.
- Notification idempotency keys stay stable for repeated webhook deliveries.
- Duplicate outbox keys do not create a second job.
- Unsupported outbox fields and mismatched deterministic keys fail closed.
- Paid-order state, outbox jobs, and Stripe event completion commit together.
- Replayed completed events do not update the order or duplicate notification jobs.
- Delivery worker tests cover successful sends, skipped claims, sanitized retryable errors, permanent/exhausted failures, and success-recording failures.
- Firestore tests cover concurrent claims, retry transitions, stale-attempt rejection, idempotent success recording, terminal failure, and a composed queued-to-sent flow with a fake provider.

Future tests should verify:

- Admin summary counts match the admin order data boundary for 20 lb and 40 lb bags.
- Provider adapter errors return safe messages without exposing secrets.

## Non-Goals

- No email provider package installation
- No live email sends
- No Firebase, Stripe, or provider secrets
- No changes to Firestore rules, indexes, hosting, or deploy settings
- No customer-facing email templates yet
