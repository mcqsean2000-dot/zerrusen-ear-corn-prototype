# Technical SEO policy and audit runbook

Status: Automated foundation implemented in SEO-006

## URL and canonical policy

- Canonical origin: `https://theosfarm.com`.
- The homepage canonical is `/`.
- Future content and commerce routes use lowercase words, hyphens, and a trailing slash.
- Query strings and fragments do not create canonical pages.
- One canonical URL may map to one indexable HTML document.
- Redirects must be one hop to the canonical HTTPS URL. Redirect chains and soft 404s fail review.
- Deleted or unknown public paths return a real `404` unless an approved redirect maps an equivalent intent.
- Admin, checkout-session, preview, staging, private, and generated operational URLs are never included in the sitemap and must carry `noindex` protection when publicly reachable.

## CI contract

`npm run check:seo` reads `seo-config.json` and fails on:

- missing, duplicate, or malformed titles, descriptions, canonicals, or H1 headings;
- indexable pages carrying `noindex`;
- private pages missing `noindex` or a robots exclusion;
- missing image alt text;
- broken same-page fragment links;
- invalid JSON-LD;
- mismatches between visible product SKU/name/price and Product structured data;
- non-first-party structured product images;
- sitemap/config mismatches;
- private, staging, checkout, preview, or localhost URLs in the sitemap;
- missing inbound links for non-exempt indexable pages.

The homepage is temporarily marked `orphanExempt` because it is the only indexable URL. Remove that exception as soon as SEO-008 adds a second indexable page.

`seo-config.json` is also the canonical crawler-file manifest:

- `npm run build:seo` regenerates `sitemap.xml` and `robots.txt`.
- `npm run check:seo-files` fails when either committed file differs from the manifest.
- New indexable routes must be added to the manifest in the same pull request as their HTML files and internal links.
- Private paths must be added to `robotsDisallow` and receive an appropriate `X-Robots-Tag` header when they are publicly reachable.
- Firebase keeps exact rewrites for `/checkout/success` and `/checkout/cancel`, both with `noindex` headers. It intentionally has no catch-all homepage rewrite, allowing unknown paths to return a real `404`.

## Runtime checks

Repository CI cannot prove live status codes, redirects, rendered mobile behavior, Core Web Vitals, or Google eligibility. After every approved deployment:

1. Fetch every configured indexable URL and require final HTTP `200`.
2. Fetch one known unknown URL and require HTTP `404`.
3. Confirm HTTP redirects once to the canonical HTTPS origin.
4. Run mobile Lighthouse against the homepage and every new template type.
5. Record field Core Web Vitals from Search Console when sufficient data exists; do not substitute lab data for field data.
6. Validate new or changed structured data with Google's Rich Results Test.
7. Inspect Search Console Pages, HTTPS, Product snippets, and Merchant listings for regressions.

## Monitoring boundary

- CI runs on every pull request and push to `main`.
- A future production monitor may fetch public URLs and alert on status, canonical, robots, sitemap, and broken-link regressions.
- Search Console data is reviewed weekly because indexation changes are delayed and cannot be safely treated as deployment-time tests.
- No automated monitor may request indexing, remove URLs, change redirects, or alter Search Console without approval.
