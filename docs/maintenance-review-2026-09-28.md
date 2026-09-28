# Maintenance review — September 28, 2026

All changes are local and uncommitted. No production deployment or provider action was performed.

## Dependency updates

- Sharp: 0.35.4 → 0.35.5.
- Firebase Admin: 14.4.0 → 14.5.0.
- Firebase Functions: 7.3.2 → 7.4.0, retained as an exact version pin.
- Stripe: 22.3.0 → 22.6.2.

## Validation

- `npm run check` passed.
- Static, SEO, analytics, notification, social, commerce, Firebase access, and packaging checks passed.
- All 249 backend tests passed.
- All 10 Firestore rules tests passed.
- All 3 Auth/Firestore SDK integration tests passed against local emulators.
- Root `npm audit` reports zero vulnerabilities.

The local validation host used Node.js 24.18.0. Production Functions remain declared for Node.js 22, which is also the CI runtime configured by the repository.

## Audit remediation

The initial Functions audit reported two moderate transitive findings in `gaxios@6.7.1` and `uuid@9.0.1`. They were under `@google-cloud/storage@8.1.0`, an optional Firebase Admin dependency that this application does not import. The advisory affects UUID v3, v5, and v6 buffer writes; gaxios uses only `uuid.v4()` to create a multipart boundary.

Because gaxios 6 is archived and cannot receive a patched dependency release, `functions/package.json` now scopes an override to `gaxios@6.7.1`, replacing UUID 9.0.1 with patched UUID 11.1.1. UUID 11.1.1 retains the CommonJS `v4` export used by gaxios and supports the declared Node.js 22 runtime. The installed gaxios and UUID exports load successfully, the complete repository suite passes, and both root and Functions audits now report zero vulnerabilities.

Recheck the Firebase Admin Storage dependency chain during the next maintenance pass and remove the override when upstream no longer resolves through gaxios 6.
