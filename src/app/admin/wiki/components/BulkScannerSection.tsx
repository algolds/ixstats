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
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Bulk Scanner
          </CardTitle>
          <Badge variant="outline" className="w-fit text-xs">
            {unlinkedCountries.length} unlinked countries
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Automatically search wiki sources for unlinked countries and suggest matches.
        </p>

        {/* Scan button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleScan}
            disabled={isScanning || unlinkedCountries.length === 0}
            className="gap-2"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isScanning ? "Scanning..." : "Scan Unlinked Countries"}
          </Button>

          {scanResults.length > 0 && (
            <Button
              variant="outline"
              onClick={handleLinkSelected}
              disabled={selectedCount === 0 || isLinking}
              className="gap-2"
            >
              {isLinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {isLinking ? "Linking..." : `Link Selected (${selectedCount})`}
            </Button>
          )}
        </div>

        {/* Progress */}
        {isScanning && (
          <div className="space-y-2">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>
                Scanning {scanProgress.current} of {scanProgress.total}...
              </span>
              <span>
                {Math.round((scanProgress.current / Math.max(scanProgress.total, 1)) * 100)}%
              </span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
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
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            No wiki matches found for unlinked countries.
          </div>
        )}

        {scanResults.length > 0 && (
          <div className="border-border/30 max-h-[24rem] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/80 sticky top-0 backdrop-blur-sm">
                <tr className="border-border/30 border-b">
                  <th className="w-10 px-3 py-2.5" />
                  <th className="text-muted-foreground px-3 py-2.5 text-left font-medium">
                    Country
                  </th>
                  <th className="text-muted-foreground px-3 py-2.5 text-left font-medium">
                    Matched Page
                  </th>
                  <th className="text-muted-foreground hidden px-3 py-2.5 text-left font-medium sm:table-cell">
                    Source
                  </th>
                  <th className="text-muted-foreground px-3 py-2.5 text-right font-medium">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border/20 divide-y">
                {scanResults.map((result) => (
                  <tr
                    key={result.countryId}
                    className={cn(
                      "transition-colors",
                      result.selected ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={result.selected}
                        onChange={() => toggleResult(result.countryId)}
                        className="border-border accent-primary h-4 w-4 rounded"
                      />
                    </td>
                    <td className="text-foreground px-3 py-2.5 font-medium">
                      {result.countryName}
                    </td>
                    <td className="text-muted-foreground max-w-[10rem] truncate px-3 py-2.5">
                      {result.matchedTitle}
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {result.source}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          result.confidence === "exact"
                            ? "border-emerald-500/30 text-emerald-500"
                            : "border-amber-500/30 text-amber-500"
                        )}
                      >
                        {result.confidence === "exact" ? "Exact" : "Partial"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
