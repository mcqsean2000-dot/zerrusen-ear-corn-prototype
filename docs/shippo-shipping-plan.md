# Shippo Shipping Plan

This plan captures the approved Shippo direction for Theo's Farm. It does not add live Shippo calls, secrets, label purchases, or checkout behavior yet.

## Direction

- Use Shippo for live shipping rates, address validation, label purchase, tracking, and future admin fulfillment workflow.
- Use Stripe Checkout for payment after the customer selects a shipping rate.
- Keep shipping package dimensions server-owned. The storefront can display product prices and collect address/cart information, but it should not be trusted to choose package weight, dimensions, or shipping price.

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
5. Firebase Function calls Shippo for available rates.
6. Storefront shows carrier/service/rate options.
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

1. Confirm ship-from address and Shippo account owner.
2. Create Shippo test/live API key under the client-controlled account.
3. Add Firebase Function endpoint for shipping rate quotes.
4. Add server-owned package specs and tests.
5. Update storefront order form from ZIP-only to full shipping address.
6. Show live Shippo rates before Stripe Checkout.
7. Create Stripe Checkout Session using product subtotal plus selected shipping.
8. Add admin label purchase endpoint.
9. Add tracking and label fields to Firestore/admin views.
10. Run test orders across nearby, regional, and far shipping ZIP codes before launch.
