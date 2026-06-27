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
- Long-term hosting direction: move from GitHub Pages prototype hosting to Cloudflare Pages for production.
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
- `assets/theos-20lb-bag.jpg` - client photo of 20 lb bag
- `assets/theos-40lb-bag.jpg` - client photo of 40 lb bag
- `assets/theos-both-bags.jpg` - client photo of both bags

## Important Notes

- Current prices are placeholders and should be confirmed before launch.
- Current cart is only a prototype interaction. It is not connected to payment processing, inventory, orders, email, or shipping.
- Do not store raw payment information in the app. Use Stripe-hosted payment collection and Stripe customer/payment method IDs.
- Do not reintroduce local pickup unless the client changes direction.

## Local Preview

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```
