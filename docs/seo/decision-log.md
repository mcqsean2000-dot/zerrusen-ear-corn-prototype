# Theo's Farm SEO Decision Log

## Decision format

Each entry records date, decision, owner, rationale, affected gates, and superseding decision when applicable.

## Decisions

### SEO-DEC-001 — Adopt the AI-first SEO roadmap

- Date: 2026-07-28
- Owners: Sean McQueen and Calvin Hagerstrom
- Decision: Proceed under `docs/theos-farm-ai-seo-roadmap.md`.
- Rationale: Automate routine SEO work while retaining human control of facts, access, spending, deployment, publication, and outreach.
- Source: GitHub issue #45.
- Status: Active.

### SEO-DEC-002 — Google account ownership

- Date: 2026-07-29
- Owners: Sean McQueen and Calvin Hagerstrom
- Decision: Search Console and GA4 are owned by the Theo's Farm business Google account, `theosfeedfarm@gmail.com`; Sean is business authorizer and Calvin performs technical setup.
- Constraint: No passwords, tokens, service-account keys, or other credentials in Git.
- Source: GitHub issue #45.
- Status: Active.

### SEO-DEC-003 — Defer Merchant Center

- Date: 2026-07-29
- Owners: Sean McQueen and Calvin Hagerstrom
- Decision: Defer Merchant Center until crawlable product pages, canonical product data, shipping details, pricing, and availability are verified.
- Revisit: SEO-005.
- Source: GitHub issue #45.
- Status: Active.

### SEO-DEC-004 — Initial external data budget

- Date: 2026-07-29
- Owners: Sean McQueen and Calvin Hagerstrom
- Decision: Initial external SEO-data budget is `$0` per month.
- Effect: Use Search Console, GA4, repository data, and public manual research; paid APIs require a new approved decision.
- Source: GitHub issue #45.
- Status: Active.

### SEO-DEC-005 — Deployment and factual approvals

- Date: 2026-07-29
- Owners: Sean McQueen and Calvin Hagerstrom
- Decision: Calvin is production deployment approver. Sean must also approve material public product, farm, pricing, shipping, or factual changes.
- Backup review: Calvin may approve only facts already present as approved in the fact register.
- Source: GitHub issue #45.
- Status: Active.

### SEO-DEC-006 — Merchant, outreach, and publication safety

- Date: 2026-07-29
- Owners: Sean McQueen and Calvin Hagerstrom
- Decision: No unapproved paid action, outreach, backlink activity, public content publication, material page change, or production deployment.
- Exceptions: None approved.
- Source: GitHub issue #45.
- Status: Active.

### SEO-DEC-007 — Search Console observed ownership differs from intended ownership

- Date: 2026-07-30
- Owner: Sean McQueen
- Observation: The `theosfarm.com` domain property is verified and its sitemap is successful, but the verified Search Console session identifies Sean McQueen rather than the business Google account named in SEO-DEC-002.
- Decision required: Confirm `theosfeedfarm@gmail.com` already has owner access, authorize adding it, or amend SEO-DEC-002 to make Sean McQueen's account the canonical owner.
- Safe state: Keep the existing verified property and successful sitemap unchanged. Do not change Search Console users or permissions without explicit approval.
- Source: Google Search Console property settings and GitHub issue #56.
- Status: Pending owner decision.
