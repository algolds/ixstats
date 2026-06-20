# Dashboard

**Last updated:** June 2026

The signed-in dashboard is a navigation hub and social home. It surfaces the
user's nation at a glance, a platform-wide activity feed (ThinkPages), trending
content, community widgets, and quick links into the rest of IxStats. All page
routes render the **same** `DashboardRouter` component — there is no per-route
content branching beyond the browser/page title.

## Routes

Every route below renders `<DashboardRouter />` (wrapped in
`DashboardErrorBoundary`); they differ only by `usePageTitle`. Source:
`src/app/dashboard/*/page.tsx`.

| Route | Page title | File |
|-------|-----------|------|
| `/dashboard` | "Dashboard" | `page.tsx` |
| `/dashboard/world` | "World - Dashboard" | `world/page.tsx` |
| `/dashboard/diplomacy` | "Diplomacy & Crises - Dashboard" | `diplomacy/page.tsx` |
| `/dashboard/feed` | "Feed - Dashboard" | `feed/page.tsx` |
| `/dashboard/trends` | "The World - Dashboard" | `trends/page.tsx` |

`loading.tsx` provides the route-level loading fallback.

> Note: unlike MyCountry/Vault/ThinkPages, `DashboardRouter` does **not** use a
> `useState` + `pushState` single-page section router. The only stateful
> sections are the hero's nav pills (below), driven by hover/click — not by URL.

## Key features

- **Nation hero** (`DashboardHero`): embedded country map (`CountryMapEmbed`),
  flag, leader, economic/population tier badges, GDP-per-capita global rank,
  IxVault credit balance + login streak, and continent/government badges.
- **Hero nav pills**: Overview, Executive, Diplomacy, Intelligence, Defense —
  hover (400 ms) or click to switch the snapshot panel; auto-cycles after 60 s
  of inactivity. **Intelligence and Defense are MyCountry-premium only**
  (`usePremium`); hidden otherwise. Hero is collapsible.
- **Unified feed** (`UnifiedDashboardSection`): tabbed activity stream — All
  Activity, Following (country owners only), Community — with an inline
  ThinkPages composer (`GlassCanvasComposer`) and account switching.
- **Community sidebar**: Trending Now (`TrendingSectionWidget`), Countries to
  Explore (`CountriesToExploreCard`), and Economic Tier Distribution.
- **Left rail widgets**: player/nation widget with Mail / Issues / Actions
  quick-actions and active-crisis banner, `VaultWidget`, and quick links.
- `NewVersionNotice` alert banner; `BlurbSection` daily-prompt widget.

## Architecture

```
page.tsx → DashboardErrorBoundary → DashboardRouter
  DashboardSidebarLayout (icon rail + content; collapse disabled here)
    ├ heroSection:  DashboardHero      (collapsible, premium-gated pills)
    ├ alerts:       NewVersionNotice
    ├ left rail:    DashboardPlayerWidget · VaultWidget · DashboardQuickLinks
    └ children:     UnifiedDashboardSection (feed + community sidebar)
```

Key files (all under `src/components/dashboard/`):

| Component | Role |
|-----------|------|
| `DashboardRouter.tsx` | Top-level orchestration + `DashboardHero` |
| `sidebar/DashboardSidebarLayout.tsx` | Shared rail/content grid, sidebar context |
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
  `mycountry.getRankings`
- **Vault**: `vault.getBalance`, `achievements.getAllWithStatus`
- **Executive / sim**: `policies.getPolicies`, `meetings.getMeetings`,
  `nationalIssues.getPendingCount`, `crisisEvents.getActive`,
  `crisisEvents.getStatistics`
- **Diplomacy / intel / defense**: `diplomaticCore.getRelationships`,
  `diplomaticEmbassies.getEmbassies`, `intelCore.getOverview`,
  `security.getDefenseOverview`, `security.getSecurityAssessment`,
  `security.getMilitaryBranches`
- **Social feed**: `activities.getGlobalFeed`, `activities.getFollowingFeed`,
  `activities.getUnifiedTrending`, `activities.followCountry`,
  `thinkpages.getMyAccounts`, `blurbs.*`
- **Messaging**: `messages.getFolderCounts`
- **Wiki**: `wiki.getIntro`, `wiki.getRecentChanges`,
  `wiki.getForumThreadPreview`, `users.resolveWikiAuthor`

## Connections to other systems

The dashboard is a hub that links/surfaces:

- **MyCountry** — hero pills + "Go to MyCountry" link; Issues/Actions deep-link
  to `/mycountry/executive`; crisis banner.
- **IxVault** — credit balance, login streak, `VaultWidget`, collector
  achievement badges.
- **ThinkPages / Activities** — global & following feeds, in-feed composer.
- **Messages** — `/messages` quick action with unread counts.
- **Maps (IxWorld)** — embedded `CountryMapEmbed` of the user's nation.
- **Diplomacy / Intelligence / Defense / Crises** — snapshot panels in the hero.
- **Wiki & Stashes** — quick links and wiki-sourced feed content.
