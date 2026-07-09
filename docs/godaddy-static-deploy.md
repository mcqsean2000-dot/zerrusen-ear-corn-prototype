# Legacy GoDaddy Static Deploy Package

Firebase Hosting is now the selected production hosting path for Theo's Farm. This checklist is kept only as a fallback/export path for GoDaddy or another approved static host. It does not deploy anything, use GoDaddy credentials, configure DNS, call Stripe, or publish backend code.

## Hosting Boundary

- Upload only the generated static storefront package.
- Keep the old Zerrusen Farms site separate from Theo's Farm.
- Keep checkout secrets, Stripe webhook secrets, Firebase service accounts, Firestore rules, and backend code out of the static host.
- Keep `checkout-config.js` blank until the trusted checkout API exists.

The public storefront can run from static hosting. Stripe Checkout session creation and webhooks must run on a trusted backend that can safely hold secrets.

## Build The Upload Folder

Run these commands from the repo root:

```bash
npm run check
npm run package:static
npm run smoke:static
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked by the local execution policy:

```powershell
npm.cmd run check
npm.cmd run package:static
npm.cmd run smoke:static
```

The package script writes:

```text
dist/godaddy-static/
```

Upload the contents of that folder, not the repo root.

## Included Public Files

The package is allowlist-based and includes only:

- `index.html`
- `styles.css`
- `order-request.js`
- `checkout-config.js`
- `script.js`
- `assets/`

The package intentionally excludes `docs/`, `functions/`, Firebase config, Firestore rules and indexes, repo metadata, local env files, package tooling, and the unauthenticated admin prototype files.

## Local Package Smoke Check

After `npm run package:static`, run:

```bash
npm run smoke:static
```

The smoke check serves `dist/godaddy-static/` from a temporary local-only server, fetches the packaged page and referenced assets, verifies the packaged checkout config points at the Firebase Functions checkout route, and confirms forbidden paths such as `docs/`, `functions/`, admin files, Firebase files, repo metadata, and package tooling are not exposed. It does not contact GoDaddy, Stripe, Firebase, or any live backend.

## Checkout Endpoint Setup

Leave `checkout-config.js` as:

```js
checkoutEndpoint: "/api/checkout-sessions"
```

The current package checks intentionally require the Firebase Functions checkout route. Do not replace it with a Stripe key, Shippo key, Firebase secret, or any other private value.

Do not put Stripe secret keys, webhook signing secrets, Firebase service account values, or private API tokens in this file. Google Pay, Apple Pay, and Link should be enabled through Stripe Checkout where available, not through static storefront secrets.

## GoDaddy Upload Checklist

1. Confirm product pricing, copy, and domain choice are approved.
2. Run `npm run check`.
3. Run `npm run package:static`.
4. Run `npm run smoke:static`.
5. In GoDaddy file manager or the selected static host, upload the contents of `dist/godaddy-static/`.
6. Do not upload the repository folder, zip of the full repo, `functions/`, `docs/`, Firebase files, `.env` files, or `.git`.
7. Visit the production domain and verify product photos, cart behavior, order request validation, and mobile layout.
8. If `checkout-config.js` is still blank, verify the form shows the disabled live submission message instead of attempting payment.
9. After a trusted backend exists, verify the endpoint uses HTTPS and redirects only to Stripe Checkout.

Windows PowerShell equivalent for steps 2 through 4:

```powershell
npm.cmd run check
npm.cmd run package:static
npm.cmd run smoke:static
```

## Post-Upload Checks

- The page should show Theo's Farm and Farm to Feeder branding.
- Products should remain only the 20 lb Ear Corn Bag and 40 lb Ear Corn Bag.
- Fulfillment copy should remain shipping only with no local pickup.
- The static host should not expose backend docs, source maps with secrets, Firebase rules, Firestore indexes, `.env` files, or repository metadata.
