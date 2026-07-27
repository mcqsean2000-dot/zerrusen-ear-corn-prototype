# Calvin Handoff: Meta Auto-Publishing Setup

Sean wants Theo's Farm social posting set up so nobody has to log into Facebook or Instagram for routine daily posts.

The implementation plan is documented in:

- `docs/social-auto-publishing-plan.md`
- `docs/social-visibility-plan.md`
- `docs/social-post-drafts.md`

## Current State

- Codex is set to generate a weekly seven-post batch on Mondays at 8:30 AM.
- The weekly batch has a local dry-run validator and remains draft/review only until an admin approves it.
- The approved queue, authenticated approval endpoint, guarded scheduled publisher, and stale-lease recovery are implemented.
- Automatic publishing remains disabled until the Meta setup is complete, Firebase secrets are configured, and the runtime flags are explicitly enabled.
- No live Meta publishing test has succeeded yet.

## What Sean Needs You To Do

Create or configure the required Meta setup so the website/backend can publish approved posts automatically.

## Meta Setup Checklist

1. Confirm the Theo's Farm Facebook Page exists and is the correct business Page.
2. Confirm the Instagram account `theosfeedfarm` is a Professional account, preferably Business.
3. Connect the Instagram account to the Theo's Farm Facebook Page.
4. Create or identify the Meta Developer app for Theo's Farm.
5. Confirm the app can request or already has the publishing permissions needed for Meta Graph API publishing:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
6. Generate the Page access token needed for publishing.
7. Capture the IDs needed by Firebase:
   - Facebook Page ID
   - Instagram professional account ID
8. Do not paste secrets into GitHub, source files, docs, or Codex chat unless Sean explicitly accepts that risk.

## Firebase Secrets

These should be added through Firebase secret management, not committed:

- `META_PAGE_ACCESS_TOKEN`
- `META_FACEBOOK_PAGE_ID`
- `META_INSTAGRAM_ACCOUNT_ID`

Optional:

- `META_GRAPH_API_VERSION`

Set the three required secret values with the Firebase CLI from a trusted terminal. Do not put their values on a command line that will be retained in shell history; run each command and enter the value when prompted:

```powershell
firebase functions:secrets:set META_PAGE_ACCESS_TOKEN
firebase functions:secrets:set META_FACEBOOK_PAGE_ID
firebase functions:secrets:set META_INSTAGRAM_ACCOUNT_ID
```

The non-secret runtime settings must also be configured for the Functions environment:

- `META_GRAPH_API_VERSION`
- `SOCIAL_PUBLISHING_ENABLED=true`
- `SOCIAL_RECONCILIATION_ENABLED=true`

Keep both enable flags off until the controlled test post has been reviewed and scheduled for a future time.

## Implemented Backend

The backend now provides:

1. `POST /api/admin/social-posts/queue` for authenticated Firebase admins to approve one reviewed post.
2. A five-minute Firebase schedule that claims only due `approved` records.
3. Facebook Page photo publishing and Instagram media-container/media-publish handling.
4. Per-platform provider IDs, bounded retries, and final publish state persistence.
5. A ten-minute stale-lease recovery schedule and authenticated reconciliation endpoints.
6. Disabled-by-default gates for both publishing and recovery.

The admin page does not yet expose the queue or reconciliation controls. Until those controls are added, the authenticated endpoint must be exercised with a Firebase admin ID token from a trusted test client.

## Controlled Test Order

1. Confirm the Facebook Page, professional Instagram account, Meta app permissions, IDs, and Page token.
2. Configure the three Firebase secrets and `META_GRAPH_API_VERSION` while leaving both enable flags off.
3. Deploy the Functions runtime.
4. Queue one reviewed post for Facebook only at least 15 minutes in the future.
5. Enable `SOCIAL_PUBLISHING_ENABLED`, deploy the setting, and verify the Facebook provider ID is recorded.
6. Queue a separate reviewed Instagram-only post and verify its provider ID.
7. Enable reconciliation only after the admin reconciliation UI or an equivalent trusted operating procedure is available.
8. Approve the remaining weekly posts only after both single-platform tests succeed.

## Guardrails

- Keep a human approval step at first.
- Do not publish fully unreviewed AI content until Sean/client approves that level of automation.
- Every post should include `https://theosfarm.com`.
- Product images should show whole ears of corn on the cob, not loose kernels.
- Avoid unsupported claims.

## Useful Repo Context

- The website is Firebase-hosted.
- Firebase Functions already exist for Stripe, Shippo, checkout, webhooks, and admin actions.
- Secrets are already managed through Firebase for Stripe and Shippo.
- Social posting should follow the same secret-management pattern.
