# Social & Core Apps Audit — ThinkPages / ThinkShare / ThinkTanks, notifications, Halo, Facet, IxTime, MyLeague/MyClub, forum, help/admin, Labs

**Repo:** `/home/user/ixstats` · branch `rose-garden` @ `e91e6b0b2` (Merge PR #46) · audited 2026-09-30 · read-only.
**Method:** read docs listed in the brief, then verified against `prisma/schema/*.prisma`, routers, modules, components and pages with grep, line counts and caller counts. Where code and docs disagree, the code wins. Items already in `docs/roadmap/code-audit-2026-09-30.md` are cited by their ID (SL-*, PL-*, WK-*). Items marked **NEW** are not in that audit or in pending-features.md.

---

## 0. Executive summary

- **The social stack is bigger than it is sticky.** About 3,750 lines of ThinkPages routers, 720 lines of message routers plus a 2,208-line messaging module, 10.5k lines of ThinkPages components, and 28 Prisma models in `social.prisma`. The **posting loop works**: personas, posts, replies, reposts, reactions, polls, images, hashtags, and Discord cross-posting. **The loops that bring people back are broken or missing.** There are no person or persona follows. **All three ThinkPages notification types are broken** (like, reply, mention). There is no bookmarks view and no moderation queue. Trending is always empty. Nothing is scoped to a realm. You can't post "as yourself", and you can't start a DM "as a country" from the UI.
- **Owner's questions, answered from the code:**
  | Can a user today… | Answer | Evidence |
  |---|---|---|
  | post in-character | **Yes**, through country-bound personas (government/media/citizen) | `thinkpages/accounts.ts`, `posts/posts/create.ts` |
  | post as themselves (IxnayID/username) | **No.** Every `ThinkpagesAccount` needs a `countryId`, and the hub blocks users with no country (`ThinkPagesAccountHub.tsx:56-78`) | `social.prisma` `ThinkpagesAccount.countryId String` (required) |
  | manage multiple personas | **Yes**, 25 per user (and per-country type caps of 17/5/10) | `accounts.ts:117-171` |
  | run polls | **Yes**, attached to posts; no end date/expiry from the composer | `create.ts:84-95`, `polls/voting.ts` |
  | follow people | **No.** Only country→country follows exist (`CountryFollow`); persona `followerCount`/`followingCount` never change (SL-9) | `core.prisma:560`, `activities/follows.ts` |
  | DM as a country | **Only implicitly.** Every DM shows your country name and flag (`pickDisplayName` puts country first). The UI "diplomatic" path is dead code, so a diplomatic conversation can't be created from `/messages` (**NEW**) | `display-names.ts:20-28`, `MessagesRouter.tsx:491`, `MessagesFolderNav.tsx:28-43` |
  | run a ThinkTank | **Partly.** Create, join, invite (by raw Clerk ID), group feed, roster and settings work. Chat and Docs are not reachable | `thinktanks/*.ts`, `ThinktankHeader.tsx:27` |
- **New security and integrity findings (this audit):**
  1. Anyone can create persona accounts attached to **any** country.
  2. Users can self-grant the **verified** badge.
  3. `sendMessage` **auto-joins** a non-participant into any group or ThinkTank conversation.
  4. The public `searchUsers` returns full `User` rows, including `clerkUserId`, `discordUserId` and `lastSeenAt`.
  5. `getPost` ignores visibility (private, draft and private-ThinkTank posts can be read by ID).
  6. `sendAdminMessage` writes a non-existent `subject` column on conversation create.
  7. Like notifications are addressed to a persona ID rather than a user.
  8. The feed likely double-counts reactions.
- **Core apps:** IxTime is a clean, heavily shared library (91 importing files). Facet is CSS plus `src/components/ui`. Halo is **not** a design-system primitive: it is an app-coupled shell with tRPC and app imports. Stash and Repository are owned by **WikiOS**, but they act as cross-app media and library services.

---

## 1. Inventory

Status key: **working** = end-to-end in UI · **partial** = UI exists, loop incomplete · **stub** = UI or schema with fake or no behaviour · **dead** = no callers or no UI.

### 1.1 ThinkPages (feed, posts, personas)

| Subsystem | Status | Paths | Evidence |
|---|---|---|---|
| Persona accounts | **working**, with integrity holes | `server/api/routers/thinkpages/accounts.ts` (270 L); `components/thinkpages/{ThinkPagesAccountHub,EnhancedAccountManager,AccountCreationModal,AccountSettingsModal}.tsx`; route `/thinkpages` | Types are `government\|media\|citizen` only (`accounts.ts:8`). 25/user cap (`:117`); per-country caps citizen 17 / gov 5 / media 10 (`:158`), which add up to 32, more than the 25 cap. **NEW:** `createAccount` only checks that the country *exists* (`:139-148`) and never that the caller owns it, so any user can run personas "for" any nation. **NEW:** `verified` is taken from client input on create (`:17`) and update (`:34`). The settings modal has a user-facing "verified" switch (`AccountSettingsModal.tsx:115-123`), and government accounts are auto-verified on create (`AccountCreationModal.tsx:370`). `postingFrequency`/`politicalLean`/`personality` are stored but read by nothing outside the account UI (**dead config**). `getAccountsByCountry` is public and returns full rows, `clerkUserId` included. |
| "Post as yourself" | **absent** | — | There is no user-level account. The only fallback is in ThinkTanks: `createGroupPost` silently creates a `citizen` persona named after the user. When the user has no country it uses `countryId = (await db.country.findFirst())?.id`, so an arbitrary nation (`thinktanks/groups.ts:618-641`) (**NEW**, hard-coded hack). |
| Post create/edit/delete/pin | **working** | `posts/posts/{create,modify,queries}.ts` (408/311/233 L); composer `components/thinkpages/composer/*`, `GlassCanvasComposer.tsx` | Replies, reposts, quote reposts, up to 4 images (`/api/upload/image` writes to local disk), "visualizations" (8 chart types), polls, mentions, hashtags. Earns 1 IxC for each of the first 5 posts/day per account; a user-level cap also exists in `vault-ledger.ts:124`. Social timestamps are real time (`create.ts:162`). |
| Reactions | **working**, with a count bug | `posts/reactions/{mutations,queries}.ts` (326/270 L) | 7 native reactions plus `discord:*` emoji (`mutations.ts:20-26`). The toggle and the change are transactional and mirrored to Discord. **NEW (likely bug):** `addReaction` increments the stored `reactionCounts` JSON *and* creates a `PostReaction` row. `thinkpages.getFeed` (`feed.ts:258-270`) and `activities.getGlobalFeed` `mergeReactionCounts` (`global.ts:41-55,484`) then add the rows on top of the JSON baseline, so native reactions count twice. Confirm at runtime. |
| Feed | **working** (recency only) | `thinkpages/feed.ts` (356 L), `activities/feed/{global,personal}.ts`, `activities/trending.ts`; UI `/dashboard` (`UnifiedFeedContent.tsx`), `/feed` (`app/feed/_components`), `/hashtags/[tag]` | The `trending` filter queries `trending: true`, which **no code ever sets** (`feed.ts:156`; only the achievement reads it), so it is always empty. `hot` == `recent`. The "Following" feed is **country-follow based** (`personal.ts:20-27`). There is no realm filter (`Country.realmId` exists; the feed ignores it). Two feed surfaces coexist: `/dashboard` (ThinkPages plus activity) and `/feed` (activity-only, with like/comment/share counters that are display-only). `ActivityLike/Comment/Share` have **0 reads and 0 writes** (**dead**). |
| Polls | **working** (basic) | `polls/{voting,management,discord,post-to-discord}.ts` (417 L), `ComposerPollModal.tsx`, `FeedPollWidget` | Votes are keyed by `clerkUserId`, not persona, which is good for integrity. The composer has no `endDate`, so user polls never close. Admin polls are separate (`management.ts` adminProcedure). |
| Hashtags | **working** | `/hashtags/[tag]`; `hashtags` stored as a JSON string, matched with `contains:"\"tag\""` | `TrendingTopic` model: **0 reads, 0 writes** (**dead**). |
| Mentions | **partial** | `create.ts:255-293` | `PostMention` is written (0 reads). The notification is broken (see §1.4). |
| Bookmarks | **stub** (write-only) | `posts/bookmarks.ts` | SL-10. **NEW:** `userId` comes from the input, not `ctx` (`bookmarks.ts:10-12`), so a caller can write bookmarks for other users. `PostBookmark` has 0 reads. It is a parallel "save" system to Stash (§5.4). |
| Flags / moderation | **stub** | `posts/flags.ts` | SL-10. The only read is the de-dupe check; there is no admin queue. |
| Discord bridge (IxTwitter) | **working** (ops-dependent) | `lib/discord/ixtwitter-sync.ts` (1,300+ L), `scripts/run-ixtwitter-sync.ts` | Outbound autopost (default on), edit/delete/reaction sync. Inbound import runs only from a PM2 script (`ecosystem.config.cjs` is untracked, PL-12). It is not a cron job in `server/cron/jobs.ts`. |
| `#thinkpages` Discord mirror | **stub for admins** | `lib/discord/thinkpages-feed.ts`, `routers/admin/thinkpagesDiscordFeed.ts` | `ThinkpagesDiscordFeedConfig.enabled` defaults to `false`. The admin router has **only a getter** (`thinkpagesDiscordFeed.ts:22`); there is no save and no UI (WK-10). It can only be switched on by editing the DB. |
| Admin ThinkPages settings | **stub** (inert) | `app/admin/_components/ThinkPagesSettingsContent.tsx` (324 L), `routers/admin/thinkpages.ts` | It saves `thinkpages_maxAccountsPerUser`, `maxCharLength`, `feedLimit`, `autoNews*` and `commentAttachments` to config, but **no code reads those keys** (grep: 0 hits outside the admin router). The real limits are hard-coded (25 accounts, 10,000 chars). Covered generally by WK-11. |
| Auto-generated posts | **mixed** | Writers: `blurbs/respond.ts`, `lib/diplomacy/news-generator.ts`, `lib/intent/intent-summation.ts`, `lib/sports/{transition,feed-post}.ts`, `ixtwitter-sync.ts` | `lib/activity/auto-post.ts` (4 exported generators) has **0 callers** (**dead, NEW**). |
| `CountryMoodMetric` | **dead** | `social.prisma` | 0 reads and 0 writes. |

### 1.2 ThinkShare (messages)

| Subsystem | Status | Paths | Evidence |
|---|---|---|---|
| 1:1 and group DMs | **working** | `routers/messages/{conversations,participants,messaging}.ts` (720 L), `server/modules/messaging/*` (2,208 L), `components/messages/*` (16 files, 4,195 L), `/messages` | Realtime over socket.io `/ws/thinkpages` (`useThinkPagesWebSocket`, `websocket-server.ts:48` with a Redis fallback broadcaster). Edit, delete, reactions, read state, Stash attachments, and "upgrade to group" (which creates a *new* conversation, so history is not carried). |
| Identity in DMs | **partial** | `modules/messaging/account-resolver.ts`, `server/shared/display-names.ts:20-28`, `MessagesIdentityBadge.tsx` | A sender is always the **User**. The display name resolves country name → forum → wiki → persona. There is no persona or "as username" choice. `resolveIdentity` switches the label for `diplomatic`/`wiki`/`forum` sources. |
| Diplomatic channels, classification | **stub** | `conversations.ts:118-147` | The input accepts `conversationType`, `diplomaticClassification`, `priority`, `encrypted` and `channelType`, but the handler passes **only** `participantIds`, `name` and `source` to the service (**NEW**). The UI only sets `source:"diplomatic"` when `activeFolder === "diplomatic"`, but `MESSAGE_FOLDERS` has only `"conversations"` and `getFolderFromPathname` always returns `"conversations"`, so the **diplomatic create path can't be reached** (**NEW**). Classification is displayed if present (`MessagesBubble.tsx:293`) but can only be set through `sendAdminMessage`. |
| Encryption and signatures | **dead fields** | `ThinkshareMessage.signature/encryptedContent`, `ThinkshareConversation.encrypted` | Decision D7. |
| Forum and wiki bridges | **working** | `modules/forum/services/forum-bridge.ts` (`syncInbound`/`sendOutbound`), `wikiTalkBridge` | XenForo conversations and wiki talk appear in ThinkShare. `/forum/conversations*` redirects to `/messages`. |
| User search | **working, over-exposed** | `participants.ts:127-147` | **NEW:** `publicProcedure` (callable signed out) returns full `User` rows plus the `Country` row: `clerkUserId`, `roleId`, `membershipTier`, `discordUserId`, `lastSeenAt`. `lastSeenAt` leaks what the "online status" privacy toggle claims to hide (SL-4). Only users **with a country** can be found, so countryless users can't be DMed. |
| Auto-join on send | **security bug** | `modules/messaging/message-operations.ts:57-67` | **NEW:** if the caller isn't a participant and the conversation is `source==="thinktank"` or `type==="group"`, `sendMessage` **creates a participant row for them**. Any signed-in user who knows a group-DM ID or a ThinkTank group ID (the lookup also matches `thinktankGroup.id`, `:39-43`, and group IDs are listed publicly) can write into a private ThinkTank chat or anyone's group DM. |
| Admin DM | **bug** | `conversation-operations.ts:215-260` | **NEW:** `sendAdminMessage` creates `thinkshareConversation` with `subject:` (`:241`), but the model has no `subject` column (`social.prisma` `ThinkshareConversation`). The first admin DM to a new user should fail with Prisma "Unknown argument". `formatters.ts:122-124,253` also reads `conv.subject`. |
| DM notifications | **working**, small bug | `message-operations.ts:100-118` | The notification href is `/messages?id=…`, which is correct. It looks up participants with `input.conversationId` rather than the resolved `targetConvId`, so sends addressed by group ID or source ID notify no one. |
| Presence | **partial** | `UserPresence` (1 write, 1 read) | Not governed by the privacy toggle. |
| `ThinktankMessage` | **dead** | `social.prisma` | Written only by the demo seed. |

### 1.3 ThinkTanks (groups)

| Subsystem | Status | Paths | Evidence |
|---|---|---|---|
| Create, edit, delete, settings | **working** (authorization fixed in #38) | `routers/thinkpages/thinktanks/{groups,access,membership,documents}.ts` (725/136/272/239 L); `components/thinktanks/*` (9 files, 2,823 L); `/thinktanks`, `/thinktanks/[groupId]` | `requireGroupManager`/`requireGroupMember`/`requireGroupReader` in `access.ts`. Test: `src/tests/server/api/routers/thinktanks-auth.test.ts`. |
| Group feed | **working** (hacky storage) | `groups.ts:522-680` | Group posts are `ThinkpagesPost` rows with `visibility:"thinktank"` and a `group:<id>` pseudo-hashtag, queried by `hashtags contains`. They are stamped with **IxTime** (`:657`), while the main feed uses real time, so the same table holds two clocks. |
| Personas in groups | **partial** | `access.ts:108-136` | With persona posting off, "post as yourself" silently uses the user's **oldest** persona, which may be a government or media account (`groups.ts:615-620`). The doc's persona types `Institution`/`Character` don't exist. |
| Invites | **partial** | `groups.ts:682-725`, `membership.ts:57-83` | SL-13 is partly fixed: joining a private group now consumes an invite. However, the invite UI takes a **raw Clerk user ID** typed into a text box (`ThinktankSettingsModal.tsx:155-157`). There is no username search, no pending-invite list, and no invite code (`inviteCode` is never written). The `thinktankInvites` privacy preference (`users/preferences.ts:39`) is not enforced. |
| Chat | **unreachable** | Each group gets a `ThinkshareConversation` with `source:"thinktank"` (`groups.ts:42-50`), but `/messages` **explicitly filters those out** (`MessagesConversationPanel.tsx:73`) and the workspace has no chat tab (`ThinktankHeader.tsx:27` `"feed" \| "roster"`). | SL-22. |
| Docs | **built, not mounted** | `ThinktankPapersTab.tsx` is imported in `ThinktankWorkspace.tsx:17` but never rendered | pending-features §3. |

### 1.4 Notifications

| Item | Status | Evidence |
|---|---|---|
| Infra | **working** | `lib/notifications/*` (2,736 L), `routers/notifications/*` (801 L), `Notification` model (`core.prisma:388`), Halo `NotificationsView.tsx`, admin composer/registry/test suite (`app/admin/notifications/_components`, ~2.6k L). |
| Hook usage | **mostly dead** | 12 of 23 `on*` hooks have **0 callers** (onActivityRingGoal, onAdminAction, onBudgetAlert, onCrisisDetected, onDefenseEvent, onEconomicCalculation, onEconomicDataChange, onIntelligenceAlert, onPolicyChange, onSecurityEvent, onTierTransition, onTradeEvent). This matches SL-6. |
| **ThinkPages notifications** | **all broken** | **Like:** `targetUserId: postWithAuthor.accountId`, which is a *persona* ID, not a Clerk ID (`reactions/mutations.ts:203-210`), so it goes to nobody (**NEW**). **Reply:** the href is `/thinkpages/${id}` (`notifications/api.ts:237`), but the route is `/thinkpages/post/[postId]`, so it 404s (**NEW**; SL-11 only covers mentions). **Mention:** the href is `/content/${id}` and the text is "Someone" (`hooks.ts:283-294`, SL-11). Follow, share and repost notifications: none. |
| Preferences | **unenforced** | SL-5 (still true: there is no category filter in `notificationAPI.create`). |
| Halo "Mark all read" | **bug** | The palette command clears only the local store (`halo/hooks.ts:240-243`, SL-20); the tray button does call the server (`NotificationsView.tsx:233`). |

### 1.5 Halo, Facet, IxTime (details in §5)

| Item | Status | Evidence |
|---|---|---|
| Halo | **working**, 2 known bugs | `components/halo/` (50 files, 10,468 L). Mounted as `CommandPalette` in `app/_components/navigation.tsx:159,239`. Plugins: wiki, forum, mycountry, builder, sports (global). **No ThinkPages, Messages, ThinkTanks, Vault or Maps plugin.** "Sign Out" links to `/sign-out`, which **has no route** (`halo/hooks.ts:157`; there is no `src/app/sign-out`) (SL-19 still open). |
| Facet | **working** | `src/styles/facet.css` + `src/styles/facet/{core,components,physics}.css` (2,226 L); `src/components/ui/` (85 files, 12,568 L) incl. `ui/facet/{tabs,swipeable,shared,hooks}`; Cuelume `src/lib/sound/cuelume.ts` (166 L, 94 importing files). `facet-` used in 342 TSX files; legacy `glass-` classes in 33. |
| IxTime | **working** | `src/lib/ixtime/` (2,144 L: `core.ts` 730, `sync.ts` 611, `accuracy.ts` 626, `weather.ts`, `range.ts`), `stores/ixtime-store.ts`, `context/IxTimeContext.tsx`, REST `app/api/ixtime/{current,health,set-natural,set-override,sync-from-bot}`. 91 importing files. Epochs `REAL_WORLD_EPOCH` 2020-10-04 → `IN_GAME_EPOCH` 2028-01-01, 4x then 2x (`core.ts:15-22`). 15 s sync (`sync.ts:192-197`). |

### 1.6 MyLeague / MyClub (see §4)

**Working (Labs).** Routers `sports/` 4,265 L; `src/lib/sports` 9,335 L; `components/sports` 65 files, 13,822 L; admin `app/admin/myleague` 2,357 L; 18 Prisma models (`sports.prisma`); cron `sports-season-advance` (`server/cron/jobs.ts:110`).

### 1.7 Forum (XenForo), Help, Admin CMS, Labs

| Item | Status | Evidence |
|---|---|---|
| IxForum | **working** | `routers/forum/*` (1,120 L, 21 procs), `modules/forum/*` (1,648 L), `(forum)/forum/*`. Read, write, react, stash and search. Linking with HMAC proof (`ixnayid/linking.ts`, `forum-link-verification.ts`). No SSO; moderation and alerts removed. The doc is accurate. |
| Help | **partial** | 54 md files in `src/content/help`, 41 registered. **Overclaims in help copy (NEW):** `social/thinkshare.md:28` says diplomatic channels support "encrypted messaging" (they don't; the UI can't even create one). `thinkshare.md:12` "Contextual Identity" is only partly true (see §1.2). `social/thinktanks.md:11` promises "upload files, and track progress", which doesn't exist. |
| Admin CMS | **partial** | 39 sections via `AdminRouter.tsx`. The ThinkPages settings are inert (above). The PL-1 audit log fix is merged per SYSTEM_STATUS. |
| Vexel | **Labs, partial** | `lib/heraldry` + `routers/heraldry` 1,624 L; ~3k L UI; 3 models. Not in the nav config (grep `vexel` in `navigation-config.ts` = 0). |
| Onoma | **Labs** | Large (the `app/labs/onoma` tree is ~20k L). Out of scope beyond noting that its Stash tab reuses `api.wikios.getStashes`. |

---

## 2. Docs vs code

| Doc (file:line) | Claim | Reality (code) |
|---|---|---|
| `docs/systems/social.md:6` | "Status: 📀 Gold Master (100% Ready)" | SYSTEM_STATUS.md replaced the Gold Master matrix. ThinkTanks is partial, follows don't exist, notifications are broken. Same stale header in `halo.md:6` and `ixtime.md:5`. |
| `social.md:16` | "verified nation tags to establish authority" | Verified is self-toggled by the account owner (`accounts.ts:34,66`; `AccountSettingsModal.tsx:123`). |
| `social.md:24` | "Each country owns multiple persona accounts" | Accounts are owned by the Clerk user and **tagged** with an unchecked `countryId` (`accounts.ts:139-148`). |
| `social.md:25` | Mirrors to the "admin-configured `#thinkpages` Discord feed" | Disabled by default; there is no admin save procedure or UI (`thinkpagesDiscordFeed.ts` getter only). |
| `social.md:43` | Classification tiers as conversation metadata | They can only be written through `sendAdminMessage`; `createConversation` drops them (`conversations.ts:139-146`). |
| `social.md` (whole) | — | Doesn't mention: the `/feed` activity page, country-follow "Following" feed, Blurbs posting as auto posts, the IxCredits post reward, the 25/17/5/10 caps, or that the IxTwitter import runs from a PM2 script. |
| `docs/systems/thinktanks.md:6` | Design system route `/apple-design` | No such route in `src/app`. |
| `thinktanks.md:80` | Personas `Citizen`, `Institution`, `Government`, `Character` | Only `government`/`media`/`citizen` (`accounts.ts:8`). |
| `thinktanks.md:89` | Chat "not started" | The backend exists (a conversation per group, `sendMessage` accepts a group ID), but the UI hides it (`MessagesConversationPanel.tsx:73`). |
| `thinktanks.md:166-170` | Inputs `createdBy`, `userId`, `invitedBy` | Removed in #38; these now come from `ctx.auth.userId` (`membership.ts:11-19`, `groups.ts:682-691`). |
| `thinktanks.md` §6 | "Direct invitation dispatch by username or user ID" | Raw user ID only (`ThinktankSettingsModal.tsx:155-157`). |
| `docs/systems/halo.md:8,…` | Halo is a "first-class primitive of the Facet UI Design System" | Facet primitives don't import Halo. Halo imports `trpc/react` (11), `app/builder` (11), `wiki-os` (15), stores and auth. It is an app shell (§5). |
| `halo.md` (tree) | "All files … ≤700 line ceiling" | True (largest is `WikiNarratorPlayer.tsx` at 661). |
| `docs/reference/branding.md:37,393-400` | Halo plugins "Wiki, Forum, Maps, Builder, MyCountry" | Actual: wiki, forum, mycountry, builder, **sports**. There is no Maps plugin (`components/halo/plugins/`). |
| `branding.md:312` | `ThinkPagesStatusWidget.tsx` | No such file in `src/`. |
| `branding.md:306` vs `social.md:5` | Accent `#3b82f6` blue vs "Emerald Jade `#10B981`" | The two docs contradict each other. |
| `branding.md:319` | ThinkTanks "4-pillar model (Feed, Chat, Docs, Members)", model `ThinktankCollaborativeDoc` | 2 pillars are live; the model is `CollaborativeDoc`. |
| `branding.md:320` | "tRPC backfill via `discord-ixtwitter-sync.ts`" | The file is `src/lib/discord/ixtwitter-sync.ts`. The backfill is an archived script (`scripts/archive/migrations/backfill-ixtwitter.ts`), not tRPC. |
| `branding.md:370-375` | Stash Prisma `LoreStash` (30+ fields), `LoreStashItem` | The models are `Stash`, `StashItem`, `StashAnnotation` (`wiki.prisma:263-330`). |
| `branding.md:203` | Repository at `/w/repository/` | The route is `/util/repository` (`app/(wiki-os)/util/repository`). |
| `docs/systems/ixtime.md:37` | accuracy.ts "12 verification suites" in the engine tier | `ixtime.md:350` itself says these were removed from runtime and run only in Jest. The diagram is stale. |
| `CHANGELOG.md:515` | `routers/thinkpages/messaging/{conversations,messages,presence}.ts` | The directory no longer exists (historical entry, but misleading when grepped). |
| `docs/roadmap/code-audit-2026-09-30.md` SL-13 | "invites are write-only (no accept)" | Partly fixed: join consumes the invite (`membership.ts:57-83`). There is still no invite list, code or username lookup. |
| `SYSTEM_STATUS.md` ThinkShare row "✅ Live" | — | Live for 1:1 and group DMs; diplomatic creation from the UI is unreachable and there is an auto-join hole (§1.2). It should be 🟡. |
| `SYSTEM_STATUS.md` Accounts row "✅ Live … Discord mirror" | — | The mirror is off and can't be enabled from the UI. Verified and country ownership are unchecked. |
| `src/content/help/social/thinkshare.md:28` | "encrypted messaging" | Nothing is encrypted (Decision D7). |

---

## 3. Distance to goal: a social layer that makes the platform sticky

**Benchmarks.** NationStates wins on *regions* (a Regional Message Board per region, regional officers, embassies between regions, WA delegate politics), *telegrams* (nation-to-nation mail, including recruitment and mass telegrams), *dispatches* (long-form, upvoted, categorised), and *issues* feeding into all of them. Discord wins on *presence and immediacy*: channels per group, @mentions that actually ping, threads, roles, and bots. IxStates today has neither the NS "place" layer nor the Discord "ping" layer. It has a global Twitter clone.

Gaps are ranked by impact on retention. Existing roadmap IDs are in brackets.

1. **The notification loop is broken (blocker).** Likes go to the wrong ID, replies and mentions 404, and there are no follow, repost or quote notifications. Without "someone replied to you", no feed is sticky. Fix: map persona→`clerkUserId` for every social notification, point hrefs at `/thinkpages/post/<id>`, and render actor names. S–M. [SL-11 + NEW]
2. **No place layer (the Realm/Region RMB).** Countries live in Realms (`Country.realmId`), but the feed, trending, ThinkTanks and sports ignore realms. NationStates' core social unit is the region board. Build per-realm feeds (pending-features §4 "Per-realm ThinkPages feed") and let a realm own a default ThinkTank (its RMB). L. [Realms Phases 2–4]
3. **Identity model: personas are country-bound; there is no "me".** The owner wants to post as an IxnayID username *or* in character, and to DM as a username *or* a country. Today posting requires a country persona and DMs always show the country. Extract "acting identity" into the identity module (`src/server/modules/identity/` already exists) as `{kind: user | country | persona}`, used by posts, DMs and ThinkTanks alike. Fix ownership (a persona's country must be one the user owns, or be flagged as a foreign-correspondent persona) and make `verified` admin- or ownership-derived. M–L. [NEW]
4. **Follows.** There are only country follows; persona and user follows don't exist and the follower counters are fake. For a social product the recommendation is to **build** follows (persona and user), not remove the counters as D8 suggests, because the "Following" tab already exists and is empty for most people. M. [SL-9, D8]
5. **Telegram equivalent: ThinkShare "as a country".** Make diplomatic channels creatable (a folder or toggle in `/messages`), honour `conversationType`/`classification`, add multi-country channels (`createConversationByCountries` exists in the module with 0 router callers), and add realm or region broadcast (the NS mass telegram). Close the auto-join hole first. M. [NEW]
6. **ThinkTanks as real spaces (the Discord replacement).** Surface the existing group conversation as a Chat tab (or stop filtering `source:"thinktank"` in `/messages`), mount Docs, add username invites, invite links (`inviteCode` exists) and pending-invite UI, and add per-group notification settings. Optionally bridge a ThinkTank to a Discord channel the way IxTwitter does. M. [SL-22, SL-13, pending §3]
7. **Discovery and ranking.** Trending never sets `trending`, engagement counters are zero, `TrendingTopic` is dead, and `hot` equals recent. A simple engagement-decay score job would do. M. [SL-7, SL-8]
8. **Safety and moderation.** There is no flag queue, block/mute is unenforced, `searchUsers` over-exposes users, `getPost` ignores visibility, and bookmarks can be written for others. This is required before any growth push. M. [SL-4, SL-10 + NEW]
9. **Long-form (dispatches).** IxForum (XenForo) and WikiOS hold long-form; ThinkPages posts allow up to 10k chars but have no "article" type. Consider a "dispatch" post type that links to or embeds a WikiOS page or forum thread (link previews already exist). S–M.
10. **Discord parity.** The IxTwitter bridge is good. The `#thinkpages` mirror needs its admin save (WK-10). Discord-to-ThinkShare DMs are out of scope, but Discord pings for ThinkPages notifications (via the bot) would bridge where people actually are. M.

---

## 4. MyLeague / MyClub

**What's real (code-verified):**
- **Engine:** 5 dedicated resolvers (`lib/sports/resolvers/{soccer,hockey,basketball,baseball,football}.ts`) plus `racing-resolver.ts` (F1). Boxing falls back to soccer. Seeded RNG (`rng.ts`), ELO (`elo-calculator.ts`), aging and Markov talent (`aging.ts`, `talent.ts`), tactics (7 presets), replayable snapshots (`simulate-and-persist.ts`), promotion and relegation plus the quadrennial World Cup (`transition.ts`), and optional LLM commentary and TTS (`commentary/narrator.ts`, off by default, SL-27).
- **Multiplayer:** leagues are created by a user (`createdByUserId`), who has managerial control (`league-access.ts`). Other users **claim franchises** (`teams.ts:88-177`), gated by Vault purchases: the MyClub license (5,000 credits) plus the Franchise Pass (2,500) for canonical leagues. There is a transfer market with escrowed bids (`transfers.ts`) and MyClub economy features: tickets, sponsors, stadium, training, and patron saints (`club.ts`, 764 L). Match revenue is fixed to pay once (SL-14, #43).
- **Clock:** the IxTime-driven `sports-season-advance` cron (it only runs if listed in `CRON_ENABLED_JOBS`).
- **Platform hooks:** ThinkPages bulletins (`feed-post.ts`, `feed-bulletins.ts`, `SportsBulletinCard.tsx`), trophy card mint, a `StorytellerEffect` from saints, `SportTeam.nationId` → Country, and the global `SportsLiveHalo` live scoreboard.
- **Not real:** prediction placing (settles only, SL-15), rivalry creation (SL-16), standings form column (made up, SL-17), stage config UI and Golden Box double elimination, patron saints in MyClub (admin-only), "Create League/Club" nav links (`navigation-config.ts:452,492` → `/myleague/create`, `/myclub/create`, which have no routes; SL-21), and realm scoping (`sports.prisma` has no `realmId`).

**To make it compelling inside IxStates:**
1. Close the loop with other players. Predictions are placeable (the model and settlement exist), with rivalries auto-created from repeat fixtures and derbies. League chat is a ThinkTank per league (reuse spaces), and match threads auto-post to that league's feed.
2. Tie it to nations. National team call-ups (the World Cup already drafts by nation), sports results feeding country stability or soft power (the saint effects prove the pipe exists), and a realm-scoped canonical league per realm.
3. Close the gap between spectating and managing: a matchday page with live commentary (enable the narrator), plus player cards (the card system exists).

**To stand alone** (a "MyLeague" app outside IxStates):
- Decouple from IxCredits and Vault gating (`checkUpgradeOwned` in `teams.ts`), from Country/Storyteller, and from ThinkPages. The engine (`lib/sports`, 9.3k L) is mostly pure and could become a package.
- It would need its own identity and onboarding (IxnayID only), a public league directory and "join a league" invites (like ThinkTanks), notifications for "your match is live" and "your bid was accepted", and mobile-first matchday views.
- Honest assessment: the simulation depth is already beyond what most hobby sports sims ship. The missing piece is the **social wrapper** (leagues as communities). Build it on the same Spaces primitive as ThinkTanks rather than a sports-only chat.

---

## 5. Core apps: what IxTime, Facet and Halo are in code

There are **no packages or workspaces** (`package.json` has no `workspaces`). Everything is a single Next.js app with `~/` path aliases. "Core apps" today are folders plus conventions.

### 5.1 IxTime (Temporal Engine)
- **Code:** `src/lib/ixtime/*` (pure class `IxTime` + `IxTimeSyncManager`), `src/stores/ixtime-store.ts` (Zustand interpolation), `src/context/IxTimeContext.tsx`, REST `src/app/api/ixtime/*`, and the admin bot router `routers/admin/bot.ts`. The source of truth is the external Discord bot (`sync-from-bot`).
- **Sharing:** 91 files import it: sports cron, elections, issues, ThinkTank group posts, and so on. It is the cleanest candidate to extract as a package: `core.ts` has no DB or React dependencies.
- **Caveat:** an `ixTimeTimestamp` column holds **real** time in many writers (ThinkPages posts, blurbs, news, intent summaries, sports bulletins, security ops, geo sync) and **IxTime** in others (ThinkTank posts, `auto-post.ts`, `club.ts:136`). The name promises game time; the data is mixed. Pick one per table, or rename to `occurredAt` plus `ixTime`.

### 5.2 Facet UI
- **Code:** CSS tokens and physics (`src/styles/facet*.css`, 2,226 L), primitives (`src/components/ui/*`, Radix-based, 85 files, 12.6k L, incl. `ui/facet/` FacetTabs/SwipeableRow/FacetMaterial), Cuelume audio (`src/lib/sound/cuelume.ts`), and two admin labs (`/admin/facet-lab`, `/admin/facet-materials-lab`).
- **Dependency direction:** `ui/*` imports only utils. It is a genuine design-system layer.

### 5.3 Halo
- **Code:** `src/components/halo/` (50 files, 10.5k L): shell (`index.tsx` exports `CommandPalette`), registry (`halo-registry.ts`), hooks, plugin store (`plugin-context.tsx`, `useDIPlugin`), views (compact, expanded, search, notifications, settings, nav tray), and per-app plugins.
- **Dependencies:** `components/ui` (36 imports) but also `trpc/react` (11), `app/builder` (11), `components/wiki-os` + `lib/wiki-os` (15), `stores/notificationStore`, `context/auth-context`. Plugins are registered by `(wiki-os)/layout.tsx`, `mycountry/layout.tsx`, `BuilderRouter.tsx`, `(forum)/forum/layout.tsx` and `GameProviders.tsx` (sports).
- **Verdict:** "Facet UI incl. Halo" matches the docs (`halo.md:8`), **not the code**. Facet is a leaf dependency; Halo sits *above* the apps (it imports builder and wiki code, and calls the notifications and messages routers). Model it as **Facet = design system** (tokens, primitives, motion, Cuelume) and **Halo = the platform shell or system UI** (like macOS Menu Bar and Spotlight). Halo is built with Facet, and every app plugs into it through `DIPlugin`. To make "things just work better", add the missing plugins: ThinkPages/Messages (unread DMs, compose-as), Vault, Maps and ThinkTanks.

### 5.4 Stash and Repository: where they sit
- **Stash:** models `Stash`/`StashItem`/`StashAnnotation` in `wiki.prisma`; router `wikios/stash.ts` + `forum/stash.ts`; UI `/stashes`, `components/wiki-os/stashes`. Content types are `wiki | forum_thread | forum_post` only.
- **Repository:** `routers/commons.ts` (Wikimedia Commons proxy), `components/wiki-os/commons`, `/util/repository`.
- **Shared picker:** `components/wiki-os/media-search/MediaSearchModal.tsx` (tabs: Wiki Repository/Commons, My Stash, Upload). It is imported by **13 files across 6 apps**: builder (2), country header, mycountry (2), sports (3), thinkpages (3), thinktanks (2). Messages attach Stash items (`MessagesStashAttachmentModal.tsx`). Onoma reads Stashes.
- **Parallel systems:** ThinkPages has its own write-only `PostBookmark`. Uploads write to local disk via `/api/upload/image`.
- **Verdict:** Stash and Repository are **data services** (a user library and a media source) consumed by every app, currently housed in WikiOS. They don't belong in Facet, which is presentation. Make them one core service, e.g. **"Library"** (Stash = saved items of any content type including ThinkPages posts, replacing `PostBookmark`; Repository = media sources: Commons, wikis, uploads). Expose them through a Facet-styled picker. Dependency order: Facet ← Library UI ← apps. Library data ← IxnayID (owner).

---

## 6. Taxonomy: does ThinkPages / ThinkShare / ThinkTanks fit the code?

**What the code actually has (data model):**
- **Posts** (`ThinkpagesPost`, `PostReaction`, `Poll`, `MediaAttachment`), authored by **personas** (`ThinkpagesAccount`, bound to a country).
- **Conversations** (`ThinkshareConversation`/`Message`/`Participant`), authored by **users**, with bridges to the forum and wiki.
- **Groups** (`ThinktankGroup`/`Member`/`Invite`/`CollaborativeDoc`). A group owns *a slice of Posts* (via `visibility:"thinktank"` plus a `group:<id>` tag) *and a Conversation* (`conversationId`) *and Docs*.
- A fourth, unlisted surface: **ActivityFeed** (`ActivityFeed`, the `activities` router at 1,743 L, `lib/activity` at 1,943 L, `/feed`) of system events, plus **Blurbs** (write posts) and **IxForum** (long-form, bridged into ThinkShare).
- The router namespace already mixes these: ThinkTank procedures live under `api.thinkpages.*`, while messages are `api.messages.*` and the transport is the "thinkpages" websocket.

**Fit:** broadly right. ThinkPages = broadcast, ThinkShare = private conversation, ThinkTanks = groups. Four adjustments are grounded in the data:

1. **Treat ThinkTanks as a container ("Space"), not a sibling feature.** It already composes a feed channel, a chat conversation and docs. Give Posts a real `spaceId` (and Conversations a `spaceId`) instead of the hashtag hack. The same Space primitive can then back **Realm boards** (the NS RMB), **MyLeague league rooms**, and **alliance or bloc rooms**. That turns one feature into the platform's "place" layer.
2. **Move identity out of ThinkPages.** Personas are a ThinkPages table, but the owner wants them in DMs and Tanks too. Make "Accounts and Personas" part of **IxnayID/Passport** (the `modules/identity` service already aggregates ThinkPages stats, `identity.service.ts:159`). ThinkPages, ThinkShare and ThinkTanks then consume `actingAs`.
3. **Fold ActivityFeed and Blurbs into ThinkPages explicitly.** The system events feed ("the Wire") and Blurbs prompts are feed producers. Today `/dashboard` and `/feed` are two overlapping feeds with different engagement semantics (ActivityLike and friends are dead). One feed with post types (`user | system | sports | blurb | news`) matches what `getGlobalFeed` already merges.
4. **Keep IxForum as its own long-form app** but list it next to ThinkPages as the "dispatches" tier. Its DMs already flow into ThinkShare, which is the right "things just work" seam.

**Proposed tree (grounded in the code):**
```
IxnayID / Passport ── identity, personas (acting-as), follows, privacy, notifications prefs
ThinkPages ─────────── feed: user posts, system wire (ActivityFeed), blurbs, sports/news bulletins, polls
ThinkShare ─────────── conversations: DMs, diplomatic cables (as country), group DMs, forum/wiki bridges
ThinkTanks (Spaces) ── container: space feed + space chat + docs; types: group, realm board, league room, bloc
IxForum ────────────── long-form (XenForo), bridged into ThinkShare
Platform shell ─────── Halo (command, tray, plugins) · Notifications infra
Design system ──────── Facet (tokens, ui primitives, motion, Cuelume)
Core services ──────── IxTime (Temporal) · Library (Stash + Repository + uploads) · Statecraft
Labs ───────────────── MyLeague/MyClub (candidate to graduate to an app on top of Spaces), Onoma, Vexel
```

---

## 7. New findings list (for triage; not in code-audit-2026-09-30)

| # | Severity | Finding | Location |
|---|---|---|---|
| N1 | SEC (M) | `sendMessage` auto-joins non-participants into any `type:"group"` or `source:"thinktank"` conversation, and resolves by ThinkTank group ID | `modules/messaging/message-operations.ts:35-67` |
| N2 | SEC/Integrity (M) | Persona `createAccount` accepts any `countryId` without checking ownership | `routers/thinkpages/accounts.ts:139-148` |
| N3 | Integrity (M) | `verified` can be set by the user on create and update; there is a UI switch | `accounts.ts:17,34,66`; `AccountSettingsModal.tsx:115-123`; `AccountCreationModal.tsx:370` |
| N4 | Privacy (M) | Public `messages.searchUsers` returns full `User` + `Country` rows (`clerkUserId`, `discordUserId`, `lastSeenAt`, `membershipTier`) | `routers/messages/participants.ts:127-147` |
| N5 | Privacy (L–M) | `thinkpages.getPost` ignores `visibility` (private, draft and thinktank posts can be read by ID) | `posts/posts/queries.ts:132-166` |
| N6 | BUG (M) | Like notification `targetUserId` is a persona ID, so nobody receives it | `posts/reactions/mutations.ts:203-210` |
| N7 | BUG (M) | Reply and like notification href `/thinkpages/<id>` has no route (should be `/thinkpages/post/<id>`) | `lib/notifications/api.ts:237` |
| N8 | BUG (M, likely) | Native reactions double-counted (stored JSON + row tally) | `thinkpages/feed.ts:258-270`; `activities/feed/global.ts:41-55,484`; `reactions/mutations.ts:164-178` |
| N9 | BUG (M) | `sendAdminMessage` writes `subject` to `ThinkshareConversation` (no such column) | `modules/messaging/conversation-operations.ts:241` |
| N10 | BUG (M) | The diplomatic DM creation path can't be reached (folder is always `"conversations"`); `createConversation` drops type, classification and priority | `MessagesRouter.tsx:491-498`; `MessagesFolderNav.tsx:28-43`; `routers/messages/conversations.ts:139-146` |
| N11 | BUG (L) | `bookmarkPost` trusts `input.userId` | `posts/bookmarks.ts:8-44` |
| N12 | STUB (M) | Admin ThinkPages settings are saved but never read | `routers/admin/thinkpages.ts:103-108`; 0 consumers |
| N13 | HACK (L) | ThinkTank "post as yourself" auto-creates a persona in `db.country.findFirst()` when the user has no country, or reuses the oldest persona | `thinktanks/groups.ts:612-641` |
| N14 | DEAD (L) | `lib/activity/auto-post.ts` (4 generators, 0 callers); `TrendingTopic`, `CountryMoodMetric`, `ActivityLike/Comment/Share` with 0 reads and 0 writes; persona `postingFrequency/politicalLean/personality` never consumed | as listed |
| N15 | BUG (L) | DM notifications use `input.conversationId`, not the resolved ID (group-ID sends notify no one) | `message-operations.ts:100-102` |
| N16 | UX (M) | ThinkTank invites need a raw Clerk user ID; the `thinktankInvites` privacy preference is not enforced | `ThinktankSettingsModal.tsx:155-157`; `users/preferences.ts:39` |
| N17 | Data (L) | `ixTimeTimestamp` holds real time in most writers and IxTime in others | see §5.1 |
| N18 | Docs (L) | Stale or wrong claims listed in §2 (branding.md Stash models, Halo plugins, StatusWidget, repository route; thinktanks.md personas, `/apple-design`, inputs; help `thinkshare.md:28` encryption) | §2 |

Still open from the prior audit, re-verified: SL-4, SL-5, SL-6 (12/23 hooks), SL-7, SL-8, SL-9, SL-10, SL-11, SL-15, SL-16, SL-17, SL-19 (`/sign-out` missing), SL-20, SL-21 (`/myleague/create`, `/myclub/create`), SL-22, WK-10, WK-11. SL-1, SL-2 and SL-3 are fixed (#38). SL-13 is partly fixed.
