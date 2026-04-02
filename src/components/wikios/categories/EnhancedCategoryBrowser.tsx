"use client";

import { useMemo } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Folder, FileText } from "lucide-react";

interface CategoryMember {
  title: string;
  ns: number;
}

interface EnhancedCategoryBrowserProps {
  category: string;
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

export function EnhancedCategoryBrowser({ subcategories, pages }: EnhancedCategoryBrowserProps) {
  // Fetch all countries for flag matching
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 10 * 60 * 1000 }
  );

  const countryMap = useMemo(() => {
    const list = Array.isArray(countriesData) ? countriesData : (countriesData as any)?.countries ?? [];
    const map = new Map<string, { flagUrl?: string | null; economicTier?: string | null }>();
    for (const c of list as any[]) {
      if (c.name) map.set(c.name.toLowerCase(), { flagUrl: c.flagUrl, economicTier: c.economicTier });
    }
    return map;
  }, [countriesData]);

  return (
    <div className="wikios-portal">
      {/* Subcategories */}
      {subcategories.length > 0 && (
        <div className="wikios-portal-section">
          <h2 className="wikios-portal-section-title">Subcategories</h2>
          <div className="wikios-portal-subcats">
            {subcategories.map((m) => {
              const name = m.title.replace(/^Category:/, "");
              return (
                <Link
                  key={m.title}
                  href={withBasePath(`/w/special/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`)}
                  className="wikios-portal-pill"
                >
                  <Folder className="h-3 w-3 opacity-50" />
                  {name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pages */}
      {pages.length > 0 && (
        <div className="wikios-portal-section">
          <h2 className="wikios-portal-section-title">
            Pages in category ({pages.length})
          </h2>
          <div className="wikios-portal-articles">
            {pages.map((m) => {
              const match = countryMap.get(m.title.toLowerCase());
              return (
                <Link
                  key={m.title}
                  href={withBasePath(`/w/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                  className="wikios-portal-card"
                >
                  {match?.flagUrl ? (
                    <img src={match.flagUrl} alt="" className="wikios-portal-card-flag" loading="lazy" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 opacity-40 shrink-0" />
                  )}
                  <span className="wikios-portal-card-title">{m.title}</span>
                  {match?.economicTier && (
                    <span className="wikios-portal-card-tier">{match.economicTier}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {pages.length === 0 && subcategories.length === 0 && (
        <p className="text-[var(--wikios-text-dim)] py-8 text-center text-sm">
          This category is empty.
        </p>
      )}
    </div>
  );
}
