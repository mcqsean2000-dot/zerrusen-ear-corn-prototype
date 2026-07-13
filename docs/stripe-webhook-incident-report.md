# Stripe Webhook Incident Report

Date: 2026-07-13

## Summary

Stripe test mode reported repeated delivery failures for:

```text
POST https://theosfarm.com/api/stripe/webhook
```

Stripe first observed the failures on 2026-07-10 at 6:35:14 PM UTC and will stop retrying this test webhook endpoint on 2026-07-19 at 6:35:14 PM UTC if it keeps failing.

This does not appear to be a Stripe account issue. The repo already contains the intended webhook route and Firebase Hosting rewrite, but the production Firebase backend is not confirmed as deployed and configured with the required project and secrets.

## Current Repo State

The codebase already includes:

- `firebase.json` rewrite from `/api/**` to Firebase Function `api` in `us-central1`.
- `functions/src/firebase-runtime.js` exporting the `api` HTTPS Function.
- `functions/src/index.js` route handling for `/api/stripe/webhook`.
- Stripe webhook verification through `STRIPE_WEBHOOK_SIGNING_SECRET`.
- Trusted webhook adapter code for `checkout.session.completed` and related checkout events.
- Documentation warning that the webhook should only be enabled after the trusted backend, runtime configuration, and secrets are reviewed.

The current local Firebase CLI check found:

- Firebase CLI installed and working at `C:\Users\crhag\AppData\Roaming\npm\firebase.cmd`.
- Firebase CLI version `15.23.0`.
- CLI logged in as `crhags@gmail.com`.
- `firebase projects:list` returned no visible Firebase projects for that login.
- No local `.firebaserc` exists in the repo checkout.

## Likely Cause

Stripe is pointed at the production domain webhook path before the Firebase project, Function deploy, and Stripe webhook secret are fully configured for that endpoint.

The handler intentionally returns non-success responses unless the runtime has the required configuration and trusted adapters:

- Missing env/secrets returns disabled or setup errors.
- Missing Stripe signature returns `400`.
- Missing verifier or adapter returns `501`.
- Invalid signature returns `400`.

Stripe requires any `2xx` response to count the webhook delivery as successful.

## Immediate Mitigation

If the backend is not ready today, disable or remove the test-mode Stripe webhook endpoint in Stripe Dashboard:

```text
https://theosfarm.com/api/stripe/webhook
```

This stops retry noise while Firebase access, secrets, and deploy are being completed.

Do not use a static storefront or GoDaddy-only hosting to receive Stripe webhooks. Webhooks must terminate at trusted backend code that can safely hold Stripe secrets.

## Required Fixes

1. Confirm the intended Firebase project for Theo's Farm.
2. Ensure the deploying Google account has access to that Firebase project.
3. Create a local, untracked `.firebaserc` from `.firebaserc.example` and set the approved project ID.
4. Confirm billing is enabled for the Firebase project if required for Cloud Functions.
5. Set backend secrets in Firebase:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SIGNING_SECRET
SHIPPO_API_TOKEN
```

6. Deploy only after reviewing the target project and config:

```text
firebase deploy --only functions
firebase deploy --only hosting
```

7. In Stripe test mode, configure the webhook endpoint to:

```text
https://theosfarm.com/api/stripe/webhook
```

8. Subscribe at minimum to:

```text
checkout.session.completed
checkout.session.expired
payment_intent.payment_failed
```

9. Resend a Stripe test event and verify a `2xx` response.
10. Complete a test Checkout and verify the matching Firestore order is updated only by trusted backend code.

## Validation Checklist

Run before production payment traffic:

```text
npm run check
npm --prefix functions run check
firebase deploy --only functions
firebase deploy --only hosting
```

Then verify:

- The storefront loads at `https://theosfarm.com/`.
- `checkout-config.js` points only to the approved public checkout endpoint and contains no secrets.
- Stripe webhook delivery logs show `2xx` for test events.
- Firebase Functions logs show no leaked secrets or stack traces in user-facing responses.
- Firestore rejects public writes to Stripe/payment-owned fields.

## Remaining Risk

- Firebase project access is not currently available to `crhags@gmail.com`, so deploy cannot proceed from this machine until access or project selection is fixed.
- The Stripe webhook signing secret must come from the exact Stripe test webhook endpoint configured in the Stripe Dashboard.
- If Stripe test Checkout is active before the webhook is fixed, order fulfillment must be manually reviewed in Stripe Dashboard and Firebase/Firestore.
