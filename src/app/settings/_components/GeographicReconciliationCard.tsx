"use client";

import React, { useTransition } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { RefreshCw, Info, Scale, TrendingUp, MapPin } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface GeographicReconciliationCardProps {
  countryId: string;
}

export function GeographicReconciliationCard({ countryId }: GeographicReconciliationCardProps) {
  const [isPending, startTransition] = useTransition();

  // Query the unified geo bundle to fetch subdivisions, cities, and computed rollups
  const { data: geoBundle, refetch: refetchGeo } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // tRPC mutations for rollups & reconciliation
  const updateModeMutation = api.countryGeo.updateGeoRollupMode.useMutation({
    onSuccess: () => {
      toast.success("Rollup reconciliation mode updated successfully");
      refetchGeo();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update rollup mode");
    },
  });

  const rebaseMutation = api.countryGeo.rebaseNationalFromGeography.useMutation({
    onSuccess: () => {
      toast.success("National simulation baseline rebased from geography successfully!");
      refetchGeo();
      // Reload page to let other tabs fetch refreshed metrics
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to rebase national stats");
    },
  });

  if (!geoBundle) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  const { country, rollups } = geoBundle;
  const currentMode = country?.geoRollupMode || "hybrid";

  // Coverage percentages
  const popCoveragePct = Math.min(Math.round(rollups.populationCoverage * 100), 500);
  const gdpCoveragePct = Math.min(Math.round(rollups.gdpCoverage * 100), 500);

  const handleModeChange = (newMode: "hybrid" | "top-down" | "bottom-up") => {
    startTransition(async () => {
      await updateModeMutation.mutateAsync({
        countryId,
        mode: newMode,
      });
    });
  };

  const handleRebase = () => {
    if (rollups.subdivisionPopulationSum === 0 && rollups.cityPopulationSum === 0) {
      toast.error(
        "Cannot rebase: no settlements or subdivisions have been defined on the map yet."
      );
      return;
    }

    if (
      confirm(
        "Are you sure you want to overwrite your national baseline population and GDP totals with the sum of your geographic subdivisions/cities? This affects the national economic builder simulation."
      )
    ) {
      startTransition(async () => {
        await rebaseMutation.mutateAsync({ countryId });
      });
    }
  };

  const isLoading = isPending || updateModeMutation.isPending || rebaseMutation.isPending;

  return (
    <Card className="glass-surface glass-refraction border-border/40 mt-4 overflow-hidden shadow-lg">
      <CardContent className="space-y-5 p-5">
        {/* Header Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Scale className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold tracking-tight">
                Geographic Reconciliation
              </h3>
              <p className="text-muted-foreground/70 text-[11px]">
                Manage how settlements and subdivisions map to your national simulation baseline
              </p>
            </div>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            Active
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Alignment Mode Configurator */}
          <div className="space-y-3.5 lg:col-span-6">
            <div>
              <label className="text-muted-foreground/80 block text-[10px] font-bold tracking-wider uppercase">
                Reconciliation Mode
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <Select
                  value={currentMode}
                  onValueChange={(val) => handleModeChange(val as any)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="border-border/40 h-9 w-[180px] bg-white/20 text-xs shadow-xs focus:ring-purple-500/30 dark:bg-white/[0.04]">
                    <SelectValue placeholder="Select rollup mode" />
                  </SelectTrigger>
                  <SelectContent className="border-border/60 bg-white/95 text-xs dark:bg-zinc-900/95">
                    <SelectItem
                      value="hybrid"
                      description="Map & baseline stats remain independent. Sync manually."
                    >
                      Hybrid (Default)
                    </SelectItem>
                    <SelectItem
                      value="top-down"
                      description="Baseline stats scale cities & regions proportionally."
                    >
                      Top-Down
                    </SelectItem>
                    <SelectItem
                      value="bottom-up"
                      description="National baseline automatically equals the sum of geography."
                    >
                      Bottom-Up
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-500" />}
              </div>
            </div>

            {/* Mode Descriptions */}
            <div className="border-border/20 rounded-xl border bg-white/35 p-3.5 text-xs leading-relaxed dark:bg-white/[0.02]">
              {currentMode === "hybrid" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                    <Info className="h-3.5 w-3.5" />
                    <span>Hybrid Mode</span>
                  </div>
                  <p className="text-muted-foreground/90 text-[11px]">
                    National totals stay fixed at the simulation baseline (e.g. from Nation Builder
                    or World Bank). Subdivisions and cities display absolute geographic breakdown
                    data. You can rebase manually anytime.
                  </p>
                </div>
              )}
              {currentMode === "top-down" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                    <Info className="h-3.5 w-3.5" />
                    <span>Top-Down Scaling Mode</span>
                  </div>
                  <p className="text-muted-foreground/90 text-[11px]">
                    The national baseline dictates the absolute totals. Subdivision populations and
                    GDP inputs are scaled dynamically on read to sum exactly to the national total.
                    Respects specific city shares.
                  </p>
                </div>
              )}
              {currentMode === "bottom-up" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
                    <Info className="h-3.5 w-3.5" />
                    <span>Bottom-Up Rollup Mode</span>
                  </div>
                  <p className="text-muted-foreground/90 text-[11px]">
                    Authoritative stats roll up directly from the map. Any time you add a city,
                    adjust subdivision boundaries, or update settlement populations, the national
                    baseline immediately sums them up.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Demographic Rollups Summary */}
          <div className="lg:border-border/30 space-y-4 lg:col-span-6 lg:border-l lg:pl-5">
            <div>
              <span className="text-muted-foreground/80 block text-[10px] font-bold tracking-wider uppercase">
                Geographic Coverage
              </span>
              <div className="mt-2.5 space-y-3">
                {/* Population Coverage */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-red-500" /> Population Coverage
                    </span>
                    <span className="text-foreground font-semibold">{popCoveragePct}%</span>
                  </div>
                  <Progress
                    value={Math.min(popCoveragePct, 100)}
                    className={cn(
                      "h-1.5",
                      popCoveragePct >= 95 && popCoveragePct <= 105
                        ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
                        : popCoveragePct > 105
                          ? "[&>[data-slot=progress-indicator]]:bg-sky-500"
                          : "[&>[data-slot=progress-indicator]]:bg-amber-500"
                    )}
                  />
                  <div className="text-muted-foreground/70 flex justify-between text-[10px]">
                    <span>Σ Geographics: {rollups.subdivisionPopulationSum.toLocaleString()}</span>
                    <span>National: {country.currentPopulation.toLocaleString()}</span>
                  </div>
                </div>

                {/* GDP Coverage */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-pink-500" /> GDP Contribution Coverage
                    </span>
                    <span className="text-foreground font-semibold">{gdpCoveragePct}%</span>
                  </div>
                  <Progress
                    value={Math.min(gdpCoveragePct, 100)}
                    className={cn(
                      "h-1.5",
                      gdpCoveragePct >= 95 && gdpCoveragePct <= 105
                        ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
                        : gdpCoveragePct > 105
                          ? "[&>[data-slot=progress-indicator]]:bg-sky-500"
                          : "[&>[data-slot=progress-indicator]]:bg-amber-500"
                    )}
                  />
                  <div className="text-muted-foreground/70 flex justify-between text-[10px]">
                    <span>
                      Σ Geographics: $
                      {Math.round(rollups.subdivisionGdpContributionSum).toLocaleString()}
                    </span>
                    <span>National: ${Math.round(country.currentTotalGdp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reconciliation Manual Action */}
            <div className="border-border/30 flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <p className="text-foreground text-[11px] font-medium">Manual Reconciliation</p>
                <p className="text-muted-foreground/60 text-[10px]">
                  Force overwrite national totals from subdivisions sum
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRebase}
                disabled={isLoading || currentMode === "top-down"}
                className="h-8 border-purple-500/30 bg-purple-500/5 text-xs text-purple-600 hover:bg-purple-500/15 dark:border-purple-400/20 dark:text-purple-400"
              >
                {rebaseMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> Rebasing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Rebase National
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
