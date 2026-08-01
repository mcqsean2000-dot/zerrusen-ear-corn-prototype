# Theo's Farm SEO Measurement Plan

Status: Search Console baseline recorded; GA4 integration pending SEO-004
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
| GA4 | Sessions, engagement, ecommerce funnel, purchases, revenue | `theosfeedfarm@gmail.com` | Pending SEO-004 |
| Storefront order system | Authoritative orders and revenue reconciliation | Calvin | Existing; integration scope pending |
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
