"use client";
// src/app/admin/wiki/components/BulkScannerSection.tsx
// Bulk heuristic scanner for automated wiki page linking.

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { TRPCClientError } from "@trpc/client";
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
import {
  countryRows,
  isWikiOutage,
  unreachableText,
  type CountriesData,
  type CountryLinkRow,
  type ScanResult,
} from "./types";
import {
  parseWikiSource,
  WIKI_SOURCES,
  wikiReaderPath,
  type WikiSource,
} from "~/lib/wiki-os/config";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

/** The wiki the scanner searches. */
const SCAN_WIKI: WikiSource = "ixwiki";

interface SearchHit {
  title: string;
  source: string;
}

type SearchTitles = (input: { query: string; wiki: WikiSource }) => Promise<readonly SearchHit[]>;

/** One country's search: its best match, none, or an outage of the wiki searched (which says nothing of a match). */
type CountryScan = { kind: "match"; result: ScanResult } | { kind: "none" } | { kind: "outage" };

async function scanCountry(country: CountryLinkRow, search: SearchTitles): Promise<CountryScan> {
  try {
    const first = (await search({ query: country.name, wiki: SCAN_WIKI }))[0];
    if (!first) return { kind: "none" };
    const isExact = first.title.toLowerCase() === country.name.toLowerCase();
    return {
      kind: "match",
      result: {
        countryId: country.id,
        countryName: country.name,
        matchedTitle: first.title,
        source: parseWikiSource(first.source),
        confidence: isExact ? "exact" : "partial",
        selected: isExact,
      },
    };
  } catch (error) {
    return error instanceof TRPCClientError && isWikiOutage(error)
      ? { kind: "outage" }
      : { kind: "none" };
  }
}

/** The scan stopped because the wiki did not answer: `skipped` countries were not searched. */
interface ScanOutage {
  wiki: WikiSource;
  skipped: number;
}

function outageText({ wiki, skipped }: ScanOutage): string {
  const countries = skipped === 1 ? "1 country was" : `${skipped} countries were`;
  return `${unreachableText(wiki)} ${countries} not scanned. Try again.`;
}

export function BulkScannerSection({ countriesData }: { countriesData: CountriesData }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanComplete, setScanComplete] = useState(false);
  const [scanOutage, setScanOutage] = useState<ScanOutage | null>(null);

  const countries = useMemo(() => countryRows(countriesData), [countriesData]);

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
    setScanOutage(null);
    setScanProgress({ current: 0, total: unlinkedCountries.length });

    const results: ScanResult[] = [];
    const search: SearchTitles = (input) => utils.wikios.searchArticles.fetch(input);

    for (let i = 0; i < unlinkedCountries.length; i++) {
      const country = unlinkedCountries[i]!;
      setScanProgress({ current: i + 1, total: unlinkedCountries.length });

      const scan = await scanCountry(country, search);
      if (scan.kind === "outage") {
        // Every later search would meet the same outage: stop, and keep what was found.
        setScanOutage({ wiki: SCAN_WIKI, skipped: unlinkedCountries.length - i });
        break;
      }
      if (scan.kind === "match") results.push(scan.result);
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
            wikiSource: r.source,
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
    <Card className="space-y-4 p-5">
      <div className="border-separator flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="text-yellow h-4 w-4" />
          <h3 className="text-label text-caption">Bulk wiki entity scanner</h3>
        </div>
        <Badge variant="outline" className="w-fit">
          {unlinkedCountries.length} unlinked countries
        </Badge>
      </div>

      <div className="space-y-4">
        <p className="text-label-secondary text-footnote">
          Automatically search wiki sources for unlinked countries and suggest entity cross-links.
        </p>

        <div className="flex items-center gap-2">
          <Button onClick={handleScan} disabled={isScanning || unlinkedCountries.length === 0}>
            {isScanning ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-2 h-3.5 w-3.5" />
            )}
            {isScanning ? "Scanning..." : "Scan unlinked countries"}
          </Button>

          {scanResults.length > 0 && (
            <Button
              variant="outline"
              onClick={handleLinkSelected}
              disabled={selectedCount === 0 || isLinking}
            >
              {isLinking ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-3.5 w-3.5" />
              )}
              {isLinking ? "Linking..." : `Link selected (${selectedCount})`}
            </Button>
          )}
        </div>

        {isScanning && (
          <div className="space-y-2">
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

        {scanOutage && (
          <div
            role="status"
            className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow flex items-center gap-2 border p-3"
          >
            <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
            {outageText(scanOutage)}
          </div>
        )}

        {scanComplete && !scanOutage && scanResults.length === 0 && (
          <div className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow flex items-center gap-2 border p-3">
            <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
            No wiki matches found for unlinked countries.
          </div>
        )}

        {scanResults.length > 0 && (
          <Table containerClassName="max-h-[24rem]">
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-10 px-3 text-center" />
                <TableHead className="px-3">Country</TableHead>
                <TableHead className="px-3">Matched page</TableHead>
                <TableHead className="hidden px-3 sm:table-cell">Source</TableHead>
                <TableHead className="px-3 text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanResults.map((result) => (
                <TableRow
                  key={result.countryId}
                  className={cn(
                    "transition-colors",
                    result.selected ? "bg-tint-fill" : "hover:bg-fill-4"
                  )}
                >
                  <TableCell className="px-3 text-center">
                    <Checkbox
                      aria-label={`Select ${result.countryName}`}
                      checked={result.selected}
                      onCheckedChange={() => toggleResult(result.countryId)}
                    />
                  </TableCell>
                  <TableCell className="text-label px-3 font-semibold">
                    {result.countryName}
                  </TableCell>
                  <TableCell className="text-label-secondary max-w-[10rem] truncate px-3">
                    <Link
                      href={wikiReaderPath(result.matchedTitle, result.source)}
                      className="hover:text-tint hover:underline"
                    >
                      {result.matchedTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden px-3 sm:table-cell">
                    <Badge variant="outline">{WIKI_SOURCES[result.source].name}</Badge>
                  </TableCell>
                  <TableCell className="px-3 text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
