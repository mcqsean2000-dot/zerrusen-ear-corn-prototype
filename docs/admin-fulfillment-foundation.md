# Admin Fulfillment Foundation

This document tracks the authenticated admin shell and its fulfillment boundary. The repo publishes the admin route through Firebase Hosting, but it does not create Firebase Auth users, grant admin claims, change production order data, or collect payment details.

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

- `admin-config.js`, which enables Firebase Hosting public auto config without committing project secrets.
- `admin-live.js`, which supports Google popup sign-in, email/password fallback, refreshed custom-claim checks, Firebase Auth ID-token headers, Firestore `orderRequests` reads, and guarded admin endpoint calls.

The admin page includes Google sign-in, email/password fallback, and a sign-out control. On Firebase Hosting, `admin-live.js` loads the public app config from `/__/firebase/init.json`. Fulfillment content remains hidden until a refreshed ID token contains `admin: true`. Sign-in failure messages are generic, and passwords are cleared after a successful Firebase Auth sign-in call.

The admin UI now renders status transition controls and label purchase buttons as guarded controls. They remain disabled in sample mode and become clickable only after `admin-live.js` passes a signed-in Firebase admin action bridge to the renderer. Browser code still calls only the trusted admin endpoints with Firebase ID-token headers; it does not hold Shippo, Stripe, or Firebase Admin secrets. Guarded actions write only safe progress, success, or retry-oriented failure feedback into the admin page.

Google identity alone does not grant admin access. A trusted Firebase Admin SDK process must grant `admin: true`, and the live bridge must derive admin identity from the resulting ID token; it must not send `body.admin` or grant claims from browser code.

For local admin testing outside Firebase Hosting, copy `admin-config.local.example.js` to ignored `admin-config.local.js` and fill in the approved Firebase public web config. The local override must not contain Stripe, Shippo, service-account, or webhook secrets.

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

The public HTML route is not the security boundary. Firebase Auth sign-in, the `admin: true` custom claim, Firestore rules, and backend token verification must all be verified in the selected production project before live order data is used.

See `docs/admin-auth-firestore-plan.md` for the proposed Firebase Auth custom-claim model, admin-editable fields, Firestore rule implications, and emulator test plan.

Expected production boundary:

1. Admin signs in through the approved Google account or Firebase email/password fallback.
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

- No unauthenticated Firebase reads or writes
- No customer payment collection
- No inventory mutation
- No deploy
- No Firebase Console provider, user, domain, or custom-claim changes from this repo
- No browser-side Shippo label purchase
