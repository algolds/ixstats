"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trophy } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { ActionPill } from "~/components/ui/action-pill";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AchievementListView,
  resolveAchievementRowState,
  type AchievementProgressStatus,
} from "../AchievementListView";
import { getCategoryTheme, groupAchievements, type GroupedAchievementItem } from "../constants";

type StatusFilter = "all" | AchievementProgressStatus;

interface CatalogueFilters {
  query: string;
  category: string;
  categorySeed: string | null;
  status: StatusFilter;
}

function matchesCatalogueFilters(
  item: GroupedAchievementItem,
  activeCategory: string,
  status: StatusFilter,
  trimmedQuery: string
): boolean {
  if (activeCategory !== "all" && item.category.toLowerCase() !== activeCategory.toLowerCase()) {
    return false;
  }

  if (status !== "all") {
    const rowState = resolveAchievementRowState(item);
    if (rowState.status !== status) {
      return false;
    }
  }

  if (!trimmedQuery) return true;

  const seriesMatch = item.seriesName?.toLowerCase().includes(trimmedQuery) ?? false;
  const levelMatch = item.levels.some(
    (lvl) =>
      lvl.title.toLowerCase().includes(trimmedQuery) ||
      lvl.description.toLowerCase().includes(trimmedQuery)
  );
  return seriesMatch || levelMatch;
}

interface AllAchievementsTabProps {
  achievements: RouterOutputs["achievements"]["getAllWithStatus"] | undefined;
  focusKey?: string;
}

export function AllAchievementsTab({ achievements, focusKey }: AllAchievementsTabProps) {
  const searchParams = useSearchParams();
  const resolvedFocusKey = focusKey ?? searchParams?.get("a") ?? undefined;
  const queryCategory = searchParams?.get("category") ?? null;

  const [filters, setFilters] = useState<CatalogueFilters>(() => ({
    query: "",
    category: queryCategory || "all",
    categorySeed: queryCategory,
    status: "all",
  }));
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(() => new Set());

  const activeCategory =
    filters.categorySeed === queryCategory ? filters.category : queryCategory || "all";

  const toggleSecretReveal = (key: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedItems = useMemo(() => groupAchievements(achievements ?? []), [achievements]);

  const categories = useMemo(
    () =>
      Array.from(new Set(groupedItems.map((item) => item.category))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [groupedItems]
  );

  const trimmedQuery = filters.query.trim().toLowerCase();
  const filteredGroupedItems = useMemo(
    () =>
      groupedItems.filter((item) =>
        matchesCatalogueFilters(item, activeCategory, filters.status, trimmedQuery)
      ),
    [groupedItems, activeCategory, filters.status, trimmedQuery]
  );

  const hasActiveFilters =
    Boolean(filters.query) || activeCategory !== "all" || filters.status !== "all";

  return (
    <section aria-labelledby="achievement-catalogue-title" className="space-y-4">
      <h2 id="achievement-catalogue-title" className="sr-only">
        Achievement catalogue
      </h2>

      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            size="sm"
            placeholder="Search achievements"
            aria-label="Search achievements"
            value={filters.query}
            onValueChange={(query) => setFilters((prev) => ({ ...prev, query }))}
            containerClassName="flex-1 sm:max-w-xs"
          />

          <Select
            value={filters.status}
            onValueChange={(status) =>
              setFilters((prev) => ({ ...prev, status: status as StatusFilter }))
            }
          >
            <SelectTrigger size="sm" aria-label="Status" className="w-full sm:w-40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="earned">Earned</SelectItem>
              <SelectItem value="in-progress">In progress</SelectItem>
              <SelectItem value="not-earned">Not earned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div role="group" aria-label="Category" className="flex flex-wrap items-center gap-1.5">
          <ActionPill
            size="sm"
            pressed={activeCategory === "all"}
            onClick={() =>
              setFilters((prev) => ({ ...prev, category: "all", categorySeed: queryCategory }))
            }
          >
            All
          </ActionPill>
          {categories.map((category) => {
            const theme = getCategoryTheme(category);
            const CatIcon = theme.icon;
            const isPressed = activeCategory.toLowerCase() === category.toLowerCase();

            return (
              <ActionPill
                key={category}
                size="sm"
                icon={<CatIcon />}
                pressed={isPressed}
                className={cn(isPressed && theme.pedestal)}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, category, categorySeed: queryCategory }))
                }
              >
                {category}
              </ActionPill>
            );
          })}
        </div>
      </div>

      {filteredGroupedItems.length > 0 ? (
        <AchievementListView
          items={filteredGroupedItems}
          activeCategory={activeCategory}
          revealedSecrets={revealedSecrets}
          toggleSecretReveal={toggleSecretReveal}
          focusKey={resolvedFocusKey}
        />
      ) : (
        <Card>
          <EmptyState
            icon={<Trophy />}
            title="No achievements match"
            message="Change the search or pick another filter."
            action={
              hasActiveFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setFilters({
                      query: "",
                      category: "all",
                      categorySeed: queryCategory,
                      status: "all",
                    })
                  }
                >
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}
    </section>
  );
}
