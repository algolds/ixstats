# Settings

**Last updated:** 2026-10-06
**Status:** Live. Every privacy control is enforced (2026-10-06, SL-4); email and push switches appear when the server
has those channels configured (SL-5). A few other controls are saved but nothing reads them yet; they are marked
**display-only** below.
**Route:** `/settings?tab=<id>` (sign-in required)
**Code:** `src/app/settings/` (`page.tsx`, `_components/SettingsContent.tsx`, `_components/panels/*`,
`_hooks/useProfileSettings.ts`, `_lib/sections.ts`), `src/components/settings/`,
`src/server/api/routers/users/preferences.ts`, `src/server/api/routers/notifications/preferences.ts`

One page, ten panels. The tab ids are `SETTINGS_TAB_IDS` (`_lib/sections.ts`); the sidebar's Settings app in
`src/lib/navigation/app-sections.ts` holds the labels and icons, and a test keeps the two in step. An unknown
`?tab=` falls back to `account`. Signed-out visitors get a sign-in button. A user with no country sees a "Country setup
required" banner linking to `/setup`.

"Display-only" means the control saves a value (to the server or the browser) but no code reads that value to change
behaviour.

---

## 1. Panels

### IxnayID & Passport (`account`) — `AccountIdentityPanel`

| Control | Effect |
| :--- | :--- |
| View public passport, copy link | Links to `/@<handle>` |
| Username, primary email | Read-only, from the auth provider |
| Community forum: link / unlink | Link: `ixnayid.startForumVerification` + `confirmForumVerification` (a code on the forum profile). Unlink: `ixnayid.unlinkForum` |
| Wikis (IxWiki, IIWiki, AltHistory) | `ixnayid.startWikiVerification` / `confirmWikiVerification` (user-page token), `unlinkWikiAccount` |
| Discord: unlink | `ixnayid.unlinkDiscord`. Linking happens by signing in with Discord. The row says "receive bot alerts", but no code sends per-user Discord alerts (the Discord code posts to channels) |

### MyCountry (`country`) — `CountryNationPanel`

Shown only when the user has a country.

| Control | Effect |
| :--- | :--- |
| National flag | Uploads to `/api/upload/image`, then **Save Flag** calls `countries.update({ flag })` |
| Country name | `countries.update({ name })` (`assertCountryWriteAccess`) |
| Map rollup mode (Hybrid, Top-down, Bottom-up) | `countryGeo.updateGeoRollupMode` (country owner). Read by `lib/country-geo/bundle.ts`, `sync.ts` and `compliance.ts` |
| Rebase from map | `countryGeo.rebaseNationalFromGeography` (country owner). Refused in the client when the map has no subdivision or city population |

### Appearance & accessibility (`appearance`) — `AppearanceAccessibilityPanel`

All browser-side. Values go through `ThemeProvider` (`~/context/theme-context`) or `useSoundSettings`, are stored
under `APPEARANCE_STORAGE_KEYS` in `localStorage`, and apply to `<html>` at once (a pre-paint script reads them on
load). Nothing is saved to the server, so the choices are per browser.

| Control | Effect |
| :--- | :--- |
| Theme (Light, Dark, System) | Colour scheme |
| Density (Regular, Compact) | Compact spacing |
| Text size slider | `--text-scale` |
| Increase contrast, Reduce transparency, Reduce motion | Off follows the OS setting; on forces it |
| Sound effects, Volume | Cuelume mute and volume. Sound is muted while Reduce motion is on |
| Texture overlays | `data-enable-textures`; `html[data-enable-textures="false"] .texture-overlay` hides them |

### WikiOS (`wikios`) — `WikiOSOptionsPanel`

| Control | Stored in | Effect |
| :--- | :--- | :--- |
| Citation tooltips | `localStorage` `wikios:showCitationTooltips` | Read by `useCiteTooltips` (`components/wiki-os/reader/`): when off, citations get no hover handlers and no preview card |
| Article outline | `localStorage` `wikios:showWikiToc` | Read by `ArticleRenderer` and `ArticlePageClient` |
| Wiki results in search | `localStorage` `wikios:dynamicSearchWiki` | Read by Halo search (`components/halo/hooks.ts`) |
| Open links in a new tab | `localStorage` `wikios:openInNewTab` | Read by `useLinkTargetPreference`: ordinary left-clicks on article links open a new tab. In-page anchors, citation and edit-section links and modified clicks are left alone |
| Image backplate | `MediaThemeContext` | Used by the WikiOS article header and lightbox |
| MyCountry inline lore | Server, `UserPreferences.wikiAutoScan` via `users.updateWikiPreferences` | **Display-only.** Nothing reads `wikiAutoScan` |

The Halo quick-settings view (`components/halo/views/SettingsView.tsx`) has the same reader switches and keys.

### Notifications (`notifications`) — `NotificationSettingsPanel`

Four category switches (Economic events, Crisis and security, Diplomacy, Platform notices) and a **Priority
threshold** select. Each change calls `notifications.upsertPreferences`, which writes `UserPreferences`
(`economicAlerts`, `crisisAlerts`, `diplomaticAlerts`, `systemAlerts`, `notificationLevel`).

They are enforced when a notification is created for **one user** through `notificationAPI.create` / `createMany`
(`src/lib/notifications/recipient-preferences.ts`): a notification whose category is switched off, or whose priority
is below the threshold, is not written. Country-wide and global notifications always show. Details:
[Notifications](./notifications.md#3-recipient-preferences).

**Delivery** (`DeliveryChannelsGroup`, SL-5) appears only for channels the server has configured
(`notifications.getDeliveryChannels`); with neither configured the group is absent.

| Control | Effect |
| :--- | :--- |
| Email | `upsertPreferences({ emailNotifications })`. Turning it on also sets `emailEnabledAt` (consent); off clears it. High and critical notifications you accepted are emailed to your primary Clerk address |
| Daily digest (shown while email is on) | `emailDigest`. One summary email a day instead of separate emails (the `notification-email-digest` job) |
| Push notifications | Asks the browser for permission, registers `/push-sw.js` (scope `/push/`), subscribes with the VAPID key and saves it (`savePushSubscription`); off unsubscribes this browser (`removePushSubscription`) and sets `pushNotifications` false. Shown on when `pushNotifications` is on and you have a saved subscription |

How each channel sends: [Notifications §4](./notifications.md#4-delivery-paths).

### Social & ThinkPages (`social`) — `SocialPersonaPanel`

Shows the first ThinkPages account (`thinkpages.getMyAccounts`). **Post frequency**, **Political lean** and **Writing
tone** save through `thinkpages.updateAccount` (`postingFrequency`, `politicalLean`, `personality`). **Display-only:**
no code generates posts from these fields. The panel describes them as rules for automatic posts, but nothing posts
automatically for a persona.

### Privacy & security (`privacy`) — `PrivacySecurityPanel`

Every control is enforced on the server (SL-4). Lists and options are stored as `UserConnection` rows
(`users/preferences.ts`): blocks and mutes as one row each, and the options as one JSON row
(`targetUserId: "global_privacy"`, `connectionType: "privacy_config"`). Enforcement lives in
`src/server/shared/user-blocks.ts` (blocks and mutes), `src/server/shared/privacy-permissions.ts` (audiences, muted
words and the switches), `presence.ts` (online status) and `clear-history.ts`. For the audience settings, "people you
follow" means one of your ThinkPages personas follows one of theirs, or your country follows theirs; a missing setting
means everyone. Every switch defaults to on. Where a switch hides something (online status, Seen, linked names) a
failed settings read hides it too.

| Control | Effect |
| :--- | :--- |
| Blocked accounts | `users.blockAccount` / `unblockAccount`. Posts by blocked accounts (or a blocked nation's accounts) are left out of your ThinkPages feed (`thinkpages.getFeed`) and the global activity feed. Someone you blocked can't start a conversation with you or send messages in a direct conversation with you (`MessagingBlockedError` → `FORBIDDEN`). In group conversations their messages are hidden from you and don't count toward your unread badges, previews or notifications. ThinkTank invites also honour blocks (`thinktanks/invite-privacy.ts`) |
| Muted accounts | `users.muteAccount` / `unmuteAccount`. Their posts are left out of your ThinkPages and activity feeds; they can still message you |
| Muted words | `users.addMutedKeyword` / `removeMutedKeyword` (one `keyword` row each). Posts and activity entries containing a muted word (case-insensitive substring) are left out of your ThinkPages feed (`thinkpages.getFeed`, cached per viewer), the global activity feed and the Following feed |
| Direct messages (everyone, people you follow, nobody) | `directMessages`. Someone outside your audience can't start a conversation with you (including a group or diplomatic one) or send messages in a direct conversation with you (`MessagingBlockedError` → `FORBIDDEN`, "not accepting direct messages"), unless Message requests is on (below). "Nobody" always refuses. Group conversations you are already in are unaffected. A stored `verified` value (no longer offered) means the sender owns a verified ThinkPages persona |
| Message requests | `messageRequestFiltering`. On: what Direct messages would refuse goes to your **Requests** folder instead (`ConversationParticipant.requestStatus = "pending"`; `messages.getConversationsByFolder({ folder: "requests" })`, counted as `getFolderCounts().requests` and nowhere else). Requests send no notification or push. Accept (`messages.respondToRequest`) moves it to Messages and lets that person keep messaging you there; Decline leaves the conversation and refuses further messages in it. The sender sees "waiting in their Requests" until you answer. Off: such messages are refused |
| Mentions (everyone, people you follow, nobody) | `mentions`. An @mention from outside your audience, or from someone you blocked, is still recorded on the post but doesn't notify you (`thinkpages.createPost`) |
| Card trade offers (everyone, people you follow, nobody) | `tradeOffers`. Someone outside your audience, or someone you blocked, can't send you a trade offer (`trading.createtradeOffer` → `FORBIDDEN`) |
| ThinkTank invites (everyone, followers, nobody) | Enforced by `filterInvitableUserIds` when someone invites you |
| Online status | `showOnlineStatus`. Signed-in tabs send `users.heartbeat` about once a minute while visible (`usePresenceHeartbeat` in `GameSidecar`); the last time is kept in Redis (`presence:<clerkId>`, 10-minute expiry) or, without Redis, in process memory. Nothing is written to the database. You show as online for two minutes after a heartbeat: a green dot on direct conversations in Messages and an "Online" badge on your passport. Off: nobody sees it |
| Read receipts | `dmReadReceipts`. Opening a conversation records your read time (`ConversationParticipant.lastReadAt`, `messages.markMessagesAsRead`). In direct conversations the sender sees "Seen" under their newest message sent before it (`messages.getSeenState`, polled every 20 seconds) only when both of you have receipts on, and not while you hold it as an unanswered request. Group conversations never show it |
| Appear in invite search | `searchDiscoverable`. When off, ThinkTank owners can't find you in the invite search (`invite-privacy.ts`) |
| Search engine indexing | `searchEngineIndexing`. Off: your passport (`/@handle`, `/id/[username]`) is served with `robots: noindex, nofollow` (`src/app/id/[username]/layout.tsx`, `passportIndexable`) |
| Show Discord tag | `showDiscordTag`. Off: other viewers see no Discord affiliation on your passport, your Discord name is not used as your name in the global activity feed, and trading partner search neither shows nor matches it. You still see it on your own passport |
| Wiki attribution | `showWikiAttribution`. Off: other viewers see no wiki name, wiki groups, Lorewards or award history on your passport and no wiki articles or wiki activity on its Work tab; `users.resolveWikiAuthor` returns your wiki name without your role or country, so wiki bylines and user-page cards don't link to your nation; the activity feed and trading search skip the name |
| Export your data | `users.exportUserData`: a JSON download of account fields, Vault, card count, preferences and up to 50 recent ThinkPages posts |
| Clear history | `users.clearHistory({ confirm: true })` after a confirmation dialog, at most 3 times an hour. Deletes your personal notifications (rows addressed to your Clerk or user id; country-wide and global notices stay), your message read receipts and your online-status heartbeat, and the browser forgets its recently viewed wiki articles and forum threads (session storage). It does not touch messages (yours or anyone's), conversation read positions, posts, activity entries, audit logs or settings |
| Sessions and two-step verification | Opens the auth provider's user profile (Clerk) |
| NationStates card deck | Links to the Cards tab and opens the takedown modal |

**Removed** (2026-10-06): "Anonymous diagnostics" (`diagnosticTelemetry`) and "Personalized recommendations"
(`personalizedRecommendations`). No telemetry is sent anywhere (the browser posts no analytics, error reports or load
metrics; server logs are operational and audit records), and nothing is recommended or personalised (feeds are
chronological or trending for everyone). Stored values for them are ignored and dropped on the next save. The
`clearSearchHistory` stub is replaced by `clearHistory`.

### Vault status (`vault`) — `VaultStatusPanel`

Balance, streak, level and lifetime totals from the Vault. **Claim** calls `vault.claimDailyBonus`. **Sync with
server** refetches.

### Cosmetics (`cosmetics`) — `CosmeticsUpgradesPanel`

Lists owned store items (`vault.listStoreItems`, `vault.getPurchasedItems`). Equip toggles call
`vault.toggleEquipCosmetic`, which writes `MyVault.equippedCosmetics`. Every viewer sees what is equipped: the passport
photo and name, and forum post and thread authors, read it through the public `vault.getEquippedCosmeticsFor`
([myvault.md](./myvault.md#public-equipped-cosmetics)).

### NationStates cards (`cards`) — `NationStatesCardsPanel`

Shows imported cards (`nsImport.getMyNSCards`). The takedown modal (`NSTakedownModal`) hides a card
(`nsImport.hideMyCard`) or files a takedown (`nsImport.requestSelfServiceTakedown`, which needs a NationStates
verification checksum; `nsImport.getVerificationUrl` gives the verification link).

## 2. Procedures used

| Procedure | Auth |
| :--- | :--- |
| `notifications.getPreferences`, `notifications.upsertPreferences` | protected (own row only) |
| `notifications.getDeliveryChannels` | protected |
| `notifications.savePushSubscription`, `removePushSubscription` | protected, light rate limit; saving needs push configured and a known push service endpoint |
| `users.getPreferences`, `users.updateWikiPreferences` | protected |
| `users.getPrivacySettings`, `updatePrivacyConfig`, `blockAccount`, `unblockAccount`, `muteAccount`, `unmuteAccount`, `addMutedKeyword`, `removeMutedKeyword`, `exportUserData` | protected (mutations rate limited) |
| `users.clearHistory` | protected; per-procedure limit plus 3 an hour; input `{ confirm: true }` |
| `users.heartbeat` | protected, rate limited (sent by every signed-in tab, not from this page) |
| `messages.respondToRequest`, `messages.getSeenState` | protected (Messages, not this page) |
| `countries.update` | protected + `assertCountryWriteAccess` |
| `countryGeo.updateGeoRollupMode`, `countryGeo.rebaseNationalFromGeography` | country owner, standard mutation rate limit |
| `thinkpages.updateAccount` | protected |
| `vault.claimDailyBonus`, `vault.toggleEquipCosmetic` | protected |
| `ixnayid.*` link and unlink procedures | protected (verification starts are light rate limited) |
| `nsImport.hideMyCard` | protected |
| `nsImport.requestSelfServiceTakedown` | public, rate limited |

## 3. Jobs

`notification-email-digest` (daily, 08:07 UTC) sends the email digest; see [Notifications §7](./notifications.md#7-jobs).

## 4. Admin-side settings wired on 2026-10-05

The same pass (SL-4, SL-5, VT-9, VT-10, WK-8, WK-10, WK-11, WK-14) checked the admin console's settings. Controls with
no consumer were removed or hidden; these are now read by the game:

| Admin setting | Key(s) | Read by |
| :--- | :--- | :--- |
| Cards: house rake, base card capacity, junk batch limit | `card_system_auction_rake_pct` (default 10), `card_system_max_inventory_cards` (150), `card_system_max_junk_batch_size` (100) | `lib/cards/general-settings.ts`: the marketplace fee (auction sales and buyouts), pack opening, NS deck import and the Vault dashboard, and `cards.junkCards`. Trading kill-switch, daily free packs, player minting and lore thumbnails are hidden |
| ThinkPages: accounts per user | `thinkpages_maxAccountsPerUser` (default 25) | `thinkpages.createAccount`; the public `thinkpages.getAccountLimit` feeds the account manager's counter. Character cap, auto-news and attachment switches are hidden |
| ThinkPages: Discord feed | `ThinkpagesDiscordFeedConfig` row | `admin.getThinkpagesDiscordFeedConfig` / `saveThinkpagesDiscordFeedConfig` (admin) behind the Discord tab's feed card |
| Lorewards: scoring weights | `lorewardWeight_<field>` for `proseWeight`, `depthMaxBonus`, `noveltyBonus`, `importanceMaxBonus`, `listPenalty`, `minorOnlyPenalty` | `loadScoringWeights()` in `lib/lorewards/scoring.ts`, used by the daily scorer and the admin preview. The older keys are ignored |

Removed: the six `vault_price*` store-price keys (store prices are each `VaultStoreItem.price`), and the Navigation
panel's Defense and Intelligence tab switches (the sidebar gates Defense on MyCountry Premium or the beta-tester role;
`admin.updateNavigationSettings` still accepts the two fields but nothing reads them). Admin → Stash shows usage only.

## 5. Known gaps

- A few controls are display-only (listed above): persona posting rules, MyCountry inline lore
  (`wikiAutoScan`), and the Discord "bot alerts" wording on the account panel.
- Appearance and most WikiOS reader settings are per browser and don't follow the account to another device.
- Muted accounts are hidden from feeds but can still message you.
- Online status needs Redis to be shared across processes; with several web processes and no Redis a user shows online
  only to requests served by a process that received their heartbeat.
- "Seen" is polled (every 20 seconds while a direct conversation is open), not pushed over the socket.
- The MyCountry tab and the Country Editor both change the flag and name; Settings has no coat-of-arms field.

## Related documentation

- [Notifications](./notifications.md)
- [IxnayID & Passport](./ixnayid-passport.md)
- [Halo](./halo.md): quick settings
- [ThinkTanks](./thinktanks.md): invite privacy and the invite inbox
