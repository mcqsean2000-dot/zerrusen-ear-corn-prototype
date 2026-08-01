# GA4 test-purchase runbook

Status: Property and web stream created; reviewed production deployment and separately approved purchase remain pending

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

## Failure handling

- If checkout cannot continue, verify a bounded `checkout_error` event and stop.
- If the purchase appears more than once, treat SEO-004 as failed and fix deduplication before another test.
- If GA4 and the trusted order disagree, the trusted order is authoritative. Record the discrepancy; do not report attributed revenue until resolved.
- Do not place a second transaction merely to troubleshoot without renewed approval.

## Activation record

- 2026-08-01: Theo's Farm GA4 property and web stream created.
- Stream ID: `15363981412`.
- Measurement ID: `G-KQSFKF42YM`.
- Repository activation prepared for review; production deployment has not been performed by this change.
- No test purchase has been performed.
