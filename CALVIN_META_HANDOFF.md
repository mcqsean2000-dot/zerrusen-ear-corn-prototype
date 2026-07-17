# Calvin Handoff: Meta Auto-Publishing Setup

Sean wants Theo's Farm social posting set up so nobody has to log into Facebook or Instagram for routine daily posts.

The implementation plan is documented in:

- `docs/social-auto-publishing-plan.md`
- `docs/social-visibility-plan.md`
- `docs/social-post-drafts.md`

## Current State

- Codex is set to generate a weekly seven-post batch on Mondays at 8:30 AM.
- The current workflow is draft/review only.
- Automatic Facebook/Instagram publishing is not implemented yet.
- The desired future flow is: approved post queue -> Firebase scheduled function -> Meta Graph API publish.

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

## Firebase Secrets Needed Later

These should be added through Firebase secret management, not committed:

- `META_PAGE_ACCESS_TOKEN`
- `META_FACEBOOK_PAGE_ID`
- `META_INSTAGRAM_ACCOUNT_ID`

Optional:

- `META_GRAPH_API_VERSION`

## Implementation Direction

Once the Meta setup is ready, the code work should be:

1. Add a Firestore `socialPostQueue` collection model for approved posts.
2. Add a Firebase scheduled function that publishes only records marked `approved`.
3. Publish to Facebook Page feed through the Page token.
4. Publish to Instagram through the media-container then media-publish flow.
5. Store post IDs, publish timestamps, attempts, and errors back on the queue record.
6. Start with a disabled or test-only publisher until one post succeeds.

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
