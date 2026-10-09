# ThinkPages

**Last updated:** October 2026

ThinkPages is IxStates' social knowledge-sharing backbone — the in-world social platform where players run multiple personas (government officials, media outlets, citizen voices) tied to their country, post to a shared feed, react, and collaborate. ThinkShare (messaging) and the Discord IxTwitter sync are sub-systems of ThinkPages.

This directory (`src/app/thinkpages`) is the App Router surface. The heavy social experiences have been consolidated elsewhere — the feed into `/dashboard`, ThinkTank groups into `/thinktanks`, and messaging into `/messages` — so most routes under `/thinkpages` are now thin redirects. The remaining live page is the **account-management hub**.

## Routes

| Route | File | Behaviour |
| --- | --- | --- |
| `/thinkpages` | `page.tsx` | Renders `ThinkPagesAccountHub` — persona/account management (create, edit, switch accounts) |
| `/thinkpages/post/[postId]` | `post/[postId]/page.tsx` | Single-post thread view with replies and inline composer |
| `/thinkpages/feed` | `feed/page.tsx` | Redirects to `/dashboard` (unified feed) |
| `/thinkpages/thinktanks` | `thinktanks/page.tsx` | Redirects to `/thinktanks` |
| `/thinkpages/thinkshare` | `thinkshare/page.tsx` | Redirects to `/messages` |
| `/thinkpages/forum` | `forum/page.tsx` | Forum home: sitewide categories and the realm directory |
| `/thinkpages/c/[key]` | `c/[key]/page.tsx` | A sitewide category's thread list |
| `/thinkpages/c/[key]/new` | `c/[key]/new/page.tsx` | Start a thread in a sitewide category |
| `/thinkpages/r/[realm]` | `r/[realm]/page.tsx` | Redirects to the realm's Hub |
| `/thinkpages/r/[realm]/[key]` | `r/[realm]/[key]/page.tsx` | A realm section's thread list (the Hub and its categories) |
| `/thinkpages/r/[realm]/[key]/new` | `r/[realm]/[key]/new/page.tsx` | Start a thread in a realm section |
| `/thinkpages/t/[threadId]` | `t/[threadId]/page.tsx` | Thread view with replies, reports and moderator tools |
| `/thinkpages/mod` | `mod/page.tsx` | Moderation console for realm and category moderators and admins |

> Note: the `Feed / ThinkTanks / ThinkShare` single-page router pattern described in older docs has been superseded — these sections now live in the Dashboard, ThinkTanks, and Messages surfaces, and the routes above forward to them.

## Forum

The public forum lives under `/thinkpages/forum`, `/thinkpages/c/*`, `/thinkpages/r/*` and `/thinkpages/t/*`, and appears in the sidebar as **Forum** under Home (ThinkTanks keeps `/thinkpages` and the rest). Reads and member writes go through `api.thinkpagesForum.*`; moderation (reports, hide/lock/pin/move, warnings, bans, appeals, the moderation log) goes through `api.thinkpagesForumMod.*`, surfaced in the moderation console at `/thinkpages/mod`. Logic lives in `src/server/modules/thinkpages-forum/`; the pure moderation rules (warning points, expiry, automatic ban thresholds) are in `src/lib/thinkpages-forum/moderation-policy.ts`. Every moderator action writes an append-only `ForumModLog` row in the same transaction.

## Key features

- **Personas / accounts** — each country can own multiple ThinkPages accounts (government, media, citizen). Managed in `ThinkPagesAccountHub` via `EnhancedAccountManager`, `AccountCreationModal`, and `AccountSettingsModal`.
- **Posts** — create, edit, delete, reply (threaded), pin, bookmark, and flag posts; hashtag and mention extraction on submit.
- **Reactions** — emoji reactions including Discord custom emoji (`discord:<name>`).
- **Feed & trends** — trending topics, country-mood metrics, and citizen reactions served via the feed router (consumed primarily from `/dashboard`).
- **ThinkTanks** — collaborative groups with membership, roles, a group feed, and (backend-only) shared documents, surfaced at `/thinktanks` (see `docs/systems/thinktanks.md`).
- **ThinkShare messaging** — DM conversations, messages, and presence, surfaced at `/messages` via the separate `api.messages` router.
- **Discord IxTwitter sync** — public posts are autoposted to Discord (`postToDiscord`, default true) and mirrored to the admin-configured `#thinkpages` feed; IxTwitter messages are imported back and reactions mirror to Discord via `~/lib/discord/ixtwitter-sync` and `~/lib/discord/thinkpages-feed`. A Discord channel topic / server emoji integration backs the reaction picker.
- **Wiki references** — the shared PlateJS editor (`src/components/shared/editor/`) provides wiki-link/embed popovers and `@` mentions.

## Architecture

| Piece | Location |
| --- | --- |
| Main page (account hub) | `src/components/thinkpages/ThinkPagesAccountHub.tsx` |
| Account management | `EnhancedAccountManager.tsx`, `AccountCreationModal.tsx`, `AccountSettingsModal.tsx` |
| Post card / thread | `ThinkpagesPost.tsx` (used by `post/[postId]/page.tsx`) |
| Feed container | `src/components/dashboard/sections/UnifiedFeedContent.tsx` (on `/dashboard`) |
| Composer | `GlassCanvasComposer.tsx`, `src/components/shared/editor/GlassPlateEditor.tsx` |
| Auth gating | `AuthenticationGuard` (from `~/components/mycountry/primitives`) |

The page resolves the signed-in user's country server-side (`getSignedInCountryId`) and passes it to the account hub; without a country the hub prompts for `/setup`.

## Data sources (tRPC)

All data flows through `api.thinkpages.*`, registered in `src/server/api/root.ts` and assembled in `src/server/api/routers/thinkpages/index.ts` via `mergeRouters` across four domains (DM conversations moved to `api.messages.*`; the legacy `messaging` adapter was removed):

| Domain | File(s) | Sample procedures |
| --- | --- | --- |
| accounts | `accounts.ts` | `getMyAccounts`, `getAccountsByCountry`, `getAccountCountsByType`, `createAccount`, `updateAccount`, `checkUsernameAvailability` |
| posts | `posts/` (posts, reactions, bookmarks, flags) | `getPost`, `getPostsByClerkUserId`, `createPost`, `updatePost`, `deletePost`, `pinPost`, `addReaction`, `removeReaction`, `getPostReactions`, `bookmarkPost`, `flagPost` |
| feed | `feed.ts` | `getFeed` (recent / trending / hot), `getDiscordChannelTopic`, `getDiscordEmojis` |
| thinktanks | `thinktanks/` (groups, membership, documents) | `getThinktanks`, `getThinktankById`, `createThinktank`, `joinThinktank`, `getGroupFeed`, `createGroupPost`, `getThinktankDocuments` |

## Connections

- **ThinkShare / `/messages`** — the messaging sub-system; `/thinkpages/thinkshare` redirects here.
- **Dashboard `/dashboard`** — hosts the unified social feed; `/thinkpages/feed` redirects here and the account hub links to it.
- **ThinkTanks `/thinktanks`** — group workspace; `/thinkpages/thinktanks` redirects here.
- **Discord** — bidirectional post/reaction mirroring (IxTwitter) and channel-topic/emoji integration.

## Reference

- Authoritative guide: `docs/systems/social.md`
- Component suite README: `src/components/thinkpages/README.md`
- Backend routers: `src/server/api/routers/thinkpages/`
