"use client";

import React, { useState, memo } from "react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import {
  WhiteFlag as Flag,
  City as Building2,
  StatsReport as BarChart3,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  Industry as Factory,
} from "iconoir-react";
import { useBuilderContext } from "../context/BuilderStateContext";
import {
  PreviewIdentity,
  PreviewGovernment,
  PreviewEconomy,
} from "./preview";

/**
 * BuilderPreviewStep - Comprehensive preview of all builder configuration data.
 * Composes domain-specific preview sub-components into a balanced Bento layout.
 */
export const BuilderPreviewStep = memo(function BuilderPreviewStep() {
  const { builderState } = useBuilderContext();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const economicInputs = builderState.economicInputs;
  const nationalIdentity = economicInputs?.nationalIdentity;
  const coreIndicators = economicInputs?.coreIndicators;
  const governmentComponents = builderState.governmentComponents || [];
  const rawCurrency = nationalIdentity?.currency || "USD";
  const currencySymbol = nationalIdentity?.currencySymbol;
  const symbolMatch = rawCurrency.match(/\(([^)]+)\)/);
  const currency = currencySymbol || (symbolMatch ? symbolMatch[1].trim() : rawCurrency);

  // Compute readiness score across core pillars
  const readinessChecks = [
    Boolean(nationalIdentity?.countryName),
    Boolean(coreIndicators?.nominalGDP && coreIndicators.nominalGDP > 0),
    Boolean(coreIndicators?.totalPopulation && coreIndicators.totalPopulation > 0),
    governmentComponents.length > 0 || Boolean(builderState.governmentStructure),
  ];
  const passedChecks = readinessChecks.filter(Boolean).length;
  const readinessScore = Math.round((passedChecks / readinessChecks.length) * 100);

  return (
    <div className="space-y-6">
      {/* ─── Row 1: Identity & Government (2-Col) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. National Identity */}
        <FacetCard
          depth="base"
          theme="gold"
          className="border-amber-500/20"
          texture="chevron"
          textureOpacity={0.03}
        >
          <div
            onClick={() => toggleSection("identity")}
            className="flex cursor-pointer items-center justify-between border-b border-border/40 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Flag className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                National Identity
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="max-w-[180px] truncate border-amber-500/30 bg-amber-500/10 text-amber-700 sm:max-w-[240px] dark:text-amber-300"
                title={nationalIdentity?.countryName || "Unspecified"}
              >
                {nationalIdentity?.countryName || "Unspecified"}
              </Badge>
              {collapsedSections.identity ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {!collapsedSections.identity && (
            <FacetCardContent className="p-5">
              <PreviewIdentity economicInputs={economicInputs} />
            </FacetCardContent>
          )}
        </FacetCard>

        {/* 2. Government */}
        <FacetCard
          depth="base"
          theme="teal"
          className="border-cyan-500/20"
          texture="chevron"
          textureOpacity={0.03}
        >
          <div
            onClick={() => toggleSection("government")}
            className="flex cursor-pointer items-center justify-between border-b border-border/40 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Government</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
              >
                {governmentComponents.length} Institutions
              </Badge>
              {collapsedSections.government ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {!collapsedSections.government && (
            <FacetCardContent className="p-5">
              <PreviewGovernment
                governmentStructure={builderState.governmentStructure}
                governmentComponents={governmentComponents}
                currency={currency}
              />
            </FacetCardContent>
          )}
        </FacetCard>
      </div>

      {/* ─── Row 2: Economy (Full Width) ─── */}
      <FacetCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.03}
      >
        <div
          onClick={() => toggleSection("economy")}
          className="flex cursor-pointer items-center justify-between border-b border-border/40 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Factory className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Economy</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              {coreIndicators ? "Configured" : "Default"}
            </Badge>
            {collapsedSections.economy ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {!collapsedSections.economy && (
          <FacetCardContent className="p-5">
            <PreviewEconomy economicInputs={economicInputs} currency={currency} />
          </FacetCardContent>
        )}
      </FacetCard>

      {/* ─── Row 3: Ready to Create Strip ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card/50 p-4 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-foreground">Ready to Create</span>
            <Badge
              variant="outline"
              className={
                readinessScore >= 80
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }
            >
              {readinessScore}% Complete
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5">
            <span className="font-semibold text-foreground">{governmentComponents.length}</span>
            <span>Institutions</span>
          </div>
          {coreIndicators?.totalPopulation ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5">
              <span className="font-semibold text-foreground">
                {coreIndicators.totalPopulation >= 1e6
                  ? `${(coreIndicators.totalPopulation / 1e6).toFixed(1)}M`
                  : coreIndicators.totalPopulation.toLocaleString()}
              </span>
              <span>Population</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5">
            <span className="font-semibold text-foreground">{currency}</span>
            <span>Currency</span>
          </div>
        </div>
      </div>
    </div>
  );
});

BuilderPreviewStep.displayName = "BuilderPreviewStep";
