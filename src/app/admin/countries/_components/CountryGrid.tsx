// src/app/admin/countries/_components/CountryGrid.tsx
// Sortable, filterable data table of all countries with key metrics
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  User,
  ChevronLeft,
  ChevronRight,
  Map,
} from "lucide-react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";

type SortField =
  | "name"
  | "currentTotalGdp"
  | "currentGdpPerCapita"
  | "realGDPGrowthRate"
  | "currentPopulation"
  | "economicTier"
  | "updatedAt";

interface CountryGridProps {
  onSelectCountry: (countryId: string) => void;
}

const TIER_OPTIONS = [
  { value: "all", label: "All Tiers" },
  { value: "developing", label: "Developing" },
  { value: "emerging", label: "Emerging" },
  { value: "developed", label: "Developed" },
  { value: "advanced", label: "Advanced" },
];

const PAGE_SIZE = 25;

function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function formatPopulation(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

function tierColor(tier: string | null): string {
  switch (tier) {
    case "advanced":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "developed":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "emerging":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "developing":
      return "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20";
    default:
      return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
  }
}

export function CountryGrid({ onSelectCountry }: CountryGridProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [tierFilter, setTierFilter] = useState("all");
  const [tierOpen, setTierOpen] = useState(false);
  const [page, setPage] = useState(0);

  const { data, isLoading } = api.admin.getCountryGrid.useQuery(
    {
      search: search || undefined,
      sortBy,
      sortOrder,
      tierFilter: tierFilter === "all" ? undefined : tierFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={tierFilter}
          open={tierOpen}
          onOpenChange={setTierOpen}
          onValueChange={(v) => {
            setTierFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">
          {data ? `${data.total} countries` : "Loading..."}
        </span>
      </div>

      {/* Table */}
      <div className="border-border/50 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-border/50 border-b">
              {[
                { field: "name" as const, label: "Country", width: "min-w-[200px]" },
                { field: "currentTotalGdp" as const, label: "GDP", width: "min-w-[100px]" },
                {
                  field: "currentGdpPerCapita" as const,
                  label: "GDP/Cap",
                  width: "min-w-[90px]",
                },
                { field: "realGDPGrowthRate" as const, label: "Growth", width: "min-w-[80px]" },
                {
                  field: "currentPopulation" as const,
                  label: "Population",
                  width: "min-w-[100px]",
                },
                { field: "economicTier" as const, label: "Tier", width: "min-w-[100px]" },
                { field: "updatedAt" as const, label: "Last Updated", width: "min-w-[120px]" },
              ].map((col) => (
                <th key={col.field} className={`px-3 py-2.5 text-left font-medium ${col.width}`}>
                  <button
                    onClick={() => toggleSort(col.field)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {col.label}
                    <SortIcon field={col.field} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-medium">Map</th>
              <th className="px-3 py-2.5 text-left font-medium">Owner</th>
              <th className="px-3 py-2.5 text-left font-medium">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-border/30 border-b">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-muted-foreground px-3 py-8 text-center">
                  No countries found
                </td>
              </tr>
            ) : (
              data?.rows.map((row) => {
                const growthNegative = row.gdpGrowthRate != null && row.gdpGrowthRate < 0;
                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setTierOpen(false);
                      onSelectCountry(row.id);
                    }}
                    className={`border-border/30 hover:bg-muted/20 cursor-pointer border-b transition-colors ${
                      growthNegative ? "bg-red-500/[0.03]" : ""
                    } ${!row.owner ? "opacity-75" : ""}`}
                  >
                    {/* Country Name */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <UnifiedCountryFlag countryName={row.name} flagUrl={row.flag} size="sm" />
                        <span className="text-foreground font-medium">{row.name}</span>
                        {row.isDemo && (
                          <Badge variant="outline" className="px-1 py-0 text-xs">
                            Demo
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* GDP */}
                    <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                      {formatNumber(row.gdp)}
                    </td>

                    {/* GDP per Capita */}
                    <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                      {row.gdpPerCapita != null
                        ? `$${row.gdpPerCapita.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : "N/A"}
                    </td>

                    {/* Growth */}
                    <td className="px-3 py-2.5">
                      <span
                        className={`font-mono text-xs font-medium ${
                          growthNegative
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {formatPercent(row.gdpGrowthRate)}
                      </span>
                    </td>

                    {/* Population */}
                    <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                      {formatPopulation(row.population)}
                    </td>

                    {/* Tier */}
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={`text-xs ${tierColor(row.economicTier)}`}>
                        {row.economicTier ?? "Unknown"}
                      </Badge>
                    </td>

                    {/* Last Updated */}
                    <td className="text-muted-foreground px-3 py-2.5 text-xs">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "Never"}
                    </td>

                    {/* Map */}
                    <td className="px-3 py-2.5">
                      {row.hasMap ? (
                        <Map className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Map className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                      )}
                    </td>

                    {/* Owner */}
                    <td className="px-3 py-2.5">
                      {row.owner ? (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-green-500" />
                          <span className="text-muted-foreground text-xs">Claimed</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">Unclaimed</span>
                      )}
                    </td>

                    {/* Alerts */}
                    <td className="px-3 py-2.5">
                      {row.activeInterventions > 0 && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {row.activeInterventions}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
