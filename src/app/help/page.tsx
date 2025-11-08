"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Book,
  Search,
  BookOpen,
  Cpu,
  Globe,
  Users,
  TrendingUp,
  Shield,
  BarChart3,
  Settings,
  Lightbulb,
  Zap,
  Target,
  Clock,
  Database,
  Code,
  ChevronRight,
  FileText,
  Sparkles,
  Brain,
  Building2,
  Plane,
  Map,
} from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "getting-started" | "features" | "systems" | "technical" | "admin";
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
    title: "Getting Started",
    description: "Learn the basics of IxStats",
    icon: Sparkles,
    category: "getting-started",
    articles: [
      {
        id: "welcome",
        title: "Welcome to IxStats",
        description: "Introduction to the platform and core concepts",
        path: "/help/getting-started/welcome",
        tags: ["basics", "intro", "overview"],
      },
      {
        id: "ixtime",
        title: "Understanding IxTime",
        description: "Learn about the custom time system that powers the simulation",
        path: "/help/getting-started/ixtime",
        tags: ["time", "basics", "simulation"],
      },
      {
        id: "first-country",
        title: "Creating Your First Country",
        description: "Step-by-step guide to building your nation",
        path: "/help/getting-started/first-country",
        tags: ["country", "builder", "tutorial"],
      },
      {
        id: "navigation",
        title: "Navigating the Platform",
        description: "Understanding the interface and navigation",
        path: "/help/getting-started/navigation",
        tags: ["ui", "interface", "basics"],
      },
    ],
  },
  {
    id: "economic-system",
    title: "Economic System",
    description: "Understanding the economy engine",
    icon: TrendingUp,
    category: "features",
    articles: [
      {
        id: "economic-tiers",
        title: "Economic Tier System",
        description: "How tier-based growth modeling works",
        path: "/help/economy/tiers",
        tags: ["economy", "tiers", "growth"],
      },
      {
        id: "calculations",
        title: "Economic Calculations",
        description: "Understanding GDP, trade, and economic indicators",
        path: "/help/economy/calculations",
        tags: ["economy", "gdp", "calculations"],
      },
      {
        id: "modeling",
        title: "Economic Modeling & Projections",
        description: "How to use modeling tools and projections",
        path: "/help/economy/modeling",
        tags: ["economy", "modeling", "projections"],
      },
      {
        id: "trade",
        title: "Trade & Commerce",
        description: "International trade mechanics and balance",
        path: "/help/economy/trade",
        tags: ["economy", "trade", "international"],
      },
    ],
  },
  {
    id: "government",
    title: "Government Systems",
    description: "Traditional & atomic government design",
    icon: Building2,
    category: "features",
    articles: [
      {
        id: "traditional",
        title: "Traditional Government Builder",
        description: "Creating conventional government structures",
        path: "/help/government/traditional",
        tags: ["government", "builder", "traditional"],
      },
      {
        id: "atomic",
        title: "Atomic Government System",
        description: "Advanced modular government design",
        path: "/help/government/atomic",
        tags: ["government", "atomic", "advanced"],
      },
      {
        id: "components",
        title: "Government Components",
        description: "Understanding the 24 atomic components",
        path: "/help/government/components",
        tags: ["government", "components", "modules"],
      },
      {
        id: "synergy",
        title: "Component Synergies",
        description: "How components interact and create synergies",
        path: "/help/government/synergy",
        tags: ["government", "synergy", "interactions"],
      },
    ],
  },
  {
    id: "defense",
    title: "Defense System",
    description: "Military and security operations",
    icon: Shield,
    category: "features",
    articles: [
      {
        id: "overview",
        title: "Defense System Overview",
        description: "Introduction to military management",
        path: "/help/defense/overview",
        tags: ["defense", "military", "overview"],
      },
      {
        id: "units",
        title: "Military Units & Assets",
        description: "Understanding unit types and capabilities",
        path: "/help/defense/units",
        tags: ["defense", "units", "military"],
      },
      {
        id: "equipment",
        title: "Military Equipment Catalog",
        description: "500+ equipment items with specifications",
        path: "/help/defense/equipment",
        tags: ["defense", "equipment", "catalog"],
      },
      {
        id: "crisis-events",
        title: "Crisis Events Management",
        description: "Handle natural disasters, economic crises, and diplomatic incidents",
        path: "/help/defense/crisis-events",
        tags: ["defense", "crisis", "events", "disasters"],
      },
      {
        id: "stability",
        title: "Political Stability",
        description: "Managing internal security and stability",
        path: "/help/defense/stability",
        tags: ["defense", "stability", "security"],
      },
      {
        id: "customization",
        title: "Force Customization",
        description: "Personalizing your military forces",
        path: "/help/defense/customization",
        tags: ["defense", "customization", "military"],
      },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence System",
    description: "Executive insights and analytics",
    icon: Brain,
    category: "features",
    articles: [
      {
        id: "dashboard",
        title: "Executive Dashboard",
        description: "Using the intelligence command center",
        path: "/help/intelligence/dashboard",
        tags: ["intelligence", "dashboard", "analytics"],
      },
      {
        id: "metrics",
        title: "Key Metrics & Indicators",
        description: "Understanding intelligence metrics",
        path: "/help/intelligence/metrics",
        tags: ["intelligence", "metrics", "kpi"],
      },
      {
        id: "alerts",
        title: "Alerts & Notifications",
        description: "Managing alerts and real-time updates",
        path: "/help/intelligence/alerts",
        tags: ["intelligence", "alerts", "notifications"],
      },
      {
        id: "forecasting",
        title: "Forecasting & Predictions",
        description: "Using predictive analytics",
        path: "/help/intelligence/forecasting",
        tags: ["intelligence", "forecasting", "predictions"],
      },
    ],
  },
  {
    id: "diplomacy",
    title: "Diplomatic Relations",
    description: "International relations and diplomacy",
    icon: Plane,
    category: "features",
    articles: [
      {
        id: "embassies",
        title: "Embassy Network",
        description: "Establishing and managing embassies",
        path: "/help/diplomacy/embassies",
        tags: ["diplomacy", "embassies", "international"],
      },
      {
        id: "missions",
        title: "Diplomatic Missions",
        description: "Conducting diplomatic missions",
        path: "/help/diplomacy/missions",
        tags: ["diplomacy", "missions"],
      },
      {
        id: "npc-personalities",
        title: "NPC Personality & AI",
        description: "8 traits, 6 archetypes, behavioral prediction",
        path: "/help/diplomacy/npc-personalities",
        tags: ["diplomacy", "npc", "ai", "personality"],
      },
      {
        id: "scenarios",
        title: "Dynamic Diplomatic Scenarios",
        description: "100+ scenarios with trade, culture, security",
        path: "/help/diplomacy/scenarios",
        tags: ["diplomacy", "scenarios", "dynamic"],
      },
      {
        id: "cultural",
        title: "Cultural Exchanges",
        description: "Cultural programs and exchanges",
        path: "/help/diplomacy/cultural",
        tags: ["diplomacy", "culture", "exchanges"],
      },
    ],
  },
  {
    id: "social",
    title: "Social Platform",
    description: "ThinkPages, ThinkShare, ThinkTanks",
    icon: Users,
    category: "features",
    articles: [
      {
        id: "thinkpages",
        title: "ThinkPages",
        description: "Creating and sharing content",
        path: "/help/social/thinkpages",
        tags: ["social", "thinkpages", "content"],
      },
      {
        id: "thinkshare",
        title: "ThinkShare",
        description: "Social sharing and collaboration",
        path: "/help/social/thinkshare",
        tags: ["social", "thinkshare", "collaboration"],
      },
      {
        id: "thinktanks",
        title: "ThinkTanks",
        description: "Research groups and think tanks",
        path: "/help/social/thinktanks",
        tags: ["social", "thinktanks", "research"],
      },
    ],
  },
  {
    id: "unified-intelligence",
    title: "Unified Intelligence System",
    description: "Executive command and strategic intelligence (formerly ECI/SDI)",
    icon: BarChart3,
    category: "systems",
    articles: [
      {
        id: "unified-overview",
        title: "Unified Intelligence Overview",
        description: "Understanding the unified intelligence system",
        path: "/help/intelligence/unified-overview",
        tags: ["intelligence", "unified", "analytics"],
      },
      {
        id: "executive-operations",
        title: "Executive Operations",
        description: "Command center and strategic operations",
        path: "/help/intelligence/executive-operations",
        tags: ["executive", "operations", "command"],
      },
      {
        id: "strategic-intelligence",
        title: "Strategic Intelligence",
        description: "Intelligence feeds and crisis management",
        path: "/help/intelligence/strategic-intelligence",
        tags: ["intelligence", "crisis", "strategic"],
      },
    ],
  },
  {
    id: "technical",
    title: "Technical Documentation",
    description: "Architecture and technical details",
    icon: Code,
    category: "technical",
    articles: [
      {
        id: "architecture",
        title: "System Architecture",
        description: "Understanding the technical architecture",
        path: "/help/technical/architecture",
        tags: ["technical", "architecture"],
      },
      {
        id: "api",
        title: "API Documentation",
        description: "52 routers, 580+ procedures reference",
        path: "/help/technical/api",
        tags: ["technical", "api", "trpc"],
      },
      {
        id: "database",
        title: "Database Schema",
        description: "131 Prisma models and data structure",
        path: "/help/technical/database",
        tags: ["technical", "database", "schema"],
      },
      {
        id: "rate-limiting",
        title: "Rate Limiting System",
        description: "Redis-based rate limiting and security",
        path: "/help/technical/rate-limiting",
        tags: ["technical", "rate-limiting", "security"],
      },
      {
        id: "glass-physics",
        title: "Glass Physics Design System",
        description: "UI framework and design principles",
        path: "/help/technical/design-system",
        tags: ["technical", "design", "ui"],
      },
    ],
  },
  {
    id: "maps-geography",
    title: "Maps & Geography",
    description: "Vector tiles and map editing",
    icon: Map,
    category: "technical",
    articles: [
      {
        id: "vector-tiles",
        title: "Vector Tile System",
        description: "100-1000x performance with Martin + Redis",
        path: "/help/maps/vector-tiles",
        tags: ["maps", "performance", "tiles"],
      },
      {
        id: "map-editor",
        title: "Interactive Map Editor",
        description: "Create subdivisions, cities, and POIs",
        path: "/help/maps/editor",
        tags: ["maps", "editor", "gis"],
      },
    ],
  },
  {
    id: "admin-tools",
    title: "Admin Tools",
    description: "Content management and system administration",
    icon: Settings,
    category: "admin",
    articles: [
      {
        id: "cms-overview",
        title: "Admin CMS Overview",
        description: "17 interfaces for 100% dynamic content",
        path: "/help/admin/cms-overview",
        tags: ["admin", "cms", "management"],
      },
      {
        id: "reference-data",
        title: "Reference Data Management",
        description: "Manage components, equipment, scenarios",
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
    { id: "getting-started", label: "Getting Started", icon: Sparkles },
    { id: "features", label: "Features", icon: Zap },
    { id: "systems", label: "Systems", icon: Cpu },
    { id: "technical", label: "Technical", icon: Code },
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
          <div className="mb-4 flex items-center gap-3">
            <Book className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Help & Documentation
            </h1>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Comprehensive guides and documentation for IxStats platform
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
              placeholder="Search documentation..."
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
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            href="/help/technical/api"
            className="group flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-4 transition-all hover:border-emerald-400/50"
          >
            <Code className="h-8 w-8 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">API Docs</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">For developers</div>
            </div>
          </Link>

          <Link
            href="/"
            className="group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-4 transition-all hover:border-amber-400/50"
          >
            <Lightbulb className="h-8 w-8 text-amber-600 transition-transform group-hover:scale-110 dark:text-amber-400" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Back to Platform</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Return home</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
