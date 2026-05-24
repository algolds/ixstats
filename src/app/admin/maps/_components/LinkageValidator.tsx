"use client";

/**
 * LinkageValidator - Admin panel for validating and repairing
 * country ↔ map feature linkage.
 */

import { useState } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

export function LinkageValidator() {
  const [tab, setTab] = useState<"issues" | "linked" | "unlinked">("issues");
  const utils = api.useUtils();

  const { data, isLoading, error, refetch } = api.geo.validateLinkage.useQuery(undefined, {
    staleTime: 10_000,
    retry: false,
  });

  const syncMutation = api.geo.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geo.validateLinkage.invalidate();
      utils.geo.listCountries.invalidate();
      utils.geo.getWorldMap.invalidate();
    },
  });

  const autoMatchMutation = api.geo.repairLinkage.useMutation({
    onSuccess: () => {
      utils.geo.validateLinkage.invalidate();
      utils.geo.listCountries.invalidate();
      utils.geo.getWorldMap.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
        <p className="font-medium text-red-700 dark:text-red-400">Failed to load linkage data</p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border rounded-xl border p-3">
          <div className="text-foreground text-2xl font-bold">{data.totalCountries}</div>
          <div className="text-muted-foreground text-xs">Total Countries</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {data.linkedCount}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-500">Linked</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
            {data.unlinkedCount}
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-500">Unlinked</div>
        </div>
        <div
          className={`rounded-xl border p-3 ${data.issueCount > 0 ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" : "border-border"}`}
        >
          <div
            className={`text-2xl font-bold ${data.issueCount > 0 ? "text-red-700 dark:text-red-400" : "text-foreground"}`}
          >
            {data.issueCount}
          </div>
          <div className="text-muted-foreground text-xs">Issues</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => syncMutation.mutate({ action: "sync_all" })}
          disabled={syncMutation.isPending}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          {syncMutation.isPending ? "Syncing..." : "Sync All Linked"}
        </button>
        <button
          onClick={() => autoMatchMutation.mutate({ action: "auto_match" })}
          disabled={autoMatchMutation.isPending}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
        >
          {autoMatchMutation.isPending ? "Matching..." : "Auto-Match by Name"}
        </button>
        <button
          onClick={() => refetch()}
          className="border-border text-foreground/80 hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
        >
          Refresh
        </button>

        {syncMutation.isSuccess && (
          <span className="self-center text-xs text-emerald-600">
            Synced {syncMutation.data.repaired} countries
          </span>
        )}
        {autoMatchMutation.isSuccess && (
          <span className="self-center text-xs text-emerald-600">
            Matched {autoMatchMutation.data.repaired} countries
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-border flex gap-1 rounded-lg border p-1">
        {(["issues", "linked", "unlinked"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? "bg-blue-500 text-white" : "text-foreground/80 hover:bg-accent"
            }`}
          >
            {t} (
            {t === "issues"
              ? data.issueCount
              : t === "linked"
                ? data.linkedCount
                : data.unlinkedCount}
            )
          </button>
        ))}
      </div>

      {/* Issues tab */}
      {tab === "issues" && (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted border-b">
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Type</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Country</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Feature</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.issues.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    No linkage issues found.
                  </td>
                </tr>
              ) : (
                data.issues.map((issue, i) => (
                  <tr key={i} className="border-border/50 border-b last:border-0">
                    <td className="px-4 py-3">
                      <IssueTypeBadge type={issue.type} />
                    </td>
                    <td className="text-foreground px-4 py-3 font-medium">{issue.countryName}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {issue.featureName ?? "\u2014"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{issue.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Linked tab */}
      {tab === "linked" && (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted border-b">
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Country</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Map Feature</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Area</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {data.linked.map((c) => (
                <tr key={c.countryId} className="border-border/50 border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.countryFlag && (
                        <img
                          src={c.countryFlag}
                          alt=""
                          className="border-border h-4 w-6 rounded-sm border object-cover"
                        />
                      )}
                      <span className="text-foreground font-medium">{c.countryName}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {c.featureName}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {c.areaSqKm ? `${Math.round(c.areaSqKm).toLocaleString()} km\u00B2` : "\u2014"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {c.hasOwner ? (
                      c.ownerName
                    ) : (
                      <span className="text-muted-foreground italic">NPC</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unlinked tab */}
      {tab === "unlinked" && (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted border-b">
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Country</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Has Geometry</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Has LandArea</th>
                <th className="text-foreground/80 px-4 py-3 text-left font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {data.unlinked.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    All countries are linked.
                  </td>
                </tr>
              ) : (
                data.unlinked.map((c) => (
                  <tr key={c.countryId} className="border-border/50 border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.countryFlag && (
                          <img
                            src={c.countryFlag}
                            alt=""
                            className="border-border h-4 w-6 rounded-sm border object-cover"
                          />
                        )}
                        <span className="text-foreground font-medium">{c.countryName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.hasGeometry ? (
                        <span className="text-amber-600">Orphaned</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.hasLandArea ? (
                        <span className="text-amber-600">Yes (stale)</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {c.hasOwner ? (
                        c.ownerName
                      ) : (
                        <span className="text-muted-foreground italic">NPC</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IssueTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    no_map_link: "bg-muted text-foreground/80",
    orphan_geometry: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    missing_geometry_sync: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    missing_area_sync: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    stale_map_link: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labels: Record<string, string> = {
    no_map_link: "No Link",
    orphan_geometry: "Orphaned",
    missing_geometry_sync: "Geo Desync",
    missing_area_sync: "Area Desync",
    stale_map_link: "Stale Link",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[type] ?? "bg-muted text-foreground/80"}`}
    >
      {labels[type] ?? type}
    </span>
  );
}
