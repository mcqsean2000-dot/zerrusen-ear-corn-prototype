# Shippo Shipping Plan

This plan captures the approved Shippo direction for Theo's Farm. Live Shippo rate quoting and the trusted selected-shipping checkout handoff are implemented. Label purchases, production Stripe credentials, and live payment launch are still future work.

## Direction

- Use Shippo for live shipping rates, address validation, label purchase, tracking, and future admin fulfillment workflow.
- Use Stripe Checkout for payment after the customer selects a shipping rate.
- Keep shipping package dimensions server-owned. The storefront can display product prices and collect address/cart information, but it should not be trusted to choose package weight, dimensions, or shipping price.
- Let customers choose from available shipping options instead of forcing cheapest-ground-only shipping.

## Confirmed Shippo Setup

- Ship-from ZIP: `62467`
- Return address: same as ship-from address
- Shippo account payment method: added
- Package templates: created
- Carrier direction: use Shippo's built-in U.S. Domestic rates for USPS and UPS first
- Customer-facing rate display: customer chooses from returned shipping options

The Shippo carrier screen shows USPS and UPS enabled with green toggles. If UPS still prompts for one-time activation during the first label purchase, complete that activation inside Shippo before launch testing.

## Product Package Specs

| SKU | Product | Product price | Package dimensions | Packed weight |
| --- | --- | ---: | --- | ---: |
| `ear-corn-20lb` | 20 lb Ear Corn Bag | $17.95 | 29 in x 17 in x 5 in | 22 lb |
| `ear-corn-40lb` | 40 lb Ear Corn Bag | $29.95 | 32 in x 18 in x 8 in | 42 lb |

Initial assumption: multiple-bag orders should be rated as separate packages unless the client later confirms that multiple bags can be safely and economically packed together.

## Checkout Flow

1. Customer adds 20 lb and/or 40 lb bags to cart.
2. Customer enters full shipping address.
3. Firebase Function validates cart items against the server catalog.
4. Firebase Function maps each item quantity to package specs.
5. Firebase Function calls Shippo for available USPS/UPS rates.
6. Storefront shows customer-safe carrier/service/rate options.
7. Customer selects a rate.
8. Firebase Function creates a Stripe Checkout Session for product subtotal plus selected shipping.
9. Stripe webhook marks the order paid after checkout completes.

## Admin Flow

1. Paid order appears in admin as ready for label review.
2. Admin confirms address, package count, selected rate, and package specs.
3. Admin buys label through Shippo from the Theo's Farm admin.
4. Backend stores carrier, service, shipping amount, label URL, tracking number, and shipment status.
5. Admin prints label and updates fulfillment status.

## Data To Store

Order-level shipping fields:

- `shippingAddress`
- `shippingRateId`
- `shippingCarrier`
- `shippingService`
- `shippingAmountCents`
- `shippingCurrency`
- `shippingEstimatedDays`
- `shippoShipmentId`
- `shippoTransactionId`
- `trackingNumber`
- `trackingUrl`
- `labelUrl`
- `labelPurchasedAt`

Package fields:

- `sku`
- `quantity`
- `lengthInches`
- `widthInches`
- `heightInches`
- `weightPounds`

## Implementation Steps

Completed:

- Created Shippo API token as Firebase secret `SHIPPO_API_TOKEN`.
- Added Firebase HTTPS function route `POST /api/shipping-rates`.
- Added server-owned package specs and tests.
- Updated storefront order form from ZIP-only to full shipping address.
- Show customer-selectable live Shippo rates before Stripe Checkout.
- Require server-side ship-from address config before live Shippo calls.
- Re-rate the selected Shippo rate server-side before creating Stripe Checkout.
- Include server-verified shipping as a Stripe Checkout line item.

Remaining:

1. Create Stripe account and credentials when the client account is ready.
2. Configure the public checkout endpoint and run test-mode Stripe Checkout with product subtotal plus selected shipping.
3. Add admin label purchase endpoint.
4. Add tracking and label fields to Firestore/admin views.
5. Run test orders across nearby, regional, and far shipping ZIP codes before launch.
