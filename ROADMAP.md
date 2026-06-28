# Theo's Farm Roadmap

This roadmap captures the current project direction so a collaborator can get up to speed without needing the full chat history.

## Phase 1: Domain and Hosting

Decision so far:

- Use a new domain for Theo's Farm.
- Keep Theo's Farm separate from the old Zerrusen Farms site/business.
- Use GoDaddy or another approved static host for the public production storefront.
- Keep Firebase/Firestore references scoped to order data, rules, indexes, and trusted backend storage if that foundation is selected.
- Keep GitHub Pages only as the current prototype preview.

Open tasks:

- Choose/register the new Theo's Farm domain.
- Decide how the GoDaddy/static hosting setup should publish the storefront and manage DNS.
- Create a production Firebase project for Theo's Farm only if Firestore remains the selected order storage foundation.
- Create a separate project/repo for the old Zerrusen Farms site if that site is restored.

## Phase 2: Storefront

Customer experience should stay very simple:

1. Select 20 lb or 40 lb bag.
2. Choose quantity.
3. Enter shipping/delivery information.
4. Pay through Stripe Checkout.
5. Receive confirmation.

Current product assumptions:

- 20 lb Ear Corn Bag
- 40 lb Ear Corn Bag
- Shipping/delivery only
- No local pickup

Content priorities:

- Sixth-generation family farm since 1894.
- 40 years of ear corn growing/packaging experience.
- Farm to Feeder positioning.
- Packed fresh to order.
- Cleaned and inspected before packaging.
- Treated and boxed for shipping protection.

## Phase 3: Payments

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

Future recurring order approach:

- Start with recurring order requests/preferences.
- Do not launch automatic recurring billing until fulfillment rules and inventory handling are proven.
- Later option: Stripe Billing for true subscriptions.

## Phase 4: Order and Fulfillment Admin

The admin side should make fulfillment easy for the farm.

Core admin features:

- Order list
- Order detail
- Payment status
- Shipping/delivery status
- Customer contact info
- Product quantities
- Internal notes
- Daily bag count summary
- Export or print packing list

Suggested statuses:

- New
- Paid
- Needs shipping quote
- Ready to pack
- Packed
- Shipped
- Delivered
- Canceled
- Refunded

Daily fulfillment summary should show:

- Total 20 lb bags
- Total 40 lb bags
- Orders needing shipping quote
- Orders ready to pack
- Orders needing follow-up

Recurring order queue should show:

- Customer
- Product and quantity
- Preferred schedule
- Next reminder/order date
- Status: requested, confirmed, paused, canceled

## Phase 5: Notifications

Minimum:

- Customer order confirmation email
- Admin new order notification
- Admin daily fulfillment summary

Later:

- Shipping confirmation
- Delivery notification
- Recurring order reminder
- Low inventory alert

## Phase 6: Production Build

Likely stack:

- Frontend: Astro, Next.js, or another lightweight app framework
- Hosting: GoDaddy or another approved static host for the public storefront
- Backend: Firebase Cloud Functions or another trusted server endpoint
- Database: Firestore
- Payments: Stripe Checkout
- Email: Resend or Postmark
- Admin auth: Firebase Auth with admin custom claims, Clerk, or similar

Build order:

1. Confirm domain.
2. Move static prototype into production app structure.
3. Build product catalog and checkout flow.
4. Add Stripe Checkout.
5. Add order persistence.
6. Add Stripe webhooks.
7. Build admin fulfillment dashboard.
   - Static admin planning shell now exists at `admin.html`.
   - Next step is authenticated Firestore reads and status updates.
8. Add email notifications.
9. Deploy the public storefront to GoDaddy or the selected static host.
10. Point production domain.
11. Run test orders.
12. Launch.

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
