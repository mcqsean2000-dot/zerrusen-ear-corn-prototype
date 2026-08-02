# Stripe And Shippo Test Activation

Issue: [#69](https://github.com/mcqsean2000-dot/zerrusen-ear-corn-prototype/issues/69)

Related traced purchase: [#58](https://github.com/mcqsean2000-dot/zerrusen-ear-corn-prototype/issues/58)

Mode: Stripe test mode and Shippo test-safe operation only

## Safety Boundary

This runbook prepares one controlled shipping-to-payment-to-order test. It does not authorize Stripe live mode, production charges, broad Firebase deployment, secret rotation, label purchase, notification delivery, social publishing, or deletion of order data.

Never paste a secret into Git, a GitHub issue, a screenshot, browser JavaScript, Firestore, or shared logs. Firebase environment files are not secure secret storage. The three provider values below must be stored through Firebase Secret Manager.

## Required Approvals And Access

- [ ] Issue #67 is complete: the deploying account can see the confirmed Firebase project `theos-farm-ear-corn`.
- [ ] The Firebase project is on a plan that supports the required Cloud Functions deployment.
- [ ] Issue #68 records approval or explicit test-only acceptance of the current product prices and package facts.
- [ ] Calvin's previously recorded approval for one traced test purchase remains current.
- [ ] Sean confirms the Stripe account is in test mode and the Shippo token is the intended test-safe credential.
- [ ] A specific human approves the exact scoped deploy immediately before it runs.

Stop if any item is incomplete.

## Configuration Inventory

### Firebase secrets

Set these interactively so their values do not appear in shell history:

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SIGNING_SECRET
firebase functions:secrets:set SHIPPO_API_TOKEN
```

Required source and mode:

| Secret | Required source |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe test secret key; it starts with `sk_test_` |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | Signing secret from the exact Stripe test endpoint for `https://theosfarm.com/api/stripe/webhook` |
| `SHIPPO_API_TOKEN` | Approved Shippo credential for test-safe rate lookup; never a browser token |

After setting or changing a Firebase secret, the functions that reference it must be redeployed before they receive the new version.

### Non-secret Functions configuration

Create the ignored project-specific file `functions/.env.theos-farm-ear-corn` from `functions/.env.example`. Do not modify or commit `functions/.env.example` with real values.

Required values:

```text
CORS_ALLOWED_ORIGINS=https://theosfarm.com,https://www.theosfarm.com
FIREBASE_PROJECT_ID=theos-farm-ear-corn
STRIPE_SUCCESS_URL=https://theosfarm.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://theosfarm.com/#delivery
STRIPE_CURRENCY=usd
FIRESTORE_ORDER_COLLECTION=orderRequests
SHIP_FROM_NAME=<approved farm sender name>
SHIP_FROM_STREET1=<approved sender street>
SHIP_FROM_STREET2=<optional>
SHIP_FROM_CITY=<approved sender city>
SHIP_FROM_STATE=IL
SHIP_FROM_ZIP=62467
```

Keep unrelated services inert during this test:

```text
NOTIFICATION_DELIVERY_ENABLED=false
NOTIFICATION_RECONCILIATION_ENABLED=false
DAILY_FULFILLMENT_SUMMARY_ENABLED=false
SOCIAL_PUBLISHING_ENABLED=false
SOCIAL_RECONCILIATION_ENABLED=false
```

Checkout, shipping rates, and webhook handling do not use a general `CHECKOUT_ENABLED` flag. Their handlers fail closed until all required route configuration, secrets, and trusted runtime dependencies are present. Therefore, adding the secrets and deploying `api` is the activation step.

## Stripe Test Endpoint

In Stripe test mode, create or verify this HTTPS event destination:

```text
https://theosfarm.com/api/stripe/webhook
```

Subscribe only to the version-one events used by this repo:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

Each endpoint and mode has its own signing secret. Copy the secret from this exact test endpoint into Firebase Secret Manager. Do not reuse a Stripe CLI forwarding secret or a live-mode endpoint secret.

## Local Configuration Preflight

From the repo root, run the safe preflight against the ignored project environment file:

```powershell
npm run commerce:preflight -- functions/.env.theos-farm-ear-corn
```

The preflight rejects provider secrets in the environment file, verifies the exact project, origin, redirect, collection, currency, and sender-region configuration, requires the approved private sender fields to be present, and confirms notification/social schedules remain disabled. Its output omits the private street, city, and sender name. It does not access Firebase Secret Manager, validate secret values, contact Stripe or Shippo, authorize a deploy, or create an order.

## Pre-deploy Review

From the repo root:

```powershell
firebase use
firebase projects:list
npm run check
git diff --check
git status --short --branch
```

Record without secrets:

- active Firebase project ID;
- commit SHA being tested;
- test date and operator;
- successful check counts;
- confirmation that the working tree contains only reviewed changes.

The expected automated baseline is 10 Firestore rules tests and 230 Functions/backend tests. If those counts change, record the new passing counts rather than treating the old numbers as a substitute for a successful run.

## Scoped Deployment

Deployment is a human-approved action-time step. Confirm the project again immediately before running any command. Deploy only the reviewed resources required for the test; do not run an unscoped `firebase deploy`.

The expected sequence is:

1. Deploy reviewed Firestore rules and indexes if the matching versions are not already active.
2. Deploy the `api` Function with its three bound secret versions and reviewed non-secret configuration.
3. Deploy Hosting only if the `/api/**` rewrite or storefront build is not already the reviewed active version.
4. Leave notification, daily-summary, and social-publishing flags disabled.

## Controlled Test

Use fictional test customer data and a Stripe test card. Do not use a real card or create a live charge.

1. Open `https://theosfarm.com/` in a fresh browser session.
2. Add one approved product to the cart.
3. Enter a complete non-sensitive test shipping address suitable for a Shippo rate quote.
4. Confirm `/api/shipping-rates` returns only customer-safe carrier, service, amount, currency, delivery estimate, and owned rate identifiers.
5. Select one returned rate and continue to Checkout.
6. Confirm the browser is redirected to Stripe-hosted Checkout and the amount equals product subtotal plus the selected server-verified shipping amount.
7. Complete the payment with Stripe test data.
8. Confirm the browser returns through the approved success URL with a Stripe Checkout Session ID.
9. In Stripe Workbench, confirm the matching `checkout.session.completed` delivery received a `2xx` response.
10. Resend that same event once and confirm the idempotency boundary still leaves one paid transition and one processed event result.
11. In Firestore, confirm the trusted order reaches the expected paid state exactly once and retains the selected shipping facts.
12. Confirm no raw card data, Stripe secret, webhook secret, Shippo token, full webhook payload, or stack trace appears in Firestore, shared evidence, or customer-facing responses.
13. Complete the GA4 evidence steps in `docs/seo/ga4-test-purchase-runbook.md` and link the same Checkout Session ID evidence to issues #58 and #69 without posting customer data.

## Evidence Record

Post a sanitized summary to issue #69:

| Evidence | Result |
| --- | --- |
| Firebase project and deployed commit | |
| Local checks | |
| Shipping rate request | pass/fail, HTTP status, carrier/service only |
| Stripe Checkout redirect | pass/fail, test mode confirmed |
| Webhook first delivery | event type, sanitized event suffix, HTTP status |
| Webhook resend | HTTP status and idempotent result |
| Firestore paid transition | sanitized order suffix and final status |
| Secret/raw-payment scan | pass/fail |
| GA4 issue #58 evidence link | |
| Operator and UTC timestamp | |

Use only short identifier suffixes when correlation is necessary. Do not post complete customer addresses, email addresses, tokens, request bodies, or complete provider IDs.

## Failure And Rollback

- If shipping rates fail, stop before Checkout and inspect sanitized Firebase logs plus Shippo test activity.
- If Checkout creation fails, leave the order in its trusted review/failure state and do not fabricate payment status.
- If the webhook does not return `2xx`, stop fulfillment, inspect the exact Stripe test delivery, and keep manual reconciliation active.
- If payment succeeds but trusted order state does not, treat it as an incident and reconcile Stripe and Firestore before another test.
- If secrets or private data appear in logs or storage, stop, restrict access, and follow an approved credential-rotation and data-remediation response.
- To disable public test checkout without deleting order evidence, remove or disable the test endpoint/config through an approved Firebase change and redeploy the last known-good Function configuration.
- Do not delete Firestore orders or rotate credentials as routine cleanup.

## Official References

- [Firebase environment configuration and Secret Manager](https://firebase.google.com/docs/functions/config-env)
- [Firebase Hosting rewrites to Cloud Functions](https://firebase.google.com/docs/hosting/functions)
- [Stripe webhook endpoint and retry guidance](https://docs.stripe.com/webhooks)
- [Stripe test and live API key formats](https://docs.stripe.com/keys)
