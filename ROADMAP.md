# Theo's Farm Roadmap

This roadmap captures the current project direction so a collaborator can get up to speed without needing the full chat history.

## Phase 1: Domain and Hosting

Decision so far:

- Use a new domain for Theo's Farm.
- Keep Theo's Farm separate from the old Zerrusen Farms site/business.
- Use Firebase Hosting for the public production storefront.
- Use Firebase/Firestore/Functions as the production foundation because the same Firebase ecosystem is already used for EasiTask and Debris Locator.
- Keep GitHub Pages only as the current prototype preview.

Open tasks:

- Choose/register the new Theo's Farm domain.
- Create or select the production Firebase project for Theo's Farm.
- Copy `.firebaserc.example` to a local `.firebaserc` and point it at the Theo's Farm Firebase project ID.
- Configure Firebase Hosting preview and production deploy flow.
- Decide whether the new domain's DNS remains at the registrar or points through Firebase's custom-domain setup.
- Use `docs/firebase-hosting-readiness.md` for first deploy checks.
- Keep `docs/godaddy-static-deploy.md` only as a fallback/static export checklist.
- Create a separate project/repo for the old Zerrusen Farms site if that site is restored.

## Phase 2: Storefront

Customer experience should stay very simple:

1. Select 20 lb or 40 lb bag.
2. Choose quantity.
3. Enter shipping information.
4. Review live shipping options from Shippo.
5. Pay product plus shipping through Stripe Checkout.
6. Receive confirmation.

Current product assumptions:

- 20 lb Ear Corn Bag: $17.95 plus shipping
- 40 lb Ear Corn Bag: $29.95 plus shipping
- Shipping only
- No local pickup

Shipping package assumptions:

- 20 lb bag ships as 29 in x 17 in x 5 in, 22 lb packed weight.
- 40 lb bag ships as 32 in x 18 in x 8 in, 42 lb packed weight.
- Multiple-bag orders should be rated as separate packages unless the client later confirms a combined-box workflow.

Content priorities:

- Sixth-generation family farm since 1894.
- 40 years of ear corn growing/packaging experience.
- Farm to Feeder positioning.
- Packed fresh to order.
- Cleaned and inspected before packaging.
- Treated and boxed for shipping protection.

## Phase 3: Shipping

Current recommendation:

- Use Shippo for live shipping rates, address validation, labels, tracking, and future admin label purchase.
- Start with customer-selected live rates at checkout, then let the admin buy labels after reviewing paid orders.
- Do not automatically buy labels immediately after payment until real fulfillment patterns are proven.

Checkout shipping flow:

1. Customer enters full shipping address.
2. Backend validates the cart and maps each product line to package dimensions and packed weight.
3. Backend asks Shippo for available shipping rates.
4. Storefront shows clear shipping options.
5. Customer chooses a rate.
6. Stripe Checkout charges product subtotal plus selected shipping.
7. Paid order appears in admin as ready for label review.

Admin shipping flow:

1. Admin opens paid order.
2. Admin confirms address, package count, and package specs.
3. Admin clicks to create/buy the Shippo label.
4. System stores carrier, service, shipping cost, label URL, tracking number, and fulfillment status.

## Phase 4: Payments

Current recommendation:

- Stripe Checkout for payment collection.
- Google Pay enabled through Stripe.
- Also allow Apple Pay and Link if available through Stripe Checkout.
- Skip Venmo for version one unless the client specifically requests it later.
- Use the host-neutral `functions/` scaffold as the starting point for trusted checkout session and webhook code.

Payment/data rules:

- Do not store full card numbers, CVV, or raw payment details.
- Store only Stripe IDs needed for order/customer/payment reference.
- Store customer/order data only when operationally useful.
- Use `docs/stripe-checkout-handoff.md` as the contract for the future trusted backend checkout session and webhook implementation.
- Pass only server-validated product subtotal and the customer-selected Shippo shipping amount into Stripe Checkout.

Future recurring order approach:

- Start with recurring order requests/preferences.
- Do not launch automatic recurring billing until fulfillment rules and inventory handling are proven.
- Later option: Stripe Billing for true subscriptions.

## Phase 5: Order and Fulfillment Admin

The admin side should make fulfillment easy for the farm.

Core admin features:

- Order list
- Order detail
- Payment status
- Shipping status
- Customer contact info
- Product quantities
- Internal notes
- Daily bag count summary
- Export or print packing list

Suggested statuses:

- New
- Paid
- Needs shipping rate
- Ready to pack
- Packed
- Shipped
- Delivered
- Canceled
- Refunded

Daily fulfillment summary should show:

- Total 20 lb bags
- Total 40 lb bags
- Orders needing shipping rate
- Orders ready to pack
- Orders needing follow-up

Recurring order queue should show:

- Customer
- Product and quantity
- Preferred schedule
- Next reminder/order date
- Status: requested, confirmed, paused, canceled

## Phase 6: Notifications

Minimum:

- Customer order confirmation email
- Admin new order notification
- Admin daily fulfillment summary

Use `docs/notification-boundary-plan.md` for the first notification event and payload boundary before choosing a provider or adding live email sends.

Later:

- Shipping confirmation
- Delivery notification
- Recurring order reminder
- Low inventory alert

## Phase 7: Production Build

Likely stack:

- Frontend: Astro, Next.js, or another lightweight app framework
- Hosting: Firebase Hosting
- Backend: Firebase Cloud Functions
- Database: Firestore
- Shipping: Shippo
- Payments: Stripe Checkout
- Email: Resend or Postmark
- Admin auth: Firebase Auth with admin custom claims, Clerk, or similar

Build order:

1. Confirm domain.
2. Move static prototype into production app structure.
3. Build product catalog and checkout flow.
4. Add Shippo rate quoting from server-owned package specs.
5. Add Stripe Checkout with selected shipping.
6. Add order persistence.
7. Add Stripe webhooks.
8. Build admin fulfillment dashboard.
   - Static admin planning shell now exists at `admin.html`.
   - Next step is authenticated Firestore reads and status updates.
9. Add Shippo label purchase and tracking updates in admin.
10. Add email notifications.
11. Deploy the public storefront to Firebase Hosting.
12. Point production domain.
13. Run test orders.
14. Launch.

## Maintenance Plan

Recommended maintenance scope:

- Hosting/domain monitoring
- Security/dependency updates
- Monthly checkout test
- Product/pricing/content updates
- Stripe webhook/order-flow checks
- Seasonal content and inventory updates
- Analytics review
- Small fulfillment/admin workflow improvements

The exact maintenance tier should depend on order volume and how often the client needs content, fulfillment, or product changes.
