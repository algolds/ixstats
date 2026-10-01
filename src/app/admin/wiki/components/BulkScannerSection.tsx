"use client";
// src/app/admin/wiki/components/BulkScannerSection.tsx
// Bulk heuristic scanner for automated wiki page linking.

import { useState, useMemo, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Refresh as RefreshCw,
  Search,
  Link as Link2,
  SystemRestart as Loader2,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { ScanResult } from "./types";
import { FacetCard } from "~/components/ui/facet-container";

export function BulkScannerSection({ countriesData }: { countriesData: any }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanComplete, setScanComplete] = useState(false);

  const countries = useMemo(() => {
    const list = countriesData?.countries ?? countriesData ?? [];
    if (!Array.isArray(list)) return [];
    return list as Array<{
      id: string;
      name: string;
      wikiPageTitle?: string | null;
    }>;
  }, [countriesData]);

  const unlinkedCountries = useMemo(() => countries.filter((c) => !c.wikiPageTitle), [countries]);

  const utils = api.useUtils();
  const notify = useNotify();
  const bulkSetWikiLinksMutation = api.admin.bulkSetWikiLinks.useMutation({
    onSuccess: () => {
      notify.success("Linked", "Bulk links applied");
      utils.countries.getAll.invalidate();
      setScanResults([]);
      setScanComplete(false);
    },
    onError: () => notify.error("Error", "Failed to apply bulk links"),
  });
  const [isLinking, setIsLinking] = useState(false);

  const handleScan = useCallback(async () => {
    if (unlinkedCountries.length === 0) return;
    setIsScanning(true);
    setScanResults([]);
    setScanComplete(false);
    setScanProgress({ current: 0, total: unlinkedCountries.length });

    const results: ScanResult[] = [];

    for (let i = 0; i < unlinkedCountries.length; i++) {
      const country = unlinkedCountries[i]!;
      setScanProgress({ current: i + 1, total: unlinkedCountries.length });

      try {
        const searchResult = await utils.wikios.searchArticles.fetch({
          query: country.name,
        });

        if (searchResult && Array.isArray(searchResult) && searchResult.length > 0) {
          const first = searchResult[0]!;
          const title = first.title ?? country.name;
          const source = first.source ?? "ixwiki";
          const isExact = title.toLowerCase() === country.name.toLowerCase();

          results.push({
            countryId: country.id,
            countryName: country.name,
            matchedTitle: title,
            source,
            confidence: isExact ? "exact" : "partial",
            selected: isExact,
          });
        }
      } catch {
        // Skip countries with no matches
      }
    }

    setScanResults(results);
    setIsScanning(false);
    setScanComplete(true);
  }, [unlinkedCountries, utils]);

  const toggleResult = useCallback((countryId: string) => {
    setScanResults((prev) =>
      prev.map((r) => (r.countryId === countryId ? { ...r, selected: !r.selected } : r))
    );
  }, []);

  const handleLinkSelected = useCallback(async () => {
    const selected = scanResults.filter((r) => r.selected);
    if (selected.length === 0) return;

    const chunks: (typeof selected)[] = [];
    for (let i = 0; i < selected.length; i += 100) {
      chunks.push(selected.slice(i, i + 100));
    }

    setIsLinking(true);
    try {
      for (const chunk of chunks) {
        await bulkSetWikiLinksMutation.mutateAsync({
          links: chunk.map((r) => ({
            countryId: r.countryId,
            wikiPageTitle: r.matchedTitle,
            wikiSource: r.source as "ixwiki" | "iiwiki",
          })),
        });
      }
      notify.success("Linked", "Bulk links applied");
      utils.countries.getAll.invalidate();
      setScanResults([]);
      setScanComplete(false);
    } catch {
      notify.error("Error", "Failed to apply bulk links");
    } finally {
      setIsLinking(false);
    }
  }, [scanResults, bulkSetWikiLinksMutation, utils, notify]);

  const selectedCount = scanResults.filter((r) => r.selected).length;

  return (
    <FacetCard className="space-y-4 p-5">
      <div className="border-separator flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="text-yellow h-4 w-4" />
          <h3 className="text-label text-caption">Bulk Wiki Entity Scanner</h3>
        </div>
        <Badge variant="outline" className="w-fit">
          {unlinkedCountries.length} unlinked countries
        </Badge>
      </div>

      <div className="space-y-4">
        <p className="text-label-secondary text-footnote">
          Automatically search wiki sources for unlinked countries and suggest entity cross-links.
        </p>

        {/* Scan button */}
        <div className="flex items-center gap-2">
          <Button onClick={handleScan} disabled={isScanning || unlinkedCountries.length === 0}>
            {isScanning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isScanning ? "Scanning..." : "Scan Unlinked Countries"}
          </Button>

          {scanResults.length > 0 && (
            <Button
              variant="outline"
              onClick={handleLinkSelected}
              disabled={selectedCount === 0 || isLinking}
            >
              {isLinking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isLinking ? "Linking..." : `Link Selected (${selectedCount})`}
            </Button>
          )}
        </div>

        {/* Progress */}
        {isScanning && (
          <div className="space-y-1.5">
            <div className="text-label-secondary text-footnote flex items-center justify-between">
              <span>
                Scanning {scanProgress.current} of {scanProgress.total}...
              </span>
              <span>
                {Math.round((scanProgress.current / Math.max(scanProgress.total, 1)) * 100)}%
              </span>
            </div>
            <div className="bg-fill-3 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-yellow duration-fast h-full rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                style={{
                  width: `${(scanProgress.current / Math.max(scanProgress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {scanComplete && scanResults.length === 0 && (
          <div className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow flex items-center gap-2 border p-3">
            <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
            No wiki matches found for unlinked countries.
          </div>
        )}

        {scanResults.length > 0 && (
          <div className="border-separator rounded-row max-h-[24rem] overflow-x-auto overflow-y-auto border">
            <table className="text-footnote w-full tabular-nums">
              <thead className="bg-fill-4 border-separator text-label-secondary sticky top-0 border-b font-semibold">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center" />
                  <th className="px-3 py-2.5 text-left font-medium">Country</th>
                  <th className="px-3 py-2.5 text-left font-medium">Matched Page</th>
                  <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">Source</th>
                  <th className="px-3 py-2.5 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-separator divide-y">
                {scanResults.map((result) => (
                  <tr
                    key={result.countryId}
                    className={cn(
                      "transition-colors",
                      result.selected ? "bg-tint-fill" : "hover:bg-fill-4"
                    )}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <Checkbox
                        aria-label={`Select ${result.countryName}`}
                        checked={result.selected}
                        onCheckedChange={() => toggleResult(result.countryId)}
                      />
                    </td>
                    <td className="text-label px-3 py-2.5 font-semibold">{result.countryName}</td>
                    <td className="text-label-secondary max-w-[10rem] truncate px-3 py-2.5 tabular-nums">
                      {result.matchedTitle}
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <Badge variant="outline">{result.source}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "rounded-control-sm text-caption inline-block border px-2 py-0.5",
                          result.confidence === "exact"
                            ? "border-green/30 bg-green/10 text-green"
                            : "border-yellow/30 bg-yellow/10 text-yellow"
                        )}
                      >
                        {result.confidence === "exact" ? "Exact" : "Partial"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FacetCard>
  );
}
