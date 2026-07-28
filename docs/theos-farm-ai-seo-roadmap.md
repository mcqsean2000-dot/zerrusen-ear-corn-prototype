# Theo's Farm AI-First SEO Service Roadmap

Status: Proposed  
Version: 1.0  
Owners: Sean McQueen and Calvin Hagerstrom  
Execution model: AI performs routine analysis and production; humans control facts, access, risk, spend, deployment, and publication.

## 1. Objective

Build a repeatable SEO and AI-search visibility service with Theo's Farm as the first client. The system must increase qualified discovery and attributable ecommerce revenue without relying on low-value bulk content, unverifiable claims, manipulative links, or unsupervised production changes.

The service is successful when it can:

1. Measure organic visibility, traffic, conversions, and revenue.
2. Detect technical SEO problems automatically.
3. Turn verified search opportunities into useful content briefs.
4. Draft on-brand pages using Theo's Farm facts and real product media.
5. require human approval for factual and public-facing decisions.
6. Publish approved changes through tested GitHub pull requests.
7. Monitor indexing and performance after release.
8. Recommend refreshes or reversals from evidence.
9. Repeat the workflow for future Toolpath Systems clients.

This roadmap is gate-based, not calendar-based. Work must not advance because a date has arrived. It advances only when the preceding gate is satisfied.

## 2. Non-negotiable operating rules

### 2.1 Source control

- Every code, content, metadata, schema, or configuration change must be made on an `agent/*` branch.
- Every production change must be reviewed in a pull request.
- One pull request should address one bounded outcome.
- Generated pages and metadata are treated as code and receive the same review.
- Direct commits to `main` are prohibited.
- Production deployments must reference a reviewed commit.

### 2.2 AI permissions

AI may perform without separate approval:

- Read-only audits of the repository and public website.
- Search Console and analytics analysis after access is granted.
- Keyword clustering and opportunity scoring.
- Technical issue detection.
- Content briefs and draft creation.
- Internal-link recommendations.
- Metadata, structured data, sitemap, and test generation.
- Local builds, tests, previews, and pull-request preparation.
- Performance summaries and refresh recommendations.

AI must obtain explicit human approval before:

- Publishing a new page or materially changing a product page.
- Deploying to production.
- Making claims about farming, treatment, storage, wildlife, safety, shipping, pricing, availability, or product performance.
- Spending money or enabling a paid API.
- Contacting a person, publication, organization, website, or community.
- Posting or commenting on Reddit, forums, social media, or third-party sites.
- Creating, buying, exchanging, or requesting backlinks.
- Changing analytics retention, account access, permissions, domains, or billing.
- Deleting, redirecting, unpublishing, or deindexing public content.

### 2.3 Content quality

- No page may exist solely to target a keyword variation.
- No unsupported superlatives, health claims, feeding claims, or guarantees.
- No fictional packaging or loose kernels may represent Theo's Farm products.
- Product imagery must show actual white bags and actual whole ears of corn on the cob.
- AI drafts must contain Theo's Farm-specific knowledge, original photography, original data, a useful answer, or another clear first-party contribution.
- Every factual page must include a fact-review record identifying the human reviewer and approval date.
- Duplicate or substantially overlapping topics must be consolidated.
- Content length is determined by usefulness, not a word-count target.

### 2.4 Measurement discipline

- Baselines must be recorded before optimization.
- Rankings are diagnostic metrics, not promises.
- Organic revenue and qualified conversions are primary business outcomes.
- No result may be attributed to SEO without a defined comparison period and source.
- Reports must distinguish observed data, estimates, and AI inference.

## 3. Roles and decision rights

| Responsibility | AI agent | Calvin | Sean |
| --- | --- | --- | --- |
| Repository and technical audit | Responsible | Reviews material findings | Informed |
| Architecture and implementation | Responsible | Technical approver | Informed |
| Keyword and content opportunity analysis | Responsible | Reviews system quality | Business approver |
| Farm/product factual accuracy | Draft support only | Consulted | Final approver |
| Brand and photography compliance | Automated checks | Reviewer | Final approver |
| Analytics and Search Console access | No authority to grant | Technical setup | Account authorization |
| Production deployment | Prepares and validates | Executes or approves | Approves material public changes |
| Paid tools and budgets | Recommends | Technical recommendation | Final approval |
| Backlink/community outreach | Research and drafts only | Reviews process | Explicit approval before contact |
| Monthly performance review | Produces report | Technical interpretation | Business decisions |

When Calvin and Sean disagree, production state remains unchanged until they resolve the decision.

## 4. Canonical sources of truth

The following files must exist and remain current:

- `docs/theos-farm-ai-seo-roadmap.md` — operating roadmap and gates.
- `docs/theos-farm-brand-guidelines.md` — visual, voice, naming, and photography policy.
- `docs/seo/fact-register.md` — approved business, farm, product, and shipping facts.
- `docs/seo/keyword-map.csv` — one primary intent and destination URL per cluster.
- `docs/seo/content-inventory.csv` — every indexable page, owner, status, and review date.
- `docs/seo/measurement-plan.md` — events, conversions, dimensions, and reporting definitions.
- `docs/seo/decision-log.md` — material strategy and exception decisions.
- `docs/seo/runbook.md` — recurring audit, drafting, review, publication, and rollback steps.

The AI must stop and request review if sources conflict. It may not silently choose the most convenient fact.

## 5. Required system architecture

```text
Search Console + GA4 + Merchant Center + site crawl
                       |
                       v
             Opportunity warehouse
                       |
                       v
       Rules-based scoring and keyword map
                       |
                       v
      Brief -> AI draft -> automated validation
                       |
                       v
         Sean fact review + Calvin code review
                       |
                       v
              GitHub pull request
                       |
                       v
         Approved deploy -> index submission
                       |
                       v
       Monitoring -> refresh, retain, or revert
```

The first implementation may store small datasets as versioned CSV or JSON files. A database is justified only when volume or concurrent clients make files unreliable.

## 6. Phase gates

### Gate 0 — Governance and access

Deliverables:

- This roadmap merged into `main`.
- GitHub issue and pull-request templates for SEO work.
- Fact register initialized from verified site and business records.
- Brand guidelines declared as a required content input.
- Named Google accounts and minimum required access documented.
- Paid-tool budget recorded as approved or `$0`.

Acceptance criteria:

- Sean and Calvin approve the non-negotiable rules.
- No shared passwords, tokens, or secrets are committed to Git.
- AI permissions and human approval boundaries are reflected in the runbook.

Exit decision: `GO` or `BLOCKED: <reason>`.

### Gate 1 — Measurement baseline

Deliverables:

- Google Search Console property verified for `theosfarm.com`.
- GA4 configured with page views, product views, add-to-cart, checkout start, purchase, revenue, and error events.
- Search Console and GA4 data access tested without exposing credentials.
- Google Merchant Center created or explicitly deferred with rationale.
- Baseline report covering indexation, queries, impressions, clicks, organic sessions, conversions, and revenue.
- UTM and attribution conventions documented.

Acceptance criteria:

- One test purchase can be traced through the agreed analytics events.
- Search Console reports the canonical domain and accepts the sitemap.
- Baseline period and known data gaps are written down.

No content expansion may begin until this gate passes. Otherwise later performance claims will be unreliable.

### Gate 2 — Technical SEO foundation

Deliverables:

- Automated crawl for status codes, titles, descriptions, canonicals, headings, indexability, structured data, image alt text, internal links, and orphan pages.
- Core Web Vitals and mobile checks.
- Redirect, 404, trailing-slash, and canonical policy.
- Automated sitemap generation.
- `robots.txt` validation.
- Structured-data validation in tests and Google's Rich Results Test.
- Production monitoring for broken links and indexing regressions.

Acceptance criteria:

- Every indexable page returns `200`, has one canonical URL, a unique title, a useful description, and at least one internal link from another indexable page.
- No staging, admin, checkout-session, or private URL is indexable.
- Product facts in structured data exactly match visible content.
- CI fails on critical SEO regressions.

### Gate 3 — Crawlable commerce architecture

Required initial URLs:

- `/ear-corn/`
- `/20-lb-ear-corn/`
- `/40-lb-ear-corn/`
- `/shipping-whole-ear-corn/`
- `/about-the-farm/`
- `/guides/`

Deliverables:

- Standalone 20 lb and 40 lb product pages with direct purchase paths.
- A whole-ear-corn category/pillar page.
- Shipping and fulfillment explanation.
- Farm story and verifiable experience page.
- Guide index.
- Crawlable global navigation and breadcrumbs.
- Product, Organization, WebSite, and Breadcrumb structured data where applicable.
- Real product photos and descriptive alt text.
- Updated sitemap and internal-link map.

Acceptance criteria:

- Each URL owns a distinct user intent defined in `keyword-map.csv`.
- Products are reachable through ordinary HTML links without using the cart.
- Prices, availability, images, and shipping language match the live checkout.
- Mobile and static-package checks pass.
- Sean approves product/farm facts; Calvin approves implementation.

### Gate 4 — AI content operating system

Workflow:

1. Import Search Console queries and approved external research.
2. Cluster by user intent.
3. Map each cluster to an existing or proposed URL.
4. Score opportunity.
5. Reject duplicate, irrelevant, unsupported, or low-value topics.
6. Generate a source-backed brief.
7. Generate a draft using the fact register and brand guide.
8. Run automated quality checks.
9. Obtain Sean's factual approval.
10. Open a pull request for Calvin's technical review.
11. Deploy only after both approvals.
12. Request indexing and begin monitoring.

Every brief must specify:

- Searcher and problem.
- Primary intent.
- Destination URL.
- Supporting queries.
- Required first-party contribution.
- Approved facts and prohibited claims.
- Real image requirements.
- Internal links in and out.
- Structured-data eligibility.
- Conversion action.
- Sources and retrieval dates.
- Refresh trigger.

Initial guide backlog:

1. Whole ear corn versus loose corn for wildlife feeders.
2. Choosing whole ear corn for squirrel feeders.
3. How to store dried whole ear corn.
4. Choosing between 20 lb and 40 lb bags.
5. How Theo's Farm cleans and packs ear corn.
6. How whole ear corn is packaged for shipping.
7. Seasonal planning for wildlife-feeder corn.
8. Common names: ear corn, cob corn, squirrel corn, deer corn, and wildlife corn.

Acceptance criteria:

- Each published guide has a named human fact reviewer.
- Each guide adds first-party value and links naturally to the relevant product.
- Automated checks find no unsupported claims, missing required metadata, broken internal links, fake product imagery, or duplicate intent.
- Publishing cadence begins at no more than two guides per month.
- Cadence may increase only after three months of positive quality, indexation, and conversion evidence.

### Gate 5 — Authority and discovery

Deliverables:

- Relevant organization, publication, supplier, feeder-manufacturer, farm-history, local-media, and directory prospect list.
- Quality rubric covering topical relevance, real audience, editorial control, traffic evidence, link placement, and spam risk.
- Outreach templates that require explicit approval before sending.
- Community-response policy for Reddit, forums, Facebook groups, and Q&A sites.
- Earned-link and brand-mention log.

Acceptance criteria:

- No paid, exchanged, inserted, or automated link is pursued without written approval.
- No AI agent impersonates a customer, farmer, wildlife expert, or unaffiliated community member.
- Every external communication is individually reviewed.
- Monthly reporting separates earned mentions, followed links, nofollow links, referral traffic, and conversions.

### Gate 6 — Reporting and optimization

Dashboard sections:

- Indexation and crawl health.
- Branded and non-branded search visibility.
- Query clusters and destination pages.
- Organic sessions and engaged sessions.
- Product views, add-to-cart rate, checkout starts, purchases, revenue, and conversion rate.
- Published content and review status.
- Content decay and refresh candidates.
- Referring domains and referral conversions.
- AI-search test prompts, citations, and evidence date.
- Incidents, reversals, and unresolved blockers.

Operating cadence:

- Daily: automated crawl and deployment regression alerts.
- Weekly: indexing, query, conversion, and anomaly review.
- Monthly: business report and prioritized next actions.
- Quarterly: consolidate, refresh, redirect, or retire weak content with approval.

Acceptance criteria:

- Every chart links to its source and includes a date range.
- AI-search observations are labeled as sampled observations, not population-level rankings.
- Recommendations state expected impact, confidence, effort, and risk.

### Gate 7 — Productize for additional clients

This phase begins only after Theo's Farm completes at least three monthly reviews.

Deliverables:

- Client onboarding questionnaire.
- Per-client fact register and brand policy.
- Isolated credentials and data.
- Configurable audit rules.
- Reusable content and review workflow.
- Multi-client dashboard with strict tenant separation.
- Service definition, pricing assumptions, support boundaries, and cancellation/export process.

Acceptance criteria:

- No client data or prompt context crosses tenant boundaries.
- A new client can be onboarded without copying secrets or source-specific claims.
- Every client retains human control of claims, publication, outreach, and spend.

## 7. Opportunity scoring

The AI must score proposed work using the same rubric:

| Dimension | Range | Meaning |
| --- | --- | --- |
| Business relevance | 0–5 | Likelihood the intent can lead to a suitable Theo's Farm customer |
| Evidence of demand | 0–5 | Search Console or approved external evidence |
| Current gap | 0–5 | No useful destination exists or current coverage is weak |
| First-party advantage | 0–5 | Theo's Farm has original experience, facts, photos, or process |
| Conversion proximity | 0–5 | Searcher is near product selection or purchase |
| Effort | 1–5 | Research, implementation, review, and maintenance cost |
| Risk | 0–5 | Claim, policy, reputation, or cannibalization risk |

Priority score:

`(business relevance + demand + gap + first-party advantage + conversion proximity) - effort - risk`

The score orders review; it never authorizes publication.

## 8. Pull-request contract

Every SEO pull request must include:

- Problem and user intent.
- Destination URL and keyword-map entry.
- Exact facts added or changed.
- Sources.
- Screenshots or rendered previews.
- Schema and metadata changes.
- Internal links changed.
- Tests executed.
- Fact-review approval.
- Deployment and rollback plan.
- Measurement plan and review date.

Required labels:

- `seo`
- `content` or `technical-seo`
- `needs-fact-review` until Sean approves
- `needs-technical-review` until Calvin approves
- `codex`
- `codex-automation` when created by an automation

Merge is prohibited while either review label remains.

## 9. Definition of done

A unit of SEO work is complete only when:

- The intended user problem is explicit.
- The URL and intent do not duplicate another page.
- Facts are approved.
- Brand and photography rules pass.
- Metadata, canonical, schema, and internal links are correct.
- Automated tests pass.
- The pull request is reviewed and merged.
- Production is verified.
- Sitemap and indexation steps are complete.
- Measurement begins.
- A review date and success metric are recorded.

Writing a draft, merging code, or publishing a page alone does not satisfy the definition of done.

## 10. Initial GitHub issue sequence

Create and complete these issues in order:

1. `SEO-001 Approve AI SEO governance and decision rights`
2. `SEO-002 Create fact register and SEO source-of-truth files`
3. `SEO-003 Connect Search Console and submit sitemap`
4. `SEO-004 Define GA4 ecommerce measurement and verify a test purchase`
5. `SEO-005 Decide and configure Google Merchant Center`
6. `SEO-006 Build automated technical SEO audit and CI checks`
7. `SEO-007 Implement automatic sitemap and indexability controls`
8. `SEO-008 Build crawlable SEO page templates and navigation`
9. `SEO-009 Launch standalone 20 lb and 40 lb product pages`
10. `SEO-010 Launch ear-corn pillar, shipping, farm, and guide-index pages`
11. `SEO-011 Build keyword map, content inventory, and opportunity scorer`
12. `SEO-012 Build AI brief, drafting, factual-review, and PR workflow`
13. `SEO-013 Publish and measure the first two approved guides`
14. `SEO-014 Build SEO performance dashboard and weekly report`
15. `SEO-015 Establish authority prospecting and outreach approval workflow`
16. `SEO-016 Complete the first monthly SEO business review`

Each issue must copy the relevant gate acceptance criteria into its checklist. A later-numbered issue may be prepared early but may not be deployed before its gate opens.

## 11. Stop conditions

AI must stop the current workflow and create a blocking issue when:

- A required claim is not in the fact register.
- Search intent conflicts with product reality.
- Analytics cannot distinguish organic results.
- A proposed page duplicates an existing intent.
- A source is inaccessible, outdated, or materially contradicted.
- A generated image changes the appearance of the real product.
- A deployment would expose credentials, private admin routes, or customer data.
- A paid action lacks an approved budget.
- External outreach lacks explicit approval.
- Indexation, traffic, or conversions show a material unexplained decline after release.

The blocking issue must state evidence, affected work, safe options, and the decision owner.

## 12. First decision

After this roadmap is merged, Sean and Calvin must review `SEO-001` and record:

- Approval of the AI permission boundary.
- Account owner for Search Console, GA4, and Merchant Center.
- Whether initial external SEO-data spend is `$0` or an approved monthly amount.
- The production deployment approver.
- The factual reviewer backup when Sean is unavailable.

No implementation phase begins until that decision is recorded.
