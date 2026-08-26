// src/app/(wiki-os)/wiki/categories/[...slug]/page.tsx
// WikiOS Category Portal — auto-detects country/domain/standard categories
// and renders enriched views with IxStats data integration.
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { CountryPortal } from "~/components/wiki-os/categories/CountryPortal";
import { DomainPortal } from "~/components/wiki-os/categories/DomainPortal";
import { EnhancedCategoryBrowser } from "~/components/wiki-os/categories/EnhancedCategoryBrowser";

// Domain categories that map to IxStats data domains
const DOMAIN_MAP: Record<string, { color: string; metric: string; description: string }> = {
  Economy: {
    color: "#22c55e",
    metric: "gdpPerCapita",
    description: "Economic systems, trade, and industry across nations",
  },
  Government: {
    color: "#6366f1",
    metric: "governmentType",
    description: "Political systems, governance, and public administration",
  },
  Military: {
    color: "#ef4444",
    metric: "populationTier",
    description: "Armed forces, defense, and military history",
  },
  People: {
    color: "#ec4899",
    metric: "population",
    description: "Demographics, ethnicity, language, and society",
  },
  Politics: {
    color: "#8b5cf6",
    metric: "politicalStability",
    description: "Elections, parties, political movements, and legislation",
  },
  History: {
    color: "#eab308",
    metric: "economicTier",
    description: "Historical events, eras, and civilizations",
  },
  Geography: {
    color: "#14b8a6",
    metric: "landArea",
    description: "Physical geography, regions, and natural features",
  },
  Culture: {
    color: "#a855f7",
    metric: "economicTier",
    description: "Art, music, cuisine, traditions, and cultural heritage",
  },
  Technology: {
    color: "#06b6d4",
    metric: "economicTier",
    description: "Innovation, science, and technological development",
  },
  Companies: {
    color: "#f97316",
    metric: "economicTier",
    description: "Businesses, corporations, and commercial enterprises",
  },
  Nature: {
    color: "#10b981",
    metric: "landArea",
    description: "Flora, fauna, ecosystems, and the natural world",
  },
  Miscellaneous: {
    color: "#64748b",
    metric: "articles",
    description: "General topics, uncategorized articles, cross-disciplinary subjects, and reference indexes",
  },
};

export default function CategoryPage({
  params: pageParams,
}: {
  params?: Promise<{ slug?: string[] }> | { slug?: string[] };
}) {
  const routerParams = useParams<{ slug?: string[] }>();
  
  // Resolve slug from page props or useParams
  const resolvedSlug = useMemo(() => {
    if (routerParams?.slug) {
      return Array.isArray(routerParams.slug) ? routerParams.slug.join("/") : routerParams.slug;
    }
    if (pageParams && typeof (pageParams as any).then !== "function") {
      const p = pageParams as { slug?: string[] };
      return p?.slug ? (Array.isArray(p.slug) ? p.slug.join("/") : p.slug) : "";
    }
    return "";
  }, [routerParams, pageParams]);

  const category = useMemo(() => {
    return decodeURIComponent(resolvedSlug || "").replace(/_/g, " ").trim();
  }, [resolvedSlug]);

  // Fetch subcategories
  const { data: subcatData, isLoading: isLoadingSubcats } = api.wikios.getCategoryMembers.useQuery(
    { category, limit: 500, type: "subcat" },
    { enabled: category.length > 0, staleTime: 60_000 }
  );

  // Fetch pages
  const { data: pageData, isLoading: isLoadingPages } = api.wikios.getCategoryMembers.useQuery(
    { category, limit: 500, type: "page" },
    { enabled: category.length > 0, staleTime: 60_000 }
  );

  const isLoading = (isLoadingSubcats || isLoadingPages) && category.length > 0;

  // Country detection (same pattern as InfoboxWithMap)
  const { data: countryResults } = api.countries.getSelectList.useQuery(
    { search: category, limit: 5 },
    { enabled: category.length > 0, staleTime: 10 * 60 * 1000 }
  );

  const matchedCountry = useMemo(() => {
    if (!countryResults || countryResults.length === 0) return null;
    return countryResults.find((c) => c.name?.toLowerCase() === category.toLowerCase()) ?? null;
  }, [countryResults, category]);

  const subcategories = useMemo(() => {
    return (subcatData?.members ?? []).map((m) => ({
      title: m.title,
      ns: ("ns" in m ? (m as { ns: number }).ns : 14) as number,
    }));
  }, [subcatData]);

  const pages = useMemo(() => {
    return (pageData?.members ?? []).map((m) => ({
      title: m.title,
      ns: ("ns" in m ? (m as { ns: number }).ns : 0) as number,
      imageUrl: ("imageUrl" in m ? (m as { imageUrl?: string | null }).imageUrl : null) ?? null,
    }));
  }, [pageData]);

  const domainKey = Object.keys(DOMAIN_MAP).find(
    (k) => k.toLowerCase() === category.toLowerCase()
  );
  const domainMeta = domainKey ? DOMAIN_MAP[domainKey] : null;
  const canonicalDomainName = domainKey ?? category;

  return (
    <WikiOSLayout hideTitleHeading>
      {isLoading ? (
        <div className="w-full space-y-6 max-w-6xl mx-auto animate-pulse select-none">
          <div className="h-40 rounded-3xl bg-muted/40 border border-border/40" />
          <div className="space-y-3">
            <div className="h-5 w-32 bg-muted/50 rounded-lg" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-8 w-28 bg-muted/40 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <div className="h-5 w-40 bg-muted/50 rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      ) : matchedCountry ? (
        <CountryPortal country={matchedCountry} subcategories={subcategories} pages={pages} />
      ) : domainMeta ? (
        <DomainPortal
          domain={canonicalDomainName}
          domainMeta={domainMeta}
          subcategories={subcategories}
          pages={pages}
        />
      ) : (
        <EnhancedCategoryBrowser category={category} subcategories={subcategories} pages={pages} />
      )}
    </WikiOSLayout>
  );
}
