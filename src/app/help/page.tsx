"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Book,
  Search,
  Users,
  TrendingUp,
  Shield,
  Settings,
  Zap,
  Target,
  ChevronRight,
  FileText,
  Sparkles,
  Brain,
  Building2,
  Plane,
  Crown,
  Coins,
  Gamepad2,
} from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "getting-started" | "features" | "systems" | "admin" | "gameplay";
  articles: HelpArticle[];
}

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  path: string;
  tags: string[];
}

const helpSections: HelpSection[] = [
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
    id: "economic-system",
    title: "Economy",
    description: "Money, trade, taxes, and how your nation grows wealthier",
    icon: TrendingUp,
    category: "features",
    articles: [
      {
        id: "economic-tiers",
        title: "Economic Tiers",
        description:
          "Seven stages from Impoverished to Extravagant — and how nations climb the ladder.",
        path: "/help/economy/tiers",
        tags: ["economy", "tiers", "growth"],
      },
      {
        id: "calculations",
        title: "How Your Economy Is Measured",
        description:
          "What GDP, growth, and the other numbers mean for your nation — in plain language.",
        path: "/help/economy/calculations",
        tags: ["economy", "gdp", "indicators"],
      },
      {
        id: "modeling",
        title: "Planning Ahead",
        description: "Project your economy forward and test the 'what ifs' before you commit.",
        path: "/help/economy/modeling",
        tags: ["economy", "modeling", "projections"],
      },
      {
        id: "trade",
        title: "Trade & Commerce",
        description:
          "Trade with the world, balance imports and exports, and grow through commerce.",
        path: "/help/economy/trade",
        tags: ["economy", "trade", "international"],
      },
      {
        id: "tax-system",
        title: "Taxes & Revenue",
        description:
          "Set tax rates, brackets, and exemptions — and fund the nation you want to build.",
        path: "/help/economy/tax-system",
        tags: ["economy", "tax", "revenue", "fiscal"],
      },
    ],
  },
  {
    id: "government",
    title: "Government",
    description: "Design how your nation is governed",
    icon: Building2,
    category: "features",
    articles: [
      {
        id: "traditional",
        title: "The Quick Way: Government Types",
        description: "Pick a familiar form of government and tailor it to your nation.",
        path: "/help/government/traditional",
        tags: ["government", "builder", "traditional"],
      },
      {
        id: "atomic",
        title: "The Deep Way: Atomic Components",
        description:
          "Build a government piece by piece and unlock bonuses when the right parts work together.",
        path: "/help/government/atomic",
        tags: ["government", "atomic", "advanced"],
      },
      {
        id: "components",
        title: "The Component Library",
        description: "Browse every government, economic, and tax building block you can use.",
        path: "/help/government/components",
        tags: ["government", "components", "modules"],
      },
      {
        id: "synergy",
        title: "Synergies & Conflicts",
        description:
          "Some choices amplify each other; others clash. Here's how to find the sweet spots.",
        path: "/help/government/synergy",
        tags: ["government", "synergy", "interactions"],
      },
    ],
  },
  {
    id: "defense",
    title: "Defense & Military",
    description: "Build, equip, and command your armed forces",
    icon: Shield,
    category: "features",
    articles: [
      {
        id: "overview",
        title: "Defense Overview",
        description: "Where to start with your military and how the pieces fit together.",
        path: "/help/defense/overview",
        tags: ["defense", "military", "overview"],
      },
      {
        id: "units",
        title: "Units & Assets",
        description: "The forces at your command and what each one is good for.",
        path: "/help/defense/units",
        tags: ["defense", "units", "military"],
      },
      {
        id: "equipment",
        title: "The Equipment Catalog",
        description: "A huge armory of real-world-inspired gear to outfit your forces.",
        path: "/help/defense/equipment",
        tags: ["defense", "equipment", "catalog"],
      },
      {
        id: "crisis-events",
        title: "Handling Crises",
        description:
          "Disasters, unrest, and emergencies — and how you steer your nation through them.",
        path: "/help/defense/crisis-events",
        tags: ["defense", "crisis", "events"],
      },
      {
        id: "stability",
        title: "Keeping the Peace",
        description: "Internal security and the things that keep your nation stable at home.",
        path: "/help/defense/stability",
        tags: ["defense", "stability", "security"],
      },
      {
        id: "customization",
        title: "Making Forces Your Own",
        description: "Give your military its own identity — names, structure, and character.",
        path: "/help/defense/customization",
        tags: ["defense", "customization", "worldbuilding"],
      },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    description: "Turn your nation's data into clear decisions",
    icon: Brain,
    category: "features",
    articles: [
      {
        id: "dashboard",
        title: "Your Situation Room",
        description: "The intelligence hub that pulls everything important into one view.",
        path: "/help/intelligence/dashboard",
        tags: ["intelligence", "dashboard", "analytics"],
      },
      {
        id: "metrics",
        title: "The Numbers That Matter",
        description: "Which indicators to watch, and what they're telling you about your nation.",
        path: "/help/intelligence/metrics",
        tags: ["intelligence", "metrics"],
      },
      {
        id: "alerts",
        title: "Alerts & Live Updates",
        description: "Stay ahead of what's happening with real-time alerts and notifications.",
        path: "/help/intelligence/alerts",
        tags: ["intelligence", "alerts", "notifications"],
      },
      {
        id: "forecasting",
        title: "Looking Ahead",
        description: "Use forecasts to see where your nation is heading and plan accordingly.",
        path: "/help/intelligence/forecasting",
        tags: ["intelligence", "forecasting", "predictions"],
      },
      {
        id: "unified-overview",
        title: "The Full Picture",
        description: "How economic, diplomatic, and security insight come together as one story.",
        path: "/help/intelligence/unified-overview",
        tags: ["intelligence", "overview"],
      },
      {
        id: "executive-operations",
        title: "Command & Operations",
        description: "Run major operations and coordinate your nation's biggest moves.",
        path: "/help/intelligence/executive-operations",
        tags: ["intelligence", "operations", "command"],
      },
      {
        id: "strategic-intelligence",
        title: "Strategic Intelligence",
        description: "The long view — insight for the decisions that shape your nation for years.",
        path: "/help/intelligence/strategic-intelligence",
        tags: ["intelligence", "strategic"],
      },
    ],
  },
  {
    id: "diplomacy",
    title: "Diplomacy",
    description: "Build relationships across the world",
    icon: Plane,
    category: "features",
    articles: [
      {
        id: "embassies",
        title: "Embassies",
        description: "Open embassies abroad and build a network of relationships.",
        path: "/help/diplomacy/embassies",
        tags: ["diplomacy", "embassies", "international"],
      },
      {
        id: "missions",
        title: "Diplomatic Missions",
        description: "Send missions to pursue trade, culture, and cooperation with other nations.",
        path: "/help/diplomacy/missions",
        tags: ["diplomacy", "missions"],
      },
      {
        id: "npc-personalities",
        title: "Meeting Other Leaders",
        description:
          "The world's leaders have personalities of their own — and they remember how you treat them.",
        path: "/help/diplomacy/npc-personalities",
        tags: ["diplomacy", "leaders", "personality"],
      },
      {
        id: "scenarios",
        title: "Diplomatic Scenarios",
        description: "Dozens of unfolding situations in trade, culture, and security to navigate.",
        path: "/help/diplomacy/scenarios",
        tags: ["diplomacy", "scenarios"],
      },
      {
        id: "cultural",
        title: "Cultural Exchanges",
        description:
          "Soft power in action — share your culture and warm relations with other nations.",
        path: "/help/diplomacy/cultural",
        tags: ["diplomacy", "culture", "exchanges"],
      },
    ],
  },
  {
    id: "vault",
    title: "Cards & Vault",
    description: "Collect, trade, and show off — backed by the IxCredits economy",
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

export default function HelpPage() {
  useEffect(() => {
    document.title = "Help Center - IxStats";
  }, []);

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
    let sections = helpSections;

    // Filter by category
    if (selectedCategory !== "all") {
      sections = sections.filter((s) => s.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sections = sections
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

    return sections;
  }, [searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center gap-3">
            <Book className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Help Center</h1>
          </div>
          <p className="max-w-2xl text-slate-600 dark:text-slate-300">
            Everything you need to build a nation and bring it to life. New here? Start with{" "}
            <Link
              href="/help/getting-started/welcome"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Welcome to IxStats
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-all ${
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

        {/* Quick Links Footer */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/help/getting-started/welcome"
            className="group flex items-center gap-3 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-4 transition-all hover:border-blue-400/50"
          >
            <Target className="h-8 w-8 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">New to IxStats?</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Start here</div>
            </div>
          </Link>

          <Link
            href="/help/getting-started/first-country"
            className="group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 p-4 transition-all hover:border-amber-400/50"
          >
            <Crown className="h-8 w-8 text-amber-600 transition-transform group-hover:scale-110 dark:text-amber-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Build a Nation</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Your first country</div>
            </div>
          </Link>

          <Link
            href="/help/getting-started/gameplay-overview"
            className="group flex items-center gap-3 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 transition-all hover:border-purple-400/50"
          >
            <Gamepad2 className="h-8 w-8 text-purple-600 transition-transform group-hover:scale-110 dark:text-purple-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">How It Works</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">The big picture</div>
            </div>
          </Link>

          <Link
            href="/help/vault/overview"
            className="group flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-4 transition-all hover:border-emerald-400/50"
          >
            <Coins className="h-8 w-8 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Cards & Vault</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Collect & trade</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
