# GA4 test-purchase runbook

Status: Complete; business-account reception, one deduplicated purchase, and trusted-order reconciliation verified 2026-08-24

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
- 2026-08-24: The business-owned account opened the `Theo's Farm` property and its production Transactions and Ecommerce purchases reports.
- A previously approved controlled transaction was reconciled without placing another order. GA4 reported it on 2026-08-05 in the property's Chicago timezone with transaction suffix `zx4ID`, exactly one ecommerce purchase, USD 36.85 purchase revenue, SKU `ear-corn-20lb`, quantity 1, and USD 17.95 item revenue.
- The trusted paid/fulfilled order has suffix `Tndomf`, SKU `ear-corn-20lb`, quantity 1, USD 17.95 item subtotal, and USD 36.85 total. Shipping is calculated as USD 36.85 total minus USD 17.95 item revenue = USD 18.90, matching the trusted order's stored shipping amount.
- Deduplication passed: the transaction-specific GA4 report contains one purchase for suffix `zx4ID`.
- PII review passed: the inspected GA4 report surfaces contained transaction and item metrics without customer data, and automated contract checks exclude customer, address, payment, and free-form error fields.
- Known gaps: the standard GA4 reports do not expose the exact event time. On the controlled transaction date, the Checkout journey report showed one `begin_checkout` user but did not connect the separately recorded purchase into the same closed funnel; transaction and trusted-order reconciliation therefore remain the purchase authority. Historic data before stable collection is unavailable, so the first complete 28-day period after launch remains the baseline.
