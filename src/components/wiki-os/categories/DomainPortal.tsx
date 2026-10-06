"use client";

import { useMemo } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Page as FileText, Folder } from "iconoir-react";
import {
  CategoryMasthead,
  CategoryPageCard,
  SubcategorySection,
  type CategoryMember,
} from "./CategoryParts";

interface DomainPortalProps {
  domain: string;
  domainMeta: { color: string; metric: string; description: string };
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

export function DomainPortal({ domain, domainMeta, subcategories, pages }: DomainPortalProps) {
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
      <CategoryMasthead
        title={domain}
        description={domainMeta.description}
        articleCount={pages.length}
        subcategoryCount={subcategories.length}
        articleAccentColor={domainMeta.color}
      />

      <SubcategorySection subcategories={subcategories} />

      {pages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <FileText aria-hidden="true" className="text-green h-4 w-4" />
            <h2 className="text-label text-headline text-eyebrow">
              Articles in {domain} ({pages.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pages.map((m) => {
              const countryMatch = countries.find(
                (c: any) =>
                  c.name &&
                  c.name.trim().length >= 3 &&
                  m.title.toLowerCase().includes(c.name.toLowerCase())
              ) as any;
              return (
                <CategoryPageCard
                  key={m.title}
                  title={m.title}
                  imageUrl={m.imageUrl}
                  flagUrl={countryMatch?.flag || countryMatch?.flagUrl}
                />
              );
            })}
          </div>
        </div>
      )}

      {subcategories.length === 0 && pages.length === 0 && (
        <div className="border-separator bg-surface rounded-card flex flex-col items-center justify-center space-y-3 border border-dashed p-12 text-center">
          <Folder className="text-label-secondary h-10 w-10" />
          <h3 className="text-label text-title-3">No articles or subcategories found</h3>
          <p className="text-label-secondary text-footnote max-w-sm">
            This domain is currently empty or indexing. Browse all indexed categories from the main
            directory.
          </p>
          <Link
            href={withBasePath("/util/categories")}
            className="bg-tint text-on-tint hover:bg-tint/90 rounded-row text-caption mt-2 inline-flex items-center gap-2 px-4 py-2 font-semibold transition-colors"
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Browse category directory</span>
          </Link>
        </div>
      )}
    </div>
  );
}
