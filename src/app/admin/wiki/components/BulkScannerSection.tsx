// src/app/admin/wiki/components/BulkScannerSection.tsx
// Bulk heuristic scanner for automated wiki page linking.

"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Refresh as RefreshCw, Search, Link as Link2, SystemRestart as Loader2, WarningTriangle as AlertTriangle } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { ScanResult } from "./types";

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
    } catch (err) {
      notify.error("Error", "Failed to apply bulk links");
    } finally {
      setIsLinking(false);
    }
  }, [scanResults, bulkSetWikiLinksMutation, utils, notify]);

  const selectedCount = scanResults.filter((r) => r.selected).length;

  return (
    <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-bold text-foreground">Bulk Wiki Entity Scanner</h3>
        </div>
        <Badge variant="outline" className="w-fit text-[10px]">
          {unlinkedCountries.length} unlinked countries
        </Badge>
      </div>

      <div className="space-y-4">
        <p className="text-muted-foreground text-[11px]">
          Automatically search wiki sources for unlinked countries and suggest entity cross-links.
        </p>

        {/* Scan button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleScan}
            disabled={isScanning || unlinkedCountries.length === 0}
            className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
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
              className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
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
            <div className="text-muted-foreground flex items-center justify-between text-[11px]">
              <span>
                Scanning {scanProgress.current} of {scanProgress.total}...
              </span>
              <span>
                {Math.round((scanProgress.current / Math.max(scanProgress.total, 1)) * 100)}%
              </span>
            </div>
            <div className="bg-muted/40 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{
                  width: `${(scanProgress.current / Math.max(scanProgress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {scanComplete && scanResults.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            No wiki matches found for unlinked countries.
          </div>
        )}

        {scanResults.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card/25 backdrop-blur-md shadow-xs max-h-[24rem] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20 sticky top-0 backdrop-blur-md border-b border-border/30 text-muted-foreground font-semibold">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center" />
                  <th className="px-3 py-2.5 text-left font-medium">Country</th>
                  <th className="px-3 py-2.5 text-left font-medium">Matched Page</th>
                  <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">Source</th>
                  <th className="px-3 py-2.5 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/15">
                {scanResults.map((result) => (
                  <tr
                    key={result.countryId}
                    className={cn(
                      "transition-colors",
                      result.selected ? "bg-primary/5" : "hover:bg-foreground/[0.02]"
                    )}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={result.selected}
                        onChange={() => toggleResult(result.countryId)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="text-foreground px-3 py-2.5 font-semibold">
                      {result.countryName}
                    </td>
                    <td className="text-muted-foreground max-w-[10rem] truncate px-3 py-2.5 font-mono">
                      {result.matchedTitle}
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <Badge variant="outline" className="text-[10px]">
                        {result.source}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                          result.confidence === "exact"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
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
    </div>
  );
}
