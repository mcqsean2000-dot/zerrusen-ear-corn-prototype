# Theo's Farm SEO Measurement Plan

Status: Search Console baseline recorded; GA4 property, web stream, production deployment, and traced purchase reconciliation complete
Business authorizer: Sean McQueen  
Technical owner: Calvin Hagerstrom  
Initial external data budget: $0 per month

## Principles

- Organic revenue and qualified ecommerce actions are primary outcomes.
- Search rankings are diagnostics, not guarantees.
- Baselines are recorded before optimization.
- Reports distinguish observed data, estimates, and AI inference.
- No customer-level personal data is required for SEO reporting.

## Data sources

| Source | Purpose | Owner | Status |
| --- | --- | --- | --- |
| Google Search Console | Queries, pages, impressions, clicks, average position, indexation | `theosfeedfarm@gmail.com`; Sean McQueen retained as verified owner | Connected; ownership aligned 2026-08-01 |
| GA4 | Sessions, engagement, ecommerce funnel, purchases, revenue | `theosfeedfarm@gmail.com` | Property and web stream created 2026-08-01; measurement ID verified live 2026-08-02; controlled purchase reconciled 2026-08-24 |
| Storefront order system | Authoritative orders and revenue reconciliation | Calvin | Controlled paid/fulfilled order reconciled to GA4 2026-08-24; broader integration scope pending |
| Repository crawl | Status, canonical, metadata, schema, links, indexability | Calvin | Pending SEO-006 |
| Google Merchant Center | Product visibility and feed diagnostics | `theosfeedfarm@gmail.com` | Deferred to SEO-005 |
| External ranking/backlink API | Competitor and SERP enrichment | Unassigned | Deferred; budget is $0 |

## Required GA4 events

| Event | Trigger | Required parameters | Conversion |
| --- | --- | --- | --- |
| `view_item` | Product detail becomes visible | `item_id`, `item_name`, `price`, `currency` | No |
| `add_to_cart` | Cart accepts a product | `item_id`, `quantity`, `price`, `currency` | Supporting |
| `begin_checkout` | Customer starts checkout | `value`, `currency`, `items` | Supporting |
| `purchase` | Confirmed completed order | `transaction_id`, `value`, `currency`, `items` | Primary |
| `checkout_error` | Checkout cannot continue | `error_class`, `step` | Diagnostic |

Do not send names, email addresses, street addresses, phone numbers, payment data, or free-form error messages to GA4.

## GA4 implementation contract

- `analytics-config.js` is the only public storefront configuration surface. The business-owned web stream uses the public measurement ID `G-KQSFKF42YM`.
- A blank or malformed measurement ID fails closed: no Google tag is loaded and no event is transmitted.
- `analytics.js` permits only explicit ecommerce fields. It does not accept customer or address objects.
- Product identity uses the canonical SKUs `ear-corn-20lb` and `ear-corn-40lb`.
- Currency is always `USD`; item and shipping values are numeric dollars derived from integer cents.
- Client-side `purchase` uses the Stripe Checkout Session ID as `transaction_id` and deduplicates it in browser storage. Before redirect, the storefront stores only the matching session ID, canonical SKU/quantity lines, and bounded server-returned shipping cents so the return event does not lose shipping revenue or persist customer data. The storefront event is diagnostic; the trusted order system remains authoritative for paid status and revenue reconciliation.
- `checkout_error` accepts only a bounded error class and funnel step. Raw exceptions and free-form messages are never transmitted.
- Automated contract coverage runs through `npm run check:analytics` and the repository's required `npm run check`.

### Activation evidence

SEO-004 activation evidence was completed on 2026-08-24:

1. The business-owned account can access the `Theo's Farm` property and production reports.
2. The reviewed public measurement ID was deployed and verified 2026-08-02.
3. Production reports show item views, add-to-cart activity, one checkout start, and one transaction-specific purchase for the controlled order; the closed Checkout journey does not connect that purchase and is recorded as a known gap.
4. GA4 transaction suffix `zx4ID` reconciles to paid/fulfilled trusted order suffix `Tndomf`.
5. The sanitized evidence, calculated shipping, deduplication result, PII review, and known gaps are recorded in the [GA4 test-purchase runbook](ga4-test-purchase-runbook.md).

### GA4 property and web stream

Observed during business setup on 2026-08-01:

- Account/property setup completed after Sean McQueen accepted Google Analytics' Terms of Service on behalf of Theo's Farm.
- Property: `Theo's Farm`.
- Property timezone: Chicago Time.
- Currency: USD.
- Web stream: `Theo's Farm Website`.
- Stream URL: `https://theosfarm.com`.
- Stream ID: `15363981412`.
- Measurement ID: `G-KQSFKF42YM`.
- Enhanced measurement retained: page views, scrolls, and outbound clicks.
- Enhanced measurement disabled: site search, form interactions, video engagement, and file downloads.
- Google Analytics reported data collection pending; activation can take up to 48 hours after deployment.

The measurement ID and stream ID are public configuration identifiers, not credentials. No password, token, or customer data is stored in the repository.

## Baseline report

Record at least:

- Reporting dates and timezone.
- Indexed and excluded URL counts.
- Branded and non-branded queries.
- Impressions, clicks, click-through rate, and average position.
- Organic sessions and engaged sessions.
- Product views, add-to-cart events, checkout starts, purchases, revenue, and conversion rate.
- Known tracking gaps and launch dates.

If historic data is unavailable, record the first complete 28-day period as the baseline and label earlier comparisons unavailable.

### GA4 activation baseline and known gaps

Observed on 2026-08-24 for the GA4 reporting date 2026-08-05 in the property's Chicago timezone:

- Transaction suffix `zx4ID` appears once with one ecommerce purchase and USD 36.85 purchase revenue.
- SKU `ear-corn-20lb` has one item purchased and USD 17.95 item revenue.
- The trusted paid/fulfilled order suffix `Tndomf` has the same SKU and quantity, USD 17.95 item subtotal, USD 18.90 shipping, and USD 36.85 total.
- Shipping is calculated in GA4 reconciliation as USD 36.85 purchase revenue minus USD 17.95 item revenue = USD 18.90.
- The inspected report surfaces contained no customer PII; the analytics contract also excludes customer, address, payment, and free-form error data.
- Exact event time is not exposed in the standard Transactions report. On the controlled transaction date, the Checkout journey report showed one `begin_checkout` user but zero purchases in the same closed funnel even though Transactions recorded the reconciled purchase. Transaction and trusted-order reports therefore remain authoritative while cross-session funnel continuity is a known gap.
- Historic data before stable collection is unavailable, so the first complete 28-day period after launch remains the formal GA4 baseline.
- A second GA4 transaction in the inspected launch-period report corresponds to a refunded/canceled trusted order. The trusted order system remains authoritative, and that transaction must not be treated as retained revenue without refund reconciliation.

## Search Console baseline

Observed in Google Search Console on 2026-07-30:

- Property: domain property `theosfarm.com`.
- Verification: the signed-in Sean McQueen account reports “You are a verified owner.”
- Property added: 2026-07-03.
- Sitemap: `https://theosfarm.com/sitemap.xml`.
- Sitemap submitted: 2026-07-02.
- Sitemap last read: 2026-07-28.
- Sitemap status: Success.
- Sitemap discovery: 1 page and 0 videos.
- Indexation overview: 1 indexed page and 3 not-indexed URLs.
- Search performance overview: 9 total web-search clicks in the period displayed by the overview.
- HTTPS overview: 1 HTTPS URL and 0 non-HTTPS URLs.
- Product snippets: 2 valid and 0 invalid.
- Merchant listings: 2 valid and 0 invalid.
- Crawl stats: 156 crawl requests during the preceding 90 days.
- `robots.txt`: Search Console reports all files valid.

The Search Console interface did not expose the overview card's exact date range in the captured baseline. The click count is therefore an observed account value with an incomplete date range and must not be used for period-over-period attribution.

### Ownership alignment

On 2026-08-01, Sean McQueen explicitly authorized the ownership alignment required by SEO-DEC-002. Search Console then confirmed `theosfeedfarm@gmail.com` as an Owner of the `theosfarm.com` domain property. Sean McQueen's existing verified owner access was retained for operational continuity. No ownership verification token, password, or other credential was added to the repository.

## Attribution

- Primary acquisition dimension: GA4 session default channel group.
- Organic search includes recognized unpaid search traffic.
- SEO-assisted revenue may be reported separately only when the attribution model is named.
- Order-system revenue is authoritative when GA4 and order totals differ.
- Social, email, referral, direct, and paid traffic must not be counted as organic.

## Reporting cadence

- Daily: automated technical regression signals after SEO-006.
- Weekly: Search Console and ecommerce funnel anomalies.
- Monthly: business report with evidence, confidence, effort, risk, and recommended next actions.
- Quarterly: content consolidation, refresh, redirect, or retirement review.

## AI reporting contract

Every AI-produced result must label statements as one of:

- `Observed`: directly present in an identified data source and date range.
- `Calculated`: formula applied to observed values, with formula stated.
- `Estimated`: modeled or sampled value with limitations.
- `Inferred`: interpretation requiring human judgment.

The AI must not claim causation from timing alone.
