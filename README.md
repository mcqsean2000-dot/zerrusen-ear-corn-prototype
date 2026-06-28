# Theo's Farm Ear Corn Prototype

Public preview:
https://mcqsean2000-dot.github.io/zerrusen-ear-corn-prototype/

This repo currently contains a static prototype for the Theo's Farm direct-to-consumer ear corn website. It is intentionally simple: two products, real client-provided product photos, farm story copy, delivery/shipping-focused messaging, and a lightweight cart drawer for demo purposes.

## Current Direction

- Brand: Theo's Farm
- Positioning: Farm to Feeder
- Products:
  - 20 lb Ear Corn Bag
  - 40 lb Ear Corn Bag
- Fulfillment: shipping/delivery only. No local pickup.
- Payments direction: Stripe Checkout with Google Pay enabled through Stripe.
- Storefront flow: cart selections feed a prototype order request form before the future Stripe Checkout handoff.
- Public hosting direction: host the static storefront on GoDaddy or another approved static host.
- Firebase/Firestore may still be used for backend order storage, rules, and indexes if selected.
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
- `admin.html` - static admin fulfillment prototype
- `admin.css` - admin shell styles
- `admin.js` - sample admin queue behavior
- `package.json` - static validation script entry point
- `tools/check-static.mjs` - no-dependency static prototype checks
- `functions/` - host-neutral trusted checkout and Stripe webhook scaffold, disabled by default
- `firebase.json` - existing Firebase Hosting config and Firestore deploy targets; public hosting direction is now GoDaddy/static host
- `.firebaserc.example` - safe Firebase project alias template for local setup
- `firestore.rules` - initial Firestore rules for prototype order requests
- `firestore.indexes.json` - Firestore index definition for order request queues
- `docs/firebase-hosting-readiness.md` - first Firebase setup, preview, deploy, and production verification notes
- `docs/firebase-order-foundation.md` - Firebase order request shape and payment boundary notes
- `docs/admin-fulfillment-foundation.md` - admin queue and fulfillment planning notes
- `docs/stripe-checkout-handoff.md` - trusted backend contract for future Stripe Checkout session creation and webhook updates
- `docs/backend-checkout-scaffold.md` - local backend scaffold notes, validation helpers, and webhook boundary
- `assets/theos-20lb-bag.jpg` - client photo of 20 lb bag
- `assets/theos-40lb-bag.jpg` - client photo of 40 lb bag
- `assets/theos-both-bags.jpg` - client photo of both bags

## Important Notes

- Current prices are placeholders and should be confirmed before launch.
- Current cart is only a prototype interaction. It is not connected to payment processing, inventory, orders, email, or shipping.
- Do not store raw payment information in the app. Use Stripe-hosted payment collection and Stripe customer/payment method IDs.
- Public Firestore writes are limited to validated order request creation. Payment status and Stripe IDs should be written only by trusted backend code.
- Do not reintroduce local pickup unless the client changes direction.

## Local Checks

```bash
npm run check
npm --prefix functions run check
```

## Local Preview

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

## Firebase Hosting Preview

Firebase Hosting is prepared for static preview/deploy only. Copy `.firebaserc.example` to `.firebaserc`, replace the placeholder with a real Firebase project ID, and keep `.firebaserc` uncommitted.

```bash
firebase emulators:start --only hosting
firebase hosting:channel:deploy preview
```

See `docs/firebase-hosting-readiness.md` before the first production deploy.
