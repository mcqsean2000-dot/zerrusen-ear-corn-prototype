# Firebase Hosting Readiness

Firebase Hosting is the selected production hosting path for Theo's Farm. This document prepares the static prototype for Firebase Hosting preview and deploy. It does not deploy, connect the storefront/admin shell to live Firebase, collect payment details, or replace the future Stripe Checkout handoff.

The current Firebase direction is:

- Firebase Hosting for the public storefront.
- Firebase Cloud Functions for trusted Stripe Checkout session creation and Stripe webhook handling.
- Firestore for order request and fulfillment state.
- GitHub Pages remains only a temporary public prototype preview.

## First Firebase Setup

1. Create or select the Firebase project for Theo's Farm.
2. Install and authenticate the Firebase CLI.
3. Copy the example project alias file:

```bash
cp .firebaserc.example .firebaserc
```

4. Replace `replace-with-your-firebase-project-id` with the real Firebase project ID.
5. Keep `.firebaserc` and `.firebase/` local only. They are intentionally ignored so project IDs, aliases, and local deploy cache files do not get committed.

## Local Static Preview

For the current no-dependency static prototype:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/
http://localhost:4173/admin.html
```

For Firebase Hosting behavior after `.firebaserc` is configured:

```bash
firebase emulators:start --only hosting
```

Firebase serves the repo root from `firebase.json`. HTML, CSS, and JavaScript are intentionally uncached for iteration, while product images can be cached for one week.

For the production deploy checklist that includes Hosting, Functions, Firestore, Stripe webhook setup, rollback, and post-deploy smoke checks, see `docs/firebase-production-deploy-checklist.md`.

## Preview And Deploy Commands

Use a preview channel before production:

```bash
firebase hosting:channel:deploy preview
```

Deploy hosting only:

```bash
firebase deploy --only hosting
```

Deploy Firestore rules and indexes separately when ready:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Avoid a broad `firebase deploy` until hosting, rules, indexes, and project targeting have all been reviewed together.

## Production Verification

Before production deploy, verify:

- The selected Firebase project is the intended Theo's Farm production project.
- `.firebaserc` contains the correct project ID and is not staged.
- `.firebase/` is not staged.
- `npm run check` passes.
- `git diff --check` passes.
- `firebase emulators:start --only hosting` serves `index.html` and `admin.html`.
- The storefront still routes payment to the planned Stripe Checkout handoff and does not collect card numbers, CVV, bank data, or raw payment details.
- The hosted admin route loads Firebase public auto config and offers Google sign-in, but fulfillment content stays hidden unless the refreshed ID token carries `admin: true`.
- Firestore public writes remain limited to validated `orderRequests` creation.
- Admin reads and status updates remain protected by Firestore rules and backend Firebase ID-token verification.
