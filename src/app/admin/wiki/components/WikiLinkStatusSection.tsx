// src/app/admin/wiki/components/WikiLinkStatusSection.tsx
// Wiki Link Status table & filtering overview.

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Search, Link2, CheckCircle, XCircle } from "lucide-react";
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
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-emerald-500" />
            Wiki Link Status
          </CardTitle>
          <div className="flex items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {tab.label}
                <span className="ml-1 opacity-60">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No countries match your filters.
          </div>
        ) : (
          <div className="border-border/30 max-h-[28rem] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/80 sticky top-0 backdrop-blur-sm">
                <tr className="border-border/30 border-b">
                  <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                    Country
                  </th>
                  <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                    Wiki Page
                  </th>
                  <th className="text-muted-foreground hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                    Source
                  </th>
                  <th className="text-muted-foreground hidden px-4 py-2.5 text-left font-medium md:table-cell">
                    Last Synced
                  </th>
                  <th className="text-muted-foreground px-4 py-2.5 text-right font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border/20 divide-y">
                {filtered.map((country) => (
                  <tr key={country.id} className="hover:bg-muted/30 transition-colors">
                    <td className="text-foreground px-4 py-2.5 font-medium">{country.name}</td>
                    <td className="text-muted-foreground max-w-[12rem] truncate px-4 py-2.5">
                      {country.wikiPageTitle ?? (
                        <span className="italic opacity-50">Not linked</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      {country.wikiSource ? (
                        <Badge variant="outline" className="text-xs">
                          {country.wikiSource}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground opacity-50">—</span>
                      )}
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-2.5 text-xs md:table-cell">
                      {country.wikiLastSynced
                        ? new Date(country.wikiLastSynced).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {country.wikiPageTitle ? (
                        <CheckCircle className="ml-auto h-4 w-4 text-emerald-500" />
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

        <p className="text-muted-foreground text-xs">
          {linkedCount} of {countries.length} countries linked to wiki pages
        </p>
      </CardContent>
    </Card>
  );
}
