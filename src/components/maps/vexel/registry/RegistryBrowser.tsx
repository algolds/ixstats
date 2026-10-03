"use client";
import { SearchField } from "~/components/ui/search-field";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import AchievementCard from "./AchievementCard";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";

const REGISTRY_TABS = [
  { value: "ALL", label: "All" },
  { value: "COUNTRY", label: "Country" },
  { value: "DYNASTY", label: "Dynasty" },
  { value: "INSTITUTION", label: "Institution" },
  { value: "CHARACTER", label: "Character" },
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
      <Card className="flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
        <SegmentedControl
          options={[...REGISTRY_TABS]}
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab as (typeof REGISTRY_TABS)[number]["value"]);
            setLimit(16); // reset
          }}
          size="sm"
          asTabs
        />

        <div className="text-footnote w-full md:w-72">
          <SearchField
            aria-label="Search the registry"
            placeholder="Search by title or blazon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
      </Card>

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
