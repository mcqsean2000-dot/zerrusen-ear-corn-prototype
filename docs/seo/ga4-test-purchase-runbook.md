# GA4 test-purchase runbook

Status: Property, web stream, and reviewed production deployment complete; account reception check and one action-time-approved traced purchase remain

## Preconditions

- Sean approves the specific test transaction at action time.
- Stripe is intentionally in test mode, or Sean approves the known charge and refund path.
- `theosfeedfarm@gmail.com` has business-owner/admin access to the GA4 property.
- The reviewed production build contains the business web stream's public `G-...` measurement ID.
- Checkout, webhook, and trusted order persistence are healthy.

## Trace

1. Open GA4 DebugView or Realtime without changing retention, permissions, domains, or billing.
2. Use a fresh browser session and visit `https://theosfarm.com/`.
3. Record observed `page_view` and the two product `view_item` events.
4. Add one approved product and record `add_to_cart`.
5. Enter the test delivery details, choose shipping, and record `begin_checkout`.
6. Complete the approved Stripe test transaction.
7. Confirm exactly one `purchase` event with:
   - `transaction_id` equal to the Stripe Checkout Session ID;
   - `currency` equal to `USD`;
   - the expected SKU, item price, and quantity;
   - no customer, address, payment, or free-form error data.
8. Confirm the trusted order record reports the same Checkout Session ID and paid state.
9. Record only the transaction reference suffix, timestamps, event names, values, and reviewer in the SEO-004 issue.

Use this sanitized evidence shape:

| Evidence | Result |
| --- | --- |
| Reviewer and UTC time | |
| GA4 business account access | pass/fail; no account identifiers beyond `theosfeedfarm@gmail.com` |
| Funnel events | event names and timestamps only |
| Purchase | transaction suffix, USD value, shipping value, canonical SKU, quantity |
| Trusted order reconciliation | order/session suffixes and paid-state result only |
| Deduplication | exactly one purchase event: pass/fail |
| PII review | pass/fail |
| Known gaps | |

## Failure handling

- If checkout cannot continue, verify a bounded `checkout_error` event and stop.
- If the purchase appears more than once, treat SEO-004 as failed and fix deduplication before another test.
- If GA4 and the trusted order disagree, the trusted order is authoritative. Record the discrepancy; do not report attributed revenue until resolved.
- Do not place a second transaction merely to troubleshoot without renewed approval.

## Activation record

- 2026-08-01: Theo's Farm GA4 property and web stream created.
- Stream ID: `15363981412`.
- Measurement ID: `G-KQSFKF42YM`.
- 2026-08-02: Reviewed Hosting deployment completed and the public production analytics configuration was verified with measurement ID `G-KQSFKF42YM`.
- 2026-08-02: Production storefront loaded the Google tag and completed a controlled 20 lb add-to-cart check without a browser console warning or error.
- 2026-08-04: Read-only production recheck returned HTTP 200 with JavaScript content types for both analytics assets; the approved measurement ID and purchase-deduplication runtime were present.
- 2026-08-04: Non-mutating CORS preflights returned HTTP 204 for `/api/shipping-rates` and `/api/checkout-sessions` with the production origin allowed. This proves route reachability only; it does not prove provider credentials, rate creation, Checkout creation, webhook handling, or trusted persistence.
- Repository checks cover the event contract, required parameters, deduplication, PII exclusion, and correlation of canonical product plus server-returned shipping facts across the Checkout return.
- Reception in the Theo's Farm GA4 Realtime or DebugView report has not yet been observed from the business-owned account.
- The local Firebase access preflight still reports `firebase_project_not_visible`; the ignored project environment and local `.firebaserc` target are not present on this checkout, so no commerce preflight or deployment was attempted.
- No test purchase has been performed.
