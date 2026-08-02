# Production Google Admin Activation

Issue: [#70](https://github.com/mcqsean2000-dot/zerrusen-ear-corn-prototype/issues/70)

Approved business admin: `theosfeedfarm@gmail.com`

Firebase project: `theos-farm-ear-corn`

## Safety Boundary

This runbook activates the existing Firebase Auth boundary. It does not create a public email allowlist, expose service-account credentials, grant access from browser code, deploy the app, or authorize any Google account merely because its email matches a domain.

The repo includes a one-time trusted claim tool. It defaults to dry-run mode and can target only the confirmed Theo's Farm project, verified business email, and exact Firebase Auth UID supplied by the operator. Apply mode also requires an explicit confirmation string.

## Firebase Console Setup

After issue #67 access is restored:

1. Open Firebase Console and select project `theos-farm-ear-corn`.
2. In Authentication > Sign-in method, enable Google.
3. Set the project support email to the approved business contact.
4. In Authentication > Settings > Authorized domains, confirm:
   - `theosfarm.com`
   - `www.theosfarm.com`
   - `theos-farm-ear-corn.web.app`
   - `theos-farm-ear-corn.firebaseapp.com`
   - only the preview hosts intentionally used for this project
5. Open `https://theosfarm.com/admin.html` and sign in once as `theosfeedfarm@gmail.com`.
6. Confirm the page says the signed-in account does not yet have admin access. This creates the Firebase Auth user but must not reveal fulfillment data.
7. In Firebase Authentication > Users, copy that user's exact UID. Do not put it in GitHub or this file.

## Trusted Claim Tool

The tool uses Firebase Admin SDK with Application Default Credentials. Prefer a named human account with narrowly scoped permission or an approved impersonated service account. Do not download a service-account key into the repo.

For local ADC, Google documents:

```powershell
gcloud auth application-default login
```

First run the tool without `--apply`:

```powershell
npm --prefix functions run admin:claim -- --project theos-farm-ear-corn --uid <COPIED_FIREBASE_UID> --email theosfeedfarm@gmail.com
```

Expected result:

```json
{"apply":false,"email":"theosfeedfarm@gmail.com","projectId":"theos-farm-ear-corn","status":"dry_run_ready","uidSuffix":"..."}
```

Stop if the project, email, UID suffix, or status is unexpected. After action-time approval, apply exactly once:

```powershell
npm --prefix functions run admin:claim -- --project theos-farm-ear-corn --uid <COPIED_FIREBASE_UID> --email theosfeedfarm@gmail.com --apply --confirm theos-farm-ear-corn:theosfeedfarm@gmail.com
```

The tool fetches the UID, requires its email to match and be verified, preserves any existing custom claims, and sets `admin: true`. Repeating the command is idempotent. Its output includes only the last six UID characters.

Custom-claim writes replace the complete claim object at the Firebase API boundary, which is why the tool merges existing claims before writing. The new claim appears after Firebase issues a refreshed ID token.

## Verification

1. Sign out of `admin.html`, then sign in again with `theosfeedfarm@gmail.com`.
2. Confirm fulfillment content becomes visible.
3. Confirm a signed-out browser cannot read order data or call an admin endpoint.
4. Sign in with an ordinary Google test account and confirm the page reports no admin access and shows no fulfillment data.
5. As the claimed admin, read the bounded order queue.
6. On a non-paid test order, perform one allowed status transition and confirm `lastAdminAction`, `lastAdminAt`, and the new status are written by the trusted endpoint.
7. Confirm the admin still cannot write Stripe IDs, payment status, unsupported fields, or delete an order.
8. Run `npm run check` and record the Firestore rules and backend auth test counts.

Do not use a real paid customer order for the first status test. Do not post names, addresses, tokens, complete UIDs, or order contents in issue #70.

## Evidence For Issue #70

Record only sanitized results:

| Evidence | Result |
| --- | --- |
| Firebase project | `theos-farm-ear-corn` confirmed |
| Google provider | enabled/failed |
| Authorized domains | pass/fail; no unrelated domains listed |
| Business admin sign-in | pass/fail; UID suffix only |
| Dry run | `dry_run_ready` or `already_admin` |
| Claim apply | `admin_granted` or `already_admin` |
| Signed-out denial | pass/fail |
| Ordinary-user denial | pass/fail |
| Claimed-admin read | pass/fail |
| Safe status update and audit fields | pass/fail |
| Automated checks | pass/fail and counts |
| Operator and UTC timestamp | |

## Revocation

Revocation is deliberately not automated by this grant-only tool. If access must be removed, treat it as a separate reviewed action: use trusted Admin SDK tooling to preserve unrelated claims while removing `admin`, then revoke refresh tokens and verify the old account is denied. Record the reason and operator without publishing user data.

## Official References

- [Firebase custom claims and token refresh](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Admin SDK setup](https://firebase.google.com/docs/admin/setup)
- [Google Cloud Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc)
