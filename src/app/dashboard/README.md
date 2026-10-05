# Dashboard

**Last updated:** September 2026

The signed-in dashboard is a navigation hub and social home. It surfaces the
user's nation at a glance, a platform-wide activity feed (ThinkPages), trending
content, community widgets, and quick links into the rest of IxStats. There is
a single route that renders `DashboardRouter`.

## Routes

| Route | Page title | File |
|-------|-----------|------|
| `/dashboard` | "Dashboard - IxStats" | `page.tsx` → `DashboardPageClient.tsx` |

The former `/dashboard/world`, `/dashboard/diplomacy`, `/dashboard/feed`, and
`/dashboard/trends` sub-routes no longer exist.

> Note: unlike MyCountry/Vault/ThinkPages, `DashboardRouter` does **not** use a
> `useState` + `pushState` single-page section router. The only stateful
> state is hero collapse and the feed tab — neither is reflected in the URL.

## Key features

- **Nation hero** (`hero/DashboardHero.tsx`): embedded country map
  (`CountryMapEmbed`), flag, leader, cosmetics, a "MyCountry" link, and
  `HeroSnapshotPanels` — a telemetry header bar, four vitality rings (opening
  the GDP / population / government-spending / vitality breakdown modals), and
  an executive telemetry micro-bar. The hero is collapsible and starts collapsed
  when the nation has no linked map territory (`countries.getMapLinkStatus`).
- **Unified feed** (`UnifiedDashboardSection`): tabbed activity stream — All
  activity, Following (country owners only), Community — with an inline
  ThinkPages composer (`GlassCanvasComposer`) and account switching.
- **Around IxStates Inspector**: Trending Now (`TrendingSectionWidget`), Countries to
  Explore (`CountriesToExploreCard`), and Economic Tier Distribution. An aside at
  1280px and up; below that the "Trends" button in the feed toolbar opens it as a sheet.
- The player widget, Vault and quick links no longer have a page column: they live in
  the account menu and the app source list.
- `NewVersionNotice` alert banner; `BlurbSection` daily-prompt widget.
- **Widgets**: sidebar and community widgets are plain `Card`s with an `h2` title under
  the page's visually hidden `h1` ("Dashboard"). The pressable Blurb card is itself the
  button, so its "Respond" pill is visual. Only the hero keeps the glass material.

## Architecture

```
page.tsx (server: resolves signed-in country id) → DashboardPageClient
  → DashboardErrorBoundary → DashboardRouter(initialCountryId)
  DashboardSidebarLayout (a plain centred column; no rail)
    ├ heroSection:  DashboardHero      (collapsible; HeroSnapshotPanels)
    ├ alerts:       NewVersionNotice
    └ children:     UnifiedDashboardSection (feed + Inspector)
```

Key files (all under `src/components/dashboard/`):

| Component | Role |
|-----------|------|
| `DashboardRouter.tsx` | Top-level orchestration (global stats, map-link status, hero collapse) |
| `hero/DashboardHero.tsx`, `hero/HeroSnapshotPanels.tsx` | Nation hero and snapshot panels |
| `sidebar/DashboardSidebarLayout.tsx` | Shared content layout; renders a collapsible rail only when given `sidebarContent` |
| `sections/UnifiedDashboardSection.tsx` | Feed tabs, composer, Inspector with the community widgets |
| `sections/UnifiedFeedContent.tsx` | Feed/Following stream rendering |
| `sections/TrendingSectionWidget.tsx` | Trending content |
| `sections/CountriesToExploreCard.tsx` | Suggested countries |
| `sections/BlurbSection.tsx` | Daily blurb prompt |

Hooks: `useUser` (auth), `usePremium`, `useActiveCosmetics` (avatar glow / chat
badge / neon frame), `useNotify`, `usePageTitle`.

## Data sources

Verified `api.*` (tRPC) calls used across the dashboard tree:

- **User / nation**: `users.getProfile`, `countries.getByIdAtTime`,
  `countries.getGlobalStats`, `countries.getRandomCountries`,
  `countries.getActivityRingsData`, `countries.getMapLinkStatus`,
  `mycountry.getRankings`, `mycountry.getCountryDashboard`
- **Vault**: `vault.getBalance` (via the Vault dashboard wallet card), `achievements.getAllWithStatus`
- **Executive / sim**: `meetings.getMeetings`,
  `nationalIssues.getPendingCount`, `crisisEvents.getStatistics`
- **Social feed**: `activities.getGlobalFeed`, `activities.getFollowingFeed`,
  `activities.getUnifiedTrending`, `activities.followCountry`,
  `thinkpages.getMyAccounts`, `blurbs.*`
- **Messaging / notifications**: `messages.getFolderCounts`,
  `notifications.getUserNotifications`, `userLogging.submitFeedback`
- **Wiki**: `wikios.getIntro`, `wikios.getRecentChanges`,
  `wikios.getForumThreadPreview`, `wikios.getPageImages`,
  `wikios.getArticleMarginData`, `wikios.createThread`, `wikios.*Stash*`,
  `users.resolveWikiAuthor`

## Connections to other systems

The dashboard is a hub that links/surfaces:

- **MyCountry** — hero "MyCountry" link; Issues/Actions deep-link
  to `/mycountry/executive`; crisis banner.
- **IxVault** — credit balance, login streak, collector
  achievement badges.
- **ThinkPages / Activities** — global & following feeds, in-feed composer.
- **Messages** — `/messages` quick action with unread counts.
- **Maps (IxWorld)** — embedded `CountryMapEmbed` of the user's nation.
- **Crises** — active-crisis count in the player widget (`crisisEvents.getStatistics`).
- **Wiki & Stashes** — quick links and wiki-sourced feed content.
