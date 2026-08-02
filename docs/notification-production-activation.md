# Notification Production Activation

This runbook controls the first Theo's Farm notification deployment. It does not deploy Functions, create secrets, verify a domain, or enable live email by itself. Complete every production action with the approved Firebase project selected and a human reviewer present.

## Before Deployment

1. Verify the Resend account belongs to Theo's Farm.
2. Verify `theosfarm.com` or the exact intended sending subdomain in Resend and approve the exact `NOTIFICATION_FROM_EMAIL` address.
3. Use `theosfeedfarm@gmail.com` as the admin recipient and reply-to. Do not use it as `NOTIFICATION_FROM_EMAIL`: Resend requires a domain Theo's Farm owns and has verified.
4. Keep all three enable flags false:
   - `NOTIFICATION_DELIVERY_ENABLED=false`
   - `NOTIFICATION_RECONCILIATION_ENABLED=false`
   - `DAILY_FULFILLMENT_SUMMARY_ENABLED=false`
5. Run `npm run check` at the repo root and `npm run check` in `functions/`.
6. Confirm `firebase use` points to the approved production project. Do not commit `.firebaserc` or project-specific `.env` files.

Create an ignored `functions/.env.<project-id>` file for the approved Firebase project. Use only non-secret runtime settings in this file:

```dotenv
NOTIFICATION_ADMIN_EMAIL=theosfeedfarm@gmail.com
NOTIFICATION_FROM_EMAIL=Theo's Farm <orders@theosfarm.com>
NOTIFICATION_REPLY_TO=theosfeedfarm@gmail.com
NOTIFICATION_DELIVERY_ENABLED=false
NOTIFICATION_RECONCILIATION_ENABLED=false
DAILY_FULFILLMENT_SUMMARY_ENABLED=false
```

Replace `<project-id>` with the exact active Firebase project ID. Never put `RESEND_API_KEY` in this file; the function receives it only through Firebase Secret Manager.

The example `orders@theosfarm.com` is a proposed sender, not approval that the domain is verified. The address must use the exact root domain or subdomain shown as verified in Resend. Resend does not require a separate sender record after domain verification, but replies should continue to route to the monitored Gmail inbox.

Before setting the secret or deploying, run the disabled-config preflight against the ignored project file:

```powershell
npm run notification:preflight -- functions/.env.theos-farm-ear-corn
```

The preflight rejects enabled flags, a Gmail or unrelated sender domain, wrong admin/reply-to addresses, duplicate environment keys, and any `RESEND_API_KEY` entry. A pass confirms only that the non-secret file is ready for disabled-deploy review; it does not verify DNS, the Resend account, Firebase access, or authorize deployment.

## Secret And Disabled Deployment

Store the Resend key in Firebase Secret Manager. Enter the value only at the CLI prompt:

```bash
firebase functions:secrets:set RESEND_API_KEY
```

Deploy the processing-lease index before Functions:

```bash
firebase deploy --only firestore:indexes
```

Deploy Functions while every notification flag remains false:

```bash
firebase deploy --only functions
```

Confirm the three functions exist and disabled invocations report only safe configuration names or aggregate counts:

- `dailyFulfillmentSummary`
- `notificationOutboxDelivery`
- `notificationOutboxReconciliation`

## Staged Enablement

Enable `NOTIFICATION_DELIVERY_ENABLED` first in the ignored project-specific environment file, then run `firebase deploy --only functions`. Create one approved test-mode paid order and verify exactly one customer/admin notification job is sent and marked `sent` with a provider message ID.

Enable `NOTIFICATION_RECONCILIATION_ENABLED` only after the direct outbox trigger passes, then run `firebase deploy --only functions`. Verify the ten-minute schedule reports bounded aggregate counts and does not resend the completed test job.

Enable `DAILY_FULFILLMENT_SUMMARY_ENABLED` last, after the farm approves the 8:00 AM Central operating time, then run `firebase deploy --only functions`. Verify one deterministic summary job for the farm business date and confirm a repeated invocation is treated as a duplicate.

Do not enable multiple stages at once. Stop and return the affected flag to `false` if delivery, Firestore state, recipient, sender, or log output differs from the reviewed behavior.

## Post-Activation Checks

- Verify customer and admin messages use approved recipients and contain no customer note text or raw Stripe data.
- Verify `pending`, `retry_pending`, `processing`, `sent`, and `failed` states transition as documented.
- Verify processing jobs younger than 15 minutes are not reclaimed.
- Verify provider failures store only sanitized error codes.
- Verify Firebase logs contain no API keys, message bodies, email addresses, or provider error payloads.
- Record the deployed commit, Firebase project, index state, sender address, test order ID, and verification time without recording secrets.

## Disable And Roll Back

Set `DAILY_FULFILLMENT_SUMMARY_ENABLED=false`, `NOTIFICATION_RECONCILIATION_ENABLED=false`, and `NOTIFICATION_DELIVERY_ENABLED=false` to stop new automated notification work. Preserve Firestore outbox documents for review. Do not delete jobs, reset attempts, rotate secrets, or resend customer messages during routine rollback without an approved incident plan.
