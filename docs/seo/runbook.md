# Theo's Farm AI SEO Runbook

Status: Initial operating procedure  
Applies to: Technical audits, opportunity analysis, briefs, content, metadata, schema, publication, monitoring, and rollback

## 1. Start every work item

1. Confirm the numbered SEO GitHub issue and current roadmap gate.
2. Read:
   - `docs/theos-farm-ai-seo-roadmap.md`
   - `docs/theos-farm-brand-guidelines.md`
   - `docs/seo/fact-register.md`
   - `docs/seo/keyword-map.csv`
   - `docs/seo/content-inventory.csv`
   - `docs/seo/decision-log.md`
3. Check for newer issue comments or decisions.
4. Create an isolated `agent/*` branch from current `origin/main`.
5. Record intended URLs, facts, measurements, and approval owners.
6. Stop if the gate is closed or sources conflict.

## 2. Read-only audit

AI may:

- Crawl public pages.
- Inspect repository files and rendered output.
- Analyze Search Console and GA4 after access is granted.
- Identify technical defects, intent gaps, and measurement gaps.

Audit output must include:

- Evidence and retrieval date.
- Affected URL or file.
- Severity, user impact, confidence, and recommended owner.
- Whether the finding is observed or inferred.

Audits do not authorize fixes or publication.

## 3. Opportunity and brief workflow

1. Identify evidence of a user need.
2. Match it to one keyword cluster.
3. Confirm one destination URL owns the intent.
4. Reject duplicate or unsupported topics.
5. Score the opportunity using the roadmap rubric.
6. Create a brief containing:
   - Searcher and problem.
   - Intent and destination.
   - Fact IDs.
   - Required first-party contribution.
   - Prohibited claims.
   - Real-image requirements.
   - Internal links.
   - Conversion action.
   - Sources and dates.
   - Refresh trigger.
7. Obtain factual approval before publication work.

## 4. Drafting

- Use approved fact IDs only.
- Preserve the meaning and limits of each fact.
- Use Theo's Farm naming and voice rules.
- Use real product photos when representing the product.
- Never create pages solely for synonym variations.
- Mark missing information with a blocker; do not fill gaps creatively.

## 5. Automated validation

At minimum:

- Root repository checks.
- `git diff --check`.
- Unique title and description.
- One canonical URL.
- Intended indexability.
- Valid internal links.
- Accurate visible facts and matching structured data.
- Descriptive image alt text.
- No admin, private, checkout-session, or secret exposure.
- No fake product packaging or loose-kernel product representation.
- CSV structural validation when SEO source files change.

## 6. Pull request

The PR must contain:

- Linked SEO issue.
- Problem, user intent, and destination URL.
- Fact IDs added or used.
- Sources and retrieval dates.
- Rendered preview or screenshot when public UI changes.
- Metadata, schema, sitemap, and internal-link effects.
- Tests.
- Fact reviewer.
- Technical reviewer.
- Deployment and rollback plan.
- Measurement and review date.

Do not merge while required factual or technical approval is missing.

## 7. Deployment

1. Confirm the merged commit and approval record.
2. Recheck dynamic price, availability, shipping, and production facts.
3. Calvin approves production deployment.
4. Sean also approves material public factual changes.
5. Deploy only the reviewed artifact.
6. Verify production URL, canonical, indexability, structured data, links, images, and purchase path.
7. Record deployment time and commit in the issue.

## 8. Indexing and monitoring

- Update the sitemap.
- Submit or inspect the URL in Search Console when appropriate.
- Monitor crawl/index status and analytics.
- Compare results to the recorded baseline.
- Report observed, calculated, estimated, and inferred findings separately.
- Set the next review date.

## 9. Rollback

Trigger rollback review when:

- Production differs from the approved preview.
- A factual claim is wrong or unapproved.
- Checkout or purchase tracking regresses.
- Canonical or indexability is incorrect.
- Secrets or private URLs are exposed.
- Material unexplained traffic or conversion decline follows release.

Rollback steps:

1. Stop additional releases.
2. Open an incident/blocking issue.
3. Identify the last known good commit.
4. Obtain Calvin's deployment approval.
5. Revert through a reviewed pull request when time permits; use the documented emergency release procedure only for active harm.
6. Verify recovery and record cause, impact, and prevention.

## 10. Stop conditions

Stop and request the named human decision when:

- A required fact is absent, pending, or contradicted.
- A paid tool or external contact is proposed.
- A product image is generated or altered beyond the brand policy.
- A deployment or public publication lacks approval.
- Search intent conflicts with the actual product.
- Measurement cannot distinguish organic outcomes.
- A proposed URL duplicates an existing intent.

