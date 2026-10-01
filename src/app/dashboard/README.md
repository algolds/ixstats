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
  The old per-section nav pills (`HERO_NAV`) are defined but not rendered.
- **Unified feed** (`UnifiedDashboardSection`): tabbed activity stream — All
  Activity, Following (country owners only), Community — with an inline
  ThinkPages composer (`GlassCanvasComposer`) and account switching.
- **Community sidebar**: Trending Now (`TrendingSectionWidget`), Countries to
  Explore (`CountriesToExploreCard`), and Economic Tier Distribution.
- **Left rail widgets**: player/nation widget with Mail / Issues / Actions
  quick-actions and active-crisis banner, `VaultWidget`, and quick links.
- `NewVersionNotice` alert banner; `BlurbSection` daily-prompt widget.
- **Widget identity (Facet 3.1)**: each sidebar widget is a `CutoutCard` in its v2
  hue — Trending orange, Blurb indigo, Countries blue, Economic tiers green, Quick
  links cyan, player indigo — via `accent="…" retint` (the player's quick-action
  tiles use `facetAccentStyle` + `facet-retint`). Widget titles are
  `CutoutCardHeader as="h2"` under the page's visually hidden `h1` ("Dashboard");
  the pressable Blurb card is itself the button, so its "Respond" pill is visual.

## Architecture

```
page.tsx (server: resolves signed-in country id) → DashboardPageClient
  → DashboardErrorBoundary → DashboardRouter(initialCountryId)
  DashboardSidebarLayout (icon rail + content; collapse disabled here)
    ├ heroSection:  DashboardHero      (collapsible; HeroSnapshotPanels)
    ├ alerts:       NewVersionNotice
    ├ left rail:    DashboardPlayerWidget · VaultWidget · DashboardQuickLinks
    └ children:     UnifiedDashboardSection (feed + community sidebar)
```

Key files (all under `src/components/dashboard/`):

| Component | Role |
|-----------|------|
| `DashboardRouter.tsx` | Top-level orchestration (global stats, map-link status, hero collapse) |
| `hero/DashboardHero.tsx`, `hero/HeroSnapshotPanels.tsx` | Nation hero and snapshot panels |
| `sidebar/DashboardSidebarLayout.tsx` | Shared rail/content grid; mounts `DashboardPlayerWidget`, `VaultWidget` (from `src/components/mycountry/shell/`) and `DashboardQuickLinks` |
| `sidebar/DashboardPlayerWidget.tsx` | Nation widget, message/issue/action counts |
| `sidebar/DashboardQuickLinks.tsx` | Quick links, status, build version |
| `sections/UnifiedDashboardSection.tsx` | Feed tabs, composer, community widgets |
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
- **Vault**: `vault.getBalance` (via `VaultWidget`), `achievements.getAllWithStatus`
- **Executive / sim**: `policies.getPolicies`, `meetings.getMeetings`,
  `nationalIssues.getPendingCount`, `crisisEvents.getActive`,
  `crisisEvents.getStatistics`
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
- **IxVault** — credit balance, login streak, `VaultWidget`, collector
  achievement badges.
- **ThinkPages / Activities** — global & following feeds, in-feed composer.
- **Messages** — `/messages` quick action with unread counts.
- **Maps (IxWorld)** — embedded `CountryMapEmbed` of the user's nation.
- **Crises** — active-crisis count in the player widget (`crisisEvents.getStatistics`).
- **Wiki & Stashes** — quick links and wiki-sourced feed content.
