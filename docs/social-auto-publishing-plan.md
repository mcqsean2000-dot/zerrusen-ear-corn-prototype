# Theo's Farm Social Auto-Publishing Plan

This plan moves Theo's Farm from social post drafts to scheduled publishing without daily Facebook or Instagram logins.

## Goal

Publish approved Theo's Farm posts to Facebook and Instagram automatically, with the website link included in every post:

`https://theosfarm.com`

The goal is visibility support, not a replacement for website SEO.

## Important Constraint

No one should need to log into Facebook or Instagram every day. However, Meta still requires an initial account/app authorization before any system can publish on behalf of a Facebook Page or Instagram professional account.

After that one-time setup, publishing can run from Firebase on a schedule.

## Recommended Architecture

1. Codex creates a weekly seven-post batch.
2. Sean/client reviews and approves the batch outside Meta.
3. Approved posts are stored in a controlled queue.
4. A Firebase scheduled function publishes the next approved post.
5. The function records the Facebook/Instagram post IDs and publish result.

## Why Firebase

Firebase is already used for Theo's Farm hosting, checkout functions, Shippo, Stripe, and admin work. Using Firebase keeps credentials in the same secret-management model and avoids adding another platform just for posting.

## Required Meta Setup

Meta requirements can change, but the expected setup is:

- Facebook Page for Theo's Farm.
- Instagram professional account, preferably Business or Creator.
- Instagram account connected to the Facebook Page if using Instagram API with Facebook Login.
- Meta Developer app, likely a Business app.
- Publishing permissions approved or available for the app/account:
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_posts`
  - `instagram_basic`
  - `instagram_content_publish`
- Page access token with publishing access.
- Facebook Page ID.
- Instagram professional account ID.

## Firebase Secrets

Do not commit Meta tokens or IDs that should remain private.

Expected Firebase secrets:

- `META_PAGE_ACCESS_TOKEN`
- `META_FACEBOOK_PAGE_ID`
- `META_INSTAGRAM_ACCOUNT_ID`

Optional:

- `META_GRAPH_API_VERSION`

## Publishing Flow

### Facebook Page

Post to the Facebook Page feed using the Page access token. For simple text/link posts, the payload should include:

- message
- link to `https://theosfarm.com`

For photo posts, use a public image URL from the Theo's Farm site assets.

### Instagram

Instagram publishing generally uses a two-step flow:

1. Create a media container using a public image URL and caption.
2. Publish the media container.

The caption should include the post text, hashtags, and `https://theosfarm.com`.

## Approval Model

Start with human-approved weekly batches. Do not publish fully unreviewed AI content until the client is comfortable with the tone and frequency.

Suggested statuses:

- `draft`
- `approved`
- `publishing`
- `needs_reconciliation`
- `published`
- `failed`
- `skipped`

## Draft Queue Shape

The approved queue collection is:

`socialPostQueue/{postId}`

Recommended fields:

- `scheduledAt`
- `status`
- `caption`
- `hashtags`
- `imageUrl`
- `platforms`
- `approvedBy`
- `approvedAt`
- `facebookPostId`
- `instagramMediaId`
- `instagramPostId`
- `publishAttempts`
- `lastError`
- `createdAt`
- `publishedAt`

## Implemented Queue Foundation

The repository now includes a server-only, SDK-free queue boundary and Firestore persistence methods. They:

- accept only deterministic post IDs and records explicitly marked `approved`;
- require a trusted reviewer uid and email;
- require every caption to include `https://theosfarm.com`;
- allow only Facebook and Instagram targets with bounded, validated hashtags;
- require Instagram images to use a public HTTPS URL on the Theo's Farm domain;
- create queue documents idempotently and transactionally claim one due post;
- prevent browser access through the existing default-deny Firestore rules.

The repository also includes a secret-injected Meta Graph adapter, a provider-neutral per-platform worker, and an explicit `SOCIAL_PUBLISHING_ENABLED` runtime gate. Platform IDs are persisted separately so a retry can skip a platform that already succeeded. Provider failures are sanitized and bounded; persistence failures after a provider success leave the post locked for manual reconciliation to avoid an automatic duplicate.

Expired `publishing` leases are handled conservatively: posts with every required provider ID are finalized, while ambiguous records move to `needs_reconciliation` and are never automatically republished. Recovery is separately gated by `SOCIAL_RECONCILIATION_ENABLED`.

This foundation is deployed and connected to a five-minute Firebase schedule. Production credentials remain in Firebase secrets rather than the repository, and publishing still fails closed unless the runtime gate is explicitly enabled. A separate ten-minute schedule recovers expired publishing leases only when its own reconciliation gate is enabled.

The admin page generates the next Monday-through-Sunday review batch automatically from a deterministic four-week content rotation. Dates are derived in `America/Chicago`, including daylight-saving changes, and every post targets both configured platforms at 8:30 AM Central. The admin reviews all seven captions, images, hashtags, platforms, and times, then uses one confirmation to approve the week. The browser submits the seven posts through the existing authenticated queue endpoint; each write remains server-validated, idempotent, and attributable to the verified admin. If a request stops partway through, retrying the weekly action safely resumes because already-created post IDs are no-ops.

The authenticated admin backend approval path is implemented at `POST /api/admin/social-posts/queue`. It derives `approvedBy` from the verified Firebase admin token, forces `status` to `approved`, and delegates validation and idempotent persistence to the trusted queue. The weekly approval control intentionally reuses this narrow endpoint rather than introducing an unbounded bulk write. The authenticated review path is implemented at `/api/admin/social-posts/reconciliation` and `/api/admin/social-posts/reconciliation/resolve`. It returns bounded safe fields and supports audited `mark_published`, `retry_confirmed_not_published`, and `skip` resolutions. The admin page exposes all three actions; retry must be used only after an admin confirms that the missing platform post does not exist, and mark-published requires verified provider IDs for every selected platform.

## Initial Implementation Steps

1. Confirm whether the existing Instagram account is professional.
2. Confirm the Instagram account is connected to the Theo's Farm Facebook Page.
3. Create or identify the Meta Developer app.
4. Generate the correct Page access token.
5. Add Meta IDs/tokens to Firebase secrets.
6. Deploy the disabled-by-default Firebase scheduled publisher and stale-lease recovery functions.
7. Test one Facebook-only approved post, then one Instagram-only approved post.
8. Turn on daily dual-platform publishing only after both tests succeed.

## Rollout Recommendation

Start with a daily publisher that only posts records marked `approved`. That keeps human review in the loop while removing the need to log into Facebook or Instagram.

After two to four weeks of clean posts, decide whether Codex-generated batches can be automatically marked approved.
