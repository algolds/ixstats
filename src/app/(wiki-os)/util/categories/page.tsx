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
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { DOMAIN_CATEGORIES } from "./_components/constants";
import { DomainCategoriesGrid } from "./_components/DomainCategoriesGrid";
import { AlphabetIndexBar } from "./_components/AlphabetIndexBar";
import { SovereignNationsGrid } from "./_components/SovereignNationsGrid";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
          className="bg-surface border-separator shadow-card text-label rounded-card relative overflow-hidden border p-6 sm:p-8"
        >
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl space-y-2">
              <div className="border-tint/20 bg-tint/10 text-caption text-tint inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold">
                <Folder className="h-3.5 w-3.5" />
                <span>Knowledge taxonomy</span>
              </div>
              <h1 className="text-label font-brand text-title-1 sm:text-large-title">
                Category directory
              </h1>
              <p className="text-label-secondary text-body leading-relaxed">
                Explore IxWiki articles through structured worldbuilding domains, sovereign nation
                portals, and encyclopedic topic classifications.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="border-separator rounded-card bg-surface flex items-center gap-2 border px-4 py-2">
                <Layers className="text-tint h-4 w-4" />
                <div className="text-left">
                  <div className="text-label text-caption font-semibold">12 Domains</div>
                  <div className="text-label-secondary text-footnote">Primary portals</div>
                </div>
              </div>

              <div className="border-separator rounded-card bg-surface flex items-center gap-2 border px-4 py-2">
                <IconoirGlobe className="text-green h-4 w-4" />
                <div className="text-left">
                  <div className="text-label text-caption font-semibold">
                    {countries.length} Nations
                  </div>
                  <div className="text-label-secondary text-footnote">Geopolitical portals</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6">
            <div className="relative flex items-center">
              <Search className="text-label-secondary pointer-events-none absolute left-4 h-4 w-4" />
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
                className="border-separator placeholder:text-label-tertiary text-label rounded-card bg-surface text-body focus:border-tint focus:ring-tint/20 w-full border py-3 pr-10 pl-10 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="text-label-secondary absolute right-3 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="border-separator flex flex-col items-start justify-between gap-4 border-b pb-3 sm:flex-row sm:items-center">
          <SegmentedControl
            aria-label="Category views"
            value={activeTab}
            onValueChange={setActiveTab}
            options={[
              { value: "domains", label: "Domain portals" },
              { value: "all-categories", label: "All Categories (A–Z)" },
              { value: "nations", label: `Countries (${countries.length})` },
            ]}
          />

          <div className="text-label-secondary text-caption">
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
