# Facet 4 sidebar: one source list

Date: 2026-10-04. Status: implemented (foundation + sidebar); per-app sweep in progress (2026-10-05). Reference: [`docs/reference/facet-design-system.md`](../reference/facet-design-system.md).
Parent: [`docs/specs/2026-10-04-facet-4-design.md`](2026-10-04-facet-4-design.md) (section 6, sub-project 3).

## 1. Goal

One native, macOS-style source list is the only navigation on every page. It replaces the app-switcher dropdown and every per-app sidebar, rail and hidden sub-navigation. Nothing reachable today becomes unreachable.

Success:
- Every page has exactly one navigation system: `AppSidebar` at 1024px and up, `TabBar` plus More sheet below.
- No `data-app-subnav` attribute or CSS rule remains, and no hidden navigation is rendered.
- Features that only lived in hidden navigation (MyCountry inbox count, forum Reply and Share) are visible again.
- Every `href` in the section map is reachable from the source list.

## 2. Decisions

| Topic | Decision |
|---|---|
| Disclosure | All main apps are listed. The current app is always open. Other apps open and close by hand; their state is remembered. Admin and Settings stay at the bottom. |
| Item sub-navigation and actions | The sidebar has two levels only: apps, then sections. An item's sub-views (league tabs, article Read/Edit/History/Talk) are `Tabs` under its `PageHeader`. Page actions (Reply, Share, Edit, New page) are `PageHeader` toolbar actions. Counts are badges on sidebar rows. |
| Widgets | Inline on rows: your flag as the MyCountry icon, the IxCredits balance as the Vault row's trailing value, a copper "Daily reward" row under Vault while claimable, the diplomacy inbox count on Diplomacy. Player and wiki profile widgets fold into the account menu. Quick links are dropped. Earnings and treasury revenue move to the Vault dashboard. |
| Admin and Settings | Area mode, like macOS System Settings: inside `/admin` or `/settings` the sidebar shows that area's grouped list with collapsible group headings and a "‹ All apps" row. |
| Narrow and collapsed | Breakpoints unchanged. 1024px and up: 256px sidebar, collapsible to a 64px icon rail with badge dots; clicking a rail icon opens a popover with that app's sections. Below 1024px: `TabBar` (four apps) plus a More sheet rendering the same source list. |

## 3. Components

### `SourceList` (new: `src/components/shell/SourceList.tsx`)

Presentational. Props: `pathname`, `searchParams`, `apps` (visible apps), `expanded` (set of app ids and admin group ids) with `onToggle`, `badges` (record by badge key), `variant: "sidebar" | "sheet" | "popover"`, and for `popover` the single `app` to render.

Renders:
- **Main mode:** one row per main app (icon, label, trailing badge, disclosure chevron). An open app shows its section rows, grouped by `group` headings where present. The current section is `aria-current="page"` with the existing sliding tint highlight. Footer apps (Admin, Settings) render as single rows after the main list.
- **Area mode** (current app has `placement: "footer"`): a "‹ All apps" row linking to `/dashboard`, then that app's sections under collapsible group headings.
- Semantics: `<nav aria-label="App navigation">` with nested `<ul>`s; disclosure toggles are `<button aria-expanded aria-controls>`; links stay in normal tab order. No roving tabindex.
- Rows meet the 44px coarse-pointer target and use Facet 4 roles only (`facet-chrome` is the host's job, not the list's).

### `AppSidebar` (rewritten host)

`facet-chrome` panel: `SourceList variant="sidebar"`, then the account row (`AccountMenu layout="sidebar"`) and the collapse toggle. The app-switcher dropdown is deleted. In the collapsed rail it renders app icons with badge dots; each icon opens a `Popover` containing `SourceList variant="popover" app={…}`.

### `TabBar` (host change)

Keeps its four app tabs. The More sheet body becomes `SourceList variant="sheet"` plus the account section, replacing its hand-built list.

### State

- `useNavExpanded()` (new, `src/lib/navigation/use-nav-expanded.ts`): the set of open app ids and admin group ids, stored in localStorage under a new `NAV_STORAGE_KEYS.expanded` key and synced across tabs (same pattern as `use-sidebar-collapsed.ts`). Read after hydration; the server renders only the current app open. The current app is always treated as open and is not stored.
- The collapsed rail keeps its `data-sidebar="collapsed"` pre-paint mechanism unchanged.

### Badges

- `AppDefinition` and `AppSection` gain an optional `badge?: NavBadgeKey`. Keys: `mycountry-flag` (MyCountry app icon), `diplomacy-inbox` (Diplomacy section), `vault-balance` (Vault app trailing value), `daily-reward` (a Vault section row shown only while claimable).
- `useNavBadges()` (new, `src/lib/navigation/use-nav-badges.ts`) runs the existing queries once in `FacetShell` when signed in: the country query `DashboardPlayerWidget` uses (flag), `useDiplomacyInboxCount`, `api.vault.getBalance` (balance, `canClaimDailyBonus`, `loginStreak`). It returns `Record<NavBadgeKey, NavBadge | undefined>`. Loading or signed out returns no badges; rows render without them (no skeletons, no layout shift).
- With an app collapsed or in the rail, any section badge on it shows as a dot on the app row.

### Daily reward

`DailyBonusWidget` splits into `DailyRewardDialog` (controlled dialog plus the once-per-UTC-day auto-open, unchanged behaviour and look) and a trigger. The dialog mounts once in `FacetShell`, so it auto-opens on any page. The sidebar "Daily reward" row opens it; after a claim the row disappears. `VaultWidget` no longer renders the trigger.

## 4. Migration

| Today | Destination | Removed |
|---|---|---|
| `DashboardSidebarLayout` left column: player, Vault widget, quick links | Player: account menu. Vault widget: Vault row and Vault dashboard. Quick links: dropped | left column, collapse/rail code |
| Dashboard right column (Trending, Blurb, Explore, Tiers) | `Inspector` on `/dashboard` | right sticky column |
| `VaultSidebarLayout` rail and mobile pill nav (`/vault`, `/achievements`, `/thinktanks`) | Earnings and treasury revenue: a Vault dashboard card. Others: plain page layout | `VaultSidebarLayout`, `VaultSubTabNav` |
| `WikiOSUnifiedSidebar` (profile, search, Create, page tools) | Profile: account menu. Search: Wiki › Search. Create: "New page" toolbar action. Page tools: article `Tabs` (Read, Edit, History, Talk) plus a toolbar overflow menu | `WikiOSUnifiedSidebar`, the rail in `WikiOSLayout` |
| `ForumLayout` pill bar and icon rail (Reply, Share) | Thread `PageHeader` actions: Reply (primary), Share | rails and their CSS (`.forum-icon-rail`, `.forum-mobile-nav`) |
| MyCountry domain tiles and segmented control in `UnifiedGlassCommandBar` | Inbox: Diplomacy badge. Domain peeks: Overview page content. Switching: sidebar | the hidden tiles and control |
| Sports: `SportsShell` left nav (`SportsSidebarNav`, 14 items) and `SportsCommandBar` | League and club sub-views: `Tabs` under `PageHeader`; breadcrumbs: `PageHeader` back button | `SportsSidebarNav`, `SportsCommandBar`, the left `<aside>` |
| Sports right focus panel | `Inspector` | `SportsFocusPanel` column wrapper |
| `ThinktankDirectorySidebar` | `/thinktanks` page body; `Inspector` on a group page | the default Dashboard rail |
| `AdminSidebarNavWidget` | Admin area mode | the widget |
| `[data-app-subnav]` rule in `shell.css` and every attribute | none | all |

`src/components/mycountry/shell/headers/UnifiedGlassCommandBar.tsx` has an uncommitted user edit. The plan does not modify that file until the user has committed or discarded the edit.

## 5. Out of scope

- The per-app visual sweep (content types, eyebrows, decoration) beyond what moving navigation requires.
- New apps or sections; renaming routes.
- Builder's `BuilderSidebarLayout` (it renders no sidebar; it is a misnamed wrapper handled by the sweep).

## 6. Testing

- `SourceList`: current app always open; toggling and remembered state; area mode with "‹ All apps"; group headings collapse; `aria-current`; badges and collapsed dots; popover variant renders one app.
- `useNavExpanded` and `useNavBadges` unit tests (signed out returns nothing; loading returns nothing; claimable adds the daily-reward badge).
- `DailyRewardDialog`: existing widget tests move with it; plus the sidebar row opens the dialog and disappears after a claim.
- Architecture: no `data-app-subnav` anywhere; the deleted component names are not imported; reachability: every section `href` in `app-sections.ts` renders a link in `SourceList` (main or area mode).
- Gates: `typecheck:ui`, `typecheck:server`, Jest, lint. Signed-in screenshots in both themes of `/dashboard`, `/vault`, `/wiki` article, a forum thread, `/myleague/[id]`, `/admin`, and phone width (More sheet).
