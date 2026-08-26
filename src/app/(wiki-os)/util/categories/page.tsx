// src/app/(wiki-os)/wiki/categories/page.tsx
// WikiOS Category Index & Directory Portal — Root category taxonomy, A-Z index & domain hub.
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Folder,
  ArrowRight,
  Packages as Layers,
  Xmark as X,
  Hashtag as Hash,
  Globe as IconoirGlobe,
  Building as IconoirBuilding,
  Palette as IconoirPalette,
  GraphUp as IconoirGraphUp,
  MapPin as IconoirMapPin,
  Bank as IconoirBank,
  Timer as IconoirTimer,
  Shield as IconoirShield,
  Leaf as IconoirLeaf,
  Group as IconoirGroup,
  Megaphone as IconoirMegaphone,
  Cpu as IconoirCpu,
} from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";

// ---------------------------------------------------------------------------
// Domain taxonomy matrix
// ---------------------------------------------------------------------------

interface DomainCategory {
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  metric: string;
  description: string;
}

const DOMAIN_CATEGORIES: DomainCategory[] = [
  {
    name: "Countries",
    color: "#3b82f6",
    icon: IconoirGlobe,
    metric: "Sovereign States & Territories",
    description: "Nations, sovereign states, dependent territories, and geopolitical entities.",
  },
  {
    name: "Economy",
    color: "#22c55e",
    icon: IconoirGraphUp,
    metric: "GDP, Trade & Industries",
    description: "Economic systems, international trade, currencies, financial markets, and industry.",
  },
  {
    name: "Government",
    color: "#6366f1",
    icon: IconoirBank,
    metric: "Political Systems & Law",
    description: "Political systems, constitutional structures, governance, and public administration.",
  },
  {
    name: "Military",
    color: "#ef4444",
    icon: IconoirShield,
    metric: "Defense & Armed Forces",
    description: "Armed forces branches, military equipment, defense doctrines, and historic conflicts.",
  },
  {
    name: "People",
    color: "#ec4899",
    icon: IconoirGroup,
    metric: "Demographics & Society",
    description: "Demographics, ethnic groups, linguistics, notable figures, and social structures.",
  },
  {
    name: "Politics",
    color: "#8b5cf6",
    icon: IconoirMegaphone,
    metric: "Elections, Parties & Treaties",
    description: "Elections, political movements, political parties, alliances, and diplomacy.",
  },
  {
    name: "History",
    color: "#eab308",
    icon: IconoirTimer,
    metric: "Timelines & Epochs",
    description: "Historical events, timelines, ancient eras, revolutions, and world history.",
  },
  {
    name: "Geography",
    color: "#14b8a6",
    icon: IconoirMapPin,
    metric: "Landforms & Regions",
    description: "Physical geography, continents, mountain ranges, bodies of water, and climates.",
  },
  {
    name: "Culture",
    color: "#a855f7",
    icon: IconoirPalette,
    metric: "Art, Heritage & Customs",
    description: "Art, architecture, music, folklore, cuisine, holidays, and cultural traditions.",
  },
  {
    name: "Technology",
    color: "#06b6d4",
    icon: IconoirCpu,
    metric: "Science & Innovation",
    description: "Science, technological development, aerospace, transport, and research institutions.",
  },
  {
    name: "Companies",
    color: "#f97316",
    icon: IconoirBuilding,
    metric: "Corporations & Commerce",
    description: "Commercial enterprises, conglomerates, state-owned corporations, and market leaders.",
  },
  {
    name: "Nature",
    color: "#10b981",
    icon: IconoirLeaf,
    metric: "Flora, Fauna & Ecology",
    description: "Flora, fauna, nature reserves, ecosystems, and natural phenomena across the world.",
  },
  {
    name: "Miscellaneous",
    color: "#64748b",
    icon: Layers,
    metric: "Indexes, Documents & General",
    description: "General topics, uncategorized articles, cross-disciplinary subjects, and reference indexes.",
  },
];

const ALPHABET = ["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"] as const;

export default function CategoriesIndexPage() {
  const reduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"domains" | "all-categories" | "nations">("domains");

  // Determine query parameters for live category search
  const effectiveQuery = useMemo(() => {
    if (searchQuery.trim().length > 0) return searchQuery.trim();
    if (activeLetter !== "ALL" && activeLetter !== "#") return activeLetter;
    if (activeLetter === "#") return "0";
    return "";
  }, [searchQuery, activeLetter]);

  // Live Category Search from MediaWiki
  const { data: categoryResults, isLoading: isLoadingCats } =
    api.wikios.searchCategories.useQuery(
      {
        query: effectiveQuery,
        limit: 60,
        wiki: "ixwiki",
      },
      {
        staleTime: 60_000,
      }
    );

  // Country Portals Data (Flags + Economic Tiers)
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 10 * 60 * 1000 }
  );

  const countries = useMemo(() => {
    const list = Array.isArray(countriesData)
      ? countriesData
      : ((countriesData as any)?.countries ?? []);
    return [...list].sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [countriesData]);

  // Filtered countries if in search mode
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const q = searchQuery.toLowerCase().trim();
    return countries.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [countries, searchQuery]);

  // Filtered domain categories if in search mode
  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) return DOMAIN_CATEGORIES;
    const q = searchQuery.toLowerCase().trim();
    return DOMAIN_CATEGORIES.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.metric.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filter maintenance categories from live search
  const cleanedLiveCategories = useMemo(() => {
    if (!categoryResults) return [];
    return categoryResults.filter(
      (c) =>
        !c.name.startsWith("Pages ") &&
        !c.name.startsWith("Articles ") &&
        !c.name.includes(" with ") &&
        !c.name.startsWith("IXWB") &&
        !c.name.startsWith("All ")
    );
  }, [categoryResults]);

  return (
    <WikiOSLayout hideTitleHeading>
      <div className="w-full space-y-8 select-none pb-16 max-w-6xl mx-auto">
        {/* ── 1. Hero Masthead & Search ── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-white/20 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Folder className="h-3.5 w-3.5" />
                <span>Knowledge Taxonomy</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-brand">
                Category Directory
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Explore IxWiki articles through structured worldbuilding domains, sovereign nation
                portals, and encyclopedic topic classifications.
              </p>
            </div>

            {/* Quick stats badge deck */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-border/60 backdrop-blur-sm">
                <Layers className="h-4 w-4 text-blue-500" />
                <div className="text-left">
                  <div className="text-xs font-bold text-foreground">12 Domains</div>
                  <div className="text-[10px] text-muted-foreground">Primary Portals</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-border/60 backdrop-blur-sm">
                <IconoirGlobe className="h-4 w-4 text-emerald-500" />
                <div className="text-left">
                  <div className="text-xs font-bold text-foreground">{countries.length} Nations</div>
                  <div className="text-[10px] text-muted-foreground">Geopolitical Portals</div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Category Search Input */}
          <div className="relative z-10 mt-6">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length > 0) {
                    setActiveLetter("ALL");
                  }
                }}
                placeholder="Search all categories, worldbuilding topics, or sovereign nations..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm bg-white/80 dark:bg-zinc-950/80 border border-border/80 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner transition-all placeholder:text-muted-foreground/60 text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── 2. Navigation Tabs & A–Z Index Bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/50">
            <button
              onClick={() => setActiveTab("domains")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "domains"
                  ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Domain Portals
            </button>
            <button
              onClick={() => setActiveTab("all-categories")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "all-categories"
                  ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Categories (A–Z)
            </button>
            <button
              onClick={() => setActiveTab("nations")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "nations"
                  ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Countries ({countries.length})
            </button>
          </div>

          {/* Quick Counter */}
          <div className="text-xs text-muted-foreground font-medium">
            {activeTab === "domains" && `${filteredDomains.length} domains available`}
            {activeTab === "all-categories" &&
              `${cleanedLiveCategories.length} live categories listed`}
            {activeTab === "nations" && `${filteredCountries.length} nation portals`}
          </div>
        </div>

        {/* ── 3. Tab Content 1: Domain Portals ── */}
        {activeTab === "domains" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDomains.map((domain, index) => {
                const Icon = domain.icon;
                return (
                  <motion.div
                    key={domain.name}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.02 }}
                  >
                    <Link
                      href={withBasePath(`/wiki/categories/${encodeURIComponent(domain.name)}`)}
                      className={cn(
                        "group relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 rounded-2xl min-h-[160px]",
                        "border border-white/20 dark:border-white/10",
                        "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md",
                        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.3)]",
                        "hover:border-foreground/30 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-lg",
                        "transition-all duration-200 active:scale-[0.98]"
                      )}
                    >
                      <TextureOverlay texture="halftone" opacity={0.03} />

                      {/* Header with Icon + Arrow */}
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 shrink-0"
                            style={{
                              backgroundColor: `${domain.color}15`,
                              color: domain.color,
                            }}
                          >
                            <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-foreground group-hover:text-blue-500 transition-colors">
                              {domain.name}
                            </h2>
                            <div className="text-[10px] font-medium text-muted-foreground">
                              {domain.metric}
                            </div>
                          </div>
                        </div>

                        <div className="p-1.5 rounded-full bg-muted/60 text-muted-foreground group-hover:text-foreground group-hover:bg-blue-500/10 transition-colors">
                          <ArrowRight className="h-3.5 w-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-200" />
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed mt-3 line-clamp-2">
                        {domain.description}
                      </p>

                      {/* Footer Badge */}
                      <div className="mt-4 flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px] font-semibold text-blue-500">
                        <span>Open {domain.name} Portal</span>
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                          Category:{domain.name} →
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {filteredDomains.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No domain portals matching &quot;{searchQuery}&quot;.
              </div>
            )}
          </div>
        )}

        {/* ── 4. Tab Content 2: All Categories (A–Z Index + Live Query) ── */}
        {activeTab === "all-categories" && (
          <div className="space-y-6">
            {/* A–Z Letter Selector */}
            <div className="flex items-center gap-1 overflow-x-auto p-1.5 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-border/60 backdrop-blur-md no-scrollbar">
              {ALPHABET.map((char) => {
                const isActive = activeLetter === char && !searchQuery.trim();
                return (
                  <button
                    key={char}
                    onClick={() => {
                      setActiveLetter(char);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      isActive
                        ? "bg-blue-600 text-white shadow-sm scale-105"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    {char}
                  </button>
                );
              })}
            </div>

            {/* Category Results Grid */}
            {isLoadingCats ? (
              <div className="flex items-center justify-center py-16">
                <div className="wikios-loading-spinner" />
              </div>
            ) : cleanedLiveCategories.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {cleanedLiveCategories.map((cat) => (
                  <Link
                    key={cat.name}
                    href={withBasePath(
                      `/wiki/categories/${encodeURIComponent(cat.name.replace(/ /g, "_"))}`
                    )}
                    className={cn(
                      "group relative overflow-hidden flex flex-col justify-between p-3.5 rounded-xl",
                      "border border-white/20 dark:border-white/10",
                      "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md",
                      "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)]",
                      "hover:border-blue-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md",
                      "transition-all duration-200 active:scale-[0.98]"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Folder className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate group-hover:text-blue-500 transition-colors">
                          {cat.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          {cat.pages > 0 && <span>{cat.pages} pages</span>}
                          {cat.subcats > 0 && <span>· {cat.subcats} subcats</span>}
                          {cat.files > 0 && <span>· {cat.files} files</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No categories found starting with &quot;{effectiveQuery}&quot;.
              </div>
            )}
          </div>
        )}

        {/* ── 5. Tab Content 3: Sovereign Nations Directory ── */}
        {activeTab === "nations" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredCountries.map((country: any) => (
                <Link
                  key={country.id}
                  href={withBasePath(
                    `/wiki/categories/${encodeURIComponent((country.name ?? "").replace(/ /g, "_"))}`
                  )}
                  className={cn(
                    "group relative overflow-hidden flex items-center gap-3 p-3 rounded-xl",
                    "border border-white/20 dark:border-white/10",
                    "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md",
                    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)]",
                    "hover:border-emerald-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md",
                    "transition-all duration-200 active:scale-[0.98]"
                  )}
                >
                  {country.flagUrl ? (
                    <img
                      src={country.flagUrl}
                      alt=""
                      className="h-7 w-11 object-cover rounded border border-border/60 shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <IconoirGlobe className="h-6 w-6 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate group-hover:text-emerald-500 transition-colors">
                      {country.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mt-0.5 tabular-nums truncate">
                      {country.population ? <span>Pop {formatNumber(country.population, 1)}</span> : null}
                      {country.population && country.gdp ? <span className="opacity-40">·</span> : null}
                      {country.gdp ? <span>{formatCurrency(country.gdp)}</span> : null}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                </Link>
              ))}
            </div>

            {filteredCountries.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No nations matching &quot;{searchQuery}&quot;.
              </div>
            )}
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
