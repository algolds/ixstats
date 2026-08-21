# ThinkPages

**Last updated:** June 2026

ThinkPages is IxStates' social knowledge-sharing backbone — the in-world social platform where players run multiple personas (government officials, media outlets, citizen voices) tied to their country, post to a shared feed, react, and collaborate. ThinkShare (messaging) and the Discord IxTwitter sync are sub-systems of ThinkPages.

This directory (`src/app/thinkpages`) is the App Router surface. As of June 2026 the heavy social experiences (feed, groups, messaging) have been consolidated into `/dashboard` and `/messages`, so most routes under `/thinkpages` are now thin redirects. The remaining live page is the **account-management hub**.

## Routes

| Route | File | Behaviour |
| --- | --- | --- |
| `/thinkpages` | `page.tsx` | Renders `ThinkPagesAccountHub` — persona/account management (create, edit, switch accounts) |
| `/thinkpages/post/[postId]` | `post/[postId]/page.tsx` | Single-post thread view with replies and inline composer |
| `/thinkpages/feed` | `feed/page.tsx` | Redirects to `/dashboard` (unified feed) |
| `/thinkpages/thinktanks` | `thinktanks/page.tsx` | Redirects to `/messages/groups?tab=discover` |
| `/thinkpages/thinkshare` | `thinkpages/thinkshare/page.tsx` | Redirects to `/messages` |

> Note: the `Feed / ThinkTanks / ThinkShare` single-page router pattern described in older docs has been superseded — these sections now live in the Dashboard and Messages surfaces, and the routes above forward to them.

## Key features

- **Personas / accounts** — each country can own multiple ThinkPages accounts (government, media, citizen). Managed in `ThinkPagesAccountHub` via `EnhancedAccountManager`, `AccountCreationModal`, and `AccountSettingsModal`.
- **Posts** — create, edit, delete, reply (threaded), pin, bookmark, and flag posts; hashtag and mention extraction on submit.
- **Reactions** — emoji reactions including Discord custom emoji (`discord:<name>`).
- **Feed & trends** — trending topics, country-mood metrics, and citizen reactions served via the feed router (consumed primarily from `/dashboard`).
- **ThinkTanks** — collaborative groups with membership, roles, group messages, and shared documents (now surfaced under `/messages/groups`).
- **ThinkShare messaging** — DM conversations, messages, and presence (now surfaced under `/messages`).
- **Discord IxTwitter sync** — posts can be mirrored to Discord (`postToDiscord`, default true); reactions sync bidirectionally via `~/lib/discord-ixtwitter-sync`. A Discord channel topic / server emoji integration backs the reaction picker.
- **Wiki lookups** — integrated wiki search for referencing content (`searchWiki`).

## Architecture

| Piece | Location |
| --- | --- |
| Main page (account hub) | `src/components/thinkpages/ThinkPagesAccountHub.tsx` |
| Account management | `EnhancedAccountManager.tsx`, `AccountCreationModal.tsx`, `AccountSettingsModal.tsx` |
| Post card / thread | `ThinkpagesPost.tsx` (used by `post/[postId]/page.tsx`) |
| Feed container | `ThinkpagesSocialPlatform.tsx` |
| Composer | `GlassCanvasComposer.tsx`, `GlassPlateEditor.tsx` |
| Auth gating | `AuthenticationGuard` (from `~/components/mycountry/primitives`) |

The account hub gates on the signed-in user having a configured country (`api.users.getProfile` + `api.countries.getMapSummary`); without one it prompts for `/setup`.

## Data sources (tRPC)

All data flows through `api.thinkpages.*`, registered in `src/server/api/root.ts` and assembled in `src/server/api/routers/thinkpages/index.ts` via `mergeRouters` across five domains:

| Domain | File(s) | Sample procedures |
| --- | --- | --- |
| accounts | `accounts.ts` | `getMyAccounts`, `getAccountsByCountry`, `createAccount`, `updateAccount`, `checkUsernameAvailability`, `generateProfilePicture` |
| posts | `posts/` (posts, reactions, bookmarks, flags) | `getFeed`, `getPost`, `createPost`, `updatePost`, `deletePost`, `pinPost`, `addReaction`, `removeReaction`, `bookmarkPost`, `flagPost` |
| feed | `feed.ts` | `calculateTrendingTopics`, `calculateCountryMoodMetrics`, `triggerCitizenReaction`, `getDiscordChannelTopic`, `getDiscordEmojis` |
| thinktanks | `thinktanks/` (groups, membership, messages, documents) | `getThinktanks`, `createThinktank`, `joinThinktank`, `sendThinktankMessage`, `getThinktankDocuments` |
| messaging (ThinkShare) | `messaging/` (conversations, messages, presence) | `getConversations`, `sendMessage`, `markMessagesAsRead`, `updatePresence` |

Page-level usage also references `api.users.getProfile` and `api.countries.getMapSummary` for the country gate.

## Connections

- **ThinkShare / `/messages`** — the messaging sub-system; `/thinkpages/thinkshare` redirects here.
- **Dashboard `/dashboard`** — hosts the unified social feed; `/thinkpages/feed` redirects here and the account hub links to it.
- **Discord** — bidirectional post/reaction mirroring (IxTwitter) and channel-topic/emoji integration.

## Reference

- Authoritative guide: `docs/systems/social.md`
- Component suite README: `src/components/thinkpages/README.md`
- Backend routers: `src/server/api/routers/thinkpages/`
