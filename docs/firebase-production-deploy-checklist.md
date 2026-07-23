# Firebase Production Deploy Checklist

This runbook is for a human-reviewed Theo's Farm production deploy using Firebase Hosting, Firebase Cloud Functions, and Firestore. It is a checklist only: do not paste real secrets into the repo, do not commit `.firebaserc`, and do not run live deploy commands until the project owner confirms the production Firebase project, Stripe mode, and domain.

## Scope

Use this checklist for:

- Firebase Hosting production storefront deploys.
- Firebase Cloud Functions deploys for trusted Stripe Checkout session creation and Stripe webhook handling.
- Firestore rules and index deploys for `orderRequests`.
- Stripe webhook endpoint setup after the Functions URL is known.

Do not use this checklist to rotate secrets, delete data, migrate order records, connect the unauthenticated admin prototype to live data, or change backend behavior.

## Production Preflight

1. Confirm the production Firebase project exists and is the intended Theo's Farm project.
2. Confirm the production domain decision is approved and the old Zerrusen Farms site remains separate.
3. Confirm product names, prices, fulfillment copy, shipping-only language, tax/shipping handling, and receipt language are approved.
4. Confirm Stripe is in the intended mode for launch. Use test mode until the owner approves live Checkout.
5. Confirm Google Pay, Apple Pay, and Link settings are managed in Stripe Checkout, not in storefront JavaScript.
6. Confirm the trusted checkout endpoint and webhook are implemented, reviewed, and intentionally enabled before taking payments.
7. Confirm Firestore public writes are still limited to validated `orderRequests` creation and trusted payment fields are backend-owned.
8. Confirm Google sign-in is enabled, the production domain is authorized, and only approved users carry the `admin: true` custom claim.

## Local Project Targeting

`.firebaserc` is local-only and must not be committed.

Example setup:

```bash
cp .firebaserc.example .firebaserc
```

Then replace `replace-with-your-firebase-project-id` with the approved production project ID. Before any deploy, have a human confirm:

```bash
firebase use
firebase projects:list
```

Treat the active project shown by `firebase use` as production-impacting. If it is not the approved Theo's Farm production project, stop.

## Secrets And Config Values

Store secrets only in Firebase/Google Cloud or Stripe configuration, never in repo files or public storefront JavaScript.

Production values to confirm outside the repo:

- Stripe secret key for the intended mode.
- Stripe webhook signing secret for the production webhook endpoint.
- Approved Checkout success and cancel URLs.
- Approved storefront origin for CORS, such as the production domain.
- Firebase Admin/Firestore access through the Functions runtime, not service-account JSON committed to the repo.
- Email provider secrets after email notifications exist.

`checkout-config.js` may contain only the public HTTPS checkout session endpoint after that endpoint is approved. It must never contain Stripe keys, webhook secrets, Firebase service account values, or private API tokens.

## Required Local Checks

Run these from the repo root before requesting production approval:

```bash
npm run check
git diff --check
```

If `go.mod` exists, also run:

```bash
go test ./...
```

If Functions code changed, also run the Functions checks documented in `docs/backend-checkout-scaffold.md` before any Functions deploy.

## Preview Channel

Use a Firebase Hosting preview channel before production. This is an example command and requires the project targeting checks above:

```bash
firebase hosting:channel:deploy preview --only hosting
```

Smoke check the preview URL:

- Theo's Farm and Farm to Feeder branding render.
- Product photos load.
- The cart and order request validation still work.
- The storefront does not collect card numbers, CVV, bank data, or raw payment details.
- Checkout redirects only through the approved trusted endpoint when enabled.
- Mobile layout is usable.
- `admin.html` remains sample/admin-planning only unless authenticated admin has shipped.

## Production Deploy

Run scoped deploys only after human confirmation of the active Firebase project and the exact deploy scope. These commands are examples; do not run them as an automatic script.

Deploy Hosting:

```bash
firebase deploy --only hosting
```

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Deploy Functions only when the trusted checkout/webhook implementation, runtime configuration, and secrets have been reviewed:

```bash
firebase deploy --only functions
```

Avoid broad `firebase deploy` for production unless the reviewer explicitly confirms that Hosting, Functions, Firestore rules, indexes, and project targeting are all intended for the same release.

## Stripe Webhook Endpoint

After the production Functions URL is known, configure Stripe to send webhooks to the approved HTTPS endpoint for:

```text
POST /api/stripe/webhook
```

Required version-one events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

Confirm the webhook handler verifies Stripe signatures before reading event data and is idempotent for repeated Stripe event deliveries. Do not put the webhook signing secret in the repo.

## Post-Deploy Smoke Checks

Immediately after deploy:

1. Open the production domain and verify the storefront loads over HTTPS.
2. Confirm product photos, cart behavior, form validation, and mobile layout.
3. Confirm no raw payment fields are present in the storefront.
4. Confirm checkout is either intentionally disabled or redirects to Stripe-hosted Checkout through the trusted endpoint.
5. In Stripe test mode, complete a test Checkout and verify the webhook updates the matching Firestore order only through trusted backend code.
6. Verify Firestore rejects public reads, updates, deletes, and client-supplied Stripe fields.
7. Verify Firestore indexes are building or ready for the intended order queue queries.
8. Confirm the admin route hides order data for signed-out and non-admin users, while an approved claimed admin can load it.
9. Check Firebase Functions logs for checkout/webhook errors without exposing secrets in shared notes.
10. Check Stripe webhook delivery status and retry details.

## Rollback

Confirm the active Firebase project again before running rollback commands.

Prefer Firebase Hosting release rollback for storefront-only issues:

```bash
firebase hosting:releases:list
firebase hosting:rollback
```

For Functions issues, redeploy the last known-good Functions build or disable the public checkout endpoint while preserving order data. Do not delete Firestore documents or rotate production secrets as part of a routine rollback unless the project owner explicitly approves an incident response.

For Firestore rules issues, redeploy the last reviewed rules file:

```bash
firebase deploy --only firestore:rules
```

After any rollback, repeat the relevant post-deploy smoke checks and document which release or rules version is active.
