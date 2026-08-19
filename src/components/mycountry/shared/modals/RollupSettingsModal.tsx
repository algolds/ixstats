"use client";

import React, { useState } from "react";
import { BarChart3, Loader2, RefreshCw, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";

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
      ? "bg-emerald-600/20 text-emerald-500"
      : worst >= 50
        ? "bg-amber-600/20 text-amber-500"
        : "bg-red-600/20 text-red-500";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="border-border bg-card/40 hover:bg-card/70 flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors"
            aria-label="Open rollup settings"
          >
            <div className="flex items-center gap-2">
              <div className="bg-accent/60 rounded-md p-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-foreground text-xs font-semibold">Geographic Rollups</div>
                <div className="text-muted-foreground text-[10px]">
                  Mode: {geoRollupMode} · Pop {popPct}% · GDP {gdpPct}%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium ${coverageTone}`}
              >
                {worst}%
              </span>
              <Settings className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <BarChart3 className="h-4 w-4" />
            Geographic Rollups & Reconciliation
          </DialogTitle>
          <DialogDescription className="text-[11px]">
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
        <div className="text-muted-foreground/70 text-[10px]">
          City pop: {rollups.cityPopulationSum.toLocaleString()} · Sub pop:{" "}
          {rollups.subdivisionPopulationSum.toLocaleString()} · National:{" "}
          {nationalPopulation.toLocaleString()}
        </div>
        <div className="text-muted-foreground/70 text-[10px]">
          City GDP: {Math.round(rollups.cityGdpContributionSum).toLocaleString()} · Sub GDP:{" "}
          {Math.round(rollups.subdivisionGdpContributionSum).toLocaleString()} · National:{" "}
          {Math.round(nationalGdp).toLocaleString()}
        </div>
      </div>

      {/* Rollup mode selector */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-[10px] font-medium uppercase">
          Rollup Mode
        </label>
        <div className="bg-accent/50 flex rounded-lg p-0.5">
          {(["hybrid", "top-down", "bottom-up"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              disabled={updateMode.isPending}
              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors ${
                mode === m
                  ? "bg-background text-foreground ring-border shadow-sm ring-1"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={
                m === "hybrid"
                  ? "Sim values authoritative; geography shown as-is"
                  : m === "top-down"
                    ? "Geography rebalanced to match national (scales up)"
                    : "National recomputed from sum (only when coverage is complete)"
              }
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground/60 text-[10px]">
          {mode === "hybrid"
            ? "Sim baseline; geography rolls up as-is."
            : mode === "top-down"
              ? "Geography scaled to match national totals."
              : "National recomputed from geographic sum (requires full coverage)."}
        </p>
      </div>

      {/* Rebase action */}
      <button
        onClick={handleRebase}
        disabled={rebase.isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-2 text-xs font-medium text-amber-500 hover:bg-amber-600/30 disabled:opacity-50"
      >
        {rebase.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {rebase.isPending ? "Rebasing…" : "Rebase National from Geography"}
      </button>

      {/* Demographic Redistribution */}
      <div className="border-border/60 my-2 space-y-3 border-t pt-3">
        <div className="text-foreground flex items-center gap-1 text-[11px] font-semibold">
          <Settings className="h-3.5 w-3.5" />
          Demographic Redistribution
        </div>
        <p className="text-muted-foreground/60 text-[10px]">
          Auto-assign populations and GDP to cities within each subdivision based on their
          province's totals and weights.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="scaleExisting"
            checked={scaleExisting}
            onChange={(e) => setScaleExisting(e.target.checked)}
            className="border-border bg-background/50 text-primary h-3.5 w-3.5 cursor-pointer rounded focus:ring-0"
          />
          <label
            htmlFor="scaleExisting"
            className="text-muted-foreground cursor-pointer text-[10px] font-medium select-none"
          >
            Scale existing populations proportionally (if non-zero)
          </label>
        </div>

        <button
          type="button"
          onClick={handleDistribute}
          disabled={distribute.isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-500 transition-colors hover:bg-emerald-600/30 disabled:opacity-50"
        >
          {distribute.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {distribute.isPending ? "Distributing…" : "Distribute Populations to Cities"}
        </button>
      </div>
    </div>
  );
}

function CoverageMeter({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color = clamped >= 100 ? "bg-emerald-500" : clamped >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="text-muted-foreground flex items-center justify-between text-[10px]">
        <span>{label}</span>
        <span className="text-foreground/80 font-mono">{clamped}%</span>
      </div>
      <div className="bg-muted/30 mt-0.5 h-1.5 overflow-hidden rounded-full">
        <div className={`${color} h-full transition-all`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
