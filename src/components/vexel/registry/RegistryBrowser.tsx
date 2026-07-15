"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import AchievementCard from "./AchievementCard";

export default function RegistryBrowser() {
  const [activeTab, setActiveTab] = useState<"ALL" | "COUNTRY" | "DYNASTY" | "INSTITUTION" | "CHARACTER">("ALL");
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 p-4 border border-white/5 rounded-xl backdrop-blur-md">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1 text-xs">
          {(["ALL", "COUNTRY", "DYNASTY", "INSTITUTION", "CHARACTER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setLimit(16); // reset
              }}
              className={`px-3 py-1.5 rounded-lg border transition-all font-semibold uppercase tracking-wider text-[10px] ${
                activeTab === tab
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full md:w-72 text-xs">
          <input
            type="text"
            placeholder="Search by title or blazon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-zinc-300 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-500 text-xs">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span>Consulting the Heraldic rolls...</span>
        </div>
      ) : filteredAchievements.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-zinc-900/10 p-20 text-center text-zinc-500 text-xs italic">
          No achievements registered.
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {filteredAchievements.map((item) => (
              <AchievementCard key={item.id} achievement={item as any} />
            ))}
          </div>

          {/* Load More */}
          {totalCount > limit && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setLimit((prev) => prev + 16)}
                className="px-6 py-2 rounded-lg border border-white/10 bg-zinc-900/40 hover:bg-zinc-800/40 hover:border-amber-500/20 text-xs font-bold tracking-wider text-zinc-400 hover:text-amber-400 transition-all outline-none"
              >
                Load More Registry Items ({totalCount - limit} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
