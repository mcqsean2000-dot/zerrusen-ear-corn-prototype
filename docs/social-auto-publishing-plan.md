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
- `published`
- `failed`
- `skipped`

## Draft Queue Shape

A future Firestore collection could be:

`socialPostQueue/{postId}`

Recommended fields:

- `scheduledDate`
- `status`
- `caption`
- `hashtags`
- `imageUrl`
- `facebookPostId`
- `instagramMediaId`
- `instagramPostId`
- `publishAttempts`
- `lastError`
- `createdAt`
- `approvedAt`
- `publishedAt`

## Initial Implementation Steps

1. Confirm whether the existing Instagram account is professional.
2. Confirm the Instagram account is connected to the Theo's Farm Facebook Page.
3. Create or identify the Meta Developer app.
4. Generate the correct Page access token.
5. Add Meta IDs/tokens to Firebase secrets.
6. Add a disabled-by-default Firebase scheduled publisher.
7. Test with one approved post.
8. Turn on daily publishing after the test succeeds.

## Rollout Recommendation

Start with a daily publisher that only posts records marked `approved`. That keeps human review in the loop while removing the need to log into Facebook or Instagram.

After two to four weeks of clean posts, decide whether Codex-generated batches can be automatically marked approved.
