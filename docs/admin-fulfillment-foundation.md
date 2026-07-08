# Admin Fulfillment Foundation

This document tracks the static admin planning shell and the disabled authenticated-admin readiness scaffold. The current repo does not deploy the admin shell, create Firebase Auth users, grant admin claims, change order data, or collect payment details.

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

## Authenticated Admin Readiness

The static admin shell now loads:

- `admin-config.js`, which keeps Firebase live mode disabled with blank public config by default.
- `admin-live.js`, which prepares Firebase Auth ID-token headers, Firestore `orderRequests` read specs, and guarded admin endpoint calls for the future authenticated dashboard.

The admin UI now renders status transition controls and label purchase buttons as guarded controls. They remain disabled in sample mode and become clickable only after `admin-live.js` passes a signed-in Firebase admin action bridge to the renderer. Browser code still calls only the trusted admin endpoints with Firebase ID-token headers; it does not hold Shippo, Stripe, or Firebase Admin secrets.

Keep `TheosAdminConfig.enabled` set to `false` until the production Firebase project ID, public web app config, Sean/Calvin Firebase Auth users, and `admin: true` custom claims are configured. The live bridge must derive admin identity from Firebase ID tokens; it must not send `body.admin`.

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

The static sample shell is not a secure admin surface by itself. It must not be published as a live admin dashboard until Firebase Auth sign-in, admin custom claims, and Firestore rules are verified in the selected production project.

See `docs/admin-auth-firestore-plan.md` for the proposed Firebase Auth custom-claim model, admin-editable fields, Firestore rule implications, and emulator test plan.

Expected production boundary:

1. Admin signs in through Firebase Auth or another selected provider.
2. Trusted backend/admin tooling grants an `admin: true` custom claim.
3. Firestore rules allow admin reads and constrained updates only to authenticated admins.
4. Stripe payment status and Stripe IDs are written by trusted backend/webhook code, not by public storefront JavaScript.
5. Shippo labels are bought only through the trusted backend route `POST /api/admin/shippo-labels` after paid-order and owned-rate validation.

## Label Purchase Boundary

The static admin shell may display `labelUrl`, `trackingNumber`, `trackingUrl`, carrier, service, package count, and shipping amount from trusted order data. It must not buy labels directly from browser JavaScript, store Shippo API tokens, or trust a client-selected rate without backend ownership checks.

Current backend scaffold behavior:

- Requires `orderRequestId` and `rateId` in the admin label request.
- Verifies the order is paid before buying a label.
- Verifies the requested Shippo `rateId` belongs to the order before buying a label.
- Persists the Shippo transaction, label, tracking, amount, carrier, service, status, and audit fields through trusted backend code.
- Requires Firebase Auth admin custom-claim verification before trusted admin label or status routes use an admin actor.

## Non-Goals For This Slice

- No live Firebase reads or writes
- No customer payment collection
- No inventory mutation
- No deploy
- No live admin authentication configuration
- No browser-side Shippo label purchase
