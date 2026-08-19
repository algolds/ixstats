// src/app/admin/wiki/page.tsx
// Admin wiki management — links, lorewards, custom awards, system tuning
"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
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
  // eslint-disable-next-line unused-imports/no-unused-imports
  Play,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Square,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Terminal,
  Sliders,
  Database,
  Trash2,
  Award,
  Users,
  Check,
  Sparkles,
  Award as AwardIcon,
  SlidersHorizontal,
  Trophy,
  Star,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronUp,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronDown,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Ban,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Info,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Zap,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Calendar,
  Medal,
  Shield,
  Crown,
  History,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronsUpDown,
} from "lucide-react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  Command,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CommandInput,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CommandList,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CommandEmpty,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CommandItem,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CommandGroup,
} from "~/components/ui/command";

const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case "trophy":
      return Trophy;
    case "medal":
      return Medal;
    case "star":
      return Star;
    case "crown":
      return Crown;
    case "shield":
      return Shield;
    case "award":
      return Award;
    case "users":
      return Users;
    case "check":
      return Check;
    case "sparkles":
    default:
      return Sparkles;
  }
};

const getColorClass = (colorName?: string) => {
  switch (colorName) {
    case "amber":
      return "text-amber-500";
    case "slate":
      return "text-slate-400";
    case "cyan":
      return "text-cyan-500";
    case "green":
      return "text-emerald-500";
    case "purple":
      return "text-purple-500";
    case "pink":
      return "text-pink-500";
    case "red":
      return "text-red-500";
    default:
      return "text-amber-500";
  }
};

const getColorHex = (colorName: string) => {
  switch (colorName) {
    case "amber":
      return "#f59e0b";
    case "slate":
      return "#94a3b8";
    case "cyan":
      return "#06b6d4";
    case "green":
      return "#10b981";
    case "purple":
      return "#a855f7";
    case "pink":
      return "#ec4899";
    case "red":
      return "#ef4444";
    default:
      return "#f59e0b";
  }
};

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

// ── Manual Link Editor Section ────────────────────────────────────────────────

export function ManualLinkEditorSection({ countriesData }: { countriesData: any }) {
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const [testResult, setTestResult] = useState<{ success: boolean; intro?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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

  const wikiIntroQuery = api.wikios.getIntro.useQuery(
    { title: wikiPageTitle, wiki: wikiSource },
    { enabled: false }
  );
  const notify = useNotify();
  const utils = api.useUtils();
  const setWikiLinkMutation = api.admin.setWikiLink.useMutation({
    onSuccess: () => {
      notify.success("Saved", "Wiki link saved");
      utils.countries.getAll.invalidate();
    },
    onError: () => notify.error("Error", "Failed to save wiki link"),
  });

  const handleTestLink = useCallback(async () => {
    if (!wikiPageTitle.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = (await wikiIntroQuery.refetch()) as any;
      if (result.data) {
        setTestResult({
          success: true,
          intro:
            typeof result.data === "string" ? result.data : (result.data.text ?? "Article found"),
        });
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
    setWikiLinkMutation.mutate({ countryId: selectedCountryId, wikiPageTitle, wikiSource });
  }, [selectedCountryId, wikiPageTitle, wikiSource, setWikiLinkMutation]);

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
          <label className="text-foreground text-sm font-medium">Country</label>
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
              <div className="border-border/50 bg-popover absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg">
                {filteredCountries.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="text-foreground hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors"
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
          <label className="text-foreground text-sm font-medium">Wiki Page Title</label>
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
          <label className="text-foreground text-sm font-medium">Wiki Source</label>
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
                    ? "text-foreground border-blue-500/50 bg-blue-500/10"
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
                ? "text-foreground border-emerald-500/30 bg-emerald-500/5"
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
                  <p className="text-muted-foreground line-clamp-4 text-xs">{testResult.intro}</p>
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

// ── Awards Manager Section ───────────────────────────────────────────────────

export function AwardsManagerSection() {
  const notify = useNotify();

  // Creation form states
  const [pageTitle, setPageTitle] = useState("");
  const [category, setCategory] = useState("FEATURED");
  const [name, setName] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [description, setDescription] = useState("");

  const [awardSearch, setAwardSearch] = useState("");
  const [awardCategory, setAwardCategory] = useState<string>("all");
  const [milestonePages, setMilestonePages] = useState("");

  // Medal Icon Builder States
  const [iconShape, setIconShape] = useState("trophy");
  const [iconColor, setIconColor] = useState("amber");
  const [customHex, setCustomHex] = useState("#ffd700");

  const {
    data: awards,
    refetch: refetchAwards,
    isLoading: isLoadingAwards,
  } = api.admin.getWikiArticleAwards.useQuery({
    category: awardCategory === "all" ? undefined : awardCategory,
    search: awardSearch || undefined,
  });

  // Fetch recent daily/weekly/monthly winners
  const {
    data: recentWinners,
    isLoading: isLoadingWinners,
    refetch: refetchRecentWinners,
  } = api.lorewards.getRecentWinners.useQuery({
    limit: 10,
  });

  const createAwardMutation = api.admin.createWikiArticleAwardBatch.useMutation({
    onSuccess: () => {
      notify.success("Awards Issued", "Wiki award(s) added successfully");
      refetchAwards();
      setPageTitle("");
      setName("");
      setRecipientText("");
      setDescription("");
      setIconShape("trophy");
      setIconColor("amber");
      setCustomHex("#ffd700");
    },
    onError: (err) => notify.error("Creation Error", err.message),
  });

  const evaluateMilestonesMutation = api.admin.evaluateWikiMilestones.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Scan Complete",
        `Scan complete. Generated ${data.createdCount} new milestone awards.`
      );
      refetchAwards();
      setMilestonePages("");
    },
    onError: (err) => notify.error("Milestone Scan Error", err.message),
  });

  const deleteAwardMutation = api.admin.deleteWikiArticleAward.useMutation({
    onSuccess: () => {
      notify.success("Award Removed", "Wiki award deleted");
      refetchAwards();
    },
    onError: (err) => notify.error("Deletion Error", err.message),
  });

  const handleCreateAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageTitle.trim() || !name.trim()) return;

    const titles = pageTitle
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const recipients = recipientText
      ? recipientText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    createAwardMutation.mutate({
      pageTitles: titles,
      category,
      name,
      description: description || undefined,
      recipientUsers: recipients,
      metadata: JSON.stringify({
        icon: iconShape,
        color: iconColor === "custom" ? customHex : iconColor,
      }),
    });
  };

  const handleScanMilestones = (e: React.FormEvent) => {
    e.preventDefault();
    const titles = milestonePages
      ? milestonePages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    evaluateMilestonesMutation.mutate({ pageTitles: titles });
  };

  const handleDeleteAward = (id: string) => {
    if (confirm("Are you sure you want to delete this award?")) {
      deleteAwardMutation.mutate({ id });
    }
  };

  const renderAwardBadgeIcon = (award: any) => {
    let iconName = "sparkles";
    let colorVal = "amber";
    let customStyle: React.CSSProperties = {};
    let isCustomHex = false;

    if (award.metadata) {
      try {
        const meta = JSON.parse(award.metadata);
        if (meta.icon) iconName = meta.icon;
        if (meta.color) {
          colorVal = meta.color;
          if (colorVal.startsWith("#")) {
            isCustomHex = true;
            customStyle = { color: colorVal };
          }
        }
      } catch (e) {
        // ignore
      }
    } else {
      // Fallback defaults based on category if metadata doesn't exist
      if (award.category === "FEATURED") {
        iconName = "trophy";
        colorVal = "amber";
      } else if (award.category === "COLLABORATION") {
        iconName = "users";
        colorVal = "cyan";
      } else if (award.category === "PEER_REVIEW") {
        iconName = "check";
        colorVal = "green";
      } else if (award.category === "SPECIAL") {
        iconName = "star";
        colorVal = "purple";
      } else {
        iconName = "sparkles";
        colorVal = "pink";
      }
    }

    const IconComp = getIconComponent(iconName);
    const colorClass = getColorClass(colorVal);

    return (
      <IconComp
        className={cn("h-4.5 w-4.5 shrink-0", !isCustomHex && colorClass)}
        style={customStyle}
      />
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-1">
        {/* Creation form */}
        <Card className="border-border/50 bg-card/80 h-fit backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AwardIcon className="h-5 w-5 text-amber-500" />
              Issue Custom Award
            </CardTitle>
            <CardDescription>Assign article-level trophies or achievements</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAward} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Page Title(s) (comma-separated)
                </label>
                <Input
                  placeholder="e.g. Main Page, Caphiria..."
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-background border-border/50 text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                >
                  <option value="FEATURED">🏆 Featured Article</option>
                  <option value="COLLABORATION">👥 Collaboration Milestone</option>
                  <option value="PEER_REVIEW">✔️ Peer Reviewed</option>
                  <option value="SPECIAL">⭐ Special Recognition</option>
                  <option value="EDITOR_MILESTONE">✨ Editor Milestone</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">Award Title / Badge</label>
                <Input
                  placeholder="e.g. Winner, Gold Star, 10k prose"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Recipients (Comma-separated)
                </label>
                <Input
                  placeholder="e.g. User1, User2"
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                />
              </div>

              {/* Medal Icon Builder Section */}
              <div className="border-border/20 space-y-3 border-t pt-3">
                <span className="text-[10px] font-black tracking-wider text-amber-500 uppercase">
                  Medal Icon Builder
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">Shape</label>
                    <select
                      value={iconShape}
                      onChange={(e) => setIconShape(e.target.value)}
                      className="bg-background border-border/50 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="trophy">🏆 Trophy</option>
                      <option value="medal">🏅 Medal</option>
                      <option value="star">⭐ Star</option>
                      <option value="crown">👑 Crown</option>
                      <option value="shield">🛡️ Shield</option>
                      <option value="award">🎖️ Award</option>
                      <option value="users">👥 Users</option>
                      <option value="check">✔️ Check</option>
                      <option value="sparkles">✨ Sparkles</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">Color Type</label>
                    <select
                      value={iconColor}
                      onChange={(e) => setIconColor(e.target.value)}
                      className="bg-background border-border/50 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="amber">Amber (Gold)</option>
                      <option value="slate">Slate (Silver)</option>
                      <option value="cyan">Cyan</option>
                      <option value="green">Green</option>
                      <option value="purple">Purple</option>
                      <option value="pink">Pink</option>
                      <option value="red">Red</option>
                      <option value="custom">Custom HEX</option>
                    </select>
                  </div>
                </div>

                {iconColor === "custom" && (
                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">
                      Custom Color (HEX)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="#ffd700"
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                      <Input
                        type="color"
                        value={
                          customHex.startsWith("#") && customHex.length === 7
                            ? customHex
                            : "#ffd700"
                        }
                        onChange={(e) => setCustomHex(e.target.value)}
                        className="h-8 w-10 cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>
                )}

                {/* Ambient Glass Medal Preview */}
                <div className="border-border/40 bg-muted/20 flex flex-col items-center justify-center rounded-xl border p-3.5 backdrop-blur-md">
                  <span className="text-muted-foreground/60 mb-2 text-[10px] font-bold uppercase select-none">
                    Live Medal Preview
                  </span>
                  <div className="border-border/50 bg-card/65 relative flex h-14 w-14 items-center justify-center rounded-full border shadow-inner transition-all duration-300">
                    {/* Ambient Glow Backdrop */}
                    <div
                      className="absolute inset-0 rounded-full opacity-25 blur-md transition-all duration-500"
                      style={{
                        backgroundColor:
                          iconColor === "custom" ? customHex : getColorHex(iconColor),
                      }}
                    />
                    {/* Medal Icon */}
                    {(() => {
                      const IconComp = getIconComponent(iconShape);
                      const isCustom = iconColor === "custom";
                      const customStyle = isCustom ? { color: customHex } : undefined;
                      const colorClass = !isCustom ? getColorClass(iconColor) : "";
                      return (
                        <IconComp
                          className={cn(
                            "relative z-10 h-7.5 w-7.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300",
                            colorClass
                          )}
                          style={customStyle}
                        />
                      );
                    })()}
                  </div>
                  <span className="text-foreground mt-2 max-w-[15rem] truncate text-xs font-black">
                    {name || "Award Title"}
                  </span>
                  <span className="text-muted-foreground/70 mt-0.5 text-[9px] font-bold tracking-wider uppercase">
                    {category.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Citation / Description
                </label>
                <textarea
                  placeholder="Enter citation details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-background border-border/50 text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <Button
                type="submit"
                disabled={createAwardMutation.isPending}
                className="mt-2 w-full gap-2"
              >
                {createAwardMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create & Issue Award
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Automated Milestones Panel */}
        <Card className="border-border/50 bg-card/80 h-fit backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Automated Milestones
            </CardTitle>
            <CardDescription>Scan page histories and auto-assign milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-muted-foreground space-y-2 text-xs">
              <p>Runs database analysis on article histories to award:</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>Prose Length:</strong> 10k, 50k, 100k milestone badges
                </li>
                <li>
                  <strong>Collaboration:</strong> 3+ unique contributors
                </li>
                <li>
                  <strong>Edit Depth:</strong> 50+ total revisions
                </li>
              </ul>
            </div>

            <form onSubmit={handleScanMilestones} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Specific Pages to Scan (Optional)
                </label>
                <Input
                  placeholder="e.g. Caphiria, Main Page (comma-separated)"
                  value={milestonePages}
                  onChange={(e) => setMilestonePages(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={evaluateMilestonesMutation.isPending}
                className="w-full gap-2 border-0 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700"
              >
                {evaluateMilestonesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Scan & Generate Milestones
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-2">
        {/* Recent Winners Log */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-amber-500" />
                  Recent Winners Log
                </CardTitle>
                <CardDescription>
                  Chronological feed of automatically calculated daily, weekly, and monthly loreward
                  winners
                </CardDescription>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => refetchRecentWinners()}
                disabled={isLoadingWinners}
                className="text-muted-foreground h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingWinners && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingWinners ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : !recentWinners || recentWinners.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm italic">
                No recent winners recorded in the database.
              </div>
            ) : (
              <div className="border-border/30 max-h-[16rem] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/80 sticky top-0 backdrop-blur-sm">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Date
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Type
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Winner
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Article Page
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-right text-xs font-medium">
                        Metrics
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {recentWinners.map((winner, idx) => {
                      const typeColors: Record<string, string> = {
                        daily:
                          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
                        weekly:
                          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
                        monthly:
                          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
                      };

                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs font-semibold">
                            {winner.date}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase",
                                typeColors[winner.type] || "bg-muted text-muted-foreground"
                              )}
                            >
                              {winner.type}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              {winner.winnerUser && (
                                <>
                                  <UnifiedCountryFlag
                                    countryName={winner.winnerUser}
                                    size="xs"
                                    showTooltip={false}
                                  />
                                  {winner.winnerUser}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {winner.winnerPage ? (
                              <a
                                href={`/wiki/${winner.winnerPage}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 font-semibold text-amber-500 hover:underline"
                              >
                                {winner.winnerPage}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">
                                No page
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs">
                            <span className="text-foreground font-semibold">
                              {winner.winnerScore ? `${winner.winnerScore} pts` : "—"}
                            </span>
                            {winner.winnerBytes ? (
                              <span className="text-muted-foreground ml-1.5 text-[10px]">
                                (+{(winner.winnerBytes / 1000).toFixed(1)}k bytes)
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Awards List */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Issued Awards</CardTitle>
                <CardDescription>Chronological list of all manual wiki rewards</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={awardCategory}
                  onChange={(e) => setAwardCategory(e.target.value)}
                  className="bg-background border-border/50 text-foreground rounded-lg border px-2.5 py-1 text-xs"
                >
                  <option value="all">All Categories</option>
                  <option value="FEATURED">Featured</option>
                  <option value="COLLABORATION">Collaboration</option>
                  <option value="PEER_REVIEW">Peer Review</option>
                  <option value="SPECIAL">Special</option>
                  <option value="EDITOR_MILESTONE">Milestones</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search awards by page title..."
                value={awardSearch}
                onChange={(e) => setAwardSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoadingAwards ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !awards || awards.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No awards match your filter criteria.
              </div>
            ) : (
              <div className="border-border/30 max-h-[30rem] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/80 sticky top-0 backdrop-blur-sm">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                        Article
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                        Award & Badge
                      </th>
                      <th className="text-muted-foreground hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                        Recipients
                      </th>
                      <th className="text-muted-foreground hidden px-4 py-2.5 text-left font-medium md:table-cell">
                        Awarded At
                      </th>
                      <th className="w-12 px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {awards.map((award) => {
                      const recipients = Array.isArray(award.recipientUsers)
                        ? (award.recipientUsers as string[])
                        : typeof award.recipientUsers === "string"
                          ? (JSON.parse(award.recipientUsers) as string[])
                          : [];

                      return (
                        <tr key={award.id} className="hover:bg-muted/30 transition-colors">
                          <td className="text-foreground px-4 py-2.5 font-medium">
                            {award.pageTitle}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {renderAwardBadgeIcon(award)}
                              <span className="font-medium">{award.name}</span>
                            </div>
                            {award.description && (
                              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                {award.description}
                              </p>
                            )}
                          </td>
                          <td className="hidden px-4 py-2.5 text-xs sm:table-cell">
                            {recipients.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {recipients.map((user) => (
                                  <Badge key={user} variant="secondary" className="px-1.5 py-0">
                                    {user}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground opacity-50">—</span>
                            )}
                          </td>
                          <td className="text-muted-foreground hidden px-4 py-2.5 text-xs md:table-cell">
                            {new Date(award.awardedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteAward(award.id)}
                              className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── System & Tuning Section ───────────────────────────────────────────────────

export function SystemTuningSection() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Scoring parameters weights
  const { data: weights, refetch: refetchWeights } = api.admin.getLorewardWeights.useQuery();
  const [tempWeights, setTempWeights] = useState<any>(null);

  useEffect(() => {
    if (weights) {
      setTempWeights({ ...weights });
    }
  }, [weights]);

  const saveWeightsMutation = api.admin.saveLorewardWeights.useMutation({
    onSuccess: () => {
      notify.success("Weights Saved", "System scoring weights updated successfully");
      refetchWeights();
    },
    onError: (err) => notify.error("Error", err.message),
  });

  const handleWeightChange = (key: string, value: number) => {
    setTempWeights((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const handleSaveWeights = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempWeights) return;
    saveWeightsMutation.mutate(tempWeights);
  };

  // Weight Tuning Preview console
  const [previewDate, setPreviewDate] = useState(
    new Date(Date.now() - 86400000).toISOString().split("T")[0]
  );
  const [currentPreviewData, setCurrentPreviewData] = useState<any>(null);
  const [simulatedPreviewData, setSimulatedPreviewData] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleRunPreview = async () => {
    if (!tempWeights || !weights) return;
    setIsPreviewLoading(true);
    try {
      const current = await utils.admin.previewLorewardScoring.fetch({
        date: previewDate,
        proseWeight: weights.lorewardWeight_proseRatio,
        collaborativeBonus: weights.lorewardWeight_collaborationBonus,
        depthMaxBonus: weights.lorewardWeight_editDepth,
        noveltyBonus: weights.lorewardWeight_newArticleBonus,
        importanceMaxBonus: 0.2,
      });

      const simulated = await utils.admin.previewLorewardScoring.fetch({
        date: previewDate,
        proseWeight: tempWeights.lorewardWeight_proseRatio,
        collaborativeBonus: tempWeights.lorewardWeight_collaborationBonus,
        depthMaxBonus: tempWeights.lorewardWeight_editDepth,
        noveltyBonus: tempWeights.lorewardWeight_newArticleBonus,
        importanceMaxBonus: 0.2,
      });

      setCurrentPreviewData(current);
      setSimulatedPreviewData(simulated);
      notify.success("Preview Generated", `Fetched scoring data for ${previewDate}`);
    } catch (err: any) {
      notify.error("Preview Error", err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const getRankDeltas = () => {
    if (!currentPreviewData || !simulatedPreviewData) return [];

    const currentMap = new Map<string, { rank: number; score: number }>();
    currentPreviewData.candidates.forEach((cand: any, idx: number) => {
      currentMap.set(`${cand.user}|${cand.page}`, {
        rank: idx + 1,
        score: cand.finalScore,
      });
    });

    return simulatedPreviewData.candidates.map((cand: any, idx: number) => {
      const simRank = idx + 1;
      const key = `${cand.user}|${cand.page}`;
      const curr = currentMap.get(key);

      const rankDelta = curr ? curr.rank - simRank : 0;
      const scoreDelta = curr ? cand.finalScore - curr.score : 0;

      return {
        user: cand.user,
        page: cand.page,
        currentRank: curr ? curr.rank : "N/A",
        simulatedRank: simRank,
        currentScore: curr ? curr.score : 0,
        simulatedScore: cand.finalScore,
        rankDelta,
        scoreDelta,
      };
    });
  };

  const rankDeltas = getRankDeltas();

  // Cache Operations
  const [purgePage, setPurgePage] = useState("");
  const purgeCacheMutation = api.admin.purgeWikiCache.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Cache Purged",
        `Cleared ${data.clearedCount} cache entries for "${purgePage}"`
      );
      setPurgePage("");
    },
    onError: (err) => notify.error("Error", err.message),
  });

  const purgeAllCacheMutation = api.admin.purgeAllWikiCache.useMutation({
    onSuccess: (data) => {
      notify.success("Cache Purged", `Cleared all ${data.clearedCount} wiki cache entries`);
    },
    onError: (err) => notify.error("Error", err.message),
  });

  const handlePurgePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgePage.trim()) return;
    purgeCacheMutation.mutate({ pageTitle: purgePage });
  };

  const handlePurgeAll = () => {
    if (
      confirm(
        "Are you sure you want to flush ALL cached wiki articles? This will force Parsoid fetches on reload."
      )
    ) {
      purgeAllCacheMutation.mutate();
    }
  };

  // Synced Templates list & Sync Actions
  const [templateSearchInput, setTemplateSearchInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templateCategoryInput, setTemplateCategoryInput] = useState("");

  const {
    data: templates,
    isLoading: isLoadingTemplates,
    refetch: refetchTemplates,
  } = api.admin.getWikiTemplatesList.useQuery();

  const { data: suggestions } = api.admin.searchMediaWikiTemplates.useQuery(
    { query: templateSearchInput },
    { enabled: templateSearchInput.trim().length >= 2 }
  );

  const syncTemplateMutation = api.admin.syncWikiTemplateByName.useMutation({
    onSuccess: (data: any) => {
      notify.success("Template Synced", `Successfully synced template: ${data.name}`);
      refetchTemplates();
      setTemplateSearchInput("");
      setShowSuggestions(false);
    },
    onError: (err) => notify.error("Sync Error", err.message),
  });

  const syncCategoryMutation = api.admin.syncWikiTemplatesByCategory.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Category Synced",
        `Successfully synced ${data.synced} of ${data.total} templates.`
      );
      refetchTemplates();
      setTemplateCategoryInput("");
    },
    onError: (err) => notify.error("Sync Error", err.message),
  });

  const handleSyncTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateSearchInput.trim()) return;
    syncTemplateMutation.mutate({ name: templateSearchInput.trim() });
  };

  const handleSyncCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateCategoryInput.trim()) return;
    syncCategoryMutation.mutate({ category: templateCategoryInput.trim() });
  };

  // Cron schedule editor
  const { data: cronSchedules, refetch: refetchCron } = api.admin.getCronSchedules.useQuery();
  const [cronScoring, setCronScoring] = useState("");
  const [cronIncome, setCronIncome] = useState("");
  const [cronCard, setCronCard] = useState("");

  useEffect(() => {
    if (cronSchedules) {
      setCronScoring(cronSchedules.cronSchedule_lorewardsScoring);
      setCronIncome(cronSchedules.cronSchedule_passiveIncome);
      setCronCard(cronSchedules.cronSchedule_cardValue);
    }
  }, [cronSchedules]);

  const saveCronMutation = api.admin.saveCronSchedules.useMutation({
    onSuccess: () => {
      notify.success("Cron Saved", "Cron schedules updated. Restart PM2 server to apply.");
      refetchCron();
    },
    onError: (err) => notify.error("Error Saving Cron", err.message),
  });

  const handleSaveCron = (e: React.FormEvent) => {
    e.preventDefault();
    saveCronMutation.mutate({
      cronSchedule_lorewardsScoring: cronScoring,
      cronSchedule_passiveIncome: cronIncome,
      cronSchedule_cardValue: cronCard,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Scoring Parameter Weights */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="h-5 w-5 text-blue-500" />
              Scoring Parameters Tuning
            </CardTitle>
            <CardDescription>
              Tune the daily Loreward scoring engine weights in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tempWeights ? (
              <form onSubmit={handleSaveWeights} className="space-y-5">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">Bytes Added Weight</span>
                      <span className="font-mono font-semibold text-blue-500">
                        {tempWeights.lorewardWeight_bytesAdded}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={tempWeights.lorewardWeight_bytesAdded}
                      onChange={(e) =>
                        handleWeightChange("lorewardWeight_bytesAdded", parseFloat(e.target.value))
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">Prose Ratio Weight</span>
                      <span className="font-mono font-semibold text-blue-500">
                        {tempWeights.lorewardWeight_proseRatio}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={tempWeights.lorewardWeight_proseRatio}
                      onChange={(e) =>
                        handleWeightChange("lorewardWeight_proseRatio", parseFloat(e.target.value))
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">Edit Depth Weight</span>
                      <span className="font-mono font-semibold text-blue-500">
                        {tempWeights.lorewardWeight_editDepth}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={tempWeights.lorewardWeight_editDepth}
                      onChange={(e) =>
                        handleWeightChange("lorewardWeight_editDepth", parseFloat(e.target.value))
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">
                        Collaboration Bonus Weight
                      </span>
                      <span className="font-mono font-semibold text-blue-500">
                        {tempWeights.lorewardWeight_collaborationBonus}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={tempWeights.lorewardWeight_collaborationBonus}
                      onChange={(e) =>
                        handleWeightChange(
                          "lorewardWeight_collaborationBonus",
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">New Article Bonus Weight</span>
                      <span className="font-mono font-semibold text-blue-500">
                        {tempWeights.lorewardWeight_newArticleBonus}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={tempWeights.lorewardWeight_newArticleBonus}
                      onChange={(e) =>
                        handleWeightChange(
                          "lorewardWeight_newArticleBonus",
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={saveWeightsMutation.isPending}
                  className="w-full gap-2"
                >
                  {saveWeightsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" />
                  Save Weight Configuration
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weight Tuning Preview Console */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
              Weight Tuning Preview
            </CardTitle>
            <CardDescription>Preview candidate ranks under simulated weights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-foreground text-sm font-medium">Scoring Date</label>
                <Input
                  type="date"
                  value={previewDate}
                  onChange={(e) => setPreviewDate(e.target.value)}
                />
              </div>
              <Button
                onClick={handleRunPreview}
                disabled={isPreviewLoading || !tempWeights}
                className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
              >
                {isPreviewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SlidersHorizontal className="h-4 w-4" />
                )}
                Preview Ranks
              </Button>
            </div>

            {isPreviewLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : rankDeltas.length > 0 ? (
              <div className="border-border/30 max-h-80 overflow-y-auto rounded-lg border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/80 sticky top-0 font-medium backdrop-blur-sm">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground w-16 px-3 py-2 text-left">Rank</th>
                      <th className="text-muted-foreground px-3 py-2 text-left">Candidate</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Curr Score</th>
                      <th className="text-muted-foreground px-3 py-2 text-right font-semibold">
                        Sim Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {rankDeltas.map((item: any, idx: number) => {
                      const delta = item.rankDelta;
                      return (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">{item.simulatedRank}</span>
                              {delta > 0 && (
                                <span className="font-bold text-emerald-500">▲{delta}</span>
                              )}
                              {delta < 0 && (
                                <span className="font-bold text-red-500">▼{Math.abs(delta)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-foreground font-semibold">{item.user}</span>
                            <span className="text-muted-foreground block text-[10px]">
                              {item.page}
                            </span>
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                            {item.currentScore.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            <span className="font-semibold">{item.simulatedScore.toFixed(2)}</span>
                            {item.scoreDelta !== 0 && (
                              <span
                                className={cn(
                                  "block text-[10px] font-medium",
                                  item.scoreDelta > 0 ? "text-emerald-500" : "text-red-500"
                                )}
                              >
                                {item.scoreDelta > 0 ? "+" : ""}
                                {item.scoreDelta.toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : currentPreviewData ? (
              <div className="text-muted-foreground py-8 text-center text-xs italic">
                No edits or candidates qualified on {previewDate}.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Cache Utilities */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-emerald-500" />
              Cache Operations
            </CardTitle>
            <CardDescription>
              Purge article wikitext and page parse trees from memory
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handlePurgePage} className="flex gap-2">
              <Input
                placeholder="Enter article title to purge..."
                value={purgePage}
                onChange={(e) => setPurgePage(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="outline"
                disabled={purgeCacheMutation.isPending}
                className="shrink-0"
              >
                {purgeCacheMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Purge Page"
                )}
              </Button>
            </form>

            <div className="border-border/20 border-t pt-2">
              <Button
                onClick={handlePurgeAll}
                disabled={purgeAllCacheMutation.isPending}
                variant="destructive"
                className="w-full gap-2"
              >
                {purgeAllCacheMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Purge All Article Caches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wiki Templates Synchronization */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
              Wiki Templates Synchronization
            </CardTitle>
            <CardDescription>Registered template components synced from MediaWiki</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sync forms */}
            <div className="border-border/20 grid gap-4 border-b pb-2 md:grid-cols-2">
              <form onSubmit={handleSyncTemplate} className="space-y-2">
                <label className="text-foreground block text-xs font-semibold">Sync by Name</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="e.g. Infobox Country"
                      value={templateSearchInput}
                      onChange={(e) => {
                        setTemplateSearchInput(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="border-border bg-card/95 absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border p-1 shadow-lg backdrop-blur-md">
                        {suggestions.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setTemplateSearchInput(name);
                              setShowSuggestions(false);
                            }}
                            className="hover:bg-accent hover:text-accent-foreground w-full rounded px-3 py-1.5 text-left text-xs transition-colors"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={syncTemplateMutation.isPending}
                    className="shrink-0"
                  >
                    {syncTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>

              <form onSubmit={handleSyncCategory} className="space-y-2">
                <label className="text-foreground block text-xs font-semibold">
                  Sync by Category
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Country templates"
                    value={templateCategoryInput}
                    onChange={(e) => setTemplateCategoryInput(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={syncCategoryMutation.isPending}
                    className="shrink-0"
                  >
                    {syncCategoryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* List */}
            {isLoadingTemplates ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs italic">
                No templates synchronized yet.
              </div>
            ) : (
              <div className="border-border/30 max-h-[12rem] overflow-y-auto rounded-lg border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0 font-medium">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-3 py-2 text-left">Template Name</th>
                      <th className="text-muted-foreground px-3 py-2 text-left">Category</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Usage</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Params</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {templates.map((tpl) => (
                      <tr key={tpl.id} className="hover:bg-muted/30">
                        <td className="text-foreground px-3 py-2 font-mono font-medium">
                          {tpl.name}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">{tpl.category || "—"}</td>
                        <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                          {tpl.usageCount}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                          {tpl.paramCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cron Schedules Editor */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sliders className="h-5 w-5 text-emerald-500" />
              Cron Schedules Editor
            </CardTitle>
            <CardDescription>
              Configure background job intervals in standard 5-field cron syntax
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveCron} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Lorewards Scoring Schedule
                </label>
                <Input
                  placeholder="e.g. 0 6 * * *"
                  value={cronScoring}
                  onChange={(e) => setCronScoring(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Passive Income Schedule
                </label>
                <Input
                  placeholder="e.g. 0 0 * * *"
                  value={cronIncome}
                  onChange={(e) => setCronIncome(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Card Value Tracking Schedule
                </label>
                <Input
                  placeholder="e.g. 0 */6 * * *"
                  value={cronCard}
                  onChange={(e) => setCronCard(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">PM2 Restart Required</p>
                  <p className="mt-0.5 opacity-80">
                    Changing schedules updates SystemConfig values. Next time the custom server is
                    restarted via PM2, these new schedule intervals will be scheduled.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saveCronMutation.isPending}
                className="w-full gap-2 border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
              >
                {saveCronMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Save Cron Configuration
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminWikiPage() {
  usePageTitle({ title: "Admin - WikiOS Administration" });

  const [activeTab, setActiveTab] = useState<string>("links");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["links", "awards", "system"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const { data: countriesData, isLoading } = api.countries.getAll.useQuery(
    { limit: 500 },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={BookOpen}
        title="WikiOS Administration"
        description="Unified portal for managing links, custom article awards, and parser systems"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-border/30 mb-4 flex h-fit w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="links"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground hover:border-border/50 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-transparent"
          >
            Wiki Links
          </TabsTrigger>
          <TabsTrigger
            value="awards"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground hover:border-border/50 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-transparent"
          >
            Awards Manager
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground hover:border-border/50 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-transparent"
          >
            System & Tuning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-6 outline-none">
          <WikiLinkStatusSection countriesData={countriesData} isLoading={isLoading} />
          <ManualLinkEditorSection countriesData={countriesData} />
          <BulkScannerSection countriesData={countriesData} />
        </TabsContent>

        <TabsContent value="awards" className="outline-none">
          <AwardsManagerSection />
        </TabsContent>

        <TabsContent value="system" className="outline-none">
          <SystemTuningSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
