"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Sparkles,
  Zap,
  Cpu,
  ShieldCheck,
  Search,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  PLATFORM_VERSION,
  RELEASE_NAME,
  CHANNEL,
  CHANNEL_CONFIG,
} from "~/lib/buildVersion";
import { StatusIndicator } from "~/components/ui/status-indicator";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type ReleaseCategory = "all" | "feature" | "improvement" | "engine" | "fix";

interface ReleaseItem {
  id: string;
  category: "feature" | "improvement" | "engine" | "fix";
  title: string;
  description: string;
  highlights?: string[];
  link?: { href: string; label: string };
}

interface Release {
  version: string;
  releaseName: string;
  date: string;
  channel: string;
  isCurrent?: boolean;
  tagline: string;
  items: ReleaseItem[];
}

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
        title: "Halo Navigation & Command Palette (v4)",
        description:
          "Universal ambient overlay providing instant global search across 80+ nations, MediaWiki archives, executive simulation commands, and active identity management.",
        highlights: [
          "Instant keyboard-driven command navigation with ⌘K activation",
          "Real-time search across countries, wiki entries, and simulation tools",
          "Context-aware page plugins and ambient status indicators",
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

const CATEGORY_META: Record<
  ReleaseCategory,
  { label: string; icon: typeof Sparkles; color: string; badgeBg: string }
> = {
  all: {
    label: "All Updates",
    icon: Layers,
    color: "text-foreground",
    badgeBg: "bg-white/10 text-foreground",
  },
  feature: {
    label: "New Features",
    icon: Sparkles,
    color: "text-emerald-500 dark:text-emerald-400",
    badgeBg:
      "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  },
  improvement: {
    label: "Improvements",
    icon: Zap,
    color: "text-blue-500 dark:text-blue-400",
    badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
  },
  engine: {
    label: "Platform & Engine",
    icon: Cpu,
    color: "text-purple-500 dark:text-purple-400",
    badgeBg:
      "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300",
  },
  fix: {
    label: "Fixes & Polish",
    icon: ShieldCheck,
    color: "text-amber-500 dark:text-amber-400",
    badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
  },
};

export default function ChangelogPage() {
  const [selectedCategory, setSelectedCategory] = useState<ReleaseCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const channelTheme = CHANNEL_CONFIG[CHANNEL] ?? CHANNEL_CONFIG.Stable;

  const filteredReleases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return RELEASES.map((release) => {
      const items = release.items.filter((item) => {
        const matchesCategory =
          selectedCategory === "all" || item.category === selectedCategory;
        const matchesSearch =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.highlights?.some((h) => h.toLowerCase().includes(q));

        return matchesCategory && matchesSearch;
      });

      return {
        ...release,
        items,
      };
    }).filter((release) => release.items.length > 0);
  }, [selectedCategory, searchQuery]);

  return (
    <div className="bg-background text-foreground relative min-h-screen">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="from-primary/10 via-blue-500/5 absolute -top-[20%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b to-transparent blur-3xl" />
        <div className="via-purple-500/5 absolute top-[40%] -left-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-transparent to-transparent blur-3xl" />
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
            <Sparkles className="h-3.5 w-3.5" />
            <span>Public Release Notes & Changelog</span>
          </div>

          <h1 className="text-foreground mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            What's New in <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent">IxStates</span>
          </h1>

          <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Follow the latest platform features, simulation updates, engine upgrades, and polish
            across the nation-building ecosystem.
          </p>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="glass-surface border-border/40 mb-10 rounded-2xl border p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search features, fixes, or engines…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-accent/10 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-accent/20 w-full rounded-xl border border-transparent py-2 pr-4 pl-9 text-xs transition-all focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(CATEGORY_META) as ReleaseCategory[]).map((cat) => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/15 bg-transparent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Release Timeline */}
        {filteredReleases.length === 0 ? (
          <div className="glass-surface border-border/30 rounded-2xl border p-12 text-center">
            <Search className="text-muted-foreground/40 mx-auto h-8 w-8" />
            <h3 className="text-foreground mt-3 text-base font-semibold">No matching updates found</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Try adjusting your search keywords or switching category filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-xl px-4 py-2 text-xs font-medium transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredReleases.map((release) => (
              <section key={release.version} className="relative">
                {/* Release Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-foreground text-2xl font-bold tracking-tight">
                        v{release.version}{" "}
                        <span className="text-muted-foreground font-semibold">"{release.releaseName}"</span>
                      </h2>
                      {release.isCurrent && (
                        <Badge className="rounded-full border-blue-500/30 bg-blue-500/15 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                          Latest Release
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed max-w-3xl">
                      {release.tagline}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{release.date}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-mono text-[11px]">Channel: {release.channel}</span>
                  </div>
                </div>

                {/* Release Items Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {release.items.map((item) => {
                    const catMeta = CATEGORY_META[item.category];
                    const CatIcon = catMeta.icon;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group glass-surface border-border/40 hover:border-border/80 flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md backdrop-blur-xl"
                      >
                        <div className="space-y-3">
                          {/* Item Category Header */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                catMeta.badgeBg
                              )}
                            >
                              <CatIcon className="h-3 w-3" />
                              <span>{catMeta.label}</span>
                            </span>

                            {item.link && (
                              <Link
                                href={item.link.href}
                                className="text-primary hover:text-primary/80 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-medium transition-all"
                              >
                                <span>{item.link.label}</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </div>

                          {/* Item Title & Description */}
                          <div>
                            <h3 className="text-foreground text-base font-semibold tracking-tight group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                              {item.description}
                            </p>
                          </div>

                          {/* Item Highlights Checklist */}
                          {item.highlights && item.highlights.length > 0 && (
                            <ul className="space-y-1.5 border-t border-white/5 pt-3">
                              {item.highlights.map((h, i) => (
                                <li
                                  key={i}
                                  className="text-foreground/90 flex items-start gap-2 text-xs leading-normal"
                                >
                                  <CheckCircle2 className="text-emerald-500/80 dark:text-emerald-400/80 mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>{h}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="border-border/30 text-muted-foreground mt-16 flex flex-col items-center justify-between gap-4 border-t pt-8 text-center text-xs sm:flex-row sm:text-left">
          <div>
            <p className="font-medium text-foreground">IxStates Platform Architecture</p>
            <p className="text-muted-foreground/80 mt-0.5 text-[11px]">
              Built with Next.js 16, React 19, TypeScript 7.0 & Bun 1.4 Native Engine.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hover:text-foreground transition-colors hover:underline"
            >
              Dashboard
            </Link>
            <span>·</span>
            <Link
              href="/mycountry"
              className="hover:text-foreground transition-colors hover:underline"
            >
              MyCountry
            </Link>
            <span>·</span>
            <Link
              href="/messages"
              className="hover:text-foreground transition-colors hover:underline"
            >
              Messages
            </Link>
            <span>·</span>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors hover:underline"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
