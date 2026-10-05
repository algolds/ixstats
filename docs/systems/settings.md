# Settings

**Last updated:** 2026-10-05
**Status:** Live. Several controls are saved but nothing reads them yet; they are marked **display-only** below.
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
| Citation tooltips | `localStorage` `wikios:showCitationTooltips` | **Display-only.** Only the settings panels read the key |
| Article outline | `localStorage` `wikios:showWikiToc` | Read by `ArticleRenderer` and `ArticlePageClient` |
| Wiki results in search | `localStorage` `wikios:dynamicSearchWiki` | Read by Halo search (`components/halo/hooks.ts`) |
| Open links in a new tab | `localStorage` `wikios:openInNewTab` | **Display-only.** Only the settings panels read the key |
| Image backplate | `MediaThemeContext` | Used by the WikiOS article header and lightbox |
| MyCountry inline lore | Server, `UserPreferences.wikiAutoScan` via `users.updateWikiPreferences` | **Display-only.** Nothing reads `wikiAutoScan` |

The Halo quick-settings view (`components/halo/views/SettingsView.tsx`) has the same reader switches and keys.

### Notifications (`notifications`) — `NotificationSettingsPanel`

Every switch calls `notifications.upsertPreferences`, which writes `UserPreferences` (email summaries, desktop push
alerts, economic events, crisis and security, diplomacy, platform notices, minimum urgency). **All display-only:** no
delivery path reads these fields, and there is no email or push delivery. See
[Notifications](./notifications.md#7-known-gaps).

### Social & ThinkPages (`social`) — `SocialPersonaPanel`

Shows the first ThinkPages account (`thinkpages.getMyAccounts`). **Post frequency**, **Political lean** and **Writing
tone** save through `thinkpages.updateAccount` (`postingFrequency`, `politicalLean`, `personality`). **Display-only:**
no code generates posts from these fields. The panel describes them as rules for automatic posts, but nothing posts
automatically for a persona.

### Privacy & security (`privacy`) — `PrivacySecurityPanel`

Lists and options are stored as `UserConnection` rows (`users/preferences.ts`): blocks, mutes and muted keywords as
one row each, and the options as one JSON row (`targetUserId: "global_privacy"`, `connectionType: "privacy_config"`).

| Control | Effect |
| :--- | :--- |
| Blocked accounts | `users.blockAccount` / `unblockAccount`. **Only ThinkTank invites honour it** (`thinktanks/invite-privacy.ts`); messages, mentions and feeds do not |
| Muted accounts, muted words | `users.muteAccount`, `addMutedKeyword`, … **Display-only** |
| ThinkTank invites (everyone, followers, nobody) | Enforced by `filterInvitableUserIds` when someone invites you |
| Direct messages, Mentions and tags, Trade and gift offers | **Display-only** |
| Message request filtering, Appear in search, Search engine indexing, Online status, Read receipts, Show Discord tag, Show wiki attribution, diagnostics and recommendations | **Display-only** |
| Clear search and browsing history | `users.clearSearchHistory` is a stub that returns success and changes nothing |
| Export your data | `users.exportUserData`: a JSON download of account fields, Vault, card count, preferences and up to 50 recent ThinkPages posts |
| Sessions and two-step verification | Opens the auth provider's user profile (Clerk) |
| NationStates card deck | Links to the Cards tab |

### Vault status (`vault`) — `VaultStatusPanel`

Balance, streak, level and lifetime totals from the Vault. **Claim** calls `vault.claimDailyBonus`. **Sync with
server** refetches.

### Cosmetics (`cosmetics`) — `CosmeticsUpgradesPanel`

Lists owned store items (`vault.listStoreItems`, `vault.getPurchasedItems`). Equip toggles call
`vault.toggleEquipCosmetic`, which writes `MyVault.equippedCosmetics`. **Display-only:** no page outside Settings and
the admin Vault tools reads equipped cosmetics, so equipping changes nothing visible.

### NationStates cards (`cards`) — `NationStatesCardsPanel`

Shows imported cards (`nsImport.getMyNSCards`). The takedown modal (`NSTakedownModal`) hides a card
(`nsImport.hideMyCard`) or files a takedown (`nsImport.requestSelfServiceTakedown`, which needs a NationStates
verification checksum; `nsImport.getVerificationUrl` gives the verification link).

## 2. Procedures used

| Procedure | Auth |
| :--- | :--- |
| `notifications.getPreferences`, `notifications.upsertPreferences` | protected (own row only) |
| `users.getPreferences`, `users.updateWikiPreferences` | protected |
| `users.getPrivacySettings`, `updatePrivacyConfig`, `blockAccount`, `unblockAccount`, `muteAccount`, `unmuteAccount`, `addMutedKeyword`, `removeMutedKeyword`, `clearSearchHistory`, `exportUserData` | protected |
| `countries.update` | protected + `assertCountryWriteAccess` |
| `countryGeo.updateGeoRollupMode`, `countryGeo.rebaseNationalFromGeography` | country owner, standard mutation rate limit |
| `thinkpages.updateAccount` | protected |
| `vault.claimDailyBonus`, `vault.toggleEquipCosmetic` | protected |
| `ixnayid.*` link and unlink procedures | protected (verification starts are light rate limited) |
| `nsImport.hideMyCard` | protected |
| `nsImport.requestSelfServiceTakedown` | public, rate limited |

## 3. Jobs

None.

## 4. Known gaps

- Many controls are display-only (listed above). The largest groups are notification preferences, privacy options
  other than ThinkTank invites and the block list, persona posting rules, and equipped cosmetics.
- Appearance and most WikiOS reader settings are per browser and don't follow the account to another device.
- `clearSearchHistory` is a stub.
- The MyCountry tab and the Country Editor both change the flag and name; Settings has no coat-of-arms field.

## Related documentation

- [Notifications](./notifications.md)
- [IxnayID & Passport](./ixnayid-passport.md)
- [Halo](./halo.md): quick settings
