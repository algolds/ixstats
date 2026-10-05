import { type Metadata } from "next";
import { PLATFORM_VERSION, RELEASE_NAME, CHANNEL, CHANNEL_CONFIG } from "~/lib/buildVersion";
import { StatusIndicator } from "~/components/ui/status-indicator";
import { cn } from "~/lib/utils";
import { ChangelogFeed, type Release } from "./_components/ChangelogFeed";
import { PageHeader } from "~/components/shell/PageHeader";
import { MarkVersionSeen } from "./_components/MarkVersionSeen";

export const metadata: Metadata = {
  title: "Changelog | IxStates",
  description: "Platform features, simulation updates, engine upgrades and fixes.",
};

const RELEASES: Release[] = [
  {
    version: "1.4.0",
    releaseName: "Lobster Crosby",
    date: "August 2026",
    channel: "Release Candidate",
    isCurrent: true,
    tagline:
      "Unified messaging, Statecraft policy builder, TypeScript 7 and Bun 1.4, and the Facet design system.",
    items: [
      {
        id: "v14-messaging",
        category: "feature",
        title: "Messaging and ThinkShare",
        description:
          "One inbox for diplomatic dispatches, group channels and ThinkShare, with reactions and presence across apps.",
        highlights: [
          "Bilateral and multilateral diplomatic channels",
          "Emoji reactions, thread replies and message editing",
          "Unread counts with one-click folder catch-up",
        ],
        link: { href: "/messages", label: "Open messages" },
      },
      {
        id: "v14-statecraft",
        category: "feature",
        title: "Statecraft policy builder",
        description:
          "Compose tax structures, budgets and economic directives for your nation and see the budget impact as you edit.",
        highlights: [
          "Live budget impact while you change a policy",
          "Slot-based component selectors with category filters",
          "Synergy and conflict detection between policies",
        ],
        link: { href: "/mycountry", label: "Open MyCountry" },
      },
      {
        id: "v14-halo",
        category: "feature",
        title: "Halo command palette",
        description:
          "Press ⌘K to jump to any page, search by keyword or synonym, and run system actions without leaving the page.",
        highlights: [
          "Keyboard navigation across Statecraft, Vault, Maps, Wiki, Forum, Sports and Labs",
          "Keyword and synonym search",
          "Actions for theme, sound effects and compact mode",
        ],
      },
      {
        id: "v14-ts7-bun",
        category: "engine",
        title: "TypeScript 7 and Bun 1.4",
        description:
          "The compiler is now the native TypeScript 7 build. Typechecking takes about 2 seconds and uses roughly 80% less memory.",
        highlights: [
          "CLI starts in under 10 ms; scheduled jobs use Bun.cron()",
          "Copy-on-write polygon operations and dependency-free color math",
          "Typecheck and architecture checks pass end to end",
        ],
      },
      {
        id: "v14-facet",
        category: "improvement",
        title: "Facet design system",
        description:
          "A consistent set of surfaces, spring animations and light and dark themes across every module.",
        highlights: [
          "Interruptible gesture transitions and fluid motion curves",
          "Semantic color tokens with stronger contrast",
          "Dossier menus and achievement dialogs follow the active theme",
        ],
      },
      {
        id: "v14-flag-service",
        category: "improvement",
        title: "Flag service",
        description:
          "Flags resolve from the database first, then a memory cache, then Wikimedia Commons.",
        highlights: [
          "Cached lookups for all 82+ custom and fictional nations",
          "Batched requests that never modify flag data",
          "Placeholder flags when none is found, with base-path routing",
        ],
        link: { href: "/countries", label: "Browse countries" },
      },
      {
        id: "v14-unread-fix",
        category: "fix",
        title: "Unread counts",
        description:
          "Unread badges now count unread messages instead of conversations, so they show 0 once everything is read.",
        highlights: [
          "One batched query for all unread counts",
          "Mark all as read clears the inbox in one action",
          "Works for both Clerk and internal user IDs",
        ],
      },
      {
        id: "v14-trending-pulse",
        category: "fix",
        title: "Trending topics and live activity",
        description:
          "The dashboard trending widget now labels each item by type and distinguishes social, wiki and forum activity.",
        highlights: [
          "Categories for map updates, economic milestones and diplomacy",
          "Preview cards for linked wiki articles and forum threads",
        ],
        link: { href: "/dashboard", label: "Open dashboard" },
      },
    ],
  },
  {
    version: "1.3.0",
    releaseName: "Epona",
    date: "July 2026",
    channel: "Stable",
    tagline: "WikiOS reader, LoreStash, a unified activity feed and metric explorers.",
    items: [
      {
        id: "v13-wikios",
        category: "feature",
        title: "WikiOS reader and canvas",
        description:
          "A Next.js frontend for MediaWiki with PlateJS visual editing, Parsoid wikitext conversion and responsive article layouts.",
        highlights: [
          "Hover previews for articles and popovers for authors",
          "LoreStash bookmarks for saved articles",
          "One MediaWiki API bridge that respects rate limits",
        ],
        link: { href: "/wiki", label: "Open WikiOS" },
      },
      {
        id: "v13-vault-cards",
        category: "feature",
        title: "IxVault collectibles and streaks",
        description:
          "Collect national cards with rarity values, keep a daily login streak and earn civic achievements.",
        highlights: [
          "Marketplace auctions and a live trading ledger",
          "Achievement milestones with a collector score",
        ],
        link: { href: "/vault", label: "Open IxVault" },
      },
      {
        id: "v13-metric-modals",
        category: "improvement",
        title: "Economic and demographic detail views",
        description:
          "Four-tab views for GDP, labor, government spending, demographics and national debt.",
        highlights: [
          "Comparison sliders and historical trend charts",
          "Fiscal health diagnostics and growth projections",
        ],
      },
      {
        id: "v13-unified-feed",
        category: "improvement",
        title: "Unified activity feed",
        description:
          "ThinkPages posts, wiki contributions, forum threads and sports news in a single feed.",
      },
    ],
  },
];

export default function ChangelogPage() {
  const channelTheme = CHANNEL_CONFIG[CHANNEL] ?? CHANNEL_CONFIG.Stable;

  return (
    <div className="bg-background text-label relative min-h-screen">
      <MarkVersionSeen />
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="What's new in IxStates"
          back={{ href: "/dashboard", label: "Dashboard" }}
          actions={
            <StatusIndicator
              status={channelTheme.status}
              label={`v${PLATFORM_VERSION} · ${RELEASE_NAME} (${channelTheme.shortName})`}
              size="sm"
              className={cn(
                "text-caption shadow-card border px-3 py-1 tabular-nums",
                channelTheme.borderColor,
                channelTheme.bgColor
              )}
            />
          }
        />

        <ChangelogFeed releases={RELEASES} />
      </div>
    </div>
  );
}
