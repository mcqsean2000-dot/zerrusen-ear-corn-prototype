# Admin Emulator Test Plan

This plan defines the Firebase emulator checks that should pass before connecting the admin UI to live Firestore order data. It is planning only: no deploy, no live Firebase project, no secrets, and no implementation are included here.

## Purpose

Use the Firebase Auth and Firestore emulators to prove the order security boundary before the admin dashboard reads or writes production data.

Current rule boundary to verify:

- Public customers can create valid `orderRequests` documents.
- Public customers cannot read, update, or delete orders.
- Authenticated non-admin users cannot read, update, or delete orders.
- Authenticated admins with `admin: true` can read orders.
- Authenticated admin updates are constrained to `status`, `audit`, and `internalNotes`.
- Authenticated admins cannot write backend-only payment or Stripe fields.
- Authenticated admins cannot delete orders.
- Trusted backend/Admin SDK paths remain responsible for payment, Stripe, refund, and summary-authority fields.

## Local Command Sequence

Run against a local Firebase project alias or emulator-only config. Do not use production project IDs, service account files, Stripe keys, webhook secrets, or live customer data.

```bash
npm install
firebase emulators:start --only auth,firestore
```

In a second terminal, run the future rules test command once test files exist:

```bash
npm run test:rules
```

Recommended final local verification before launch on PowerShell:

```powershell
npm run check
git diff --check
if (Test-Path go.mod) { go test ./... } else { Write-Output "go.mod not found; skipping go test ./..." }
```

If the repo later adds Functions-backed Stripe or claim-management tests, run them against emulators only and keep all environment variables pointed at local test values.

## Suggested Fixtures

Create deterministic emulator fixtures without secrets:

- `publicCustomer`: unauthenticated client context.
- `anonymousUser`: unauthenticated read/update/delete attempts, modeled separately from valid public create tests for clarity.
- `nonAdminUser`: authenticated Firebase Auth user with no custom claims.
- `adminUser`: authenticated Firebase Auth user with token `{ admin: true }`.
- `backendAdminSdk`: trusted Admin SDK context that bypasses client Firestore rules in local tests.

Use generated document IDs such as `orderRequests/test-needs-review-001`; avoid real customer names, emails, phone numbers, addresses, project IDs, or Stripe IDs.

Baseline valid order:

```json
{
  "createdAt": "request.time",
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
    "name": "Test Customer",
    "contact": "customer@example.test",
    "preferredContact": "email",
    "shippingZip": "62401",
    "note": "Leave at side door."
  }
}
```

Baseline admin update:

```json
{
  "status": "ready_to_pack",
  "audit": {
    "updatedAt": "request.time",
    "updatedByUid": "admin-user-001",
    "updatedByEmail": "admin@example.test",
    "lastAction": "status_changed"
  },
  "internalNotes": [
    {
      "body": "Customer confirmed shipping timing.",
      "createdAt": "emulator timestamp",
      "createdByUid": "admin-user-001",
      "createdByEmail": "admin@example.test",
      "visibility": "admin"
    }
  ]
}
```

## Access Matrix

| Actor | Create order | Read order | Update order | Delete order | Payment/Stripe fields |
| --- | --- | --- | --- | --- | --- |
| Public customer | Allow valid narrow creates only | Deny | Deny | Deny | Deny on create and update |
| Unauthenticated user | Allow only when acting as valid public create | Deny | Deny | Deny | Deny |
| Authenticated non-admin | Deny unless using the same public create path | Deny | Deny | Deny | Deny |
| Authenticated admin | Deny client-created orders unless matching public create shape | Allow | Allow only approved admin fields | Deny | Deny |
| Trusted backend/Admin SDK | Allow operational writes when using Admin SDK | Allow | Allow backend-owned updates | Allow only if an explicit backend policy later exists | Allow backend-owned payment/Stripe writes |

## Create Scenarios

Expected pass:

- Public customer creates a valid `orderRequests` document with `createdAt == request.time`, `source == "static-storefront"`, `status == "needs_review"`, one or two valid items, valid customer fields, and a valid subtotal range.
- Public customer creates a one-item 20 lb order.
- Public customer creates a one-item 40 lb order.
- Public customer creates a two-item order with both supported SKUs.
- Public customer includes optional `customer.note` within the length limit.

Expected fail:

- Create with any status other than `needs_review`.
- Create with missing required customer fields.
- Create with invalid `shippingZip`, unsupported `preferredContact`, invalid SKU, invalid product name, invalid quantity, invalid unit price, or subtotal outside the allowed range.
- Create with more than two items.
- Create with `stripeCheckoutSessionId`, `stripePaymentIntentId`, `stripeCustomerId`, `paymentStatus`, `paidAt`, `refundedAt`, `refundId`, `audit`, `internalNotes`, `fulfillment`, or denormalized daily summary fields.
- Create with client-supplied audit metadata.
- Create with any raw payment details.

## Read Scenarios

Expected pass:

- Authenticated admin can read the order list.
- Authenticated admin can read an order detail document.
- Authenticated admin can query `orderRequests` by `status` ordered by `createdAt DESC`.

Expected fail:

- Public customer cannot read the order they created.
- Unauthenticated user cannot list or read any order.
- Authenticated non-admin cannot list or read any order.
- Unknown collections and unrelated document paths are denied for every client actor.

## Update Scenarios

Expected pass:

- Authenticated admin changes `status` from `needs_review` to `ready_to_pack` with valid audit metadata.
- Authenticated admin changes `status` from `ready_to_pack` to `packed` with valid audit metadata.
- Authenticated admin changes `status` back to `needs_review` with valid audit metadata.
- Authenticated admin writes `audit.updatedAt == request.time`, `audit.updatedByUid == request.auth.uid`, a bounded `audit.updatedByEmail`, and a bounded `audit.lastAction`.
- Authenticated admin adds or replaces `internalNotes` while total notes remain within the current rule limit.
- Authenticated admin combines allowed `status`, `audit`, and `internalNotes` changes in one update.

Expected fail:

- Public customer, unauthenticated user, and authenticated non-admin update any order field.
- Authenticated admin updates customer details, item fields, subtotal, source, or created timestamp.
- Authenticated admin changes `status` to future values such as `paid`, `needs_shipping_quote`, `shipped`, `delivered`, `canceled`, or `refunded` before the rules intentionally allow them.
- Authenticated admin writes `stripeCheckoutSessionId`, `stripePaymentIntentId`, `stripeCustomerId`, `paymentStatus`, `paidAt`, `refundedAt`, `refundId`, raw webhook payloads, or denormalized daily summary counts.
- Authenticated admin writes `audit.updatedAt` to any value other than `request.time`.
- Authenticated admin writes `audit.updatedByUid` that does not match `request.auth.uid`.
- Authenticated admin writes a missing, non-string, too-short, or too-long `audit.updatedByEmail`.
- Authenticated admin writes a missing, non-string, empty, or too-long `audit.lastAction`.
- Authenticated admin omits required audit fields when changing audit metadata.
- Authenticated admin writes `internalNotes` with more than the allowed note count.
- Authenticated admin writes `internalNotes` as a string, map, number, boolean, or null instead of a list.

## Delete Scenarios

Expected fail:

- Public customer cannot delete an order.
- Unauthenticated user cannot delete an order.
- Authenticated non-admin cannot delete an order.
- Authenticated admin cannot delete an order.

If order cancellation or data retention later needs deletion-like behavior, add an explicit backend-owned archive or cancellation flow instead of enabling admin UI deletes by default.

## Trusted Backend Scenarios

Backend/Admin SDK tests should confirm trusted code can perform operational writes outside client rule limits in the emulator, while client actors remain denied.

Expected pass:

- Admin SDK writes Stripe Checkout session IDs after a trusted checkout session is created.
- Admin SDK writes `stripePaymentIntentId`, `stripeCustomerId`, `paymentStatus`, and `paidAt` after a webhook confirmation.
- Admin SDK writes refund fields such as `refundedAt` and `refundId` only through future trusted refund handling.
- Admin SDK recomputes any future materialized daily summary documents.
- Admin SDK grants or revokes `admin: true` custom claims in a local Auth emulator setup script.

Expected fail:

- Any browser/client SDK actor writes backend-only payment, Stripe, refund, webhook, or materialized summary authority fields.
- Admin UI code attempts to grant custom claims directly.

## Functional Emulator Checks

These checks are not only rule assertions; they should exercise the query and data behavior the admin UI will rely on.

- Status filter returns only the selected status and sorts by `createdAt DESC`.
- Daily 20 lb and 40 lb bag counts are computed from `items[].quantity` by SKU.
- Needs-review and ready-to-pack counts are derived from order status, not manually stored client values.
- Mixed one-product and two-product orders produce correct packing totals.
- Internal note behavior is append-oriented at the UI/service layer, even though the current rule only validates the bounded list shape.
- Admin token refresh is required after changing custom claims; stale non-admin tokens remain denied.
- Emulator index errors are captured and turned into intentional index changes only when the implemented query requires them.

## Pass Criteria

The admin UI can move toward local Firestore connection when all of the following are true:

- Every allow/deny case above has an emulator test.
- Public create tests prove the existing storefront order shape still works.
- Public, unauthenticated, and non-admin users cannot read, update, or delete orders.
- Admin reads work for list and detail views.
- Admin updates are limited to `status`, `audit`, and `internalNotes`.
- Admin deletes are denied.
- Admin client attempts to write backend-only payment and Stripe fields are denied.
- Trusted backend/Admin SDK tests cover payment/Stripe writes separately from client rules.
- Local static checks and diff whitespace checks pass.

## Launch Blockers

Do not connect the admin UI to live Firestore if any of these are true:

- A public or non-admin user can read order data.
- A public or non-admin user can update or delete order data.
- An admin client can write Stripe IDs, payment status, refund fields, raw webhook payloads, customer/order authority fields, or summary-authority fields.
- Admin deletes are enabled without a documented retention and cancellation policy.
- Valid public storefront order creation is broken.
- Admin status updates can be made without trustworthy audit metadata.
- Emulator tests require live project IDs, production credentials, Stripe secrets, or real customer data.
- Required admin queries fail without a deliberate index decision.

## Non-Goals

- No deployment.
- No live Firebase project access.
- No secrets or credential rotation.
- No Firebase project setting changes.
- No admin UI implementation.
- No Functions, checkout, webhook, payment-state, refund, or email implementation.
- No changes to `firestore.rules` or `firestore.indexes.json` from this plan.
