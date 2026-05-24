"use client";

/**
 * CountryAssigner - Link map features to Country database records.
 *
 * Shows a table of all political features with their linkage status.
 * Admins can manually assign/unassign country links.
 */

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

export function CountryAssigner() {
  const [filter, setFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [search, setSearch] = useState("");
  const [assigningFeatureId, setAssigningFeatureId] = useState<string | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState("");

  const utils = api.useUtils();

  const { data: features, isLoading: featuresLoading } = api.geo.listCountries.useQuery();

  // Get all countries from the database for the assignment dropdown
  const { data: dbCountries } = api.countries.getAll.useQuery(undefined, {
    staleTime: 60000,
  });

  const assignMutation = api.geo.assignCountryGeometry.useMutation({
    onSuccess: () => {
      utils.geo.listCountries.invalidate();
      utils.geo.getMapStats.invalidate();
      utils.geo.getWorldMap.invalidate();
      setAssigningFeatureId(null);
      setSelectedCountryId("");
    },
  });

  const unlinkMutation = api.geo.unlinkCountryGeometry.useMutation({
    onSuccess: () => {
      utils.geo.listCountries.invalidate();
      utils.geo.getMapStats.invalidate();
      utils.geo.getWorldMap.invalidate();
    },
  });

  const filtered = useMemo(() => {
    if (!features) return [];
    return features.filter((f) => {
      // Status filter
      if (filter === "linked" && !f.isClaimed) return false;
      if (filter === "unlinked" && f.isClaimed) return false;
      // Search filter
      if (
        search &&
        !f.displayName.toLowerCase().includes(search.toLowerCase()) &&
        !f.featureId.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [features, filter, search]);

  // Countries not yet assigned to any feature
  const availableCountries = useMemo(() => {
    const countries = dbCountries?.countries;
    if (!countries || !features) return [];
    const assignedCountryIds = new Set(features.filter((f) => f.countryId).map((f) => f.countryId));
    return countries.filter((c: { id: string; name: string }) => !assignedCountryIds.has(c.id));
  }, [dbCountries, features]);

  const handleAssign = (featureId: string) => {
    if (!selectedCountryId) return;
    assignMutation.mutate({ featureId, countryId: selectedCountryId });
  };

  const handleUnlink = (featureId: string) => {
    if (confirm("Unlink this feature from its country?")) {
      unlinkMutation.mutate({ featureId });
    }
  };

  if (featuresLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-border bg-background text-foreground rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="border-border flex rounded-lg border">
          {(["all", "linked", "unlinked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-blue-500 text-white" : "text-foreground/80 hover:bg-accent"
              } ${f === "all" ? "rounded-l-lg" : ""} ${f === "unlinked" ? "rounded-r-lg" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-sm">{filtered.length} features</span>
      </div>

      {/* Table */}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-muted border-b">
              <th className="text-foreground/80 px-4 py-3 text-left font-medium">Feature</th>
              <th className="text-foreground/80 px-4 py-3 text-left font-medium">Status</th>
              <th className="text-foreground/80 px-4 py-3 text-left font-medium">Area</th>
              <th className="text-foreground/80 px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((feature) => (
              <tr key={feature.featureId} className="border-border/50 border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="border-border h-3 w-3 rounded-sm border"
                      style={{ backgroundColor: feature.fillColor }}
                    />
                    <div>
                      <div className="text-foreground font-medium">{feature.displayName}</div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {feature.featureId}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {feature.isClaimed ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Linked
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                      Unlinked
                    </span>
                  )}
                </td>
                <td className="text-foreground/80 px-4 py-3">
                  {feature.areaSqKm
                    ? `${Math.round(feature.areaSqKm).toLocaleString()} km²`
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-right">
                  {feature.isClaimed ? (
                    <button
                      onClick={() => handleUnlink(feature.featureId)}
                      disabled={unlinkMutation.isPending}
                      className="rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                    >
                      Unlink
                    </button>
                  ) : assigningFeatureId === feature.featureId ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCountryId}
                        onChange={(e) => setSelectedCountryId(e.target.value)}
                        className="border-border bg-background text-foreground rounded border px-2 py-1 text-xs"
                      >
                        <option value="">Select country...</option>
                        {availableCountries.map((c: { id: string; name: string }) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(feature.featureId)}
                        disabled={!selectedCountryId || assignMutation.isPending}
                        className="rounded bg-blue-500 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                      >
                        {assignMutation.isPending ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setAssigningFeatureId(null);
                          setSelectedCountryId("");
                        }}
                        className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningFeatureId(feature.featureId)}
                      className="rounded px-2 py-1 text-xs text-blue-500 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      Assign
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
