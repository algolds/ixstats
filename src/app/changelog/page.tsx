import Link from "next/link";
import { type Metadata } from "next";
import { FireFlame as Flame, ArrowLeft } from "iconoir-react";
import { PLATFORM_VERSION, RELEASE_NAME, CHANNEL, CHANNEL_CONFIG } from "~/lib/buildVersion";
import { StatusIndicator } from "~/components/ui/status-indicator";
import { cn } from "~/lib/utils";
import { ChangelogFeed, type Release } from "./_components/ChangelogFeed";

export const metadata: Metadata = {
  title: "Changelog & Platform Updates | IxStates",
  description:
    "Follow the latest platform features, simulation updates, engine upgrades, and polish across the nation-building ecosystem.",
};

const RELEASES: Release[] = [
  {
    version: "1.4.0",
    releaseName: "Ogma",
    date: "August 2026",
    channel: "Release Candidate",
    isCurrent: true,
    tagline:
      "Bun 1.4 & TypeScript 7.0 Native Engine Upgrade, Unified Messaging, Atomic Statecraft, and Facet Design System Convergence.",
    items: [
      {
        id: "v14-messaging",
        category: "feature",
        title: "Unified Messaging & ThinkShare Suite",
        description:
          "Full-featured platform communication hub supporting bilateral diplomatic dispatches, multi-party discussion channels, real-time message reactions, and cross-app presence.",
        highlights: [
          "Bilateral and multilateral diplomatic communication channels",
          "Real-time emoji reactions, thread replies, and message editing",
          "Zero-latency unread tracking engine with single-click folder catch-up",
        ],
        link: { href: "/messages", label: "Open Messages" },
      },
      {
        id: "v14-statecraft",
        category: "feature",
        title: "Atomic Statecraft & Policy Synthesizer",
        description:
          "High-performance headless policy builder for executive national management, tax structure synthesis, and economic directive composition.",
        highlights: [
          "Real-time simulation feedback with reactive budget impact modeling",
          "Tactile slot-based component selectors with category filtering",
          "Automated synergy and friction detection between national policies",
        ],
        link: { href: "/mycountry", label: "Explore Statecraft" },
      },
      {
        id: "v14-halo",
        category: "feature",
        title: "Halo Navigation & Command Palette (v5)",
        description:
          "Universal ambient overlay and command palette providing instant multi-domain navigation, keyword synonym search, and in-palette system execution.",
        highlights: [
          "Instant keyboard-driven command navigation with ⌘K activation",
          "Comprehensive multi-domain coverage across Statecraft, Vault, Geography, Knowledge, Community, Sports, and Labs",
          "Fast keyword and synonym indexing for seamless discovery",
          "Direct in-palette system actions for themes, audio effects, and compact mode",
        ],
      },
      {
        id: "v14-ts7-bun",
        category: "engine",
        title: "TypeScript 7.0 & Bun 1.4 Native Engine",
        description:
          "Upgraded compiler to native Go shared-memory concurrency with multi-threaded checkers, reducing typechecking time down to ~2s and cutting memory overhead by 80%.",
        highlights: [
          "Sub-10ms atomic CLI boot times and native Bun.cron() scheduling",
          "Strict Copy-on-Write polygon operations and zero-dependency color mathematics",
          "100% end-to-end verified typecheck and architecture integrity validation",
        ],
      },
      {
        id: "v14-facet",
        category: "improvement",
        title: "Facet Design Language (v2) & Tactile Physics",
        description:
          "Elevated visual design system featuring translucent frosted glass refraction, momentum-aware spring animations, and refined light/dark theme compliance across all modules.",
        highlights: [
          "Apple-inspired fluid motion curves and interruptible gesture transitions",
          "Enhanced contrast ratios, semantic color tokens, and ambient depth layering",
          "Theme-compliant dossier action menus and congratulatory achievement dialogs",
        ],
      },
      {
        id: "v14-flag-service",
        category: "improvement",
        title: "Canonical Flag Authority & Fast Resolution",
        description:
          "Streamlined flag resolution engine combining PostgreSQL database authority with high-speed memory caching and Wikimedia Commons fallback.",
        highlights: [
          "Sub-millisecond resolution for all 82+ custom and fictional world nations",
          "Immutability guarantees with zero-mutation request batching",
          "Adaptive fallback placeholders with automatic basePath routing",
        ],
        link: { href: "/countries", label: "Browse Countries" },
      },
      {
        id: "v14-unread-fix",
        category: "fix",
        title: "Accurate Unread Message & Notification Counting",
        description:
          "Replaced folder conversation tallying with exact unread message timestamp queries, ensuring notification badges display 0 when all inbox messages have been read.",
        highlights: [
          "Single-trip batch SQL queries for instantaneous unread count resolution",
          "Global Mark All as Read mutation for one-touch inbox clearing",
          "Robust multi-identity user resolution supporting Clerk and internal IDs",
        ],
      },
      {
        id: "v14-trending-pulse",
        category: "fix",
        title: "Live Activity & Trending Topics Redesign",
        description:
          "Modernized dashboard trending widget with categorical Live Activity badges, amber pulse indicators, and enhanced social/wiki/forum distinction.",
        highlights: [
          "Dynamic categorization for map updates, economic milestones, and diplomacy",
          "Interactive preview cards for linked MediaWiki articles and forum threads",
        ],
        link: { href: "/dashboard", label: "View Dashboard" },
      },
    ],
  },
  {
    version: "1.3.0",
    releaseName: "Epona",
    date: "July 2026",
    channel: "Stable",
    tagline:
      "WikiOS Visual Reader, LoreStash, Unified Feed Architecture, and Interactive Metric Explorers.",
    items: [
      {
        id: "v13-wikios",
        category: "feature",
        title: "WikiOS Next-Gen Reader & Canvas",
        description:
          "Modern Next.js native frontend for MediaWiki knowledge bases featuring PlateJS rich visual editing, Parsoid wikitext transformation, and responsive article layouts.",
        highlights: [
          "Interactive wiki article hover previews and fast author popovers",
          "LoreStash bookmarking for offline and saved article reading",
          "Unified MediaWiki API bridge with strict rate-limiting compliance",
        ],
        link: { href: "/wiki", label: "Explore WikiOS" },
      },
      {
        id: "v13-vault-cards",
        category: "feature",
        title: "IxVault Collectibles & Streak Milestones",
        description:
          "Interactive national collectible card deck, dynamic rarity values, daily login streaks, and civic achievement unlocks.",
        highlights: [
          "Marketplace auctions and real-time live trading ledger",
          "Civic achievement milestones with collector score tracking",
        ],
        link: { href: "/vault", label: "Visit IxVault" },
      },
      {
        id: "v13-metric-modals",
        category: "improvement",
        title: "Deep Economic & Demographic Modals",
        description:
          "Comprehensive four-tab analytical modals for GDP, Labor, Government Spending, Demographics, and National Debt.",
        highlights: [
          "Interactive comparison sliders and historical trend visualizers",
          "Detailed fiscal health diagnostics and growth projections",
        ],
      },
      {
        id: "v13-unified-feed",
        category: "improvement",
        title: "Multi-Source Unified Activity Stream",
        description:
          "Real-time aggregate stream combining ThinkPages posts, MediaWiki contributions, forum threads, and sports news bulletins into a single cohesive feed.",
      },
    ],
  },
];

export default function ChangelogPage() {
  const channelTheme = CHANNEL_CONFIG[CHANNEL] ?? CHANNEL_CONFIG.Stable;

  return (
    <div className="bg-background text-foreground relative min-h-screen">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="from-primary/10 absolute -top-[20%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b via-blue-500/5 to-transparent blur-3xl" />
        <div className="absolute top-[40%] -left-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-transparent via-purple-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="group text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium backdrop-blur-md transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <StatusIndicator
              status={channelTheme.status}
              label={`v${PLATFORM_VERSION} · ${RELEASE_NAME} (${channelTheme.shortName})`}
              size="sm"
              className={cn(
                "border px-2.5 py-1 text-xs font-medium tabular-nums shadow-sm backdrop-blur-md",
                channelTheme.borderColor,
                channelTheme.bgColor
              )}
            />
          </div>
        </div>

        {/* Hero Header */}
        <div className="mb-12 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Flame className="h-3.5 w-3.5" />
            <span>Public Release Notes & Changelog</span>
          </div>

          <h1 className="text-foreground mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            What's New in{" "}
            <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              IxStates
            </span>
          </h1>

          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
            Follow the latest platform features, simulation updates, engine upgrades, and polish
            across the nation-building ecosystem.
          </p>
        </div>

        {/* Interactive Feed */}
        <ChangelogFeed releases={RELEASES} />
      </div>
    </div>
  );
}
