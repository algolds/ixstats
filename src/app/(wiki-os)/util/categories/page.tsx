"use client";
// src/app/(wiki-os)/util/categories/page.tsx
// WikiOS Category Index & Directory Portal — Root category taxonomy, A-Z index & domain hub.

import React, { useState, useMemo } from "react";
import {
  Search,
  Folder,
  Packages as Layers,
  Xmark as X,
  Globe as IconoirGlobe,
} from "iconoir-react";
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

  const { data: categoryResults, isLoading: isLoadingCats } = api.wikios.searchCategories.useQuery(
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
      <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
        {/* Hero Masthead & Search */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/70 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />

          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Folder className="h-3.5 w-3.5" />
                <span>Knowledge Taxonomy</span>
              </div>
              <h1 className="text-foreground font-brand text-2xl font-bold tracking-tight sm:text-3xl">
                Category Directory
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Explore IxWiki articles through structured worldbuilding domains, sovereign nation
                portals, and encyclopedic topic classifications.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <div className="border-border/60 flex items-center gap-2 rounded-2xl border bg-white/50 px-3.5 py-2 backdrop-blur-sm dark:bg-zinc-800/50">
                <Layers className="h-4 w-4 text-blue-500" />
                <div className="text-left">
                  <div className="text-foreground text-xs font-bold">12 Domains</div>
                  <div className="text-muted-foreground text-[10px]">Primary Portals</div>
                </div>
              </div>

              <div className="border-border/60 flex items-center gap-2 rounded-2xl border bg-white/50 px-3.5 py-2 backdrop-blur-sm dark:bg-zinc-800/50">
                <IconoirGlobe className="h-4 w-4 text-emerald-500" />
                <div className="text-left">
                  <div className="text-foreground text-xs font-bold">
                    {countries.length} Nations
                  </div>
                  <div className="text-muted-foreground text-[10px]">Geopolitical Portals</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6">
            <div className="relative flex items-center">
              <Search className="text-muted-foreground pointer-events-none absolute left-3.5 h-4 w-4" />
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
                className="border-border/80 placeholder:text-muted-foreground/60 text-foreground w-full rounded-2xl border bg-white/80 py-3 pr-10 pl-10 text-sm shadow-inner transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:bg-zinc-950/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted absolute right-3.5 rounded-full p-1 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="border-border/60 flex flex-col items-start justify-between gap-4 border-b pb-3 sm:flex-row sm:items-center">
          <div className="bg-muted/60 border-border/50 flex items-center gap-1.5 rounded-xl border p-1">
            <button
              onClick={() => setActiveTab("domains")}
              className={cn(
                "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                activeTab === "domains"
                  ? "text-foreground bg-white shadow-sm dark:bg-zinc-800"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Domain Portals
            </button>
            <button
              onClick={() => setActiveTab("all-categories")}
              className={cn(
                "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                activeTab === "all-categories"
                  ? "text-foreground bg-white shadow-sm dark:bg-zinc-800"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Categories (A–Z)
            </button>
            <button
              onClick={() => setActiveTab("nations")}
              className={cn(
                "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                activeTab === "nations"
                  ? "text-foreground bg-white shadow-sm dark:bg-zinc-800"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Countries ({countries.length})
            </button>
          </div>

          <div className="text-muted-foreground text-xs font-medium">
            {activeTab === "domains" && `${filteredDomains.length} domains available`}
            {activeTab === "all-categories" &&
              `${cleanedLiveCategories.length} live categories listed`}
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
