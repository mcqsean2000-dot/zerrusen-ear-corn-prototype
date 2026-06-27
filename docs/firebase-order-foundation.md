# Firebase Order Foundation

This branch adds the static-site foundation for Firebase Hosting and Firestore order requests. It does not deploy Firebase, collect payment, or store card details.

## Hosting

`firebase.json` serves the current static prototype from the repo root. It keeps HTML, CSS, and JavaScript uncached for quick iteration while caching product images for one week.

Before production, create a real Firebase project and copy `.firebaserc.example` to a local `.firebaserc` file:

```json
{
  "projects": {
    "default": "theos-farm-production"
  }
}
```

`.firebaserc` is intentionally ignored so each collaborator can point at their own Firebase project.

See `docs/firebase-hosting-readiness.md` for first setup, local preview, preview channels, deploy commands, and the production verification checklist.

## Order Request Collection

Firestore collection:

```text
orderRequests
```

Suggested document shape:

```json
{
  "createdAt": "server timestamp",
  "source": "static-storefront",
  "status": "needs_review",
  "subtotalCents": 4400,
  "items": [
    {
      "name": "20 lb Ear Corn Bag",
      "sku": "ear-corn-20lb",
      "quantity": 1,
      "unitPriceCents": 1600
    },
    {
      "name": "40 lb Ear Corn Bag",
      "sku": "ear-corn-40lb",
      "quantity": 1,
      "unitPriceCents": 2800
    }
  ],
  "customer": {
    "name": "Customer Name",
    "contact": "customer@example.com",
    "preferredContact": "email",
    "shippingZip": "62401",
    "note": "Delivery timing or address notes"
  }
}
```

## Security Rules

`firestore.rules` allows unauthenticated customers to create `orderRequests` with a narrow, validated shape. It does not allow public reads, updates, or deletes.

Admin access is reserved for authenticated users with a custom `admin: true` claim. The admin dashboard should be built later after auth is selected.

The rules reject Stripe IDs on public create. Stripe Checkout session IDs and payment intent IDs should be added later by trusted backend code after Stripe creates or confirms the checkout session.

## Payment Boundary

Do not collect card numbers, CVV, bank data, or raw payment details in Firestore or the static app.

The intended sequence is:

1. Customer submits an order request with products, contact details, and shipping ZIP.
2. Backend code validates shipping/delivery needs and creates a Stripe Checkout session.
3. Customer pays on Stripe-hosted Checkout.
4. Stripe webhook updates the order request with trusted Stripe IDs and payment status.
5. Admin fulfillment tools read the paid order queue.

## Deployment Commands

After Firebase CLI auth and project selection are configured:

```bash
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
```

For a combined first deploy:

```bash
firebase deploy
```
