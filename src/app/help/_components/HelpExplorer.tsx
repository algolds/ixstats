"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Book,
  Search,
  Users,
  TrendingUp,
  Shield,
  Settings,
  Zap,
  ChevronRight,
  FileText,
  Sparkles,
  Crown,
  Coins,
  Gamepad2,
} from "lucide-react";

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  path: string;
  tags: string[];
}

export interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "getting-started" | "features" | "systems" | "admin" | "gameplay";
  articles: HelpArticle[];
}

export const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Start Here",
    description: "New to IxStats? This is the place to begin.",
    icon: Sparkles,
    category: "getting-started",
    articles: [
      {
        id: "welcome",
        title: "Welcome to IxStats",
        description:
          "What this place is, and what you'll build here — especially if you're coming from NationStates.",
        path: "/help/getting-started/welcome",
        tags: ["basics", "intro", "nationstates", "worldbuilding"],
      },
      {
        id: "first-country",
        title: "Create Your First Nation",
        description:
          "From a blank page to a living country in a few minutes. We'll walk you through it.",
        path: "/help/getting-started/first-country",
        tags: ["country", "builder", "tutorial", "first steps"],
      },
      {
        id: "gameplay-overview",
        title: "How It All Fits Together",
        description:
          "Economy, government, diplomacy, the map — a quick tour of how your nation comes alive.",
        path: "/help/getting-started/gameplay-overview",
        tags: ["basics", "overview", "worldbuilding"],
      },
      {
        id: "ixtime",
        title: "The World Clock (IxTime)",
        description: "Time here moves at twice real speed. Here's what that means for your nation.",
        path: "/help/getting-started/ixtime",
        tags: ["time", "basics", "world"],
      },
      {
        id: "ixnayid",
        title: "Unified Identity (IxnayID)",
        description:
          "Connect your simulator country profile with the community wiki and interactive maps.",
        path: "/help/getting-started/ixnayid",
        tags: ["ixnayid", "identity", "authentication", "sso", "basics"],
      },
      {
        id: "navigation",
        title: "Finding Your Way Around",
        description: "Where everything lives, plus a few shortcuts to get around fast.",
        path: "/help/getting-started/navigation",
        tags: ["ui", "interface", "basics"],
      },
    ],
  },
  {
    id: "gameplay",
    title: "Living World",
    description: "How your nation grows, reacts, and competes over time",
    icon: Gamepad2,
    category: "gameplay",
    articles: [
      {
        id: "simulation",
        title: "How Your Nation Comes Alive",
        description:
          "Your economy and the wider world keep moving even when you're away. Here's the rhythm of it.",
        path: "/help/gameplay/simulation",
        tags: ["gameplay", "simulation", "world", "economy"],
      },
      {
        id: "country-building",
        title: "Shaping Your Nation",
        description:
          "Going deeper with the builder — identity, government, economy, and the story you're telling.",
        path: "/help/gameplay/country-building",
        tags: ["gameplay", "builder", "country", "worldbuilding"],
      },
      {
        id: "national-issues",
        title: "National Issues & Decisions",
        description:
          "Events that land on your desk and ask: what kind of leader are you? Your choices stick.",
        path: "/help/gameplay/national-issues",
        tags: ["gameplay", "issues", "events", "decisions"],
      },
      {
        id: "achievements",
        title: "Achievements & Rewards",
        description:
          "Milestones to chase, rarity tiers to unlock, and IxCredits to earn along the way.",
        path: "/help/gameplay/achievements",
        tags: ["gameplay", "achievements", "progression", "rewards"],
      },
      {
        id: "leaderboards",
        title: "Leaderboards & Rankings",
        description:
          "See how your nation measures up — by economy, population, influence, and more.",
        path: "/help/gameplay/leaderboards",
        tags: ["gameplay", "leaderboards", "rankings"],
      },
    ],
  },
  {
    id: "mycountry",
    title: "MyCountry — Your Nation's Home",
    description: "One place to run everything: the economy, cabinet, military, and foreign affairs",
    icon: Crown,
    category: "features",
    articles: [
      {
        id: "overview",
        title: "Your National Overview",
        description: "Your country's health at a glance — the vitals you check first each visit.",
        path: "/help/mycountry/overview",
        tags: ["mycountry", "overview", "dashboard"],
      },
      {
        id: "executive",
        title: "The Executive Desk",
        description:
          "Hold cabinet meetings, set national policy, and make the big calls that move your nation.",
        path: "/help/mycountry/executive",
        tags: ["mycountry", "executive", "policies", "meetings"],
      },
      {
        id: "diplomacy",
        title: "Foreign Affairs",
        description: "Manage embassies, talk to other nations, and steer your foreign policy.",
        path: "/help/mycountry/diplomacy",
        tags: ["mycountry", "diplomacy", "embassies"],
      },
      {
        id: "intelligence",
        title: "Reading the Room",
        description:
          "Analytics and insights that turn your nation's numbers into clear next moves.",
        path: "/help/mycountry/intelligence",
        tags: ["mycountry", "intelligence", "analytics"],
      },
      {
        id: "defense",
        title: "Defense & Security",
        description: "Command your military, shape your forces, and keep your nation secure.",
        path: "/help/mycountry/defense",
        tags: ["mycountry", "defense", "military"],
      },
      {
        id: "politics",
        title: "Politics & Elections",
        description:
          "Your legislature, political parties, and the elections that decide who holds power.",
        path: "/help/mycountry/politics",
        tags: ["mycountry", "politics", "elections", "parties"],
      },
    ],
  },
  {
    id: "economy",
    title: "Economy & Finances",
    description: "Taxes, trade, government spending, and the engine beneath your nation",
    icon: TrendingUp,
    category: "systems",
    articles: [
      {
        id: "tiers",
        title: "Economic Tiers",
        description: "How nations scale from regional players to global economic engines.",
        path: "/help/economy/tiers",
        tags: ["economy", "tiers", "progression", "gdp"],
      },
      {
        id: "tax-system",
        title: "The Tax Engine",
        description:
          "Brackets, deductions, exemptions, and how to fund your government without choking growth.",
        path: "/help/economy/tax-system",
        tags: ["economy", "taxes", "brackets", "revenue"],
      },
      {
        id: "trade",
        title: "Trade & Commerce",
        description: "Imports, exports, tariffs, and building trade ties with other nations.",
        path: "/help/economy/trade",
        tags: ["economy", "trade", "tariffs", "commerce"],
      },
      {
        id: "calculations",
        title: "How the Math Works",
        description:
          "A transparent look at how GDP, population, and spending are calculated behind the scenes.",
        path: "/help/economy/calculations",
        tags: ["economy", "calculations", "formulas", "mechanics"],
      },
    ],
  },
  {
    id: "government",
    title: "Government & Structure",
    description: "Ministries, policies, ideologies, and how you govern",
    icon: Shield,
    category: "systems",
    articles: [
      {
        id: "components",
        title: "Government Components",
        description: "Mix and match ministries and structures to shape how your government works.",
        path: "/help/government/components",
        tags: ["government", "components", "builder", "structure"],
      },
      {
        id: "atomic",
        title: "Atomic Statecraft",
        description:
          "Fine-tune individual policies, detect synergies, and balance conflicting priorities.",
        path: "/help/government/atomic",
        tags: ["government", "atomic", "statecraft", "policies"],
      },
      {
        id: "traditional",
        title: "Classic Systems",
        description:
          "Prefer a simpler model? Presets and traditional structures get you up and running fast.",
        path: "/help/government/traditional",
        tags: ["government", "traditional", "presets"],
      },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence & Strategy",
    description: "Forecasts, threat tracking, security operations, and decision-making",
    icon: Shield,
    category: "systems",
    articles: [
      {
        id: "dashboard",
        title: "The Intel Dashboard",
        description: "Your briefing desk — threats, opportunities, and strategic indicators.",
        path: "/help/intelligence/dashboard",
        tags: ["intelligence", "dashboard", "briefings"],
      },
      {
        id: "alerts",
        title: "Alerts & Triggers",
        description:
          "Set up automatic notifications when economic or diplomatic metrics cross your thresholds.",
        path: "/help/intelligence/alerts",
        tags: ["intelligence", "alerts", "notifications", "thresholds"],
      },
      {
        id: "metrics",
        title: "Strategic Metrics",
        description: "The indices and scores that measure your nation's health across every domain.",
        path: "/help/intelligence/metrics",
        tags: ["intelligence", "metrics", "analytics", "scores"],
      },
    ],
  },
  {
    id: "diplomacy",
    title: "Diplomacy & Alliances",
    description: "Embassies, treaties, cultural ties, and living alongside other nations",
    icon: Users,
    category: "features",
    articles: [
      {
        id: "embassies",
        title: "Embassies & Staff",
        description: "Open missions in other nations, assign diplomats, and build foreign ties.",
        path: "/help/diplomacy/embassies",
        tags: ["diplomacy", "embassies", "missions", "ambassadors"],
      },
      {
        id: "missions",
        title: "Diplomatic Missions",
        description: "Send envoys on trade talks, cultural summits, and strategic negotiations.",
        path: "/help/diplomacy/missions",
        tags: ["diplomacy", "missions", "operations"],
      },
      {
        id: "cultural",
        title: "Cultural Exchanges",
        description: "Share art, sports, and culture to deepen goodwill with neighboring countries.",
        path: "/help/diplomacy/cultural",
        tags: ["diplomacy", "cultural", "exchanges", "soft power"],
      },
      {
        id: "npc-personalities",
        title: "NPC Personalities",
        description:
          "How computer-run nations think, react, and decide who to trust or challenge.",
        path: "/help/diplomacy/npc-personalities",
        tags: ["diplomacy", "npc", "ai", "personalities"],
      },
    ],
  },
  {
    id: "vault",
    title: "IxVault & Cards",
    description: "Collectible cards, card packs, marketplace trading, and IxCredits",
    icon: Coins,
    category: "features",
    articles: [
      {
        id: "vault-overview",
        title: "Your Vault",
        description: "Your collection, your IxCredits, and how your Vault grows as you play.",
        path: "/help/vault/overview",
        tags: ["vault", "cards", "overview", "ixcredits"],
      },
      {
        id: "card-packs",
        title: "Packs & Opening",
        description: "Buy packs, pull the rares, and enjoy the reveal.",
        path: "/help/vault/card-packs",
        tags: ["vault", "packs", "cards"],
      },
      {
        id: "trading",
        title: "Trading & Marketplace",
        description: "Auctions, bids, and direct trades with other players.",
        path: "/help/vault/trading",
        tags: ["vault", "trading", "marketplace", "auction"],
      },
      {
        id: "lore-cards",
        title: "Lore Cards",
        description: "Cards made from wiki articles — your world's stories, turned collectible.",
        path: "/help/vault/lore-cards",
        tags: ["vault", "lore", "wiki", "cards"],
      },
      {
        id: "ixcredits",
        title: "IxCredits",
        description: "How you earn the currency, what you spend it on, and how it all adds up.",
        path: "/help/vault/ixcredits",
        tags: ["vault", "ixcredits", "economy"],
      },
    ],
  },
  {
    id: "social",
    title: "Community",
    description: "Meet the people behind the other nations",
    icon: Users,
    category: "features",
    articles: [
      {
        id: "thinkpages",
        title: "ThinkPages",
        description: "Share updates, post in-world news, and follow what other nations are up to.",
        path: "/help/social/thinkpages",
        tags: ["social", "thinkpages", "community"],
      },
      {
        id: "thinkshare",
        title: "Messages (ThinkShare)",
        description: "Direct messages and real-time chat with other players.",
        path: "/help/social/thinkshare",
        tags: ["social", "thinkshare", "messaging"],
      },
      {
        id: "thinktanks",
        title: "ThinkTanks",
        description:
          "Form groups with other worldbuilders to plan, collaborate, and tell shared stories.",
        path: "/help/social/thinktanks",
        tags: ["social", "thinktanks", "groups"],
      },
    ],
  },
  {
    id: "admin-tools",
    title: "For Admins",
    description: "Tools for the people who help run the world",
    icon: Settings,
    category: "admin",
    articles: [
      {
        id: "cms-overview",
        title: "Admin Overview",
        description: "Managing platform content and keeping the shared world running smoothly.",
        path: "/help/admin/cms-overview",
        tags: ["admin", "management"],
      },
      {
        id: "reference-data",
        title: "Reference Data",
        description: "Curating the components, equipment, and scenarios everyone builds with.",
        path: "/help/admin/reference-data",
        tags: ["admin", "data", "catalog"],
      },
    ],
  },
];

export function HelpExplorer({ sections = helpSections }: { sections?: HelpSection[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Topics", icon: Book },
    { id: "getting-started", label: "Start Here", icon: Sparkles },
    { id: "gameplay", label: "Living World", icon: Gamepad2 },
    { id: "features", label: "Your Nation", icon: Zap },
    { id: "admin", label: "Admin", icon: Settings },
  ];

  const filteredSections = useMemo(() => {
    let result = sections;

    if (selectedCategory !== "all") {
      result = result.filter((s) => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result
        .map((section) => ({
          ...section,
          articles: section.articles.filter(
            (article) =>
              article.title.toLowerCase().includes(query) ||
              article.description.toLowerCase().includes(query) ||
              article.tags.some((tag) => tag.toLowerCase().includes(query))
          ),
        }))
        .filter((section) => section.articles.length > 0);
    }

    return result;
  }, [sections, searchQuery, selectedCategory]);

  return (
    <>
      {/* Search and Filter */}
      <div className="mb-8 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search the help center..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-4 pr-4 pl-12 text-slate-900 placeholder-slate-400 backdrop-blur-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-400"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-all cursor-pointer ${
                  selectedCategory === category.id
                    ? "border-blue-500/50 bg-blue-500/20 text-blue-600 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Help Sections */}
      {filteredSections.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-slate-400 dark:text-slate-600" />
          <h3 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-300">
            No results found
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredSections.map((section) => {
            const Icon = section.icon as React.ComponentType<{ className?: string }>;
            return (
              <div
                key={section.id}
                className="rounded-xl border border-slate-200 bg-white p-6 backdrop-blur-xl transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="mb-4 flex items-start gap-4">
                  <div className="rounded-lg bg-blue-500/20 p-3">
                    <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">
                      {section.title}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300">{section.description}</p>
                  </div>
                </div>

                <div className="grid gap-2">
                  {section.articles.map((article) => (
                    <Link
                      key={article.id}
                      href={article.path}
                      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-500/50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <div className="flex-1">
                        <h3 className="mb-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">
                          {article.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {article.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {article.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
