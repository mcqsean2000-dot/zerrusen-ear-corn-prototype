# Google Merchant Center readiness

Status: Explicitly deferred  
Decision date: 2026-08-01  
Decision owner: Sean McQueen under SEO-DEC-003  
Budget: `$0` per month; no paid listings, ads, promotions, or billing changes approved

## Decision

Do not create or configure a Theo's Farm Merchant Center account yet.

The live storefront exposes two valid product entities and Search Console reports two valid Merchant listings with zero invalid items. That is useful eligibility evidence, but it does not satisfy the approved commerce architecture. Both products currently resolve to the homepage and the sitemap contains only that one URL. The required standalone product, category, and shipping URLs are Gate 3 work.

Creating Merchant Center now would force product-feed, destination, shipping, and availability decisions before the canonical crawlable sources are complete. The safe action is to preserve the valid structured data, complete Gates 1–3, and revisit account creation only when the checklist below passes.

## Evidence observed 2026-08-01

| Check | Evidence | Result |
| --- | --- | --- |
| Live homepage | `https://theosfarm.com/` returned HTTP `200` over HTTPS | Pass |
| Canonical | Homepage declares `https://theosfarm.com/` | Pass |
| Product data | Two `Product` entities expose stable SKU, image, USD price, and `InStock` availability | Pass with verification requirement |
| Visible product match | 20 lb at `$17.95` and 40 lb at `$29.95`, both plus shipping, are visible on the homepage | Pass with verification requirement |
| Real imagery | Product entities reference the approved real 20 lb and 40 lb bag photos | Pass |
| Search eligibility | Search Console baseline reports two valid Merchant listings and zero invalid | Pass |
| Product destinations | Both offers point to homepage fragment `#shop`; no standalone product URLs exist | Blocked by Gate 3 |
| Sitemap coverage | Live sitemap contains only `https://theosfarm.com/` | Blocked by Gates 2–3 |
| Crawlable shipping page | Shipping information is a homepage section, not the required standalone URL | Blocked by Gate 3 |
| Checkout reconciliation | Price, availability, shipping, and checkout behavior have not completed the Gate 1 test-purchase trace | Blocked by SEO-004 |

The product price and availability values above are observed storefront values, not a new factual approval. They must be rechecked against the trusted checkout immediately before a future feed or account is activated.

## Revisit trigger

Reopen Merchant Center configuration only after all of these are true:

- SEO-004 has traced one approved purchase and analytics can distinguish organic outcomes.
- SEO-006 and SEO-007 enforce technical quality, sitemap, robots, and indexability in CI.
- SEO-009 has launched reviewed standalone 20 lb and 40 lb product pages.
- SEO-010 has launched reviewed pillar, shipping, farm, and guide-index pages.
- Product URL, SKU, title, description, image, price, availability, shipping, return/contact, and checkout values are reconciled.
- `theosfeedfarm@gmail.com` is confirmed as the business account owner/admin.
- Sean approves account creation and any product, shipping, tax, return, or business-information submission.

## Future free-listing configuration checklist

- Use the business Google account and minimum required access.
- Claim only `theosfarm.com`; do not change DNS or Search Console ownership without approval.
- Prefer automatic website product discovery or a deterministic first-party feed generated from the same canonical product source.
- Keep one product ID per canonical SKU.
- Use only real product photos showing the actual white bags and actual whole ears of corn on the cob.
- Match product destinations, visible price, availability, and shipping exactly.
- Enable free listings only after diagnostics are clean.
- Do not enable ads, promotions, paid campaigns, billing, or third-party feed services under the `$0` decision.
- Record diagnostics and approvals in GitHub without credentials or customer data.
