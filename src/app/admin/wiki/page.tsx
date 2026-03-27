// src/app/admin/wiki/page.tsx
// Admin wiki management — link status, manual editor, bulk scanner
"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  Search,
  Link2,
  RefreshCw,
  CheckCircle,
  Globe,
  Loader2,
  BookOpen,
  XCircle,
  ExternalLink,
  Save,
  AlertTriangle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "linked" | "unlinked";

interface ScanResult {
  countryId: string;
  countryName: string;
  matchedTitle: string;
  source: string;
  confidence: "exact" | "partial";
  selected: boolean;
}

// ── Wiki Link Status Section ──────────────────────────────────────────────────

function WikiLinkStatusSection() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: countriesData, isLoading } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          <div className="py-8 text-center text-sm text-muted-foreground">
            No countries match your filters.
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-border/30">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Country</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Wiki Page</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground sm:table-cell">Source</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Last Synced</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.map((country) => (
                  <tr key={country.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{country.name}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-muted-foreground">
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
                    <td className="hidden px-4 py-2.5 text-xs text-muted-foreground md:table-cell">
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

        <p className="text-xs text-muted-foreground">
          {linkedCount} of {countries.length} countries linked to wiki pages
        </p>
      </CardContent>
    </Card>
  );
}

// ── Manual Link Editor Section ────────────────────────────────────────────────

function ManualLinkEditorSection() {
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const [testResult, setTestResult] = useState<{ success: boolean; intro?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

  const countries = useMemo(() => {
    const list = countriesData?.countries ?? countriesData ?? [];
    if (!Array.isArray(list)) return [];
    return list as Array<{ id: string; name: string }>;
  }, [countriesData]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries.slice(0, 20);
    const q = countrySearch.toLowerCase();
    return countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20);
  }, [countries, countrySearch]);

  const selectedCountry = countries.find((c) => c.id === selectedCountryId);

  const wikiIntroQuery = api.wiki.getIntro.useQuery(
    { title: wikiPageTitle, source: wikiSource },
    { enabled: false }
  );

  const handleTestLink = useCallback(async () => {
    if (!wikiPageTitle.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await wikiIntroQuery.refetch();
      if (result.data) {
        setTestResult({ success: true, intro: typeof result.data === "string" ? result.data : (result.data as any)?.intro ?? "Article found" });
      } else {
        setTestResult({ success: false });
      }
    } catch {
      setTestResult({ success: false });
    } finally {
      setIsTesting(false);
    }
  }, [wikiPageTitle, wikiIntroQuery]);

  const handleSave = useCallback(() => {
    if (!selectedCountryId || !wikiPageTitle.trim()) return;
    // TODO: Wire to api.admin.setWikiLink when endpoint is created
    // mutation.mutate({ countryId: selectedCountryId, wikiPageTitle, wikiSource });
    console.log("Save wiki link:", { countryId: selectedCountryId, wikiPageTitle, wikiSource });
  }, [selectedCountryId, wikiPageTitle, wikiSource]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-blue-500" />
          Manual Link Editor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Country</label>
          <div className="relative">
            <Input
              placeholder="Search for a country..."
              value={selectedCountry ? selectedCountry.name : countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setSelectedCountryId(null);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {showDropdown && filteredCountries.length > 0 && !selectedCountryId && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border/50 bg-popover shadow-lg">
                {filteredCountries.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedCountryId(c.id);
                      setCountrySearch(c.name);
                      setShowDropdown(false);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wiki Page Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Wiki Page Title</label>
          <Input
            placeholder="e.g., Urcea, Burgundie, Caphiria..."
            value={wikiPageTitle}
            onChange={(e) => {
              setWikiPageTitle(e.target.value);
              setTestResult(null);
            }}
          />
        </div>

        {/* Wiki Source */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Wiki Source</label>
          <div className="flex gap-2">
            {(["ixwiki", "iiwiki"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => {
                  setWikiSource(source);
                  setTestResult(null);
                }}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm font-medium transition-all",
                  wikiSource === source
                    ? "border-blue-500/50 bg-blue-500/10 text-foreground"
                    : "border-border/50 text-muted-foreground hover:bg-muted/30"
                )}
              >
                {source === "ixwiki" ? "IxWiki" : "IIWiki"}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleTestLink}
            disabled={!wikiPageTitle.trim() || isTesting}
            className="gap-2"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Test Link
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedCountryId || !wikiPageTitle.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Link
          </Button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              testResult.success
                ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                : "border-red-500/30 bg-red-500/5 text-red-400"
            )}
          >
            {testResult.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-emerald-500">
                  <CheckCircle className="h-4 w-4" />
                  Article found
                </div>
                {testResult.intro && (
                  <p className="line-clamp-4 text-xs text-muted-foreground">
                    {testResult.intro}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Article not found. Check the title and source.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Bulk Scanner Section ──────────────────────────────────────────────────────

function BulkScannerSection() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanComplete, setScanComplete] = useState(false);

  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

  const countries = useMemo(() => {
    const list = countriesData?.countries ?? countriesData ?? [];
    if (!Array.isArray(list)) return [];
    return list as Array<{
      id: string;
      name: string;
      wikiPageTitle?: string | null;
    }>;
  }, [countriesData]);

  const unlinkedCountries = useMemo(
    () => countries.filter((c) => !c.wikiPageTitle),
    [countries]
  );

  const utils = api.useUtils();

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
        const searchResult = await utils.wiki.searchWithFallback.fetch({
          query: country.name,
        });

        if (searchResult && typeof searchResult === "object") {
          const sr = searchResult as any;
          const title = sr.title ?? sr.matchedTitle ?? country.name;
          const source = sr.source ?? "ixwiki";
          const isExact = (title as string).toLowerCase() === country.name.toLowerCase();

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

  const handleLinkSelected = useCallback(() => {
    const selected = scanResults.filter((r) => r.selected);
    // TODO: Wire to api.admin.bulkSetWikiLinks when endpoint is created
    // mutation.mutate({ links: selected.map(r => ({ countryId: r.countryId, wikiPageTitle: r.matchedTitle, wikiSource: r.source })) });
    console.log(
      "Bulk link:",
      selected.map((r) => ({
        countryId: r.countryId,
        title: r.matchedTitle,
        source: r.source,
      }))
    );
  }, [scanResults]);

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
        <p className="text-sm text-muted-foreground">
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
              disabled={selectedCount === 0}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              Link Selected ({selectedCount})
            </Button>
          )}
        </div>

        {/* Progress */}
        {isScanning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Scanning {scanProgress.current} of {scanProgress.total}...
              </span>
              <span>
                {Math.round((scanProgress.current / Math.max(scanProgress.total, 1)) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            No wiki matches found for unlinked countries.
          </div>
        )}

        {scanResults.length > 0 && (
          <div className="max-h-[24rem] overflow-y-auto rounded-lg border border-border/30">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border/30">
                  <th className="w-10 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Country</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Matched Page</th>
                  <th className="hidden px-3 py-2.5 text-left font-medium text-muted-foreground sm:table-cell">Source</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
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
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{result.countryName}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 text-muted-foreground">
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminWikiPage() {
  usePageTitle({ title: "Admin - Wiki Management" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={BookOpen}
        title="Wiki Management"
        description="Manage wiki page links, scan for matches, and configure lore integration"
      />

      <WikiLinkStatusSection />
      <ManualLinkEditorSection />
      <BulkScannerSection />
    </div>
  );
}
