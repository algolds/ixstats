// src/app/(wikios)/w/special/categories/[...slug]/page.tsx
// WikiOS Category Portal — auto-detects country/domain/standard categories
// and renders enriched views with IxStats data integration.
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { CountryPortal } from "~/components/wikios/categories/CountryPortal";
import { DomainPortal } from "~/components/wikios/categories/DomainPortal";
import { EnhancedCategoryBrowser } from "~/components/wikios/categories/EnhancedCategoryBrowser";

// Domain categories that map to IxStats data domains
const DOMAIN_MAP: Record<string, { color: string; metric: string; description: string }> = {
  Economy: { color: "#22c55e", metric: "gdpPerCapita", description: "Economic systems, trade, and industry across nations" },
  Government: { color: "#6366f1", metric: "governmentType", description: "Political systems, governance, and public administration" },
  Military: { color: "#ef4444", metric: "populationTier", description: "Armed forces, defense, and military history" },
  People: { color: "#ec4899", metric: "population", description: "Demographics, ethnicity, language, and society" },
  Politics: { color: "#8b5cf6", metric: "politicalStability", description: "Elections, parties, political movements, and legislation" },
  History: { color: "#eab308", metric: "economicTier", description: "Historical events, eras, and civilizations" },
  Geography: { color: "#14b8a6", metric: "landArea", description: "Physical geography, regions, and natural features" },
  Culture: { color: "#a855f7", metric: "economicTier", description: "Art, music, cuisine, traditions, and cultural heritage" },
  Technology: { color: "#06b6d4", metric: "economicTier", description: "Innovation, science, and technological development" },
  Companies: { color: "#f97316", metric: "economicTier", description: "Businesses, corporations, and commercial enterprises" },
  Nature: { color: "#10b981", metric: "landArea", description: "Flora, fauna, ecosystems, and the natural world" },
};

export default function CategoryPage() {
  const params = useParams<{ slug: string[] }>();
  const category = params.slug.join("/").replace(/_/g, " ");

  // Fetch subcategories
  const { data: subcatData } = api.wikios.getCategoryMembers.useQuery(
    { category, limit: 100, type: "subcat" },
    { staleTime: 60_000 }
  );

  // Fetch pages
  const { data: pageData, isLoading } = api.wikios.getCategoryMembers.useQuery(
    { category, limit: 100, type: "page" },
    { staleTime: 60_000 }
  );

  // Country detection (same pattern as InfoboxWithMap)
  const { data: countryResults } = api.countries.getSelectList.useQuery(
    { search: category, limit: 5 },
    { staleTime: 10 * 60 * 1000 }
  );

  const matchedCountry = useMemo(() => {
    if (!countryResults || countryResults.length === 0) return null;
    return countryResults.find(
      (c) => c.name?.toLowerCase() === category.toLowerCase()
    ) ?? null;
  }, [countryResults, category]);

  const subcategories = subcatData?.members ?? [];
  const pages = pageData?.members ?? [];
  const domainMeta = DOMAIN_MAP[category] ?? null;

  return (
    <WikiOSLayout title={matchedCountry ? undefined : `Category:${category}`}>
      {isLoading ? (
        <div className="wikios-loading" style={{ minHeight: 200 }}>
          <div className="wikios-loading-spinner" />
        </div>
      ) : matchedCountry ? (
        <CountryPortal
          country={matchedCountry}
          subcategories={subcategories}
          pages={pages}
        />
      ) : domainMeta ? (
        <DomainPortal
          domain={category}
          domainMeta={domainMeta}
          subcategories={subcategories}
          pages={pages}
        />
      ) : (
        <EnhancedCategoryBrowser
          category={category}
          subcategories={subcategories}
          pages={pages}
        />
      )}
    </WikiOSLayout>
  );
}
