# 💬 ThinkPages — Sovereign Feed, ThinkTanks & ThinkShare

**Last updated:** 2026-10-06

**Parent App Suite:** ThinkPages (`THINKPAGES_VERSION = 2`)  
**Subsystems:** Sovereign Feed, Account Manager, Collaborative ThinkTanks, ThinkShare Messaging  
**Primary Action:** `DELIBERATE` | **Domain Accent:** Blue (`#3B82F6` / `--color-blue-500`, the `/thinkpages` accent in `NavTray.tsx` and [branding.md](../reference/branding.md))  
**Routes:** `/dashboard` (feed), `/thinkpages` (account hub), `/thinkpages/post/[postId]`, `/thinkpages/profile/[username]`, `/hashtags/[tag]`, `/thinktanks`, `/messages` | **Status:** see [SYSTEM_STATUS.md](SYSTEM_STATUS.md): feed and Blurbs ✅ Live; Accounts, ThinkShare and ThinkTanks 🟡 Partial  

ThinkPages is the real-time communications and publishing network of IxStates. It pairs public sovereign micro-publishing with multilateral ThinkTank working rooms, automated Discord distribution, and ThinkShare direct messaging.

---

## 1. Sovereign Feed & Micro-Publishing (`/dashboard`)

The **Sovereign Feed** (rendered on `/dashboard`; `/thinkpages/feed` redirects there) is the public town square for national announcements, diplomatic communiqués, breaking news, and community polling:
- **`[blurb:slug|Title]` Blurb Cross-Posts**: [Blurbs](../../src/app/blurbs/README.md) (Topic Tuesday) responses auto-cross-post to the feed with a `[blurb:slug|Title]` prefix and `#blurb` tag; the post card strips the prefix and renders a chip linking back to the prompt. Inline link previews cover Wiki, Forum, League, and Club URLs.
- **Official Seals & Sovereign Identity**: Posts display sovereign state seals, leader titles, and verified tags. Only admins can set the verified flag, and creating an account tied to a country requires write access to that country (`accounts.ts`).
- **National Polls**: Real-time polling widgets let rulers gauge international sentiment and domestic approval with instant visual tallying.
- **Hashtag Indexing**: Hashtags are extracted on submit and each tag has its own page (`/hashtags/[tag]`) aggregating discussions across sovereign borders.
- **Saved posts** (`/thinkpages/saved`, SL-10): a post's menu bookmarks it (`thinkpages.bookmarkPost`, keyed by the caller's Clerk id). `thinkpages.getBookmarkedPosts` lists the caller's bookmarks, most recently saved first (cursor on the bookmark id), leaving out posts deleted since and posts the caller can no longer read. The page links from the ThinkPages account hub and each item has **Remove from saved**.
- **Flags and the moderation queue** (SL-10): `thinkpages.flagPost` records a flag (`PostFlag`) for the caller, with an optional reason; the flagger is always the signed-in user (a client-sent `userId` is ignored), and a user flags a post once. Admins work the queue in **Admin → ThinkPages → Flagged posts** (`admin.listFlaggedPosts`: open flags grouped by post, most flagged first, with up to five reasons). **Dismiss** closes every open flag on the post (`status: "dismissed"`); **Remove post** deletes the post through the same path as `deletePost` (`server/shared/thinkpages-post-delete.ts`) and closes its flags as `removed`. Both record `resolvedAt` and the admin's Clerk id in `resolvedBy`.

### Trending, Hot & engagement counters

- **`thinkpages-trending` cron job** (`src/lib/thinkpages/trending-cron.ts`, every 15 min, schedule override `cronSchedule_thinkpagesTrending`; off unless listed in `CRON_ENABLED_JOBS`). It scores each post from the real reactions (`PostReaction`), public replies, reposts and views it received in the last 72 h. Weights are reaction 1, reply 2, repost/quote 3 and view 0.25 per distinct viewer, and each event halves every 12 h (a day's views count as made at midday). Engagement from any persona of the post author's own user is ignored, and each user counts once per kind per post. Tunables live in `TRENDING_CONFIG` (`src/lib/thinkpages/trending.ts`).
- **Post views** (`src/lib/thinkpages/post-views.ts`, SL-8): opening `/thinkpages/post/[postId]` signed in calls `thinkpages.recordPostView` (light mutation). A view counts once per viewer per post per UTC day, never the author's own, on public and unlisted posts only. The per-day claim is a Redis `SET NX` (2-day expiry) when Redis is ready, else an in-process set (so without Redis, each web process dedupes on its own). Counted views collect in a pending tally (Redis hash or memory) that is flushed in batches, once a minute or every 100 views from the recording process and at the start of every trending run, into `ThinkpagesPostViewDay` (views per post per day, read by the score) and `ThinkpagesPost.impressions` (the lifetime count shown as views).
- **Trending posts**: public, top-level posts (not replies or plain reposts) with a score of at least 3 are ranked, and the top 25 get `trending = true`; every other post is cleared. Each eligible post's score is stored in `ThinkpagesPost.trendingScore`, and scores outside the window reset to 0.
- **Feed filters** (`thinkpages.getFeed`): `trending` lists only flagged posts, by score. `hot` lists all posts, pinned first and then by `trendingScore`, newest among equals. `recent` is newest first. The `/dashboard` **Trending** tab shows the flagged posts and trending hashtags. When nothing qualifies it shows an empty state ("Nothing is trending right now"), with no recency fallback.
- **Trending topics** (`TrendingTopic`): hashtags on public posts from the window, grouped case-insensitively. A hashtag needs at least 2 posts by at least 2 users. The top 10 by `postCount + engagement` are `isActive`; the rest are deactivated. `peakTimestamp` records when a topic last hit a new high. `activities.getTrendingTopics` reads these rows for the `/feed` "Trending Now" list and the Trending tab chips. A topic shows as rising if it peaked in the last 6 h.
- **Unified trending** (`activities.getUnifiedTrending`, dashboard sidebar): the ThinkPages source is the posts with `trendingScore > 0`, by score (views included). Activity rows have no view tracking, so the IxStats source takes the newest public rows of the last 48 h and scores them by type, likes, comments and shares.
- **Engagement counters**: `likeCount` mirrors the `like` entry of the `reactionCounts` tally and is written by every reaction add, change and remove. `createPost` increments the parent's `replyCount` and the original's `repostCount`, and `deletePost` decrements them (never below 0). Other writers (Discord import, ThinkTanks, auto-posts) don't maintain them, so the cron job also reconciles all three counters with the real rows on every run.

### Activity feed producers (`ActivityFeed`)

The global activity feed (`activities.getGlobalFeed`, `/feed` and the dashboard) merges `ActivityFeed` rows with
ThinkPages posts, wiki and forum activity. The rows come from `src/lib/activity/hooks.ts` (`ActivityHooks`) and
`src/lib/activity/generator.ts`, and each producer is called where its game event happens. Every producer is best
effort: a failed write is logged and never fails the action that triggered it.

| Feed filter | Event | Called from |
| :--- | :--- | :--- |
| Diplomatic | Embassy established | `diplomacy/embassies/establish.ts` |
| Diplomatic | Public alliance founded / joined (accepted invite) | `diplomacy/policies/alliances.ts`, `alliance-invite-procedures.ts`; private and secret alliances post nothing |
| Economic | Economic milestone: the stored economic tier changes (GDP per capita crossed a tier threshold) | `stat-progression` cron job and the admin force recalculation (`onEconomicTierChange`) |
| Economic / Achievements | A bill passes and becomes law (Economic when it has a GDP effect) | `legislation.holdVote` |
| Achievements | Achievement unlocked | `lib/achievements/service.ts` |
| Social | Nation founded in the builder / nation claimed in a realm | `countries.createCountry`, `realms` claim side effects |
| Social | Onoma name generation and dictionary sharing | `onoma/namebank.ts` |

Producers with no real event behind them (diplomatic missions, trade agreements, budgets, tax reforms,
infrastructure projects, military branches, security threats, government components and effectiveness, ThinkPage
posts, country follows and sign-ups) were deleted (SL-7). The `achievements` filter matches rows of type
`achievement`.

### Social notifications

Notifications are keyed by Clerk user id. The recipient is always the **owning user** of the target persona, never the persona id, and a user is never notified about their own personas. Titles name the acting persona (display name, else `@username`), and every link goes to `/thinkpages/post/<id>` (base path applied).
- **Like** (`reactions/mutations.ts`) and **reply** (`createPost`): "*Persona* liked / commented on your ThinkPage".
- **Mention** (`createPost`): one notification per mentioned user ("*Persona* mentioned you"), linked to the new post. Mentions are still recorded in `PostMention`.
- **Repost / quote** (`createPost`): "*Persona* reposted your post" links to the original; "*Persona* quoted your post" links to the quoting post.
- Mention, repost and quote notifications are sent only for `public` and `unlisted` posts, since only the author can open private and draft posts.

---

## 2. Account Manager & Discord Bridge

- **Multi-Account Switching**: Each user owns up to 25 persona accounts (government, media, citizen; `accounts.ts`), each tied to a country the user can write to, managed from the `/thinkpages` account hub; the composer switches identities with a single click without logging out.
- **Personal persona ("post as yourself")**: Each user can also have exactly one personal persona: a `ThinkpagesAccount` with `accountType: "personal"` and **no `countryId`** (`thinkpages/personal-account.ts`). One per user is enforced by the `ThinkpagesPersonalAccount` row (primary key = Clerk id, `prisma/schema/social-follows.prisma`). It is created on first use by `api.thinkpages.ensurePersonalAccount` (username from the IxnayID username, then forum/wiki name, sanitized and de-duplicated), read with `getMyPersonalAccount`, and does not count toward the 25-account cap. Its type cannot be changed and it starts unverified. The composer's identity picker offers **Post as yourself** when the user has none yet, and users with no country can post through it (the composer no longer requires a country). Readers that look for "the user's nation via their ThinkPages account" skip it (`countryId: { not: null }` in `identity.resolve.ts`, `users/profile.ts`, `ixnayid/core.ts`); post cards show no country for it.
- **Follows**: Personas follow personas (`ThinkpagesFollow`, unique per follower/followed pair). `api.activities.followPersona` / `unfollowPersona` take the persona to follow and, optionally, which of the caller's own personas follows; by default the caller's personal persona follows (created on the first follow). You cannot follow your own personas. The row and the `followerCount` / `followingCount` increments or decrements happen in one transaction; a repeat follow is a no-op. A new follow notifies the followed persona's owner (by Clerk id, `category: "social"`, linking the follower's profile); imported `system_` personas get none. Profiles (`api.thinkpages.getAccountProfile`, page `/thinkpages/profile/[username]`) count followers, following and public posts from rows rather than trusting the stored counters, and never return the owner's Clerk id. Post cards open an author card with the same counts and a **Follow** button.
- **Following feed**: The dashboard's Following tab (`api.activities.getFollowingFeed`) merges posts from personas the user follows (from any of their personas) with activity and posts from countries their country follows. It is shown to every signed-in user; persona follows need no country.
- **Automated Discord Syndication**: Publishing a public post autoposts it to the Discord IxTwitter channel (`postToDiscord`, default on) and can mirror it to a dedicated `#thinkpages` Discord feed (`src/lib/discord/thinkpages-feed.ts`). The mirror is **off by default** (`ThinkpagesDiscordFeedConfig.enabled = false`) and there is no admin save procedure or UI (only `getThinkpagesDiscordFeedConfig`), so it cannot be enabled from the app.
- **Discord → ThinkPages Sync**: IxTwitter channel messages are imported into the feed (`syncIxTwitterToThinkPages`; the bulk import runs from the PM2 script `scripts/run-ixtwitter-sync.ts`), reactions mirror to Discord, and the feed reads the Discord channel topic and custom server emoji (`getDiscordChannelTopic`, `getDiscordEmojis`).

---

## 3. ThinkTanks Collaborative Workspaces (`/thinktanks`)

ThinkTanks are dedicated research and policy drafting rooms for alliances, international coalitions, and co-authors:
- **Group Feed**: Asynchronous notes, lore drafts, and critique requests with quick intent tags.
- **Role-Based Membership**: Group ownership, admin/member roles, invitations, and member roster management.
- **Realm Boards**: every realm has a board ThinkTank at `/r/[realm]/board`. Anyone can read it, owners of a nation in the realm post there, and its posts also appear in the realm-filtered feed (`thinkpages.getFeed({ realmId })`). See [ThinkTanks §4a](./thinktanks.md#4a-realm-boards-type-realm_board) and [Realms](./realms.md).
- **Joint Working Papers and group chat**: the workspace mounts a Docs tab (`ThinktankPapersTab`, `CollaborativeDoc` CRUD) and a Chat tab on the group's linked ThinkShare conversation (see [ThinkTanks](./thinktanks.md#pillars-34-chat-and-docs)).

---

## 4. ThinkShare Real-Time Messaging (`/messages`)

All platform direct messaging runs on the unified ThinkShare infrastructure:
- **Message Types**: Personal 1:1 DMs, Diplomatic and official cables, Group rooms, and pinned **System / LoreBot** streams.
- **Classification Tiers**: `PUBLIC`, `RESTRICTED`, `CONFIDENTIAL`, `SECRET`, `TOP_SECRET` (metadata on diplomatic/official conversations and messages). They can be written only through the admin `sendAdminMessage`; `createConversation` accepts `diplomaticClassification` but drops it, so diplomatic conversations cannot be created with a tier from the UI.
- **Security**: The schema reserves `signature` and `encryptedContent` message fields and an `encrypted` conversation flag, but no signing or end-to-end encryption is implemented yet; access is enforced by participant checks.
- **Requests, Seen and online (SL-4)**: a direct message from outside the recipient's audience lands in their **Requests** folder (`ConversationParticipant.requestStatus`, `messages.respondToRequest`); direct conversations show **Seen** when both people allow read receipts (`messages.getSeenState`); a green dot marks participants who are online and share it (`server/shared/presence.ts`). Details: [Settings](./settings.md#privacy--security-privacy--privacysecuritypanel).
- **Caching**: Feed pages are cached in `globalCache` (15 s TTL) and invalidated by pattern (`thinkpages_feed:*`) on new posts.

---

## Related Documentation

- [ThinkTanks Collaborative Groups Guide](./thinktanks.md)
- [Diplomacy System Guide](./diplomacy.md)
- [Forum Integration](./forum.md)
- [API Reference: ThinkPages & Messages](../reference/api-complete.md)
