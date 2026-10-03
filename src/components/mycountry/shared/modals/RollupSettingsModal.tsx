"use client";

import React, { useState } from "react";
import {
  StatsReport as BarChart3,
  SystemRestart as Loader2,
  Refresh as RefreshCw,
  Settings,
} from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

export interface GeoRollups {
  cityPopulationSum: number;
  subdivisionPopulationSum: number;
  cityGdpContributionSum: number;
  subdivisionGdpContributionSum: number;
  populationCoverage: number;
  gdpCoverage: number;
}

interface RollupSettingsModalProps {
  countryId: string;
  geoRollupMode: string;
  rollups: GeoRollups;
  nationalPopulation: number;
  nationalGdp: number;
  onUpdated: () => void;
  /** Custom trigger element. Defaults to a Settings-button with a coverage badge. */
  trigger?: React.ReactNode;
}

/**
 * RollupSettingsModal — settings dialog for geographic rollup mode + rebase.
 *
 * Replaces the inline rollup card on the Geography page. Trigger shows a
 * coverage summary so the user can see at a glance how well the geography
 * data covers the national totals before opening the dialog.
 */
export function RollupSettingsModal({
  countryId,
  geoRollupMode,
  rollups,
  nationalPopulation,
  nationalGdp,
  onUpdated,
  trigger,
}: RollupSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const popPct = Math.round(rollups.populationCoverage * 100);
  const gdpPct = Math.round(rollups.gdpCoverage * 100);
  const worst = Math.min(popPct, gdpPct);
  const coverageTone =
    worst >= 100
      ? "bg-fill-3 text-green"
      : worst >= 50
        ? "bg-fill-3 text-yellow"
        : "bg-fill-3 text-destructive";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Open rollup settings"
            className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start gap-2 py-2 text-left whitespace-normal"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="text-label-secondary h-4 w-4" />
              <div>
                <div className="text-label text-caption font-semibold">Geographic rollups</div>
                <div className="text-label-secondary text-footnote">
                  Mode: {geoRollupMode} · Pop {popPct}% · GDP {gdpPct}%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-control-sm text-caption px-2 py-0.5 tabular-nums ${coverageTone}`}
              >
                {worst}%
              </span>
              <Settings className="text-label-secondary h-3.5 w-3.5" />
            </div>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-body flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Geographic rollups & reconciliation
          </DialogTitle>
          <DialogDescription className="text-footnote">
            Choose how city + subdivision data should reconcile against national totals.
          </DialogDescription>
        </DialogHeader>
        <RollupBody
          countryId={countryId}
          geoRollupMode={geoRollupMode}
          rollups={rollups}
          nationalPopulation={nationalPopulation}
          nationalGdp={nationalGdp}
          onUpdated={() => {
            onUpdated();
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RollupBody({
  countryId,
  geoRollupMode,
  rollups,
  nationalPopulation,
  nationalGdp,
  onUpdated,
}: {
  countryId: string;
  geoRollupMode: string;
  rollups: GeoRollups;
  nationalPopulation: number;
  nationalGdp: number;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState(geoRollupMode);
  const [scaleExisting, setScaleExisting] = useState(true);
  const updateMode = api.countryGeo.updateGeoRollupMode.useMutation({ onSuccess: onUpdated });
  const rebase = api.countryGeo.rebaseNationalFromGeography.useMutation({ onSuccess: onUpdated });
  const distribute = api.countryGeo.distributeSubdivisionDemographics.useMutation({
    onSuccess: onUpdated,
  });

  const popPct = Math.round(rollups.populationCoverage * 100);
  const gdpPct = Math.round(rollups.gdpCoverage * 100);

  const handleModeChange = (newMode: "hybrid" | "top-down" | "bottom-up") => {
    setMode(newMode);
    updateMode.mutate({ countryId, mode: newMode });
  };

  const handleRebase = () => {
    if (
      !window.confirm(
        "Recompute national totals from geographic sums? This overwrites currentPopulation/currentTotalGdp."
      )
    )
      return;
    rebase.mutate({ countryId });
  };

  const handleDistribute = () => {
    if (
      !window.confirm(
        "Auto-assign populations and GDP to cities based on their subdivision totals? This will overwrite populations and GDP contributions for all cities linked to subdivisions."
      )
    )
      return;
    distribute.mutate({ countryId, scaleExisting });
  };

  return (
    <div className="space-y-4">
      {/* Coverage meters */}
      <div className="space-y-2">
        <CoverageMeter label="Population coverage" percent={popPct} />
        <CoverageMeter label="GDP coverage" percent={gdpPct} />
        <div className="text-label-secondary text-footnote">
          City pop: {rollups.cityPopulationSum.toLocaleString()} · Sub pop:{" "}
          {rollups.subdivisionPopulationSum.toLocaleString()} · National:{" "}
          {nationalPopulation.toLocaleString()}
        </div>
        <div className="text-label-secondary text-footnote">
          City GDP: {Math.round(rollups.cityGdpContributionSum).toLocaleString()} · Sub GDP:{" "}
          {Math.round(rollups.subdivisionGdpContributionSum).toLocaleString()} · National:{" "}
          {Math.round(nationalGdp).toLocaleString()}
        </div>
      </div>

      {/* Rollup mode selector */}
      <div className="space-y-2">
        <Eyebrow id="rollup-mode-label" className="block">
          Rollup mode
        </Eyebrow>
        <div
          className="bg-fill-3 rounded-control flex p-0.5"
          role="group"
          aria-labelledby="rollup-mode-label"
        >
          {(["hybrid", "top-down", "bottom-up"] as const).map((m) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              key={m}
              onClick={() => handleModeChange(m)}
              disabled={updateMode.isPending}
              aria-pressed={mode === m}
              title={
                m === "hybrid"
                  ? "Sim values authoritative; geography shown as-is"
                  : m === "top-down"
                    ? "Geography rebalanced to match national (scales up)"
                    : "National recomputed from sum (only when coverage is complete)"
              }
              aria-label={
                m === "hybrid"
                  ? "Sim values authoritative; geography shown as-is"
                  : m === "top-down"
                    ? "Geography rebalanced to match national (scales up)"
                    : "National recomputed from sum (only when coverage is complete)"
              }
              className={cn(
                "rounded-control-sm size-5",
                cn(
                  "focus-visible:ring-tint rounded-control-sm text-caption min-h-8 flex-1 px-2 py-2 capitalize transition-[color,background-color,box-shadow,transform] duration-150 outline-none focus-visible:ring-2",
                  mode === m ? "bg-surface text-label" : "text-label-secondary hover:text-label"
                )
              )}
            >
              {m}
            </Button>
          ))}
        </div>
        <p className="text-label-tertiary text-footnote">
          {mode === "hybrid"
            ? "Sim baseline; geography rolls up as-is."
            : mode === "top-down"
              ? "Geography scaled to match national totals."
              : "National recomputed from geographic sum (requires full coverage)."}
        </p>
      </div>

      {/* Rebase action */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleRebase}
        disabled={rebase.isPending}
      >
        {rebase.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {rebase.isPending ? "Rebasing…" : "Rebase National from Geography"}
      </Button>

      {/* Demographic Redistribution */}
      <div className="border-separator my-2 space-y-3 border-t pt-3">
        <div className="text-label text-caption flex items-center gap-1 font-semibold">
          <Settings className="h-3.5 w-3.5" />
          Demographic redistribution
        </div>
        <p className="text-label-tertiary text-footnote">
          Auto-assign populations and GDP to cities within each subdivision based on their
          province's totals and weights.
        </p>

        <div className="flex items-center gap-2">
          <Checkbox
            id="scaleExisting"
            checked={scaleExisting}
            onCheckedChange={(checked) => setScaleExisting(checked === true)}
          />
          <label
            htmlFor="scaleExisting"
            className="text-label-secondary text-caption cursor-pointer select-none"
          >
            Scale existing populations proportionally (if non-zero)
          </label>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleDistribute}
          disabled={distribute.isPending}
        >
          {distribute.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {distribute.isPending ? "Distributing…" : "Distribute Populations to Cities"}
        </Button>
      </div>
    </div>
  );
}

function CoverageMeter({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color = clamped >= 100 ? "bg-green" : clamped >= 50 ? "bg-yellow" : "bg-destructive";
  return (
    <div>
      <div className="text-label-secondary text-footnote flex items-center justify-between">
        <span>{label}</span>
        <span className="text-label-secondary tabular-nums">{clamped}%</span>
      </div>
      <Progress value={clamped} className="mt-0.5 h-1.5" indicatorClassName={color} />
    </div>
  );
}
