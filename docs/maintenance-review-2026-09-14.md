# Maintenance review — September 14, 2026

Tracking: GitHub issue #85. All changes are local and uncommitted; no production deployment has been performed.

## Changes ready for review

- Upgrade Firebase Admin 13.10.0 to 14.4.0 and refresh its locked dependencies.
- Declare Node.js 22 for Functions, matching firebase.json and CI.
- Add a local-only Auth/Firestore SDK integration suite and include it in npm run check. It requires both emulator hosts to be loopback addresses and uses demo-theos-farm.
- Retain the maintenance updates to Sharp, the Firebase client/test packages, hosting exclusions, and approved product/analytics documentation. Pre-existing README and roadmap changes are preserved.

## Compatibility review

Firebase Admin 14 removes Node 18/20 and legacy namespace APIs. This app uses the supported firebase-admin/app, firebase-admin/auth, and firebase-admin/firestore entry points. The installed firebase-functions 7.3.2 peer range explicitly accepts Admin 14. The Functions runtime loads with the upgraded SDK.

Admin 14.4.0 upgrades Firestore to 9.1.0 and Storage to 8.1.0. The app's used APIs are exercised through local Auth/Firestore integration checks; unused SDK modules are not claimed as validated.

Sources:
- https://firebase.google.com/support/release-notes/admin/node
- npm registry metadata for firebase-admin@14.4.0 and firebase-functions@7.3.2

## Remaining audit findings

The backend audit now reports two moderate findings, down from eight before the Admin upgrade. Both derive from @google-cloud/storage@8.1.0 using gaxios@6.7.1 and uuid@9.0.1. Running npm audit fix again did not change that dependency chain. No forced transitive override was added.

The installed gaxios source uses uuid.v4 for multipart boundaries; the advisory concerns v3/v5/v6 with caller-provided buffers. This is a limited code-path observation, not proof that every dependency path is safe. The app does not currently import firebase-admin/storage. Recheck upstream Storage/gaxios fixes before closing the dependency follow-up.

Advisory: https://github.com/advisories/GHSA-w5hq-g745-h8pq

## Validation scope

The SDK integration tests cover runtime exports, real emulator token verification and admin claims, ordinary-user rejection, paid-order transaction persistence, webhook replay deduplication, notification persistence with a fake sender, full refunds, and delayed payment events after refunds.

Existing unit checks cover checkout/Stripe adapter behavior using fake provider clients. No real payment, label purchase, notification delivery, or social publication is performed.

## Release checklist

- Review the diff, including preserved pre-existing documentation edits.
- Commit/push the reviewed changes and confirm GitHub CI under Node 22.
- Coordinate Firebase deploy access and release verification through #67.
- Deploy the reviewed changes, then verify storefront/admin behavior and hosting exclusions.
- Recheck audit results and record deployed versions in #85.
## Recorded results

- Full npm run check passed under Node.js 22.23.2: 249 backend tests, 10 Firestore rules tests, and all static/tool checks plus the three SDK integration tests.
- After isolating the emulator credential fixture with a disposable in-memory certificate, the three SDK integration tests passed again without the metadata credential lookup warning.
- Root npm audit: zero findings. Functions npm audit: two moderate findings; zero high or critical.
- git diff --check passed.