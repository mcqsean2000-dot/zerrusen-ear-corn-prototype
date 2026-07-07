# Admin Fulfillment Foundation

This branch adds a static admin planning shell. It does not authenticate users, connect to Firebase, change order data, deploy hosting, or collect payment details.

## Static Admin Shell

Open locally:

```text
http://localhost:4173/admin.html
```

The shell uses sample order requests to model the first admin workflows:

- review new order requests
- see customer contact preference and shipping ZIP
- scan product quantities and estimated subtotal
- view daily bag counts for packing
- review trusted shipping label and tracking fields after backend purchase
- filter by fulfillment status

## Future Firestore Read Model

The authenticated admin dashboard should read from:

```text
orderRequests
```

Initial admin statuses:

- `needs_review`
- `ready_to_pack`
- `packed`

Later statuses can follow the roadmap: paid, needs shipping rate, shipped, delivered, canceled, and refunded.

## Security Boundary

The static admin shell is not a secure admin surface. It must not be connected to live Firestore data until admin authentication is selected and implemented.

See `docs/admin-auth-firestore-plan.md` for the proposed Firebase Auth custom-claim model, admin-editable fields, Firestore rule implications, and emulator test plan.

Expected production boundary:

1. Admin signs in through Firebase Auth or another selected provider.
2. Trusted backend/admin tooling grants an `admin: true` custom claim.
3. Firestore rules allow admin reads and updates only to authenticated admins.
4. Stripe payment status and Stripe IDs are written by trusted backend/webhook code, not by public storefront JavaScript.
5. Shippo labels are bought only through the trusted backend route `POST /api/admin/shippo-labels` after paid-order and owned-rate validation.

## Label Purchase Boundary

The static admin shell may display `labelUrl`, `trackingNumber`, `trackingUrl`, carrier, service, package count, and shipping amount from trusted order data. It must not buy labels directly from browser JavaScript, store Shippo API tokens, or trust a client-selected rate without backend ownership checks.

Current backend scaffold behavior:

- Requires `orderRequestId` and `rateId` in the admin label request.
- Verifies the order is paid before buying a label.
- Verifies the requested Shippo `rateId` belongs to the order before buying a label.
- Persists the Shippo transaction, label, tracking, amount, carrier, service, status, and audit fields through trusted backend code.
- Uses request-provided admin identity only as a temporary scaffold; production must replace this with authenticated admin context.

## Non-Goals For This Slice

- No live Firebase reads or writes
- No customer payment collection
- No inventory mutation
- No deploy
- No admin authentication implementation
- No browser-side Shippo label purchase
