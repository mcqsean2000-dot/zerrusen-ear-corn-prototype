# Production Observability

Theo's Farm Firebase Functions use the official `firebase-functions/logger` API through `functions/src/operational-logger.js`. Operational failures are written as structured `ERROR` entries for Cloud Logging and Error Reporting. Scheduled and event-driven function outcomes are written as structured `INFO` entries.

## Privacy Boundary

The logger records only:

- stable event name
- bounded error code and error type
- retryable flag when supplied by trusted code
- safe route method and path
- bounded operational counts, actions, and configuration key names

It does not record raw error messages, request or response bodies, headers, authorization values, cookies, customer names, email addresses, shipping addresses, Stripe payloads, Shippo payloads, Meta tokens, Firebase tokens, or secret-like values.

## Error Events

The HTTP API emits these operational error events when a request reaches an unexpected provider or persistence failure:

- `checkout_shipping_rates_failed`
- `checkout_creation_failed`
- `shipping_rates_failed`
- `shipping_label_transaction_incomplete`
- `shipping_label_purchase_failed`
- `admin_status_update_failed`
- `admin_notification_health_failed`
- `admin_notification_retry_failed`
- `admin_social_reconciliation_failed`
- `admin_social_reconciliation_update_failed`
- `admin_social_queue_failed`
- `stripe_webhook_failed`
- `api_request_unhandled`

Scheduled and event-driven functions append `_failed` to their normal event name when they throw. A sanitized event-and-code error is rethrown after logging so Firebase retry behavior and failed invocation metrics remain accurate without forwarding the original provider message.

## View Logs

The Firebase CLI account must have access to the Theo's Farm Firebase project. Confirm access before relying on CLI output:

```powershell
firebase login:list
firebase projects:list
firebase functions:log --project <theos-farm-project-id> --lines 100
```

To narrow logs to the HTTP function:

```powershell
firebase functions:log --project <theos-farm-project-id> --only api --lines 100
```

Cloud Logging can filter structured failures with a query similar to:

```text
severity>=ERROR
jsonPayload.event!=""
```

Use Google Cloud Error Reporting to group the sanitized reportable errors by event and error code. Configure a log-based alert for `severity>=ERROR` after the production project owner confirms notification recipients and an acceptable alert threshold.

## First Production Verification

1. Deploy with all production enable flags still disabled.
2. Invoke a safe disabled endpoint and confirm no error event is emitted.
3. Trigger one reviewed test failure with non-customer test data.
4. Confirm the expected structured event appears without secrets or personal data.
5. Confirm Error Reporting groups the event.
6. Remove the test condition before enabling checkout, notifications, or social publishing.

Do not enable production services solely because logging is present. Complete each service's existing activation runbook and verify its secrets, permissions, idempotency, and retry behavior separately.
