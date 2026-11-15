# Facet Sidebar & Contextual Subtabs Design

**Date:** 2026-11-15
**Status:** Locked Spec (Pending Mockup Review)

## Goal

Redesign the expanded `AppSidebar`, collapsed `64px` icon rail, `SourceList` subtab hierarchy, in-page secondary tab bars (`CardsHub`, `VaultAchievementsPage`), and sidebar footer (`SidebarVaultCard`, `AccountMenu`, `AppSidebar` chrome) so the shell reads as a calm, uncrowded Apple/Facet source list where:

1. Subtabs appear **contextually only for the active app**, eliminating cross-app accordion clutter and trailing `[>]` buttons.
2. Top-level apps and subordinate subtabs have unmistakable **Facet physical hierarchy** (`facet-recess` key-down parent mark vs. compact hairline-guided text subtabs).
3. `Vault` and `Wiki` subtab trees are right-sized to **5 peer destinations each**, with 3rd-level views promoted to zero-reload in-page Facet `<SegmentedControl>` switches and preserved in `⌘K`.
4. The collapsed `64px` rail restores **1-click navigation** on every app icon while offering hover-disclosed `facet-overlay` `HoverCard` flyouts for subtabs.
5. The sidebar footer compresses from ~`190px` of stacked chrome into a **2-row Facet footer** (`Card variant="well"` single-line `IxCredits` strip + portrait/active-nation `AccountMenu` row with inline `Collapse` `⌘\`).

---

## 1. Contextual Subtab Disclosure & 1-Click Collapsed Rail

### 1.1 Expanded Sidebar (`SourceList` `data-mode="apps"`)

- **Active-app-only disclosure:** Subtabs (`SectionRows`) render in the expanded sidebar **only when `isCurrent` is true** (`app.id === activeAppId`).
- **Retire manual `[>]` app accordions:** Remove the trailing `Expand / Collapse <App>` chevron button on inactive `AppRow`s and retire `sectionsWhenCurrentOnly` from `AppDefinition` (contextual disclosure is now the universal rule for every `placement: "main"` app with `sections.length > 0`).
- **Pending badge roll-up on inactive apps:** When an inactive app has a child section with an active `count` or `action` badge (`pendingInside`), its `AppRow` continues to display a `size-2 rounded-full bg-tint` indicator dot on the trailing edge (`Home` inline rows continue showing numeric unread pills directly on `Messages`).
- **Interruptible spring disclosure:** Wrap the active app's `SectionRows` disclosure in `AnimatePresence initial={false}` with a height/opacity `motion.div` driven by `springSmooth` (`REDUCED_MOTION_FADE` when `useReducedMotion()` is true) so navigating between apps smoothly opens the current app's subtabs without layout snap.
- **Scoped active-pill `layoutId`:** Scope `indicatorId` per app (`source-list-${variant}-${app.id}`) so switching subtabs _within_ an app slides the `bg-tint-fill` pill via `springSnappy`, while switching _between_ apps never arcs a shared layout pill across unrelated trees.
- **Mobile `TabBar` `More` sheet (`variant="sheet"`):** Because `More` lists overflow apps when the user may currently be on a primary tab (`Dashboard`, `MyCountry`, `Vault`, `Wiki`), `variant="sheet"` keeps `Admin` / `Settings` direct area links and renders the active overflow app's sections inline when current.

### 1.2 Collapsed Icon Rail (`64px`, `data-sidebar="collapsed"`)

- **1-click primary icons:** Every app icon on the collapsed rail (`RailApp`) renders as a direct `<Link href={app.href}>` (`size-9`, `pointer-coarse:size-11`, `text-tint`, `facet-recess` when `isCurrent`), eliminating the two-click `PopoverTrigger` trap where clicking `Vault` or `Wiki` failed to navigate.
- **`HoverCard` subtab flyouts (`facet-overlay`):**
  - When an app has visible sections (`withCountryRows(app, countryHref, countryMeta)` has `sections.length > 0` and `!plain`), wrap the `<Link>` in Facet's `<HoverCard openDelay={220} closeDelay={120}>` (`src/components/ui/hover-card.tsx`).
  - `HoverCardContent` (`side="right"`, `align="start"`, `sideOffset={10}`, `data-app={app.tint}`, `className="w-56 p-1.5"`) uses `facet-overlay` + `<SurfaceReset>` automatically, rendering an app title header (`text-footnote font-semibold text-label px-2 py-1`) followed by `<SourceList variant="popover" app={resolvedApp} ... />` so any subtab is also **1-click reachable on pointer hover/focus** without blocking direct clicks on the rail icon.
  - Plain leaf apps without sections (`Maps`, `Labs`, `Settings`, `Admin`, `Home` inline rows) keep crisp `CollapsedTooltip` labels (`side="right"`, `sideOffset={8}`).

---

## 2. Subordinate Subtab Hierarchy & Facet Surface Physics

### 2.1 Distinct Parent vs. Subtab Anatomy (`SourceList.tsx`)

- **Top-level `AppRow`:**
  - Uses Facet's density-aware `--control-height` token (`min-h-(--control-height)`, `36px` standard / `32px` under Halo's `data-density="compact"`, `pointer-coarse:min-h-11`).
  - Keeps the `28px` (`size-7`) `NavMark` slot (`text-tint`). **Only the active top-level `AppRow` (and active `inline` row such as `Dashboard` or `Messages`) wears `facet-recess`** ("key held down" into `facet-chrome`).
  - Preserves the exact `<span className="flex-1 whitespace-nowrap">{app.label}</span>` contract enforced by `src/tests/architecture/sidebar-labels.test.ts` (never `truncate` on top-level app labels; never `StreakPill` in `SourceList`).
- **Subordinate `SectionRow` & `ActionRow` (when indented under an `AppRow` in `variant="sidebar"`):**
  - **No `28px` `NavMark` icon box:** Child subtabs drop the repeated `size-7` icon container and never apply `facet-recess`, immediately distinguishing subordinate sections from top-level apps.
  - **Hairline vertical guide:** `SectionRows` renders left-aligned beneath the center of the parent's `28px` `NavMark` (`ml-[21px] border-l border-separator pl-2.5 py-0.5`, matching `px-2` + half of `size-7`).
  - **Compact geometry & typography:** Subtab rows use `min-h-(--control-height-sm)` (`28px` standard / `26px` compact, `pointer-coarse:min-h-11`), `rounded-control-sm`, `px-2.5`, and `text-subhead` (`13px`).
  - **Active subtab treatment:** Active subtab wears `text-tint-ink font-medium`, a `motion.span` `bg-tint-fill rounded-control-sm` shared pill (`springSnappy`), and a `2px` leading vertical `bg-tint` accent bar (`-left-[11px] top-1.5 bottom-1.5 w-0.5 rounded-full`) anchored directly on the hairline guide. Inactive subtabs read in `text-label-secondary hover:text-label hover:bg-fill-4`.
  - **Popover & area modes (`variant="popover"` and `data-mode="area"`):**
    - In `variant="popover"` (collapsed rail `HoverCard` flyout), rows sit inside a standalone menu without a parent row above them, so compact `size-4 text-label-secondary` leading icons (without `facet-recess` boxes) remain visible beside `text-subhead` labels.
    - In `data-mode="area"` (`Settings` and `Admin`), `SectionRow`s are the primary rows of that dedicated area, so they keep `min-h-(--control-height)` + `NavMark` (`current={active}`).

### 2.2 Canonical Facet Primitives (`Badge`, `ScrollArea`, Controls)

- **Facet `<Badge>` on counts:** `Trailing` in `SourceList.tsx` uses `<Badge variant="secondary" className="bg-tint-fill text-tint-ink tabular-nums">` for `kind === "count"` badges (`value > 0`) and `text-caption text-label-secondary tabular-nums` for `kind === "action"` hints (`"+25"`).
- **Facet `<ScrollArea>`:** Replace raw `overflow-y-auto` on `AppSidebar`'s scroll body with `<ScrollArea className="min-h-0 flex-1">` (`src/components/ui/scroll-area.tsx`) so long `Admin` trees get Facet's fading overlay thumb instead of OS-default scrollbars.
- **No press-scale on controls:** Per `facet-guards.test.ts`, sidebar rows, rail icons, segmented tabs, and footer buttons communicate press strictly via background/color shifts (`hover:bg-fill-4`, `active:bg-fill-3`), never `active:scale-*` or `facet-press`.

---

## 3. Right-Sized Subtab Trees & In-Page `SegmentedControl`s

### 3.1 `Vault` (`11` rows → `5` contextual subtabs)

Update `VAULT_APP.sections` in `src/lib/navigation/app-sections.ts` to 5 peer destinations:

| Section ID     | Label          | Href                  | Active Match Rule                        | Notes                                                               |
| :------------- | :------------- | :-------------------- | :--------------------------------------- | :------------------------------------------------------------------ |
| `overview`     | `Wallet`       | `/vault`              | Exact `/vault`                           | Matches Vault `PageHeader` & `SidebarVaultCard`                     |
| `cards`        | `Cards`        | `/vault/cards/mine`   | Prefix `/vault/cards` or `/vault/import` | Consolidates `My cards`, `Sets`, `Market`, `Explore`, `Import deck` |
| `packs`        | `Store`        | `/vault/store`        | Prefix `/vault/store` or `/vault/packs`  | Unchanged                                                           |
| `achievements` | `Achievements` | `/vault/achievements` | Prefix `/vault/achievements`             | Consolidates `Achievements` & `?tab=lorewards`                      |
| `leaderboards` | `Leaderboards` | `/leaderboards`       | Prefix `/leaderboards`                   | Unchanged                                                           |

- **Remove duplicate `Daily reward` (`action: "daily-reward"`) from `VAULT_APP.sections`:** Daily reward claiming lives persistently on `SidebarVaultCard` right below the nav list (`facet-gold` **Claim** pill when ready), on the `RailWallet` dot when collapsed, and in `⌘K` (`Claim daily reward`).

#### In-Page Promotions for Consolidated Vault Views

1. **`CardsHub` (`src/components/vault/cards/CardsHub.tsx`):**
   - Render a Facet `<SegmentedControl value={tab} onValueChange={navigate} size="sm" options={...} aria-label="Cards views" />` in the `CardsHub` sub-bar beneath `PageHeader` (`data-app="vault"`) wired directly to `useCardHubTab`'s zero-reload `window.history.pushState` `navigate` callback:
     - `mine` → `"My cards"`
     - `sets` → `"Sets"`
     - `market` → `"Market"`
     - `explore` → `"Explore"`
   - Render a secondary `<Button asChild variant="secondary" size="sm"><Link href="/vault/import">Import deck</Link></Button>` alongside the `Cards views` switcher.
   - Extend `getActiveSectionId` (`src/lib/navigation/app-sections.ts`) with optional `matchPrefixes?: readonly string[]` on `NavSection` so `cards` (`href: "/vault/cards/mine"`, `matchPrefixes: ["/vault/cards", "/vault/import"]`) stays highlighted across `/vault/cards/mine`, `/vault/cards/sets`, `/vault/cards/market`, `/vault/cards/explore`, `/vault/cards/[cardId]`, and `/vault/import`.
2. **`VaultAchievementsPage` (`src/app/vault/achievements/page.tsx`):**
   - Add a Facet `<SegmentedControl value={activeTab} onValueChange={...} size="sm" aria-label="Achievement categories" />` in `PageHeader` `actions` (`Achievements` | `Lorewards`), updating `/vault/achievements` vs. `/vault/achievements?tab=lorewards` cleanly via `router.replace` so `Lorewards` is 1 click inside `Achievements` without needing a dedicated sidebar subtab.

### 3.2 `Wiki` (`8` rows → `5` contextual subtabs)

Update `WIKI_APP.sections` in `src/lib/navigation/app-sections.ts` to 5 peer destinations:

| Section ID       | Label            | Href                   | Active Match Rule                                                                                     |
| :--------------- | :--------------- | :--------------------- | :---------------------------------------------------------------------------------------------------- |
| `main`           | `Main page`      | `/wiki`                | Exact `/wiki` (and article routes `/wiki/*` fall back to `WIKI_APP` without highlighting `Utilities`) |
| `repository`     | `Repository`     | `/util/repository`     | Prefix `/util/repository`                                                                             |
| `stash`          | `Stash`          | `/stashes`             | Prefix `/stashes`                                                                                     |
| `recent-changes` | `Recent changes` | `/util/recent-changes` | Prefix `/util/recent-changes`                                                                         |
| `util`           | `Utilities`      | `/util`                | Prefix `/util` (excluding `/util/repository` and `/util/recent-changes` via longest-prefix match)     |

- `Search` (`/util/search`), `Categories` (`/util/categories`), and `Wiki Lorewards` (`/util/lorewards`) remain featured cards on `/util` and stay directly searchable in `⌘K`.

### 3.3 `Realms`, `Help`, `MyCountry` & `ThinkPages`

- **`Realms` (`2` contextual subtabs):** `My realm` (`/countries`), `Explore` (`/realms`). Remove the `adminOnly` `Realm admin` (`/admin/realms`) duplicate from `Realms` (canonical home remains `Admin → System → Realms`).
- **`Help` (`3` contextual subtabs when inside `/help` or `/changelog`):** `Getting started` (`/help`), `What's new` (`/changelog`), and external `Ixnay Discord` (`https://discord.gg/ixnay`, `external: true`). Match `/changelog` to `HELP_APP` (`extraPrefixes: ["/changelog"]`) so `What's new` highlights cleanly.
- **`MyCountry` (`3` contextual subtabs when linked):** `Public profile` (`/countries/[slug]`), `Country editor` (`/mycountry/editor`), `Map editor` (`/mycountry/map-editor`) via `withCountryRows` (plus `Dashboard` at `/mycountry` when unlinked).
- **`ThinkPages` (`4` contextual subtabs):** Unchanged (`Forums`, `ThinkTanks`, `Accounts`, `Moderation`).

### 3.4 `⌘K` Command Palette Parity (`src/lib/halo/commands-from-apps.ts`)

Add explicit entries in `EXTRA_HALO_COMMANDS` for every consolidated 3rd-level destination so nothing loses keyboard reachability, and disambiguate colliding `"Lorewards"` titles:

- `Card sets` (`/vault/cards/sets`, subtitle `"Vault · Browse card sets and completion"`, keywords `["sets", "collections", "cards", "vault"]`)
- `Card market` (`/vault/cards/market`, subtitle `"Vault · Live auctions and listings"`, keywords `["market", "auctions", "buy", "sell", "cards"]`)
- `Explore cards` (`/vault/cards/explore`, subtitle `"Vault · Search every card in circulation"`, keywords `["explore", "catalog", "cards", "directory"]`)
- `Import deck` (`/vault/import`, subtitle `"Vault · Import NationStates deck"`, keywords `["import", "deck", "nationstates", "ns"]`)
- `Lorewards` (`/vault/achievements?tab=lorewards`, subtitle `"Vault · Article reading and lore rewards"`, keywords `["lorewards", "achievements", "vault"]`)
- `Wiki Lorewards` (`/util/lorewards`, subtitle `"Wiki · WikiOS contribution rewards"`, keywords `["wiki", "lorewards", "utilities"]`)
- `Wiki search` (`/util/search`, subtitle `"Wiki · Full-text article search"`, keywords `["wiki", "search", "articles", "utilities"]`)
- `Wiki categories` (`/util/categories`, subtitle `"Wiki · Browse category tree"`, keywords `["wiki", "categories", "taxonomy", "utilities"]`)

---

## 4. Open `Settings` Groups vs. Collapsible `Admin` Groups

- In `SourceList.tsx` (`data-mode="area"`), pass `collapsibleGroups={current.id === "admin"}` instead of hardcoding `true`.
- **`/settings` (`10` items across `Profile`, `Preferences`, `Vault`):** Renders all three groups open simultaneously under quiet static `GroupHeading` labels (`text-caption text-label-secondary px-2 pt-3 pb-1`, sentence case), eliminating accordion clicks for a 10-item list that fits in a single viewport.
- **`/admin` (`38` items across `Overview`, `World & Simulation`, `Economy & Cards`, `Content & Media`, `System`):** Keeps collapsible group accordions (`collapsibleGroups={true}`) inside `<ScrollArea>` with `← All apps` returning to `backHref`.

---

## 5. Compact 2-Row Facet Footer & Right-Click Context Menus

### 5.1 Single-Line `SidebarVaultCard` (`Card variant="well"`, `data-app="vault"`)

- **Respects Facet layer hierarchy (`facet-well` inside `facet-chrome`):** Remains `<Card variant="well" padding="none" data-slot="sidebar-vault-card" data-app="vault" className="rounded-row px-2.5 py-1.5">` (concentric `10px` radius inside `AppSidebar`'s `px-2.5` padding; never glass-on-glass).
- **Compact single-line layout (`~38px` tall instead of `~92px`):**
  - **Leading `<Link href="/vault">`:** Renders `<IxCreditsSymbol decorative className="size-4 shrink-0 text-tint" />`, animated `<NumberFlowDisplay value={Math.round(balance.credits)} className="text-subhead font-semibold text-label tabular-nums" />`, and (when `today > 0`) inline `<span className="text-caption text-success-ink tabular-nums">+{formatCredits(today)}</span>`.
  - **Trailing inline Daily Reward pill (only when claimable):** Renders a compact `facet-gold` pill button (`Claim` or `+25` with `Gift` / `Spark` affordance via a compact `DailyRewardInlineTrigger` from `DailyRewardProvider`) that opens the Daily Reward claim modal directly without adding a second row. When already claimed, renders nothing.
  - **Trailing `Popover` breakdown button (`Button variant="ghost" size="icon-sm"`):** Replaces the height-jumping inline `Collapsible` drawer with a `facet-overlay` `<Popover>` (`side="right"`, `align="end"`, `sideOffset={10}`, `data-app="vault"`, `className="w-64 p-3"`) showing today's earnings breakdown (`Earnings`) and `<Progress>` achievement summary (`AchievementProgress`). Deletes the duplicate `VAULT_LINKS` (`Cards`, `Store`, `Achievements`) footer inside the panel.
  - Note: Because `SidebarVaultCard` no longer needs external `expanded` / `onToggle` state persisted in `useNavExpanded("ix.vault.open")`, `Popover` manages its transient open state locally (keeping `SidebarVaultCardProps` backward-compatible or clean in `FacetShell.tsx` and tests).

### 5.2 Portrait + Active Nation `AccountMenu` Row + Inline `Collapse` (`⌘\`)

- **Active nation visibility on `AccountMenu` (`layout="sidebar"`):**
  - Display the player's Clerk `Avatar` (`size-6`) + `name` alongside their linked active nation (`countryName`), formatted cleanly on one compact row: `<span className="truncate font-medium text-label">{name}</span>` and (when `countryName` exists) `<span className="text-label-tertiary">·</span> <span className="text-footnote text-label-secondary truncate">{countryName}</span>` so switching nations via `NationSwitcher` immediately reflects in the persistent sidebar chrome.
- **Inline `Collapse` (`⌘\`) button (`AppSidebar.tsx`):**
  - When expanded, place the `Collapse sidebar (⌘\)` button (`Button variant="ghost" size="icon-sm"`, `<SidebarCollapse className="size-4" />`, wrapped in `<Tooltip content={`Collapse sidebar (${shortcut})`} side="top">`) inline on the trailing edge of the bottom account flex row (`<div className="flex items-center gap-1">`), eliminating the dedicated `36px` `Collapse` row!
  - When collapsed (`64px` rail), stack the `Avatar` button and the `Expand sidebar (⌘\)` icon button cleanly centered in the `64px` column (`sidebar-collapsed:flex-col`).
- **Clean sidebar floor (`SidebarFooterLinks` moved into `AccountPanel`):**
  - Remove the permanent 2-line `SidebarFooterLinks` block from `AppSidebar`'s bottom floor.
  - Inside `AccountPanel` (`AccountMenu.tsx`), include `Send feedback` (`onOpenFeedback` callback passed from `FacetShell` → `AppSidebar` → `AccountMenu`, or dispatching the existing feedback modal) in the secondary action list and render the compact metadata footer (`APP_VERSION · BUILD_VERSION` link to `/changelog`, `Privacy`, `Terms`) at the bottom of `AccountPanel` in both `sidebar` popover and `sheet` layouts.

### 5.3 IxStates `SystemContextMenu` Integration (`useContextArea` & `COUNTRY_ATTRS`)

- **Sidebar chrome context menu (`AppSidebar.tsx`):** Attach `useContextArea` (`src/components/shared/context-menu/useContextArea.ts`) to `<FacetMaterial id={APP_SIDEBAR_ID}>` contributing contextual shell actions on right-click anywhere in the sidebar:
  1. `Collapse sidebar` / `Expand sidebar` (`⌘\`)
  2. `Search & commands` (`⌘K` — opens Halo Search)
  3. `Quick settings` (opens Halo `SettingsView`)
- **MyCountry `Public profile` row (`COUNTRY_ATTRS`):** Extend `NavSection` with optional `dataAttributes?: Record<string, string>` (or `countryMeta?: { slug: string; name: string }` on `withCountryRows`) so `MyCountry → Public profile` carries `COUNTRY_ATTRS({ slug, name })` (`data-country-slug`, `data-country-name`). Right-clicking `Public profile` automatically activates `SystemContextMenu`'s nation target (`Open nation` Country Actions sheet + `Open profile`).

---

## 6. File Impact Matrix & Verification Plan

| File                                                            | Responsibility                                                                                                                                                                                                                                                                                                              |
| :-------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/navigation/app-sections.ts`                            | Right-size `VAULT_APP` (`5`), `WIKI_APP` (`5`), `REALMS_APP` (`2`), `HELP_APP` (`3` + `/changelog` prefix); add `matchPrefixes` & `COUNTRY_ATTRS` metadata on `withCountryRows`; retire `sectionsWhenCurrentOnly`.                                                                                                          |
| `src/lib/halo/commands-from-apps.ts`                            | Add `EXTRA_HALO_COMMANDS` for `Card sets`, `Card market`, `Explore cards`, `Import deck`, `Lorewards`, `Wiki Lorewards`, `Wiki search`, `Wiki categories`.                                                                                                                                                                  |
| `src/components/shell/SourceList.tsx`                           | Active-only contextual `SectionRows` in `sidebar` mode with `springSmooth` disclosure; subordinate hairline-guided compact `SectionRow` without `NavMark`/`facet-recess`; per-app `indicatorId` with `springSnappy`; `<Badge>` counts; open groups in `Settings` (`collapsibleGroups={current.id === "admin"}`).            |
| `src/components/shell/AppSidebar.tsx`                           | 1-click `<Link>` rail icons wrapped in `HoverCard` (`facet-overlay`) for apps with sections; `<ScrollArea>` body; inline trailing `Collapse sidebar (⌘\)` button beside `AccountMenu`; `useContextArea` shell menu; remove permanent `SidebarFooterLinks` floor.                                                            |
| `src/components/shell/SidebarVaultCard.tsx`                     | Single-line `Card variant="well"` with `IxCreditsSymbol` + `NumberFlowDisplay` + `+today` delta + inline claimable `facet-gold` trigger + `facet-overlay` `Popover` breakdown (no duplicate Vault nav buttons).                                                                                                             |
| `src/components/shell/AccountMenu.tsx`                          | Show `name · countryName` on sidebar trigger; add `Send feedback` + `APP_VERSION · BUILD_VERSION · Privacy · Terms` footer inside `AccountPanel`.                                                                                                                                                                           |
| `src/components/shell/FacetShell.tsx`                           | Pass `countryMeta` (`slug`, `name`) and `onOpenFeedback` cleanly to `AppSidebar` / `AccountMenu`; simplify removed `vaultOpen` persistence if unused.                                                                                                                                                                       |
| `src/components/vault/DailyRewardProvider.tsx`                  | Export compact inline `DailyRewardInlinePill` (renders `facet-gold` `Claim` pill only when claimable) alongside existing `DailyRewardStatus`.                                                                                                                                                                               |
| `src/components/vault/cards/CardsHub.tsx`                       | Add in-page `<SegmentedControl asTabs>` (`My cards                                                                                                                                                                                                                                                                          | Sets                         | Market | Explore`) wired to `useCardHubTab`+`Import deck`button in`PageHeader`. |
| `src/app/vault/achievements/page.tsx`                           | Add in-page `<SegmentedControl asTabs>` (`Achievements                                                                                                                                                                                                                                                                      | Lorewards`) in `PageHeader`. |
| `src/components/shell/__tests__/*` & `src/tests/architecture/*` | Update unit tests (`SourceList.test.tsx`, `AppSidebar.test.tsx`, `AccountMenu.test.tsx`, `app-sections.test.ts`, `commands-from-apps.test.ts`) and verify `sidebar-labels.test.ts`, `facet-guards.test.ts`, `halo-motion.test.ts`, `use-state-ratchet.test.ts`, `oxlint`, `check:compiler`, `audit:arch`, and `docs:check`. |
