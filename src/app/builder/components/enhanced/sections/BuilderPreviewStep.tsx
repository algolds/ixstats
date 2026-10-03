"use client";

import React, { useState, memo } from "react";
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
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PreviewSection
          id="identity"
          title="National identity"
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
          badge={`${governmentComponents.length} institutions`}
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

      <Card className="rounded-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <BarChart3 aria-hidden="true" className="text-label-secondary h-5 w-5" />
          <span className="text-label text-headline">
            {mode === "edit" ? "Country profile" : "Ready to create"}
          </span>
          <Badge
            variant="outline"
            className={readinessScore >= 80 ? "border-green/40 text-green-ink" : undefined}
          >
            <span className="tabular-nums">{readinessScore}%</span> complete
          </Badge>
        </div>

        <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-baseline gap-2">
            <span className="text-label font-semibold tabular-nums">
              {governmentComponents.length}
            </span>
            institutions
          </span>
          {populationLabel ? (
            <span className="flex items-baseline gap-2">
              <span className="text-label font-semibold tabular-nums">{populationLabel}</span>
              population
            </span>
          ) : null}
          <span className="flex items-baseline gap-2">
            <span className="text-label font-semibold">{currency}</span>
            currency
          </span>
        </div>
      </Card>
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

/** A collapsible preview card: a header button shows or hides the content. */
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
    <Card className="rounded-card overflow-hidden">
      <CardHeader className="p-0">
        <h2 className="m-0">
          <button
            type="button"
            onClick={() => onToggle(id)}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            data-cuelume-press="toggle"
            data-cuelume-hover="tick"
            className="border-separator hover:bg-fill-3 focus-visible:ring-tint flex min-h-11 w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-[background-color] duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="bg-fill-3 text-label-secondary flex size-7 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
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
        </h2>
      </CardHeader>
      {!collapsed && (
        <CardContent id={contentId} className="p-5">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

BuilderPreviewStep.displayName = "BuilderPreviewStep";
