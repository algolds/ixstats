# Dashboard

**Last updated:** October 2026

The signed-in dashboard is a social home. It surfaces the user's nation at a
glance, a platform-wide activity feed, the persona **Accounts** section, and
trending content and community cards in an Inspector. Links into the rest of
IxStats are the sidebar's source list. `/dashboard` and `/dashboard/accounts`
render `DashboardRouter`; the feed's post, profile and saved pages are pages of
their own (below). ThinkPages itself is the forum, at `/thinkpages`
(`src/app/thinkpages/README.md`); this directory holds the feed and personas.

## Routes

| Route        | Page title            | File                                   |
| ------------ | --------------------- | -------------------------------------- |
| `/dashboard` | "Dashboard - IxStats" | `page.tsx` → `DashboardPageClient.tsx` |
| `/dashboard/accounts` | "Accounts - IxStats" | `accounts/page.tsx` → `DashboardPageClient.tsx` (`initialSection="accounts"`) |
| `/dashboard/post/[postId]` | feed post | `post/[postId]/page.tsx` (client page: a feed post with replies and the inline reply composer) |
| `/dashboard/profile/[username]` | persona profile | `profile/[username]/page.tsx` (client page: a persona's posts, followers and following) |
| `/dashboard/saved` | "Saved posts - IxStats" | `saved/page.tsx` (client component `SavedPosts`; signed-in only) |

Feed posts and persona profiles are public, as they were under `/thinkpages`; Accounts and
Saved posts need a sign-in. The old `/thinkpages/profile/<username>` and `/thinkpages/saved`
paths redirect (308) to `/dashboard/profile/<username>` and `/dashboard/saved`.
`/thinkpages/post/<id>` is the forum's post permalink: a forum post the viewer may see
redirects (307) to its thread, and any other id redirects (307) to `/dashboard/post/<id>`.
The former `/dashboard/world`, `/dashboard/diplomacy`, `/dashboard/feed`, and
`/dashboard/trends` sub-routes no longer exist.

`/dashboard` and `/dashboard/accounts` are the two sections of a single-page router: `useDashboardSection`
(`src/hooks/useDashboardSection.ts`, paths and titles in `src/lib/dashboard-sections.ts`)
switches them in place with `pushState`, follows back/forward through `popstate`, and
re-syncs from `usePathname()` when a sidebar link moves between the two routes. The
Accounts section is the persona hub (`src/components/dashboard/accounts/AccountsSection.tsx`);
the feed's account manager dialog links to it ("Manage accounts"). Hero collapse and the
feed tab are not reflected in the URL.

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
- There is no player widget, Vault card or quick-links column: the page is a plain
  centred column. The Vault balance and Daily reward are badges and a row in the
  sidebar's Vault entry, and links to other apps are the source list.
- `BlurbSection` daily-prompt widget. A new build is announced by the sidebar's "What's new" row
  (shown while the build is unseen; `src/lib/navigation/seen-version.ts`), not a banner.
- **Widgets**: the Inspector's trend and community widgets are plain `Card`s with an `h2` title under
  the page's visually hidden `h1` ("Dashboard"). The pressable Blurb card is itself the
  button, so its "Respond" pill is visual. Only the hero keeps the glass material.

## Architecture

```
page.tsx / accounts/page.tsx (server: resolves signed-in country id) → DashboardPageClient
  (useDashboardSection: "home" | "accounts")
  → DashboardErrorBoundary → DashboardRouter(initialCountryId, section, onNavigate)
  DashboardColumn (a plain centred column; no rail)
    ├ heroSection:  DashboardHero      (home only; collapsible; HeroSnapshotPanels)
    └ children:     home → UnifiedDashboardSection (feed + Inspector)
                    accounts → AccountsSection (loaded lazily)
```

Key files (all under `src/components/dashboard/`):

| Component                                               | Role                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `DashboardRouter.tsx`                                   | Top-level orchestration (global stats, map-link status, hero collapse) |
| `hero/DashboardHero.tsx`, `hero/HeroSnapshotPanels.tsx` | Nation hero and snapshot panels                                        |
| `DashboardColumn.tsx`                                   | Shared content layout: a plain centred column (hero, children)         |
| `accounts/AccountsSection.tsx`                          | The Accounts section: persona list, create and settings modals         |
| `accounts/EnhancedAccountManager.tsx`, `accounts/AccountCreationModal.tsx`, `accounts/AccountSettingsModal.tsx`, `accounts/AccountManagerModal.tsx` | Persona management dialogs |
| `accounts/form/`                                        | Creation form parts: type selector, details form, traits, username check |
| `sections/UnifiedDashboardSection.tsx`                  | Feed tabs, composer, Inspector with the community widgets              |
| `sections/UnifiedFeedContent.tsx`                       | Feed/Following stream rendering                                        |
| `sections/TrendingSectionWidget.tsx`                    | Trending content                                                       |
| `sections/CountriesToExploreCard.tsx`                   | Suggested countries                                                    |
| `sections/BlurbSection.tsx`                             | Daily blurb prompt                                                     |

Hooks: `useUser` (auth), `usePremium`, `useActiveCosmetics` (avatar glow / chat
badge / neon frame), `useNotify`, `usePageTitle`.

## Data sources

Verified `api.*` (tRPC) calls used across the dashboard tree:

- **User / nation**: `users.getProfile`, `countries.getByIdAtTime`,
  `countries.getGlobalStats`, `countries.getRandomCountries`,
  `countries.getActivityRingsData`, `countries.getMapLinkStatus`,
  `mycountry.getCountryDashboard`
- **Social feed**: `activities.getGlobalFeed`, `activities.getFollowingFeed`,
  `activities.getUnifiedTrending`, `activities.followCountry`,
  `thinkpages.getMyAccounts`, `blurbs.*`
- **Feedback**: `userLogging.submitFeedback`
- **Wiki**: `wikios.getIntro`, `wikios.getRecentChanges`,
  `wikios.getForumThreadPreview`, `wikios.getPageImages`,
  `wikios.getArticleMarginData`, `wikios.createThread`, `wikios.*Stash*`,
  `users.resolveWikiAuthor`

## Connections to other systems

The dashboard surfaces:

- **MyCountry**: hero "MyCountry" link and the country's vitality data.
- **IxVault**: credit balance and Daily reward are sidebar badges (`src/components/shell/use-nav-badges.ts`).
- **ThinkPages / Activities** — global & following feeds, in-feed composer.
- **Maps (IxWorld)** — embedded `CountryMapEmbed` of the user's nation.
- **Wiki & Stashes**: wiki-sourced feed content.
