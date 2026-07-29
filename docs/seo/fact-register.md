# Theo's Farm SEO Fact Register

Status: Initial review required  
Owner: Sean McQueen  
Backup reviewer: Calvin Hagerstrom, limited to facts already approved in this register  
Last structural update: 2026-07-29

## Purpose

This file is the only approved factual input for AI-generated SEO briefs, pages, metadata, schema, and refreshes. Existing public copy is recorded as an existing claim, not independent proof.

## Status definitions

- `approved-existing`: already public on `theosfarm.com`; may be reused without changing its meaning.
- `approved-governance`: approved in GitHub issue #45.
- `pending-sean`: do not publish or repeat in new content until Sean approves.
- `dynamic-verify`: must be checked against the live storefront or production system immediately before publication.
- `prohibited`: must not be used.

## Evidence classes

- `public-site`: existing Theo's Farm public copy or visible product data.
- `repository`: merged source-controlled policy or implementation.
- `governance`: recorded human decision in GitHub.
- `production`: live checkout, inventory, shipping, or analytics system.
- `first-party-record`: business record supplied and approved by an authorized reviewer.

## Registered facts

| ID | Status | Fact or constraint | Evidence class | Canonical source | Allowed usage | Reviewer |
| --- | --- | --- | --- | --- | --- | --- |
| BRAND-001 | approved-existing | Public brand name is `Theo's Farm`. | repository | `docs/theos-farm-brand-guidelines.md` | All public uses; retain apostrophe and space. | Sean |
| BRAND-002 | approved-existing | Canonical website is `https://theosfarm.com`. | public-site | `index.html` | Calls to action, canonicals, and organization references. | Sean |
| BRAND-003 | approved-existing | Product descriptor is `Whole Ear Corn`. | repository | `docs/theos-farm-brand-guidelines.md` | Product headings, metadata, and explanatory copy. | Sean |
| BRAND-004 | approved-existing | Supporting phrases are `Whole & Natural` and `Farm to Feeder`. | repository | `docs/theos-farm-brand-guidelines.md` | Brand support only; not evidence of a regulated or nutritional claim. | Sean |
| PRODUCT-001 | approved-existing | Theo's Farm offers a 20 lb bag of whole ear corn. | public-site | `index.html` | Product selection and factual comparison. | Sean |
| PRODUCT-002 | approved-existing | Theo's Farm offers a 40 lb bag of whole ear corn. | public-site | `index.html` | Product selection and factual comparison. | Sean |
| PRODUCT-003 | dynamic-verify | The 20 lb bag is listed at `$17.95 plus shipping`. | production | Live storefront and checkout | Price copy and Product/Offer schema only after immediate verification. | Calvin technical; Sean material change |
| PRODUCT-004 | dynamic-verify | The 40 lb bag is listed at `$29.95 plus shipping`. | production | Live storefront and checkout | Price copy and Product/Offer schema only after immediate verification. | Calvin technical; Sean material change |
| PRODUCT-005 | dynamic-verify | Product availability is shown as in stock in current structured data. | production | Live storefront, inventory behavior, and checkout | Availability copy and schema only after immediate verification. | Calvin |
| PRODUCT-006 | approved-existing | The purchasable product is whole ears of corn on the cob, not loose kernels. | public-site | `index.html`; real product photos | Product descriptions, comparisons, and image selection. | Sean |
| PHOTO-001 | approved-existing | Product visuals must show actual white 20 lb and 40 lb bags when packaging is represented. | repository | `docs/theos-farm-brand-guidelines.md` | All product photography and social/SEO imagery. | Sean |
| PHOTO-002 | prohibited | A fictional brown retail bag may not be presented as the real product. | repository | `docs/theos-farm-brand-guidelines.md` | Never use as product evidence or purchasable packaging. | Sean |
| PHOTO-003 | prohibited | Loose kernels may not represent the product being sold. | repository | `docs/theos-farm-brand-guidelines.md` | Never use as primary product imagery. | Sean |
| PROCESS-001 | approved-existing | Bags are described publicly as packaged to order. | public-site | `index.html` | May say `packaged to order`; do not infer a guaranteed fulfillment time. | Sean |
| PROCESS-002 | approved-existing | Public copy says husks, foreign material, small ears, and partially filled ears are removed before packaging. | public-site | `index.html` | Process explanation without adding efficacy or quality guarantees. | Sean |
| PROCESS-003 | approved-existing | Public copy says corn is treated with an Insect Growth Regulator before bulk storage and again when bags are filled. | public-site | `index.html` | Repeat only with the same limited wording; no safety, efficacy, or regulatory inference. | Sean |
| PROCESS-004 | approved-existing | Public copy says filled bags use woven poly packaging with a white paper overlay and are boxed for shipping. | public-site | `index.html` | Shipping-process explanation; do not promise damage prevention. | Sean |
| FARM-001 | approved-existing | Public copy describes Theo's Farm as a sixth-generation family farm dating to 1894. | public-site | `index.html` | Farm story; present as Theo's Farm's stated history. | Sean |
| FARM-002 | approved-existing | Public copy describes more than 40 years of experience growing and packaging ear corn. | public-site | `index.html` | Farm story; do not convert into unsupported superiority claims. | Sean |
| USE-001 | approved-existing | Public copy positions whole ear corn for backyard wildlife feeders, squirrel feeders, deer feeding areas, and seasonal wildlife stations. | public-site | `index.html` | Describe customer use cases without feeding, health, or wildlife-management advice. | Sean |
| SEARCH-001 | approved-existing | Existing public terminology includes ear corn, corn on the cob, whole corn, cob corn, squirrel corn, deer corn, wildlife corn, and Zerrusen farm. | public-site | `index.html` | Natural language and research seeds; no keyword stuffing. | Sean |
| GOV-001 | approved-governance | Search Console and GA4 business account owner is `theosfeedfarm@gmail.com`; Sean authorizes and Calvin handles technical setup. | governance | GitHub issue #45 | Access planning only; never store credentials in Git. | Sean and Calvin |
| GOV-002 | approved-governance | Merchant Center is deferred to SEO-005 until crawlable product data is verified. | governance | GitHub issue #45 | Roadmap sequencing. | Sean and Calvin |
| GOV-003 | approved-governance | Initial external SEO-data budget is `$0` per month. | governance | GitHub issue #45 | Tool selection and planning. | Sean and Calvin |
| GOV-004 | approved-governance | Calvin is production deployment approver; Sean also approves material public product, farm, pricing, shipping, or factual changes. | governance | GitHub issue #45 | Pull-request and release gates. | Sean and Calvin |

## Pending facts

The following require Sean's explicit approval and a source before use:

- Exact farm location or service area.
- Crop variety, grade, moisture, ear count, average ear size, or nutritional values.
- Treatment brand, concentration, regulatory status, safety, or efficacy details.
- Storage-life, shelf-life, pest-resistance, or freshness-duration claims.
- Wildlife health, dietary suitability, consumption, attraction, or management claims.
- Guaranteed processing, packing, shipping, delivery, or transit times.
- Return, replacement, damage, or satisfaction promises not already in a published policy.
- Organic, non-GMO, pesticide-free, chemical-free, food-grade, locally grown, or similar certifications.
- Customer counts, sales volume, review scores, ranking results, or performance outcomes.

## AI use rules

1. Use only facts whose status permits the intended use.
2. Quote or paraphrase without broadening the claim.
3. Check every `dynamic-verify` fact against production in the same work session.
4. Stop and open a blocking issue when a required fact is missing or conflicting.
5. Cite the fact IDs used in every content brief and SEO pull request.
6. Never use a pending or prohibited item to make a draft sound more persuasive.

