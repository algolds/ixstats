# Shell, Halo & Command Palette Cohesion Design

**Date:** 2026-11-15
**Status:** Approved

## Goal

Unify `AppSidebar`, mobile `TabBar`, `Halo` (`CommandPalette`), contextual Halo plugins, `NavTray`, and `⌘K` Search so every surface has one clear job, consistent terminology, shared live state, and fluid keyboard/pointer physics.

## 1. Account Mental Model

- **Halo `AccountView` (`MyCountry | Passport`) is primary:** Clicking Halo's greeting (`[Clerk portrait] Good afternoon, Ada`) opens the rich two-sided `AccountView`.
- **Persistent Account trigger when a plugin owns Halo's center:** Whenever an active plugin supplies `pluginCenter` (`WikiHalo` on an article or active narrator, `BuilderHalo`, `SportsLiveHalo`), `CompactView` renders a compact `Account` button (`triggerFor="mycountry"`) on Halo's right action rail so `AccountView` remains one click away on every route (and via `⌘K` → `Account`).
- **Slimmed, portrait-led `AccountMenu`:** `AccountMenu` remains anchored at the bottom-left of `AppSidebar` (and inline in `TabBar`'s `More` sheet), displays the personal Clerk portrait (`user.imageUrl`) rather than overwriting it with the nation flag, links `MyCountry` directly to `/mycountry` (instead of opening the Country Actions Sheet), keeps `Passport` (`/@me`), `Stash` (`/stashes`), `NationSwitcher`, `Finish setup` (when needed), external `Manage account`, and `Sign out`, removes duplicate `Theme` and `/settings?tab=account` rows, and renders `Privacy · Terms` only in sheet/collapsed contexts where `SidebarFooterLinks` is hidden.
- **Tightened `SidebarVaultCard`:** When collapsed and today's daily reward is already claimed, `DailyRewardStatus` omits the inert `"Daily claimed"` banner (`hideWhenClaimed`) so the sidebar footer stays compact while still surfacing `"Daily reward"` whenever claimable.

## 2. Clean Plugin Boundaries

- **`MyCountryHalo`:** Retires its `<Crown /> MyCountry` center override and deletes `MyCountryActionsView`. Registers `MYCOUNTRY_PLUGIN_COMMANDS` (`Declare directive`, `Open diplomacy`, `Open economy`, `Open defense`, `Open politics`, `Open country editor`, `Open map editor`) as `"On this page"` commands in `⌘K` while leaving Halo's pill greeting intact on `/mycountry`.
- **`WikiHalo`:** Claims Halo's center pill (`WikiBreadcrumb` + `WikiCenterActions`) only when viewing a specific article (`articleTitle` other than `"IxWiki"` / `"Main Page"`) or while narration is active. On non-article Wiki routes (`/wiki`, `/util/*`, `/stashes`, `/blurbs`), Halo keeps its standard greeting → `AccountView`, while `WikiHalo` exposes `Wiki workspace` as a pill action button and `"On this page"` command opening the streamlined `WikiProfileView` (paused sessions, scratchpad, and recent pages — with the duplicate `Wiki profile` tab and `Country management` sub-screen removed).

## 3. Chromeless-Only `NavTray`

- **Standard shell pages (`!isChromelessPath`):** Disable Halo's vertical drag gesture and `NavTray`, since `AppSidebar` (desktop) and `TabBar` (mobile) own app-switching.
- **Chromeless routes where Halo mounts (`/mycountry/map-editor`, `/admin/maps/*`):** Provide both an explicit `Apps` (`ViewGrid`) button on Halo's pill (`aria-expanded`) and a natural **downward** pull gesture (`offset.y > 30 || velocity.y > 200`) to open `NavTray` below the island.

## 4. Zero-Query Command Palette (`⌘K`) & Unified Filters

- **Unified filter tabs:** `All | Wiki | Countries | Realms | Commands` (`SearchFilter = "all" | "wiki" | "countries" | "realms" | "commands"`). `CORE_FEATURES` (`Refresh data`, `Notifications` with `Bell` icon) fold into `Commands`; the self-referential `"Search"` entry is removed.
- **Zero-query launcher:** Empty queries immediately surface `"On this page"` plugin commands plus curated top destinations/actions under `All`, Wiki page actions + Wiki navigation commands under `Wiki`, and browsable entries under `Countries`, `Realms`, and `Commands`.
- **Complete shell actions & aligned naming:** Adds `Passport` (`/@me`), `Account` (`#mycountry`), `Quick settings` (`#settings`), `Toggle sidebar` (`toggle-sidebar`), `Claim daily reward` (`daily-reward`), and `Send feedback` (`open-feedback`); renames MyCountry sidebar `Editor` → `Country editor`, adds `Map editor` to `withCountryRows`, and aligns `EXTRA_HALO_COMMANDS` (`Map editor`) and `MyCountryLogomark` icons (`app-sections.ts`, `country-actions.ts`).

## 5. State, Motion, Badges & Keyboard Cohesion

- **Settings ↔ Search size & transition fix:** Removes `SettingsView`'s unmount `setSize(SIZE_PRESETS.MEDIUM)` race, makes `computeExpandedSize` deterministic per mode, switches `ExpandedView` to `<AnimatePresence mode="popLayout" initial={false}>`, routes `"Wiki system settings"` via `navigateWithBasePath("/settings?tab=wikios", router)`, and clarifies `"Quick search"` copy (`"Start Halo search on Wiki tab"`).
- **Mobile `TabBar` badges & contextual `All apps` back link:** Renders unread count pills / pending dots on `TabBar` primary tabs and an aggregate pending dot on `More`; tracks the last non-area route in `FacetShell` (`backHref`, defaulting to `"/dashboard"`) so `All apps` in `Settings` and `Admin` returns to where the user came from.
- **Server-synced `mark-all-read`:** `⌘K` `"Mark all notifications read"` executes server `notifications.markAllAsRead` + `messages.markAllAsRead` mutations alongside store cleanup and invalidates `notifications.getUserNotifications`, `notifications.getUnreadCount`, and `messages.getFolderCounts` (also added to `NotificationsView`'s `markAllMessagesMutation`).
- **Sidebar & Palette keyboard physics:** Smoothly animates sidebar width, `[data-shell-main]` padding, and `ShellHalo` horizontal offset via `data-sidebar-animating` (`--duration-slow`, `--ease-out-facet`, `0ms` under Reduce Motion); adds `⌘\` / `Ctrl+\` to toggle the sidebar; cycles Search filters via `Alt+←` / `Alt+→` (or plain `←` / `→` when the query is empty); surfaces platform shortcut hints on Halo and Sidebar tooltips.
