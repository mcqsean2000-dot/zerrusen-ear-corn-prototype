# Admin Auth and Firestore Access Plan

This plan scopes the first production admin-auth and Firestore access model for Theo's Farm order fulfillment. It is planning only: no Firebase project settings, deploys, credentials, or live data are changed here.

## Recommended Admin Identity Model

Use Firebase Auth users with an `admin: true` custom claim for production admin access.

Rationale:

- It matches the current Firebase Hosting, Firestore, and Functions direction.
- Firestore rules can enforce the claim without trusting client-side route checks.
- Admin access can be granted or revoked centrally by trusted backend tooling.
- It avoids committing operational email allowlists into static frontend code or Firestore rules.

An allowlisted admin email list can be useful as a bootstrap or recovery checklist, but it should not be the primary production authorization model. Email allowlists are easier to drift, expose operational details in config, and still require trusted backend code to set or verify access safely.

Recommended production flow:

1. Sean and Calvin are created as Firebase Auth users in the Theo's Farm Firebase project.
2. A trusted setup script or Firebase Admin SDK task grants `admin: true` custom claims.
3. The admin UI signs in with Firebase Auth and reads `request.auth.token.admin == true` through Firestore rules.
4. Admin sessions are refreshed after claim changes so the new token includes the claim.
5. Claim grants and removals are logged outside the public storefront.

## Firestore Data The Admin UI Needs

Primary collection:

```text
orderRequests
```

The admin dashboard should use this collection for list, detail, status, notes, fulfillment counts, and audit visibility. The existing static order-request shape is the starting point, with backend-only payment fields added later by trusted Functions or webhook code.

Likely admin reads:

- Order queue filtered by `status`, sorted by `createdAt`.
- Order detail by document ID.
- Daily fulfillment summaries derived from orders due or ready to pack.
- Internal notes and audit metadata for fulfillment history.

Likely admin writes:

- Fulfillment status changes.
- Internal notes.
- Admin-facing fulfillment metadata, such as packed/shipped timestamps when those statuses exist.
- Audit metadata describing who changed the order and when.

Implemented backend boundary:

- `functions/src/firestore-adapter.js` exposes `updateAdminOrderStatus` for trusted admin status movement.
- The helper validates admin UID/email, checks the current order exists, limits status values to the first admin-shell statuses, enforces supported status transitions, and writes `status` plus audit metadata only.
- It does not write Stripe, payment, customer, item, subtotal, shipping-label, or raw payment fields.
- `functions/src/admin-auth.js` verifies Firebase Auth bearer tokens and requires an `admin: true` custom claim before returning the server-derived admin actor.
- `functions/src/index.js` exposes `POST /api/admin/order-status` as the trusted HTTP boundary for authenticated admin status updates. The route fails closed with `admin_auth_dependency_missing` unless a trusted runtime injects admin authentication, and with `admin_status_dependency_missing` unless the status persistence adapter is injected.
- The Firebase runtime wires `updateAdminOrderStatus` only with Firebase Admin Auth token verification, so browser JavaScript cannot choose the `admin.uid` or `admin.email` used for audit fields.

## Trusted Field Plan

Order list reads should trust only fields needed to scan and triage:

- `createdAt`
- `status`
- `subtotalCents`
- `items[].sku`
- `items[].name`
- `items[].quantity`
- `customer.name`
- `customer.contact`
- `customer.preferredContact`
- `customer.shippingZip`
- `paymentStatus` when later written by backend code
- `fulfillment.dueDate` or `fulfillment.targetDate` if later added
- `audit.updatedAt`
- `audit.updatedByEmail`

Order detail reads may include the list fields plus:

- `customer.note`
- `stripeCheckoutSessionId`
- `stripePaymentIntentId`
- `stripeCustomerId` if later needed for support
- `paymentStatus`
- `fulfillment.shippingCarrier`
- `fulfillment.trackingNumber`
- `fulfillment.packedAt`
- `fulfillment.shippedAt`
- `internalNotes[]`
- `audit.createdBy`
- `audit.updatedByUid`
- `audit.updatedByEmail`

Status update writes should be limited to fulfillment status fields:

- `status`
- `audit.updatedAt`
- `audit.updatedByUid`
- `audit.updatedByEmail`
- `audit.lastAction`

Initial allowed admin statuses should stay aligned with the current admin shell:

- `needs_review`
- `ready_to_pack`
- `packed`

Later statuses from the roadmap can be added when payment, shipping, refund, and cancellation workflows exist:

- `paid`
- `needs_shipping_quote`
- `shipped`
- `delivered`
- `canceled`
- `refunded`

Internal note writes should be append-only from the admin UI where possible:

- `internalNotes[].body`
- `internalNotes[].createdAt`
- `internalNotes[].createdByUid`
- `internalNotes[].createdByEmail`
- `internalNotes[].visibility` with value `admin`

Daily bag counts should be computed from trusted item fields, not manually stored as the source of truth:

- 20 lb count: sum `items[].quantity` where `sku == "ear-corn-20lb"`
- 40 lb count: sum `items[].quantity` where `sku == "ear-corn-40lb"`
- Ready-to-pack count: count orders where `status == "ready_to_pack"`
- Needs-review count: count orders where `status == "needs_review"`
- Follow-up count: count orders where `status == "needs_shipping_quote"` or another future follow-up status

If daily summaries are later materialized for performance, use a backend-owned collection such as `dailyFulfillmentSummaries/{yyyy-mm-dd}`. The admin UI may read those summaries, but writes should remain backend-only so counts cannot drift from order data.

Audit metadata should be explicit and boring:

- `audit.createdAt`
- `audit.updatedAt`
- `audit.updatedByUid`
- `audit.updatedByEmail`
- `audit.lastAction`

The public storefront should not be trusted to write admin audit fields.

## Firestore Rules Implications

The current rule posture is correct for the prototype boundary:

- Public users may only create narrow `orderRequests`.
- Public users may not read, update, or delete orders.
- Admin access depends on `request.auth.token.admin == true`.
- Stripe IDs are rejected from public creates.

Before connecting the admin UI to live data, rules should become more specific than blanket admin `read, update, delete` access. Recommended next rule shape:

- Allow admin reads of `orderRequests`.
- Allow admin updates only for approved admin-editable fields.
- Reject admin writes to payment authority fields unless the request comes from trusted backend code.
- Keep deletes disabled for the admin UI unless a formal cancellation/deletion policy exists.

Backend-only fields should include:

- `stripeCheckoutSessionId`
- `stripePaymentIntentId`
- `stripeCustomerId`
- `paymentStatus`
- `paidAt`
- `refundedAt`
- `refundId`
- any raw webhook payloads
- any denormalized daily summary counts

Backend-only operations should include:

- Creating Stripe Checkout sessions.
- Confirming payment status from Stripe webhooks.
- Writing Stripe IDs.
- Writing refund state.
- Recomputing materialized summaries.
- Granting or revoking admin custom claims.

## Likely Index Needs

Existing index:

- `orderRequests`: `status ASC`, `createdAt DESC`

Likely near-term indexes:

- `orderRequests`: `status ASC`, `audit.updatedAt DESC` for recently changed admin queues.
- `orderRequests`: `paymentStatus ASC`, `createdAt DESC` when paid/unpaid queue filters are live.
- `orderRequests`: `status ASC`, `fulfillment.targetDate ASC`, `createdAt DESC` if daily packing dates are stored.

Avoid speculative indexes until the admin UI query shape is implemented. Firestore emulator and index error links should drive final index additions.

## Emulator Test Cases

Rules tests should cover these cases before live admin connection:

- Public customer can create a valid `orderRequests` document.
- Public customer cannot read any `orderRequests` document.
- Public customer cannot update status, notes, Stripe IDs, payment status, or audit fields.
- Public customer cannot create an order containing Stripe fields.
- Authenticated non-admin user cannot read or update orders.
- Authenticated admin can read order list/detail fields.
- Authenticated admin can update allowed status and audit fields.
- Authenticated admin cannot update backend-only payment fields.
- Authenticated admin cannot delete orders unless deletion is intentionally allowed later.
- Backend/admin SDK path can write Stripe/payment fields outside client-enforced rules.

Functional emulator checks should cover:

- Status filter plus `createdAt DESC` sorting.
- Daily bag-count calculations for one-product and two-product orders.
- Internal-note append behavior.
- Token refresh after custom claim changes.

## Operational Setup Checklist

For Sean and Calvin, without secrets:

- Confirm the production Firebase project ID out of band.
- Create Firebase Auth users for Sean and Calvin using their approved business emails.
- Grant `admin: true` custom claims with a trusted Admin SDK script or console-safe backend task.
- Ask each admin to sign out and back in after claims are granted.
- Verify each admin can load the admin dashboard and read only admin-appropriate order fields.
- Verify a non-admin test user cannot read or update order data.
- Keep `.firebaserc` local and uncommitted.
- Keep Stripe keys, Firebase service account credentials, and webhook secrets out of this repo.
- Record who granted admin access, when, and why in the project handoff notes.

## Non-Goals

- No raw payment details in Firestore or the admin UI.
- No local pickup workflow.
- No deploy.
- No live Firebase project changes.
- No credential rotation.
- No implementation in `functions/src/*`.
- No checkout, webhook, or payment-state implementation.
