// src/app/(wiki-os)/util/categories/page.tsx
// WikiOS Category Index & Directory Portal — Root category taxonomy, A-Z index & domain hub.
"use client";

import React, { useState, useMemo } from "react";
import { Search, Folder, Packages as Layers, Xmark as X, Globe as IconoirGlobe } from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { DOMAIN_CATEGORIES } from "./_components/constants";
import { DomainCategoriesGrid } from "./_components/DomainCategoriesGrid";
import { AlphabetIndexBar } from "./_components/AlphabetIndexBar";
import { SovereignNationsGrid } from "./_components/SovereignNationsGrid";

export default function CategoriesIndexPage() {
  const reduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"domains" | "all-categories" | "nations">("domains");

  const effectiveQuery = useMemo(() => {
    if (searchQuery.trim().length > 0) return searchQuery.trim();
    if (activeLetter !== "ALL" && activeLetter !== "#") return activeLetter;
    if (activeLetter === "#") return "0";
    return "";
  }, [searchQuery, activeLetter]);

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

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const q = searchQuery.toLowerCase().trim();
    return countries.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [countries, searchQuery]);

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
        {/* Hero Masthead & Search */}
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

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
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

          <div className="text-xs text-muted-foreground font-medium">
            {activeTab === "domains" && `${filteredDomains.length} domains available`}
            {activeTab === "all-categories" && `${cleanedLiveCategories.length} live categories listed`}
            {activeTab === "nations" && `${filteredCountries.length} nation portals`}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "domains" && (
          <DomainCategoriesGrid domains={filteredDomains} searchQuery={searchQuery} />
        )}

        {activeTab === "all-categories" && (
          <AlphabetIndexBar
            activeLetter={activeLetter}
            onSelectLetter={(char) => {
              setActiveLetter(char);
              setSearchQuery("");
            }}
            searchQuery={searchQuery}
            cleanedLiveCategories={cleanedLiveCategories}
            isLoading={isLoadingCats}
            effectiveQuery={effectiveQuery}
          />
        )}

        {activeTab === "nations" && (
          <SovereignNationsGrid countries={filteredCountries} searchQuery={searchQuery} />
        )}
      </div>
    </WikiOSLayout>
  );
}
