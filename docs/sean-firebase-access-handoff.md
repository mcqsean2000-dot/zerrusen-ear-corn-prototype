# Sean Firebase Access Handoff

This handoff resolves [issue #67](https://github.com/mcqsean2000-dot/zerrusen-ear-corn-prototype/issues/67) without sharing passwords, service-account JSON files, or Firebase secrets.

## Confirmed Project

- Firebase project ID: `theos-farm-ear-corn`
- Production domain: `https://theosfarm.com`
- Account requiring deploy access: `crhags@gmail.com`

The project ID and Firebase web configuration are public identifiers. Stripe, Shippo, Resend, Meta, and webhook values remain secrets and must never be placed in this repository or an issue comment.

## Sean: Grant Project Access

Only a project Owner, or a member allowed to change IAM policy, can add or change project roles.

1. Open the Firebase console for `theos-farm-ear-corn`.
2. Open **Project settings** and then **Users and permissions**.
3. Add `crhags@gmail.com` as a project member.
4. Grant only the roles needed for the approved work. This repository needs Hosting, Cloud Functions, Firestore rules/indexes, Authentication administration, and Secret Manager setup.

A practical least-privilege starting set is:

- Firebase Admin (`roles/firebase.admin`) for Firebase product administration.
- Firebase Hosting Admin (`roles/firebasehosting.admin`) for Hosting releases and preview channels.
- API Keys Viewer (`roles/serviceusage.apiKeysViewer`) because Firebase CLI Hosting deploys require it.
- Cloud Functions Admin (`roles/cloudfunctions.admin`) for Functions deployment.
- Service Account User (`roles/iam.serviceAccountUser`) on the service account used by the Functions deploy.
- Firebase Authentication Admin (`roles/firebaseauth.admin`) for provider/domain/user setup.
- Secret Manager Admin (`roles/secretmanager.admin`) only while creating and configuring approved secrets.

Google may require another narrowly scoped permission for an existing project configuration. If a CLI preflight reports one, stop and have Sean review that permission instead of granting Project Owner broadly. If Sean temporarily chooses Project Owner for setup convenience, downgrade it after the release path is verified.

Official references:

- [Firebase IAM roles](https://firebase.google.com/docs/projects/iam/roles)
- [Firebase IAM permissions](https://firebase.google.com/docs/projects/iam/permissions)
- [Firebase product-level roles](https://firebase.google.com/docs/projects/iam/roles-predefined-product)
- [Firebase CLI reference](https://firebase.google.com/docs/cli)

## Calvin: Verify Access Without Deploying

Allow several minutes for IAM propagation. Then run these from the repository root in PowerShell:

```powershell
firebase login:list
firebase login:use crhags@gmail.com
firebase projects:list
firebase use theos-farm-ear-corn
firebase use
firebase hosting:sites:list --project theos-farm-ear-corn
firebase functions:list --project theos-farm-ear-corn
```

Use plain `firebase login:list` only. Do not add `--json`: Firebase CLI `15.23.0` can include OAuth token fields in that JSON response.

Expected result:

- `firebase projects:list` includes `theos-farm-ear-corn`.
- `firebase use` reports `theos-farm-ear-corn` as active.
- Hosting and Functions list commands complete without a permission error.

Do not run `firebase init`; the repository already contains reviewed `firebase.json`, rules, indexes, and Functions configuration.

## Create Local Project Target

After access is verified, copy the safe template to the ignored local file:

```powershell
Copy-Item .firebaserc.example .firebaserc
```

Replace only the template project ID with `theos-farm-ear-corn`. Confirm that `.firebaserc` remains ignored:

```powershell
git status --short
```

The local `.firebaserc` must not appear in Git status and must not be committed.

Run the repository preflight after the account can see the project and `.firebaserc` is configured:

```powershell
npm run firebase:access:preflight
```

The preflight is read-only. It verifies the minimum CLI version, approved account, visible public project ID, exact local default target, and Git ignore rule. It never prints raw Firebase command output and does not inspect Hosting, Functions, Auth, IAM, or secret values.

## Pre-Deploy Checks

Run locally before requesting a preview deployment:

```powershell
npm.cmd ci
npm.cmd run check
git status --short --branch
firebase use
```

The repository check requires Firebase CLI `15.23.0` and Java 21 or newer. Stop if tests fail, the tree is dirty unexpectedly, or the active project is not `theos-farm-ear-corn`.

## Approval Boundary

Access verification is read-only. A preview or production deployment is a separate action and requires action-time human approval.

After approval, deploy only the requested scope. Start with a Hosting preview channel:

```powershell
firebase hosting:channel:deploy coordinator-access-check --only hosting --project theos-farm-ear-corn
```

Do not run an unscoped `firebase deploy`. Functions, Firestore rules/indexes, secrets, Auth settings, and production Hosting each require their own reviewed activation step.

## Completion Evidence

Record the following on issue #67 without exposing secrets:

- Date access was granted.
- Account and project ID verified by the CLI.
- Read-only list commands that succeeded.
- Preview URL and smoke-test result after preview approval.
- Any additional IAM role Sean approved.
- Confirmation that `.firebaserc` and all secret values remain uncommitted.
