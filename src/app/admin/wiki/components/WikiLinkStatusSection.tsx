// src/app/admin/wiki/components/WikiLinkStatusSection.tsx
// Wiki Link Status table & filtering overview.

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Search, Link as Link2, CheckCircle, XmarkCircle as XCircle } from "iconoir-react";
import { cn } from "~/lib/utils";
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
    <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-foreground">Wiki Link Status</h3>
        </div>
        <div className="bg-card/40 border-border/40 flex items-center gap-1 rounded-xl border p-1 backdrop-blur-md">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] transition-all",
                filter === tab.key
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span className="ml-1 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          placeholder="Search countries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs backdrop-blur-md focus:border-border/60"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-xs">
          No countries match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card/25 backdrop-blur-md shadow-xs max-h-[28rem] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/20 sticky top-0 backdrop-blur-md border-b border-border/30 text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Country</th>
                <th className="px-4 py-2.5 text-left font-medium">Wiki Page</th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Source</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Last Synced</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/15">
              {filtered.map((country) => (
                <tr key={country.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="text-foreground px-4 py-2.5 font-semibold">{country.name}</td>
                  <td className="text-muted-foreground max-w-[12rem] truncate px-4 py-2.5">
                    {country.wikiPageTitle ?? (
                      <span className="italic opacity-50">Not linked</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    {country.wikiSource ? (
                      <Badge variant="outline" className="text-[10px]">
                        {country.wikiSource}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground opacity-50">—</span>
                    )}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 font-mono text-[11px] md:table-cell">
                    {country.wikiLastSynced
                      ? new Date(country.wikiLastSynced).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {country.wikiPageTitle ? (
                      <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="ml-auto h-4 w-4 text-red-400" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-[11px]">
        {linkedCount} of {countries.length} countries linked to wiki pages
      </p>
    </div>
  );
}
