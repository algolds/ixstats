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
  Plane
} from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "getting-started" | "features" | "systems" | "technical";
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
        tags: ["basics", "intro", "overview"]
      },
      {
        id: "ixtime",
        title: "Understanding IxTime",
        description: "Learn about the custom time system that powers the simulation",
        path: "/help/getting-started/ixtime",
        tags: ["time", "basics", "simulation"]
      },
      {
        id: "first-country",
        title: "Creating Your First Country",
        description: "Step-by-step guide to building your nation",
        path: "/help/getting-started/first-country",
        tags: ["country", "builder", "tutorial"]
      },
      {
        id: "navigation",
        title: "Navigating the Platform",
        description: "Understanding the interface and navigation",
        path: "/help/getting-started/navigation",
        tags: ["ui", "interface", "basics"]
      }
    ]
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
        tags: ["economy", "tiers", "growth"]
      },
      {
        id: "calculations",
        title: "Economic Calculations",
        description: "Understanding GDP, trade, and economic indicators",
        path: "/help/economy/calculations",
        tags: ["economy", "gdp", "calculations"]
      },
      {
        id: "modeling",
        title: "Economic Modeling & Projections",
        description: "How to use modeling tools and projections",
        path: "/help/economy/modeling",
        tags: ["economy", "modeling", "projections"]
      },
      {
        id: "trade",
        title: "Trade & Commerce",
        description: "International trade mechanics and balance",
        path: "/help/economy/trade",
        tags: ["economy", "trade", "international"]
      }
    ]
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
        tags: ["government", "builder", "traditional"]
      },
      {
        id: "atomic",
        title: "Atomic Government System",
        description: "Advanced modular government design",
        path: "/help/government/atomic",
        tags: ["government", "atomic", "advanced"]
      },
      {
        id: "components",
        title: "Government Components",
        description: "Understanding the 24 atomic components",
        path: "/help/government/components",
        tags: ["government", "components", "modules"]
      },
      {
        id: "synergy",
        title: "Component Synergies",
        description: "How components interact and create synergies",
        path: "/help/government/synergy",
        tags: ["government", "synergy", "interactions"]
      }
    ]
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
        tags: ["defense", "military", "overview"]
      },
      {
        id: "units",
        title: "Military Units & Assets",
        description: "Understanding unit types and capabilities",
        path: "/help/defense/units",
        tags: ["defense", "units", "military"]
      },
      {
        id: "stability",
        title: "Political Stability",
        description: "Managing internal security and stability",
        path: "/help/defense/stability",
        tags: ["defense", "stability", "security"]
      },
      {
        id: "customization",
        title: "Force Customization",
        description: "Personalizing your military forces",
        path: "/help/defense/customization",
        tags: ["defense", "customization", "military"]
      }
    ]
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
        tags: ["intelligence", "dashboard", "analytics"]
      },
      {
        id: "metrics",
        title: "Key Metrics & Indicators",
        description: "Understanding intelligence metrics",
        path: "/help/intelligence/metrics",
        tags: ["intelligence", "metrics", "kpi"]
      },
      {
        id: "alerts",
        title: "Alerts & Notifications",
        description: "Managing alerts and real-time updates",
        path: "/help/intelligence/alerts",
        tags: ["intelligence", "alerts", "notifications"]
      },
      {
        id: "forecasting",
        title: "Forecasting & Predictions",
        description: "Using predictive analytics",
        path: "/help/intelligence/forecasting",
        tags: ["intelligence", "forecasting", "predictions"]
      }
    ]
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
        tags: ["diplomacy", "embassies", "international"]
      },
      {
        id: "missions",
        title: "Diplomatic Missions",
        description: "Conducting diplomatic missions",
        path: "/help/diplomacy/missions",
        tags: ["diplomacy", "missions"]
      },
      {
        id: "cultural",
        title: "Cultural Exchanges",
        description: "Cultural programs and exchanges",
        path: "/help/diplomacy/cultural",
        tags: ["diplomacy", "culture", "exchanges"]
      }
    ]
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
        tags: ["social", "thinkpages", "content"]
      },
      {
        id: "thinkshare",
        title: "ThinkShare",
        description: "Social sharing and collaboration",
        path: "/help/social/thinkshare",
        tags: ["social", "thinkshare", "collaboration"]
      },
      {
        id: "thinktanks",
        title: "ThinkTanks",
        description: "Research groups and think tanks",
        path: "/help/social/thinktanks",
        tags: ["social", "thinktanks", "research"]
      }
    ]
  },
  {
    id: "eci-sdi",
    title: "ECI & SDI Systems",
    description: "Economic and Security Development Indices",
    icon: BarChart3,
    category: "systems",
    articles: [
      {
        id: "eci-overview",
        title: "Economic Complexity Index",
        description: "Understanding the ECI system",
        path: "/help/eci-sdi/eci",
        tags: ["eci", "economics", "index"]
      },
      {
        id: "sdi-overview",
        title: "Security Development Index",
        description: "Understanding the SDI system",
        path: "/help/eci-sdi/sdi",
        tags: ["sdi", "security", "index"]
      }
    ]
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
        tags: ["technical", "architecture"]
      },
      {
        id: "api",
        title: "API Documentation",
        description: "tRPC API reference and usage",
        path: "/help/technical/api",
        tags: ["technical", "api", "trpc"]
      },
      {
        id: "database",
        title: "Database Schema",
        description: "Understanding the data model",
        path: "/help/technical/database",
        tags: ["technical", "database", "schema"]
      },
      {
        id: "glass-physics",
        title: "Glass Physics Design System",
        description: "UI framework and design principles",
        path: "/help/technical/design-system",
        tags: ["technical", "design", "ui"]
      }
    ]
  }
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
    { id: "technical", label: "Technical", icon: Code }
  ];

  const filteredSections = useMemo(() => {
    let sections = helpSections;

    // Filter by category
    if (selectedCategory !== "all") {
      sections = sections.filter(s => s.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sections = sections
        .map(section => ({
          ...section,
          articles: section.articles.filter(article =>
            article.title.toLowerCase().includes(query) ||
            article.description.toLowerCase().includes(query) ||
            article.tags.some(tag => tag.toLowerCase().includes(query))
          )
        }))
        .filter(section => section.articles.length > 0);
    }

    return sections;
  }, [searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Book className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Help & Documentation</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-lg">
            Comprehensive guides and documentation for IxStats platform
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-xl"
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    selectedCategory === category.id
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-300"
                      : "bg-white border-slate-200 dark:bg-white/5 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{category.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Help Sections */}
        {filteredSections.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No results found</h3>
            <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredSections.map((section) => {
              const Icon = section.icon as React.ComponentType<{ className?: string }>;
              return (
                <div
                  key={section.id}
                  className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-6 backdrop-blur-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{section.title}</h2>
                      <p className="text-slate-600 dark:text-slate-300">{section.description}</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {section.articles.map((article) => (
                      <Link
                        key={article.id}
                        href={article.path}
                        className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 hover:border-blue-500/50 transition-all"
                      >
                        <div className="flex-1">
                          <h3 className="text-slate-900 dark:text-white font-semibold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                            {article.title}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{article.description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {article.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Links Footer */}
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/help/getting-started/welcome"
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl hover:border-blue-400/50 transition-all group"
          >
            <Target className="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-900 dark:text-white font-semibold">New to IxStats?</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Start here</div>
            </div>
          </Link>

          <Link
            href="/help/technical/api"
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl hover:border-emerald-400/50 transition-all group"
          >
            <Code className="w-8 h-8 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-900 dark:text-white font-semibold">API Docs</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">For developers</div>
            </div>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl hover:border-amber-400/50 transition-all group"
          >
            <Lightbulb className="w-8 h-8 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-900 dark:text-white font-semibold">Back to Platform</div>
              <div className="text-sm text-slate-700 dark:text-slate-300">Return home</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
