# Theo's Farm Ear Corn Prototype

Public preview:
https://mcqsean2000-dot.github.io/zerrusen-ear-corn-prototype/

This repo currently contains a static prototype for the Theo's Farm direct-to-consumer ear corn website. It is intentionally simple: two products, real client-provided product photos, farm story copy, delivery/shipping-focused messaging, and a lightweight cart drawer for demo purposes.

## Active Handoffs

- `CALVIN_META_HANDOFF.md` - Meta/Facebook/Instagram setup tasks needed before no-daily-login social auto-publishing can be implemented.

## Current Direction

- Brand: Theo's Farm
- Positioning: Farm to Feeder
- Products:
  - 20 lb Ear Corn Bag
  - 40 lb Ear Corn Bag
- Fulfillment: shipping only. No local pickup.
- Shipping direction: Shippo for live rates, address validation, labels, and tracking.
- Payments direction: Stripe Checkout with Google Pay enabled through Stripe.
- Farm/admin email account: `theosfeedfarm@gmail.com` for business account setup and future order notifications.
- Facebook profile: `Theos Farm` for the farm's new Facebook presence tied to the email account.
- Instagram account: `theosfeedfarm` for the farm's new Instagram presence tied to the email account.
- Storefront flow: cart selections feed a shipping address form, live Shippo rate lookup, and customer-selected shipping option before the future Stripe Checkout handoff.
- Public hosting direction: Firebase Hosting.
- Firebase/Firestore/Functions are the selected production foundation because the same Firebase ecosystem is already used for EasiTask and Debris Locator.
- Old Zerrusen Farms informational site should remain separate from Theo's Farm as a separate business/site.

## Client-Provided Business Notes

- Sixth-generation family farm dating back to 1894.
- 40 years of experience growing and packaging ear corn for wildlife food.
- Offering corn directly from the farm to the customer's wildlife feeder.
- High-quality corn, cleaned of husks and foreign material.
- Small or partially filled ears are removed before packaging.
- All bags are packaged to order.
- No old inventory is shipped.
- Corn is treated with an Insect Growth Regulator before bulk storage, and each bag is treated again when filled to help ensure a bug-free product.
- Corn is packed in a durable, heavy-duty woven poly bag with a white paper overlay, then boxed for added protection during shipping.

## Shipping Package Assumptions

- 20 lb Ear Corn Bag: $17.95 plus shipping, 29 in x 17 in x 5 in, 22 lb packed weight.
- 40 lb Ear Corn Bag: $29.95 plus shipping, 32 in x 18 in x 8 in, 42 lb packed weight.
- Ship-from ZIP: 62467.
- Return address: same as ship-from address.
- Initial carriers: Shippo USPS and UPS rates.
- Shipping selection: customer chooses from available shipping options.
- Multiple-bag orders should be rated as separate packages until the client confirms a combined-package workflow.

## Search / SEO Terms

Natural search phrases to keep in mind:

- Theo's Farm
- Zerrusen farm
- ear corn
- corn on the cob
- whole corn
- cob corn
- squirrel corn
- deer corn
- wildlife corn

## Prototype Files

- `index.html` - static page content and layout
- `styles.css` - responsive styling
- `script.js` - demo cart drawer behavior
- `checkout-config.js` - public static-host checkout endpoint placeholder, disabled by default
- `robots.txt` - crawl policy pointing search engines to the production sitemap
- `sitemap.xml` - one-page production sitemap for the canonical Theo's Farm domain
- `_config.yml` - GitHub Pages preview exclude list that keeps backend, docs, admin prototype, and tooling files out of the public Pages artifact
- `CALVIN_META_HANDOFF.md` - Calvin-facing Meta setup checklist for social auto-publishing
- `admin.html` - static admin fulfillment prototype
- `admin.css` - admin shell styles
- `admin-config.js` - disabled public admin Firebase config gate
- `admin-config.local.example.js` - ignored local admin config override template for local Firebase admin testing
- `admin.js` - sample admin queue behavior plus auth-gated status, label action controls, and safe action feedback
- `admin-live.js` - optional authenticated admin bridge for future Firebase email/password sign-in, reads/actions, and guarded admin endpoint posts
- `package.json` - static validation script entry point
- `tools/check-static.mjs` - no-dependency static prototype checks
- `tools/package-static.mjs` - allowlist-based static host package generator kept as a fallback/export path
- `tools/serve-static.mjs` - no-dependency local preview server for the repo root or generated static package
- `functions/` - host-neutral trusted checkout and Stripe webhook scaffold, disabled by default
- `functions/src/notification-builder.js` - provider-neutral paid-order customer/admin email job builders
- `functions/src/notification-outbox.js` - trusted notification outbox boundary with deterministic job keys
- `firebase.json` - Firebase Hosting config and Firestore deploy targets for the chosen production path
- `.firebaserc.example` - safe Firebase project alias template for local setup
- `firestore.rules` - initial Firestore rules for prototype order requests
- `firestore.indexes.json` - Firestore index definition for order request queues
- `docs/firebase-hosting-readiness.md` - first Firebase setup, preview, deploy, and production verification notes
- `docs/firebase-order-foundation.md` - Firebase order request shape and payment boundary notes
- `docs/admin-fulfillment-foundation.md` - admin queue and fulfillment planning notes
- `docs/stripe-checkout-handoff.md` - trusted backend contract for future Stripe Checkout session creation and webhook updates
- `docs/shippo-shipping-plan.md` - Shippo rate, package, label, and tracking implementation plan
- `docs/social-visibility-plan.md` - daily social post workflow, keyword themes, and starter post drafts
- `docs/social-post-drafts.md` - reviewed social post drafts ready for manual publishing or scheduling
- `docs/social-auto-publishing-plan.md` - no-daily-login Meta/Firebase publishing path and required setup
- `docs/backend-checkout-scaffold.md` - local backend scaffold notes, validation helpers, and webhook boundary
- `docs/stripe-webhook-incident-report.md` - current Stripe test webhook failure summary, blockers, and remediation checklist
- `docs/godaddy-static-deploy.md` - legacy/fallback static upload checklist; not the preferred production path
- `assets/theos-20lb-bag.jpg` - client photo of 20 lb bag
- `assets/theos-40lb-bag.jpg` - client photo of 40 lb bag
- `assets/theos-both-bags.jpg` - client photo of both bags

## Important Notes

- Current prices are placeholders and should be confirmed before launch.
- Current cart is connected to live Shippo shipping-rate lookup, but not yet connected to payment processing, inventory, order persistence, live email sends, or label purchase.
- Completed Stripe Checkout events atomically mark the order paid, create deterministic customer/admin Firestore outbox jobs, and mark the Stripe event processed. No email provider or live sender is enabled yet.
- The Firebase-hosted admin shell supports Google sign-in plus an email/password fallback. Fulfillment content and actions remain hidden until Firebase Auth returns an `admin: true` custom claim; signing in with an ordinary Google account does not grant access.
- Production admin config is loaded from Firebase Hosting's public `/__/firebase/init.json` endpoint. Enable the Google provider, authorize the production domain, create the approved admin account, and grant its custom claim before launch.
- For local admin testing only, copy `admin-config.local.example.js` to ignored `admin-config.local.js` and fill in approved Firebase public web config after Auth users and admin claims are ready. Do not commit the local override.
- Keep `checkout-config.js` blank until a trusted backend endpoint is ready. For Firebase Hosting, set only the public checkout session URL there, never secrets.
- Do not store raw payment information in the app. Use Stripe-hosted payment collection and Stripe customer/payment method IDs.
- Public Firestore writes are limited to validated order request creation. Payment status and Stripe IDs should be written only by trusted backend code.
- Do not reintroduce local pickup unless the client changes direction.

## Local Checks

```bash
npm run check
npm run package:static
npm run preview
npm --prefix functions run check
```

On Windows PowerShell, use `npm.cmd` if the local execution policy blocks `npm.ps1`:

```powershell
npm.cmd run check
npm.cmd run package:static
npm.cmd run preview
npm.cmd --prefix functions run check
```

The static package scripts remain useful for smoke checks and emergency static export, but Firebase Hosting is now the production target.

## Local Preview

```bash
npm run preview
```

Then open:

```text
http://localhost:4173/
```

To preview the generated static host package instead:

```bash
npm run preview:static
```

Then open:

```text
http://localhost:4174/
```

## Firebase Hosting Preview

Firebase Hosting is the chosen production direction. Copy `.firebaserc.example` to `.firebaserc`, replace the placeholder with the real Theo's Farm Firebase project ID, and keep `.firebaserc` uncommitted.

```bash
firebase emulators:start --only hosting
firebase hosting:channel:deploy preview
```

See `docs/firebase-hosting-readiness.md` before the first production deploy.
