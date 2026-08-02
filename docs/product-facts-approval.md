# Theo's Farm Product Facts Approval

Issue: [#68](https://github.com/mcqsean2000-dot/zerrusen-ear-corn-prototype/issues/68)

Approval owner: Sean McQueen and the Theo's Farm client

Technical contact: Calvin Hagerstrom

## Purpose

Use this sheet to approve or correct the facts that customers, search engines, shipping providers, and Stripe will rely on. The storefront still displays a prototype disclaimer because the prices, availability, and shipping package assumptions below have not received one recorded launch approval.

For each row, enter `Approved` or provide the corrected value. Approval can be recorded by completing this file in a pull request or by commenting on issue #68 with the row IDs and any corrections. Do not include credentials, payment details, or private customer data.

## Brand And Products

| ID | Current proposed value | Approve or correct |
| --- | --- | --- |
| BRAND-001 | Public brand: `Theo's Farm` | |
| BRAND-002 | Positioning: `Farm to Feeder` | |
| BRAND-003 | Canonical website: `https://theosfarm.com` | |
| PRODUCT-001 | Product name: `20 lb Ear Corn Bag` | |
| PRODUCT-002 | Product name: `40 lb Ear Corn Bag` | |
| PRODUCT-003 | Product is whole ears of corn on the cob, not loose kernels | |
| PRODUCT-004 | 20 lb bag price: `$17.95 plus shipping` | |
| PRODUCT-005 | 40 lb bag price: `$29.95 plus shipping` | |
| PRODUCT-006 | Both products may be publicly marked `In stock` | |

Price and availability approval affects the visible product cards, cart, order validation, Stripe Checkout line items, analytics, Product/Offer structured data, and automated tests. If inventory is not continuously tracked, correct PRODUCT-006 to the wording or behavior the farm wants customers to see.

## Shipping And Packages

| ID | Current proposed value | Approve or correct |
| --- | --- | --- |
| SHIP-001 | Fulfillment is shipping only; no local pickup | |
| SHIP-002 | Ship-from ZIP: `62467` | |
| SHIP-003 | Return address is the same as the ship-from address | |
| SHIP-004 | Initial live rates are requested from Shippo for USPS and UPS | |
| SHIP-005 | Customer selects from the available shipping services and rates | |
| SHIP-006 | Each bag is rated as a separate package, including multi-bag orders | |
| PACKAGE-001 | 20 lb bag parcel: `29 x 17 x 5 in`, `22 lb` packed weight | |
| PACKAGE-002 | 40 lb bag parcel: `32 x 18 x 8 in`, `42 lb` packed weight | |

Package dimensions and packed weights are sent to Shippo and directly affect the shipping rates shown to customers. They should be measured from a normal ready-to-ship box, not inferred from the product's net weight.

## Farm Story And Product Handling

These statements are already recorded as approved existing claims in `docs/seo/fact-register.md`. Confirm that they remain accurate for launch or provide corrected wording.

| ID | Current public statement | Approve or correct |
| --- | --- | --- |
| FARM-001 | Sixth-generation family farm dating back to 1894 | |
| FARM-002 | More than 40 years of experience growing and packaging ear corn for wildlife food | |
| PROCESS-001 | Bags are packaged to order; old bagged inventory is not shipped | |
| PROCESS-002 | Husks, foreign material, small ears, and partially filled ears are removed before packaging | |
| PROCESS-003 | Corn is treated with an Insect Growth Regulator before bulk storage and again when each bag is filled | |
| PROCESS-004 | Corn is packed in a durable woven poly bag with a white paper overlay, then boxed for shipping | |

Approval does not add claims about treatment safety or efficacy, guaranteed freshness duration, guaranteed delivery time, wildlife health, certifications, returns, or damage prevention. Those claims require separate evidence and approval.

## Launch Approval

Complete these four items after reviewing every row:

- [ ] All prices and product names are correct.
- [ ] Availability language matches the farm's real inventory process.
- [ ] Parcel dimensions, packed weights, and ship-from ZIP are correct.
- [ ] The public farm-story and handling statements remain accurate.

Approved by: ______________________________

Role: ____________________________________

Date: ____________________________________

Issue #68 approval comment or pull request: ______________________________

## Implementation After Approval

Calvin or Sean should make one focused implementation change that:

1. Applies every correction consistently to storefront copy, structured data, frontend catalog values, backend validation, shipping package data, and tests.
2. Updates `docs/seo/fact-register.md` so public price and availability facts retain the correct approval and verification status.
3. Removes the footer text `Prototype copy and pricing for discussion only. Replace with verified farm details before launch.`
4. Runs `npm run check` and verifies the production storefront after deployment.

Approval of this sheet does not authorize a deployment by itself. Production deployment remains a separate controlled step.
