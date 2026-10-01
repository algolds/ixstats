"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { SearchField } from "~/components/ui/search-field";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import AchievementCard from "./AchievementCard";
import { FacetTabs } from "~/components/ui/facet";

const REGISTRY_TABS = [
  { id: "ALL", label: "All" },
  { id: "COUNTRY", label: "Country" },
  { id: "DYNASTY", label: "Dynasty" },
  { id: "INSTITUTION", label: "Institution" },
  { id: "CHARACTER", label: "Character" },
] as const;

export default function RegistryBrowser() {
  const [activeTab, setActiveTab] = useState<
    "ALL" | "COUNTRY" | "DYNASTY" | "INSTITUTION" | "CHARACTER"
  >("ALL");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(16);

  // Fetch from router
  const { data, isLoading } = api.heraldry.getRegistry.useQuery({
    subjectType: activeTab === "ALL" ? undefined : activeTab,
    limit,
  });

  const achievements = data?.items ?? [];
  const totalCount = data?.total ?? 0;

  // Client side search filter
  const filteredAchievements = achievements.filter((ach) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      ach.title.toLowerCase().includes(query) ||
      ach.generatedBlazon.toLowerCase().includes(query) ||
      ach.ownerId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Sub-navigation & search toolbar */}
      <FacetCard className="flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
        {/* Filter Tabs */}
        <FacetTabs
          tabs={[...REGISTRY_TABS]}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab as (typeof REGISTRY_TABS)[number]["id"]);
            setLimit(16); // reset
          }}
          size="sm"
          tone="neutral"
          showTexture={false}
        />

        {/* Search */}
        <div className="text-footnote w-full md:w-72">
          <SearchField
            aria-label="Search the registry"
            placeholder="Search by title or blazon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
      </FacetCard>

      {/* Grid List */}
      {isLoading ? (
        <div className="text-label-secondary text-footnote flex flex-col items-center justify-center gap-3 py-32">
          <div className="border-tint h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <span>Consulting the Heraldic rolls...</span>
        </div>
      ) : filteredAchievements.length === 0 ? (
        <div className="border-separator bg-fill-3 text-label-secondary rounded-row text-footnote border p-20 text-center italic">
          No achievements registered.
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {filteredAchievements.map((item) => (
              <AchievementCard key={item.id} achievement={item as any} />
            ))}
          </div>

          {/* Load More */}
          {totalCount > limit && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm" onClick={() => setLimit((prev) => prev + 16)}>
                Load More Registry Items ({totalCount - limit} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
