"use client";

import React, { useState, memo } from "react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
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
import { PreviewIdentity, PreviewGovernment, PreviewEconomy } from "./preview";

/**
 * BuilderPreviewStep - Comprehensive preview of all builder configuration data.
 * Composes domain-specific preview sub-components into a balanced Bento layout.
 */
export const BuilderPreviewStep = memo(function BuilderPreviewStep() {
  const { builderState, mode } = useBuilderContext();

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

  const populationLabel = coreIndicators?.totalPopulation
    ? coreIndicators.totalPopulation >= 1e6
      ? `${(coreIndicators.totalPopulation / 1e6).toFixed(1)}M`
      : coreIndicators.totalPopulation.toLocaleString()
    : null;

  return (
    <div className="space-y-6">
      {/* ─── Row 1: Identity & Government (2-Col) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PreviewSection
          id="identity"
          title="National Identity"
          icon={Flag}
          badge={nationalIdentity?.countryName || "Unspecified"}
          collapsed={Boolean(collapsedSections.identity)}
          onToggle={toggleSection}
        >
          <PreviewIdentity economicInputs={economicInputs} />
        </PreviewSection>

        <PreviewSection
          id="government"
          title="Government"
          icon={Building2}
          badge={`${governmentComponents.length} Institutions`}
          collapsed={Boolean(collapsedSections.government)}
          onToggle={toggleSection}
        >
          <PreviewGovernment
            governmentStructure={builderState.governmentStructure}
            governmentComponents={governmentComponents}
            currency={currency}
          />
        </PreviewSection>
      </div>

      {/* ─── Row 2: Economy (Full Width) ─── */}
      <PreviewSection
        id="economy"
        title="Economy"
        icon={Factory}
        badge={coreIndicators ? "Configured" : "Default"}
        collapsed={Boolean(collapsedSections.economy)}
        onToggle={toggleSection}
      >
        <PreviewEconomy economicInputs={economicInputs} currency={currency} />
      </PreviewSection>

      {/* ─── Row 3: Ready to Create Strip ─── */}
      <FacetCard className="rounded-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <BarChart3 aria-hidden="true" className="text-label-secondary h-5 w-5" />
          <span className="text-label text-headline">
            {mode === "edit" ? "Country profile" : "Ready to Create"}
          </span>
          <Badge
            variant="outline"
            className={
              readinessScore >= 80 ? "border-green/40 text-green" : "border-tint/40 text-tint"
            }
          >
            {readinessScore}% Complete
          </Badge>
        </div>

        <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-label font-semibold tabular-nums">
              {governmentComponents.length}
            </span>
            Institutions
          </span>
          {populationLabel ? (
            <span className="flex items-baseline gap-1.5">
              <span className="text-label font-semibold tabular-nums">{populationLabel}</span>
              Population
            </span>
          ) : null}
          <span className="flex items-baseline gap-1.5">
            <span className="text-label font-semibold">{currency}</span>
            Currency
          </span>
        </div>
      </FacetCard>
    </div>
  );
});

interface PreviewSectionProps {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  badge: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

/** A collapsible preview card: FacetCard with a header button that shows/hides its content. */
function PreviewSection({
  id,
  title,
  icon: Icon,
  badge,
  collapsed,
  onToggle,
  children,
}: PreviewSectionProps) {
  const contentId = `builder-preview-${id}`;
  return (
    <FacetCard className="rounded-card overflow-hidden">
      <FacetCardHeader className="p-0">
        <h3 className="m-0">
          <button
            type="button"
            onClick={() => onToggle(id)}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            data-cuelume-press="toggle"
            data-cuelume-hover="tick"
            className="border-separator hover:bg-fill-3 focus-visible:ring-tint flex min-h-11 w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-[background-color] duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
              <span className="text-label text-headline">{title}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <Badge
                variant="secondary"
                className="max-w-[180px] truncate sm:max-w-[240px]"
                title={badge}
              >
                {badge}
              </Badge>
              {collapsed ? (
                <ChevronDown aria-hidden="true" className="text-label-secondary h-4 w-4" />
              ) : (
                <ChevronUp aria-hidden="true" className="text-label-secondary h-4 w-4" />
              )}
            </span>
          </button>
        </h3>
      </FacetCardHeader>
      {!collapsed && (
        <FacetCardContent id={contentId} className="p-5">
          {children}
        </FacetCardContent>
      )}
    </FacetCard>
  );
}

BuilderPreviewStep.displayName = "BuilderPreviewStep";
