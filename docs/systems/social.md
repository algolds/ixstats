# 💬 ThinkPages — Sovereign Feed, ThinkTanks & ThinkShare

**Parent App Suite:** ThinkPages (`THINKPAGES_VERSION = 2`)  
**Subsystems:** Sovereign Feed, Account Manager, Collaborative ThinkTanks, ThinkShare Messaging  
**Primary Action:** `DELIBERATE` | **Domain Accent:** Blue (`#3B82F6` / `--color-blue-500`, the `/thinkpages` accent in `NavTray.tsx` and [branding.md](../reference/branding.md))  
**Routes:** `/dashboard` (feed), `/thinkpages` (account hub), `/thinkpages/post/[postId]`, `/hashtags/[tag]`, `/thinktanks`, `/messages` | **Status:** see [SYSTEM_STATUS.md](SYSTEM_STATUS.md): feed and Blurbs ✅ Live; Accounts, ThinkShare and ThinkTanks 🟡 Partial  

ThinkPages is the real-time communications and publishing network of IxStates. It pairs public sovereign micro-publishing with multilateral ThinkTank working rooms, automated Discord distribution, and ThinkShare direct messaging.

---

## 1. Sovereign Feed & Micro-Publishing (`/dashboard`)

The **Sovereign Feed** (rendered on `/dashboard`; `/thinkpages/feed` redirects there) is the public town square for national announcements, diplomatic communiqués, breaking news, and community polling:
- **`[blurb:slug|Title]` Blurb Cross-Posts**: [Blurbs](../../src/app/blurbs/README.md) (Topic Tuesday) responses auto-cross-post to the feed with a `[blurb:slug|Title]` prefix and `#blurb` tag; the post card strips the prefix and renders a chip linking back to the prompt. Inline link previews cover Wiki, Forum, League, and Club URLs.
- **Official Seals & Sovereign Identity**: Posts display sovereign state seals, leader titles, and verified tags. Only admins can set the verified flag, and creating an account tied to a country requires write access to that country (`accounts.ts`).
- **National Polls**: Real-time polling widgets let rulers gauge international sentiment and domestic approval with instant visual tallying.
- **Hashtag Indexing**: Hashtags are extracted on submit and each tag has its own page (`/hashtags/[tag]`) aggregating discussions across sovereign borders.

### Trending, Hot & engagement counters

- **`thinkpages-trending` cron job** (`src/lib/thinkpages/trending-cron.ts`, every 15 min, schedule override `cronSchedule_thinkpagesTrending`; off unless listed in `CRON_ENABLED_JOBS`). It scores each post from the real reactions (`PostReaction`), public replies and reposts it received in the last 72 h. Weights are reaction 1, reply 2 and repost/quote 3, and each event halves every 12 h. Engagement from any persona of the post author's own user is ignored, and each user counts once per kind per post. Tunables live in `TRENDING_CONFIG` (`src/lib/thinkpages/trending.ts`).
- **Trending posts**: public, top-level posts (not replies or plain reposts) with a score of at least 3 are ranked, and the top 25 get `trending = true`; every other post is cleared. Each eligible post's score is stored in `ThinkpagesPost.trendingScore`, and scores outside the window reset to 0.
- **Feed filters** (`thinkpages.getFeed`): `trending` lists only flagged posts, by score. `hot` lists all posts, pinned first and then by `trendingScore`, newest among equals. `recent` is newest first. The `/dashboard` **Trending** tab shows the flagged posts and trending hashtags. When nothing qualifies it shows an empty state ("Nothing is trending right now"), with no recency fallback.
- **Trending topics** (`TrendingTopic`): hashtags on public posts from the window, grouped case-insensitively. A hashtag needs at least 2 posts by at least 2 users. The top 10 by `postCount + engagement` are `isActive`; the rest are deactivated. `peakTimestamp` records when a topic last hit a new high. `activities.getTrendingTopics` reads these rows for the `/feed` "Trending Now" list and the Trending tab chips. A topic shows as rising if it peaked in the last 6 h.
- **Unified trending** (`activities.getUnifiedTrending`, dashboard sidebar): the ThinkPages source is the posts with `trendingScore > 0`, by score.
- **Engagement counters**: `likeCount` mirrors the `like` entry of the `reactionCounts` tally and is written by every reaction add, change and remove. `createPost` increments the parent's `replyCount` and the original's `repostCount`, and `deletePost` decrements them (never below 0). Other writers (Discord import, ThinkTanks, auto-posts) don't maintain them, so the cron job also reconciles all three counters with the real rows on every run.

### Social notifications

Notifications are keyed by Clerk user id. The recipient is always the **owning user** of the target persona, never the persona id, and a user is never notified about their own personas. Titles name the acting persona (display name, else `@username`), and every link goes to `/thinkpages/post/<id>` (base path applied).
- **Like** (`reactions/mutations.ts`) and **reply** (`createPost`): "*Persona* liked / commented on your ThinkPage".
- **Mention** (`createPost`): one notification per mentioned user ("*Persona* mentioned you"), linked to the new post. Mentions are still recorded in `PostMention`.
- **Repost / quote** (`createPost`): "*Persona* reposted your post" links to the original; "*Persona* quoted your post" links to the quoting post.
- Mention, repost and quote notifications are sent only for `public` and `unlisted` posts, since only the author can open private and draft posts.

---

## 2. Account Manager & Discord Bridge

- **Multi-Account Switching**: Each user owns up to 25 persona accounts (government, media, citizen; `accounts.ts`), optionally tagged with a `countryId` that is not checked against the user's nations, managed from the `/thinkpages` account hub; the composer switches identities with a single click without logging out.
- **Automated Discord Syndication**: Publishing a public post autoposts it to the Discord IxTwitter channel (`postToDiscord`, default on) and can mirror it to a dedicated `#thinkpages` Discord feed (`src/lib/discord/thinkpages-feed.ts`). The mirror is **off by default** (`ThinkpagesDiscordFeedConfig.enabled = false`) and there is no admin save procedure or UI (only `getThinkpagesDiscordFeedConfig`), so it cannot be enabled from the app.
- **Discord → ThinkPages Sync**: IxTwitter channel messages are imported into the feed (`syncIxTwitterToThinkPages`; the bulk import runs from the PM2 script `scripts/run-ixtwitter-sync.ts`), reactions mirror to Discord, and the feed reads the Discord channel topic and custom server emoji (`getDiscordChannelTopic`, `getDiscordEmojis`).

---

## 3. ThinkTanks Collaborative Workspaces (`/thinktanks`)

ThinkTanks are dedicated research and policy drafting rooms for alliances, international coalitions, and co-authors:
- **Group Feed**: Asynchronous notes, lore drafts, and critique requests with quick intent tags.
- **Role-Based Membership**: Group ownership, admin/member roles, invitations, and member roster management.
- **Joint Working Papers** *(pending)*: `CollaborativeDoc` CRUD procedures and a `ThinktankPapersTab` component exist, but the Docs tab is not yet mounted in the workspace. Real-time group chat is likewise deferred (see [ThinkTanks](./thinktanks.md#roadmap-pillars-deferred--future-phases)).

---

## 4. ThinkShare Real-Time Messaging (`/messages`)

All platform direct messaging runs on the unified ThinkShare infrastructure:
- **Message Types**: Personal 1:1 DMs, Diplomatic and official cables, Group rooms, and pinned **System / LoreBot** streams.
- **Classification Tiers**: `PUBLIC`, `RESTRICTED`, `CONFIDENTIAL`, `SECRET`, `TOP_SECRET` (metadata on diplomatic/official conversations and messages). They can be written only through the admin `sendAdminMessage`; `createConversation` accepts `diplomaticClassification` but drops it, so diplomatic conversations cannot be created with a tier from the UI.
- **Security**: The schema reserves `signature` and `encryptedContent` message fields and an `encrypted` conversation flag, but no signing or end-to-end encryption is implemented yet; access is enforced by participant checks.
- **Caching**: Feed pages are cached in `globalCache` (15 s TTL) and invalidated by pattern (`thinkpages_feed:*`) on new posts.

---

## Related Documentation

- [ThinkTanks Collaborative Groups Guide](./thinktanks.md)
- [Diplomacy System Guide](./diplomacy.md)
- [Forum Integration](./forum.md)
- [API Reference: ThinkPages & Messages](../reference/api-complete.md)
