"use client";
// src/app/admin/wiki/components/WikiLinkStatusSection.tsx
// Wiki Link Status table & filtering overview.

import { FacetCard } from "~/components/ui/facet-container";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Search, Link as Link2, CheckCircle, XmarkCircle as XCircle } from "iconoir-react";
import type { FilterTab } from "./types";

export function WikiLinkStatusSection({
  countriesData,
  isLoading,
}: {
  countriesData: any;
  isLoading: boolean;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const countries = useMemo(() => {
    const list = countriesData?.countries ?? countriesData ?? [];
    if (!Array.isArray(list)) return [];
    return list as Array<{
      id: string;
      name: string;
      wikiPageTitle?: string | null;
      wikiSource?: string | null;
      wikiLastSynced?: string | Date | null;
    }>;
  }, [countriesData]);

  const filtered = useMemo(() => {
    let result = countries;

    if (filter === "linked") {
      result = result.filter((c) => c.wikiPageTitle);
    } else if (filter === "unlinked") {
      result = result.filter((c) => !c.wikiPageTitle);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.wikiPageTitle && c.wikiPageTitle.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, filter, searchQuery]);

  const linkedCount = countries.filter((c) => c.wikiPageTitle).length;
  const unlinkedCount = countries.length - linkedCount;

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: countries.length },
    { key: "linked", label: "Linked", count: linkedCount },
    { key: "unlinked", label: "Unlinked", count: unlinkedCount },
  ];

  return (
    <FacetCard className="space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="text-green h-4 w-4" />
          <h3 className="text-label text-caption">Wiki Link Status</h3>
        </div>
        <SegmentedControl
          size="sm"
          aria-label="Link status filter"
          value={filter}
          onValueChange={setFilter}
          options={TABS.map((tab) => ({
            value: tab.key,
            label: `${tab.label} (${tab.count})`,
          }))}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          placeholder="Search countries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-label-secondary text-footnote py-8 text-center">
          No countries match your filters.
        </div>
      ) : (
        <div className="border-separator rounded-row max-h-[28rem] overflow-x-auto overflow-y-auto border">
          <table className="text-footnote w-full tabular-nums">
            <thead className="bg-fill-4 border-separator text-label-secondary sticky top-0 border-b font-semibold">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Country</th>
                <th className="px-4 py-2.5 text-left font-medium">Wiki Page</th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Source</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Last Synced
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-separator divide-y">
              {filtered.map((country) => (
                <tr key={country.id} className="hover:bg-fill-4 transition-colors">
                  <td className="text-label px-4 py-2.5 font-semibold">{country.name}</td>
                  <td className="text-label-secondary max-w-[12rem] truncate px-4 py-2.5">
                    {country.wikiPageTitle ?? <span className="italic opacity-50">Not linked</span>}
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    {country.wikiSource ? (
                      <Badge variant="outline">{country.wikiSource}</Badge>
                    ) : (
                      <span className="text-label-secondary opacity-50">—</span>
                    )}
                  </td>
                  <td className="text-label-secondary text-footnote hidden px-4 py-2.5 tabular-nums md:table-cell">
                    {country.wikiLastSynced
                      ? new Date(country.wikiLastSynced).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {country.wikiPageTitle ? (
                      <CheckCircle className="text-green ml-auto h-4 w-4" />
                    ) : (
                      <XCircle className="text-red ml-auto h-4 w-4" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-label-secondary text-footnote">
        {linkedCount} of {countries.length} countries linked to wiki pages
      </p>
    </FacetCard>
  );
}
