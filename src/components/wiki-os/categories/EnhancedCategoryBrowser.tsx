"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { Page as FileText } from "iconoir-react";
import {
  CategoryMasthead,
  CategoryPageCard,
  SubcategorySection,
  type CategoryMember,
} from "./CategoryParts";

interface EnhancedCategoryBrowserProps {
  category: string;
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

export function EnhancedCategoryBrowser({
  category,
  subcategories,
  pages,
}: EnhancedCategoryBrowserProps) {
  // Fetch all countries for flag matching
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 10 * 60 * 1000 }
  );

  const countryMap = useMemo(() => {
    const list = Array.isArray(countriesData)
      ? countriesData
      : ((countriesData as any)?.countries ?? []);
    const map = new Map<string, { flagUrl?: string | null; economicTier?: string | null }>();
    for (const c of list as any[]) {
      if (c.name)
        map.set(c.name.toLowerCase(), { flagUrl: c.flagUrl, economicTier: c.economicTier });
    }
    return map;
  }, [countriesData]);

  const cleanCategoryName = category.replace(/^Category:/i, "").replace(/_/g, " ");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
      <CategoryMasthead
        title={cleanCategoryName}
        description={
          <>
            Encyclopedic category index containing {pages.length} published article
            {pages.length === 1 ? "" : "s"}
            {subcategories.length > 0
              ? ` and ${subcategories.length} subcategor${subcategories.length === 1 ? "y" : "ies"}`
              : ""}
            .
          </>
        }
        articleCount={pages.length}
        subcategoryCount={subcategories.length}
      />

      <SubcategorySection subcategories={subcategories} />

      {/* ── Pages in Category Grid ── */}
      {pages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <FileText className="text-green h-4 w-4" />
            <h2 className="text-label text-headline text-subhead">
              Pages in category ({pages.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pages.map((m) => {
              const match = countryMap.get(m.title.toLowerCase());
              return (
                <CategoryPageCard
                  key={m.title}
                  title={m.title}
                  imageUrl={m.imageUrl}
                  flagUrl={match?.flagUrl}
                  detail={match?.economicTier}
                />
              );
            })}
          </div>
        </div>
      )}

      {pages.length === 0 && subcategories.length === 0 && (
        <div className="border-separator bg-fill-4 rounded-card border py-16 text-center">
          <p className="text-label-secondary text-body">This category is currently empty.</p>
        </div>
      )}
    </div>
  );
}
