"use client";

import React, { useMemo } from "react";
import {
  Globe,
  Users,
  DollarSign,
  Landmark,
  MapPin,
  ChevronDown,
  Flag,
  TrendingUp,
  Building2,
  Coins,
  Activity,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { DistortedGlass } from "~/components/ui/distorted-glass";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { formatCompactNumber, formatCompactCurrency } from "~/lib/format-utils";
import { CountryPreview } from "../primitives/CountryPreview";
import { BUILDER_SECTION_THEMES, type BuilderSection } from "../lib/builder-theme";
import { useBuilderActions } from "../hooks/useBuilderActions";

import { TooltipProvider } from "~/components/ui/tooltip";
import { HealthRing } from "~/components/ui/health-ring";
import { Badge } from "~/components/ui/badge";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import {
  detectSynergies as detectGovSynergies,
  detectConflicts as detectGovConflicts,
  calculateGovernmentEffectiveness,
} from "~/lib/atomic-government-utils";
import { ComponentType as GovComponentType } from "@prisma/client";

interface BuilderPreviewWidgetProps {
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
  activeSection?: BuilderSection;
}

function AttributeSlider({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[9px] font-semibold text-zinc-400">
        <span>{label}</span>
        <span style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded border border-white/5 bg-zinc-900/60 p-[1px]">
        <div
          className="h-full rounded transition-all duration-500 ease-out"
          style={{
            width: `${value}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

const sectionThemeTextClasses: Record<BuilderSection, string> = {
  foundation: "text-amber-400 border-amber-500/30",
  identity: "text-teal-400 border-teal-500/30",
  government: "text-cyan-400 border-cyan-500/30",
  economics: "text-emerald-400 border-emerald-500/30",
  preview: "text-amber-400 border-amber-500/30",
  import: "text-blue-400 border-blue-500/30",
};

export function BuilderPreviewWidget({
  heroCollapsed,
  onHeroExpand,
  activeSection,
}: BuilderPreviewWidgetProps) {
  const {
    builderState,
    setBuilderState,
    mode,
    foundationPreviewCountry,
    setFoundationPreviewCountry,
    updateStep,
    submitFn,
    isSubmittingGlobal,
  } = useBuilderContext();
  const foundationFilter = useBuilderFilter();
  const { handleContinue, handlePreviousStep } = useBuilderActions({
    builderState,
    setBuilderState,
    mode,
  });
  const isBackDisabled =
    activeSection === "foundation" || (mode === "edit" && activeSection === "identity");
  const isLastStep = activeSection === "preview";
  const { economicInputs, selectedCountry } = builderState;
  const { setPreviewWidgetHeight } = foundationFilter;

  const sectionTheme = activeSection ? BUILDER_SECTION_THEMES[activeSection] : null;
  const themeTextColor = activeSection
    ? sectionThemeTextClasses[activeSection]?.split(" ")[0] || "text-zinc-400"
    : "text-zinc-400";

  const economicHealthMetrics = useMemo(() => {
    return {
      gdpGrowthRate: 3.2,
      inflationRate: 2.1,
      unemploymentRate: builderState.economyBuilderState?.laborMarket?.unemploymentRate ?? 5.0,
      competitivenessScore: 78,
      innovationIndex:
        65 + (builderState.economyBuilderState?.selectedAtomicComponents?.length ?? 0) * 2,
      productivityIndex:
        70 + (builderState.economyBuilderState?.selectedAtomicComponents?.length ?? 0) * 1.5,
    };
  }, [
    builderState.economyBuilderState?.laborMarket?.unemploymentRate,
    builderState.economyBuilderState?.selectedAtomicComponents?.length,
  ]);

  const econMetrics = useMemo(() => {
    const selectedComponents = builderState.economyBuilderState?.selectedAtomicComponents || [];
    const components = selectedComponents
      .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type]!)
      .filter(Boolean);

    const overallEffectiveness =
      components.length > 0
        ? components.reduce((sum, c) => sum + c.effectiveness, 0) / components.length
        : 0;

    const realEconomicHealth = economicHealthMetrics
      ? (economicHealthMetrics.competitivenessScore +
          economicHealthMetrics.innovationIndex +
          economicHealthMetrics.productivityIndex) /
        3
      : 0;

    const taxImpact = components.reduce(
      (acc, c) => ({
        corporateRate: acc.corporateRate + c.taxImpact.optimalCorporateRate,
        incomeRate: acc.incomeRate + c.taxImpact.optimalIncomeRate,
        vatRate: acc.vatRate + 15,
      }),
      { corporateRate: 0, incomeRate: 0, vatRate: 0 }
    );

    const avgTaxImpact =
      components.length > 0
        ? {
            corporateRate: taxImpact.corporateRate / components.length,
            incomeRate: taxImpact.incomeRate / components.length,
            vatRate: taxImpact.vatRate / components.length,
          }
        : { corporateRate: 0, incomeRate: 0, vatRate: 0 };

    const allSynergies = new Set<string>();
    const allConflicts = new Set<string>();

    const governmentComponents =
      builderState.governmentComponents?.map((c: any) =>
        c && typeof c === "string" ? c : c?.id || c?.name || ""
      ) || [];

    components.forEach((comp) => {
      comp.synergies.forEach((syn) => {
        if (selectedComponents.includes(syn)) allSynergies.add(`${comp.id}-${syn}`);
      });
      comp.conflicts.forEach((conf) => {
        if (selectedComponents.includes(conf)) allConflicts.add(`${comp.id}-${conf}`);
      });

      if (governmentComponents && governmentComponents.length > 0) {
        governmentComponents.forEach((govComp) => {
          if (comp.governmentSynergies?.includes(govComp)) {
            allSynergies.add(`${comp.id}-${govComp}`);
          }
          if (comp.governmentConflicts?.includes(govComp)) {
            allConflicts.add(`${comp.id}-${govComp}`);
          }
        });
      }
    });

    const synergyBonus = allSynergies.size * 2;
    const conflictPenalty = allConflicts.size * 3;

    const governmentAlignment =
      governmentComponents.length > 0 ? 70 + allSynergies.size * 5 - allConflicts.size * 5 : 0;
    const taxAlignment = 82;
    const crossBuilderScore =
      governmentComponents.length > 0
        ? Math.max(0, Math.min(100, (governmentAlignment + taxAlignment) / 2))
        : 0;

    const calculatedScore = Math.max(
      0,
      Math.min(100, overallEffectiveness + synergyBonus - conflictPenalty)
    );
    const finalScore = realEconomicHealth > 0 ? realEconomicHealth : calculatedScore;

    return {
      overallEffectiveness,
      crossBuilderScore,
      economicHealth: finalScore,
      taxImpact: avgTaxImpact,
      gdpGrowthRate: economicHealthMetrics?.gdpGrowthRate || 0,
      inflationRate: economicHealthMetrics?.inflationRate || 0,
      unemploymentRate: economicHealthMetrics?.unemploymentRate || 0,
    };
  }, [
    builderState.economyBuilderState?.selectedAtomicComponents,
    builderState.governmentComponents,
    economicHealthMetrics,
  ]);

  const govMetrics = useMemo(() => {
    const governmentComponents =
      builderState.governmentComponents?.map((c: any) =>
        c && typeof c === "string" ? c : c?.id || c?.name || ""
      ) || [];

    const govComps = governmentComponents as GovComponentType[];
    const effectivenessMetrics = calculateGovernmentEffectiveness(govComps);
    const synergies = detectGovSynergies(govComps);
    const conflicts = detectGovConflicts(govComps);

    let legitimacy = 50;
    if (govComps.includes("ELECTORAL_LEGITIMACY" as GovComponentType)) legitimacy += 15;
    if (govComps.includes("TRADITIONAL_LEGITIMACY" as GovComponentType)) legitimacy += 10;
    if (govComps.includes("PERFORMANCE_LEGITIMACY" as GovComponentType)) legitimacy += 15;
    if (govComps.includes("CHARISMATIC_LEGITIMACY" as GovComponentType)) legitimacy += 10;
    if (govComps.includes("RELIGIOUS_LEGITIMACY" as GovComponentType)) legitimacy += 10;

    legitimacy -= conflicts.length * 5;
    if (govComps.includes("MILITARY_ENFORCEMENT" as GovComponentType)) legitimacy -= 12;
    if (govComps.includes("SURVEILLANCE_SYSTEM" as GovComponentType)) legitimacy -= 8;
    legitimacy = Math.min(100, Math.max(0, legitimacy));

    const allocations = builderState.governmentStructure?.budgetAllocations || [];
    const totalAllocatedPercent = allocations.reduce(
      (sum: number, a: any) => sum + (a.allocatedPercent || 0),
      0
    );
    const budgetHealth = Math.max(0, 100 - Math.abs(100 - totalAllocatedPercent));

    let efficiency = 50;
    if (govComps.includes("PROFESSIONAL_BUREAUCRACY" as GovComponentType)) efficiency += 20;
    if (govComps.includes("TECHNOCRATIC_AGENCIES" as GovComponentType)) efficiency += 15;
    if (govComps.includes("PARTISAN_INSTITUTIONS" as GovComponentType)) efficiency -= 15;
    if (govComps.includes("MILITARY_ADMINISTRATION" as GovComponentType)) efficiency -= 10;
    const deptCount = builderState.governmentStructure?.departments?.length || 0;
    if (deptCount > 8) {
      efficiency -= (deptCount - 8) * 3;
    }
    efficiency = Math.min(100, Math.max(10, efficiency));

    let stability = 60;
    stability += synergies.length * 8;
    stability -= conflicts.length * 12;
    if (govComps.includes("RULE_OF_LAW" as GovComponentType)) stability += 15;
    if (govComps.includes("MILITARY_ENFORCEMENT" as GovComponentType)) stability += 10;
    stability = Math.min(100, Math.max(5, stability));

    const overallSystemScore =
      (legitimacy + effectivenessMetrics.totalEffectiveness + budgetHealth) / 3;

    return {
      legitimacy,
      effectiveness: effectivenessMetrics.totalEffectiveness,
      budgetHealth,
      overallScore: overallSystemScore,
      administrativeEfficiency: efficiency,
      politicalStability: stability,
      synergyCount: synergies.length,
      conflictCount: conflicts.length,
    };
  }, [builderState.governmentComponents, builderState.governmentStructure]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rectHeight = el.getBoundingClientRect().height;
        if (rectHeight > 0) {
          setPreviewWidgetHeight(rectHeight);
        }
      }
    });

    observer.observe(el);
    const initialHeight = el.getBoundingClientRect().height;
    if (initialHeight > 0) {
      setPreviewWidgetHeight(initialHeight);
    }

    return () => {
      observer.disconnect();
      setPreviewWidgetHeight(0);
    };
  }, [setPreviewWidgetHeight]);

  const previewCountry = foundationPreviewCountry || foundationFilter.selectedTemplate;

  // On foundation step: hide country preview until a country is clicked
  if (activeSection === "foundation" && !previewCountry) {
    return (
      <div ref={containerRef} className="w-56">
        <CutoutCard
          className={cn(cutoutCardSurfaceClassName, "group w-56 overflow-hidden rounded-xl")}
          trackPointerHover={false}
          texture="dots"
          textureOpacity={0.06}
        >
          <DistortedGlass asBackground className="bg-black/20" />
          <div className="flex min-h-[80px] items-center justify-center">
            <span className="text-xs text-zinc-500">Select a country to preview</span>
          </div>
          {heroCollapsed && onHeroExpand && (
            <CutoutCardContent className="p-3 pt-1">
              <button
                onClick={onHeroExpand}
                className="text-muted-foreground hover:text-foreground bg-muted/40 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold transition-colors"
              >
                <ChevronDown className="h-3 w-3 shrink-0" />
                Expand Header
              </button>
            </CutoutCardContent>
          )}
        </CutoutCard>
      </div>
    );
  }

  // Show live preview when hovering/clicking a country in the foundation grid
  if (activeSection === "foundation" && previewCountry) {
    const flagUrl = previewCountry.flag || previewCountry.flagUrl;
    return (
      <div ref={containerRef} className="w-56">
        <CutoutCard
          className={cn(cutoutCardSurfaceClassName, "group w-56 overflow-hidden rounded-xl")}
          trackPointerHover={false}
          texture="dots"
          textureOpacity={0.06}
        >
          <DistortedGlass asBackground className="bg-black/20" />

          {/* Cutout tab header with background flag (matches rest of builder) */}
          <div className="relative flex h-28 w-full flex-col items-center justify-center overflow-hidden bg-blue-500/10 px-3 pt-3 pb-6">
            {flagUrl ? (
              <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
                <UnifiedCountryFlag
                  countryName={previewCountry.name}
                  flagUrl={flagUrl}
                  fitContainer={true}
                  showTooltip={false}
                  rounded={false}
                  className="h-full w-full object-cover opacity-75 brightness-75 transition-all duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 z-10 bg-black/45" />
              </div>
            ) : (
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-white/[0.02]">
                <Globe className="h-8 w-8 text-white/10" />
              </div>
            )}

            {/* Live activity indicator badge */}
            <span className="absolute top-2 left-2 z-20 rounded bg-blue-500/80 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
              {foundationPreviewCountry ? "Live Preview" : "Selected Base"}
            </span>

            <span
              className={cn(
                "relative z-20 line-clamp-2 rounded-md border bg-black/60 px-3 py-1.5 text-center text-xs font-bold tracking-wider uppercase shadow-md backdrop-blur-sm",
                activeSection
                  ? sectionThemeTextClasses[activeSection]
                  : "border-white/10 text-zinc-100"
              )}
            >
              {previewCountry.name}
            </span>

            <CutoutCorner className="text-card absolute -bottom-px left-0 z-20" size={16} />
            <CutoutCorner
              className="text-card absolute right-0 -bottom-px z-20 -scale-x-100"
              size={16}
            />
          </div>

          <CutoutCardContent className="space-y-3 p-3 pt-2">
            <CountryPreview country={previewCountry} size="small" />

            <div className="flex gap-2 border-t border-white/5 pt-2">
              <button
                onClick={() => {
                  if (foundationFilter.selectedTemplate) {
                    // Go back from Part 2 to Part 1
                    foundationFilter.setSoftSelectedCountry(foundationFilter.selectedTemplate);
                    foundationFilter.setNewCountryName(foundationFilter.selectedTemplate.name);
                    foundationFilter.setSelectedTemplate(null);
                    setFoundationPreviewCountry(foundationFilter.selectedTemplate);
                  } else {
                    // Deselect in Part 1
                    foundationFilter.clearSelection();
                    setFoundationPreviewCountry(null);
                  }
                }}
                className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-white/5 py-1.5 text-center text-[10px] font-bold text-zinc-300 transition-all hover:bg-white/10 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (foundationFilter.softSelectedCountry) {
                    if (foundationFilter.confirmHandlerRef.current) {
                      foundationFilter.confirmHandlerRef.current();
                    }
                  } else if (previewCountry) {
                    updateStep("foundation", previewCountry);
                  }
                }}
                disabled={
                  !!(
                    foundationFilter.softSelectedCountry && !foundationFilter.newCountryName.trim()
                  )
                }
                className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1.5 text-center text-[10px] font-bold text-zinc-950 shadow-md transition-all hover:from-amber-400 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>
    );
  }

  const countryName = economicInputs?.countryName || selectedCountry?.name || "Unnamed Nation";
  const flagUrl = economicInputs?.flagUrl || selectedCountry?.flag;

  // Stats
  const population =
    economicInputs?.coreIndicators?.totalPopulation ?? selectedCountry?.population ?? null;
  const gdpPerCapita =
    economicInputs?.coreIndicators?.gdpPerCapita ?? selectedCountry?.gdpPerCapita ?? null;
  const nominalGdp =
    population && gdpPerCapita ? population * gdpPerCapita : (selectedCountry?.gdp ?? null);
  const governmentType =
    economicInputs?.nationalIdentity?.governmentType ||
    selectedCountry?.governmentType ||
    "Not configured";
  const location =
    economicInputs?.geography?.continent || selectedCountry?.continent || "Not selected";

  // ─── Subsystem Status Calculations ───
  const symbolsConfigured = !!(
    economicInputs?.flagUrl ||
    economicInputs?.coatOfArmsUrl ||
    selectedCountry?.flag
  );

  const corePop = economicInputs?.coreIndicators?.totalPopulation;
  const coreGdpPc = economicInputs?.coreIndicators?.gdpPerCapita;
  const coreConfigured = !!(corePop && coreGdpPc);
  const coreStatusText = coreConfigured
    ? `Pop: ${corePop >= 1e9 ? (corePop / 1e9).toFixed(1) + "B" : corePop >= 1e6 ? (corePop / 1e6).toFixed(1) + "M" : corePop.toLocaleString()} | GDP: $${coreGdpPc >= 1e3 ? Math.round(coreGdpPc / 1e3).toLocaleString() + "k" : Math.round(coreGdpPc)}`
    : "Pending";

  const govAtoms = builderState.governmentComponents?.length || 0;
  const govDepts = builderState.governmentStructure?.departments?.length || 0;
  const govConfigured = govAtoms > 0 || govDepts > 0;
  const govStatusText = govConfigured
    ? `${govAtoms > 0 ? govAtoms + " Atoms" : ""}${govAtoms > 0 && govDepts > 0 ? " | " : ""}${govDepts > 0 ? govDepts + " Depts" : ""}`
    : "Pending";

  const taxCats = builderState.taxSystemData?.categories?.length || 0;
  const taxConfigured = !!(builderState.taxSystemData?.taxSystem || taxCats > 0);
  const taxStatusText = taxConfigured
    ? `${builderState.taxSystemData?.taxSystem?.progressiveTax ? "Progressive" : "Flat"}${taxCats > 0 ? ` | ${taxCats} Cats` : ""}`
    : "Pending";

  return (
    <TooltipProvider>
      <div ref={containerRef} className="w-56">
        <CutoutCard
          className={cn(cutoutCardSurfaceClassName, "group w-56 overflow-hidden rounded-xl")}
          trackPointerHover={false}
          texture="dots"
          textureOpacity={0.06}
        >
          <DistortedGlass asBackground className="bg-black/20" />
          {/* Cutout tab header with background flag */}
          <div className="relative flex h-40 w-full flex-col items-center justify-center overflow-hidden bg-blue-500/10 px-3 pt-3 pb-6">
            {flagUrl ? (
              <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
                <UnifiedCountryFlag
                  countryName={countryName}
                  flagUrl={flagUrl}
                  fitContainer={true}
                  showTooltip={false}
                  rounded={false}
                  className="h-full w-full object-cover opacity-75 brightness-75 transition-all duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 z-10 bg-black/45" />
              </div>
            ) : (
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-white/[0.02]">
                <Globe className="h-8 w-8 text-white/10" />
              </div>
            )}

            <span
              className={cn(
                "relative z-20 line-clamp-2 rounded-md border bg-black/60 px-3 py-1.5 text-center text-xs font-bold tracking-wider uppercase shadow-md backdrop-blur-sm",
                activeSection
                  ? sectionThemeTextClasses[activeSection]
                  : "border-white/10 text-zinc-100"
              )}
            >
              {countryName}
            </span>

            <CutoutCorner className="text-card absolute -bottom-px left-0 z-20" size={16} />
            <CutoutCorner
              className="text-card absolute right-0 -bottom-px z-20 -scale-x-100"
              size={16}
            />
          </div>

          <CutoutCardContent className="space-y-2.5 p-3 pt-1">
            {heroCollapsed && onHeroExpand && (
              <div className="border-border/40 border-b pb-1.5">
                <button
                  onClick={onHeroExpand}
                  className="text-muted-foreground hover:text-foreground bg-muted/40 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold transition-colors"
                >
                  <ChevronDown className="h-3 w-3 shrink-0" />
                  Expand Header
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              {/* Population */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                  <Users className="h-3 w-3 text-blue-500/80" /> Population
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {population !== null ? formatCompactNumber(population) : "—"}
                </span>
              </div>

              {/* GDP Per Capita */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                  <DollarSign className="h-3 w-3 text-emerald-500/80" /> GDP / Capita
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {gdpPerCapita !== null ? formatCompactCurrency(gdpPerCapita) : "—"}
                </span>
              </div>

              {/* Nominal GDP */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                  <Globe className="h-3 w-3 text-indigo-500/80" /> Nominal GDP
                </span>
                <span className="text-foreground text-[10px] font-semibold">
                  {nominalGdp !== null ? formatCompactCurrency(nominalGdp) : "—"}
                </span>
              </div>

              {/* Government */}
              <div className="border-border/40 flex items-center justify-between gap-2 border-t pt-1.5">
                <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[10px]">
                  <Landmark className="h-3 w-3 text-cyan-500/80" /> Government
                </span>
                <span
                  className="text-foreground max-w-[100px] truncate text-[10px] font-semibold"
                  title={governmentType}
                >
                  {governmentType}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[10px]">
                  <MapPin className="h-3 w-3 text-cyan-500/80" /> Region
                </span>
                <span
                  className="text-foreground max-w-[100px] truncate text-[10px] font-semibold"
                  title={location}
                >
                  {location}
                </span>
              </div>
            </div>

            {/* Government Health Section */}
            {(activeSection === "government" || activeSection === "preview") && (
              <div className="border-border/40 space-y-2 border-t pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-black tracking-wider uppercase">
                    <Activity className="h-2.5 w-2.5 text-cyan-400" />
                    Gov Health
                  </span>
                  <span className="text-[10px] font-bold text-cyan-400">
                    {govMetrics.overallScore.toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 justify-items-center gap-1 pt-1.5">
                  <div className="flex flex-col items-center gap-1">
                    <HealthRing
                      value={govMetrics.legitimacy}
                      size={40}
                      color="#06b6d4"
                      label="Legitimacy"
                      tooltip={`Legitimacy: ${govMetrics.legitimacy.toFixed(1)}% - Public alignment and democratic mandate`}
                    />
                    <span
                      className={cn(
                        "max-w-[50px] truncate text-[8px] font-medium transition-colors",
                        themeTextColor
                      )}
                    >
                      Legitimacy
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <HealthRing
                      value={govMetrics.effectiveness}
                      size={40}
                      color="#8b5cf6"
                      label="Effectiveness"
                      tooltip={`Effectiveness: ${govMetrics.effectiveness.toFixed(1)}% - Policy cohesion and executive capability`}
                    />
                    <span
                      className={cn(
                        "max-w-[50px] truncate text-[8px] font-medium transition-colors",
                        themeTextColor
                      )}
                    >
                      Effectiveness
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <HealthRing
                      value={govMetrics.budgetHealth}
                      size={40}
                      color="#f59e0b"
                      label="Budget"
                      tooltip={`Budget Health: ${govMetrics.budgetHealth.toFixed(1)}% - Match accuracy of allocations to total budget`}
                    />
                    <span
                      className={cn(
                        "max-w-[50px] truncate text-[8px] font-medium transition-colors",
                        themeTextColor
                      )}
                    >
                      Budget
                    </span>
                  </div>
                </div>

                {/* Sliders / Governance Attributes */}
                <div className="border-border/10 space-y-1.5 border-t pt-2">
                  <AttributeSlider
                    label="Admin Efficiency"
                    value={govMetrics.administrativeEfficiency}
                    color="#3b82f6"
                  />
                  <AttributeSlider
                    label="Political Stability"
                    value={govMetrics.politicalStability}
                    color="#ec4899"
                  />
                </div>

                {/* Synergies & Conflicts */}
                <div className="flex items-center justify-between pt-2 text-[9px]">
                  <div className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className="h-4 border-emerald-500/20 bg-emerald-500/5 px-1 py-0 text-[8px] text-emerald-400"
                    >
                      {govMetrics.synergyCount} Syn
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-4 px-1 py-0 text-[8px]",
                        govMetrics.conflictCount > 0
                          ? "border-red-500/25 bg-red-500/10 text-red-400"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-500"
                      )}
                    >
                      {govMetrics.conflictCount} Con
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Economics Health Section */}
            {(activeSection === "economics" || activeSection === "preview") && (
              <div className="border-border/40 space-y-2 border-t pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-black tracking-wider uppercase">
                    <Activity className="h-2.5 w-2.5 text-emerald-400" />
                    Econ Health
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">
                    {econMetrics.economicHealth.toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 justify-items-center gap-1 pt-1.5">
                  <div className="flex flex-col items-center gap-1">
                    <HealthRing
                      value={econMetrics.economicHealth}
                      size={40}
                      color="#22c55e"
                      label="Econ Health"
                      tooltip={`Economic Health: ${econMetrics.economicHealth.toFixed(1)}%`}
                    />
                    <span
                      className={cn(
                        "max-w-[50px] truncate text-[8px] font-medium transition-colors",
                        themeTextColor
                      )}
                    >
                      Health
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <HealthRing
                      value={econMetrics.crossBuilderScore}
                      size={40}
                      color="#3b82f6"
                      label="Integration"
                      tooltip={`Integration Score: ${econMetrics.crossBuilderScore.toFixed(1)}%`}
                    />
                    <span
                      className={cn(
                        "max-w-[50px] truncate text-[8px] font-medium transition-colors",
                        themeTextColor
                      )}
                    >
                      Integration
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <HealthRing
                      value={econMetrics.overallEffectiveness}
                      size={40}
                      color="#a855f7"
                      label="Component Quality"
                      tooltip={`Component Quality: ${econMetrics.overallEffectiveness.toFixed(1)}%`}
                    />
                    <span
                      className={cn(
                        "max-w-[50px] truncate text-[8px] font-medium transition-colors",
                        themeTextColor
                      )}
                    >
                      Quality
                    </span>
                  </div>
                </div>

                {/* Economic Indicators */}
                <div className="border-border/10 space-y-1.5 border-t pt-2">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400">GDP Growth</span>
                    <span
                      className={cn(
                        "font-semibold",
                        econMetrics.gdpGrowthRate > 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {econMetrics.gdpGrowthRate > 0 ? "+" : ""}
                      {econMetrics.gdpGrowthRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400">Inflation</span>
                    <span
                      className={cn(
                        "font-semibold",
                        econMetrics.inflationRate <= 2
                          ? "text-green-400"
                          : econMetrics.inflationRate <= 4
                            ? "text-yellow-400"
                            : "text-red-400"
                      )}
                    >
                      {econMetrics.inflationRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400">Unemployment</span>
                    <span
                      className={cn(
                        "font-semibold",
                        econMetrics.unemploymentRate < 5
                          ? "text-green-400"
                          : econMetrics.unemploymentRate < 10
                            ? "text-yellow-400"
                            : "text-red-400"
                      )}
                    >
                      {econMetrics.unemploymentRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Tax Recommendations */}
                <div className="border-border/10 space-y-1 border-t pt-2">
                  <div className="text-[8px] font-bold tracking-wider text-zinc-400 uppercase">
                    Tax Optimal Rates
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="bg-zinc-850/50 rounded border border-white/5 p-1 text-center">
                      <div className="text-[8px] text-zinc-500">Corp</div>
                      <div className="text-[9px] font-semibold text-zinc-300">
                        {econMetrics.taxImpact.corporateRate.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-zinc-850/50 rounded border border-white/5 p-1 text-center">
                      <div className="text-[8px] text-zinc-500">Income</div>
                      <div className="text-[9px] font-semibold text-zinc-300">
                        {econMetrics.taxImpact.incomeRate.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-zinc-850/50 rounded border border-white/5 p-1 text-center">
                      <div className="text-[8px] text-zinc-500">VAT</div>
                      <div className="text-[9px] font-semibold text-zinc-300">
                        {econMetrics.taxImpact.vatRate.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {heroCollapsed && (
              <div className="border-border/40 space-y-1.5 border-t pt-2.5">
                <div className="text-muted-foreground text-[9px] font-black tracking-wider uppercase">
                  Subsystems
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Symbols */}
                  <div
                    className="border-border/20 flex items-center justify-between gap-1 rounded border bg-black/10 p-1.5 transition-colors hover:bg-black/20"
                    title={`Symbols: ${symbolsConfigured ? "Configured" : "Pending"}`}
                  >
                    <span className="text-muted-foreground flex items-center gap-1 text-[8px] font-bold">
                      <Flag
                        className={cn(
                          "h-2.5 w-2.5",
                          symbolsConfigured ? "text-teal-400" : "text-muted-foreground/40"
                        )}
                      />
                      Symbols
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-[1.5px]",
                        symbolsConfigured ? "bg-emerald-500" : "bg-zinc-700"
                      )}
                    />
                  </div>

                  {/* Core */}
                  <div
                    className="border-border/20 flex items-center justify-between gap-1 rounded border bg-black/10 p-1.5 transition-colors hover:bg-black/20"
                    title={`Core Metrics: ${coreStatusText}`}
                  >
                    <span className="text-muted-foreground flex items-center gap-1 text-[8px] font-bold">
                      <TrendingUp
                        className={cn(
                          "h-2.5 w-2.5",
                          coreConfigured ? "text-blue-400" : "text-muted-foreground/40"
                        )}
                      />
                      Core
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-[1.5px]",
                        coreConfigured ? "bg-emerald-500" : "bg-zinc-700"
                      )}
                    />
                  </div>

                  {/* Government */}
                  <div
                    className="border-border/20 flex items-center justify-between gap-1 rounded border bg-black/10 p-1.5 transition-colors hover:bg-black/20"
                    title={`Government: ${govStatusText}`}
                  >
                    <span className="text-muted-foreground flex items-center gap-1 text-[8px] font-bold">
                      <Building2
                        className={cn(
                          "h-2.5 w-2.5",
                          govConfigured ? "text-cyan-400" : "text-muted-foreground/40"
                        )}
                      />
                      Gov
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-[1.5px]",
                        govConfigured ? "bg-emerald-500" : "bg-zinc-700"
                      )}
                    />
                  </div>

                  {/* Tax */}
                  <div
                    className="border-border/20 flex items-center justify-between gap-1 rounded border bg-black/10 p-1.5 transition-colors hover:bg-black/20"
                    title={`Tax Policy: ${taxStatusText}`}
                  >
                    <span className="text-muted-foreground flex items-center gap-1 text-[8px] font-bold">
                      <Coins
                        className={cn(
                          "h-2.5 w-2.5",
                          taxConfigured ? "text-emerald-400" : "text-muted-foreground/40"
                        )}
                      />
                      Tax
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-[1.5px]",
                        taxConfigured ? "bg-emerald-500" : "bg-zinc-700"
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Back & Continue/Submit buttons for all other steps */}
            <div className="flex gap-2 border-t border-white/5 pt-2.5">
              <button
                onClick={handlePreviousStep}
                disabled={isBackDisabled}
                className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-white/5 py-1.5 text-center text-[10px] font-bold text-zinc-300 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Back
              </button>
              <button
                onClick={isLastStep ? () => submitFn?.() : handleContinue}
                disabled={isLastStep ? isSubmittingGlobal : false}
                className={cn(
                  "flex-1 cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-bold shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-55",
                  isLastStep
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400"
                    : "bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 hover:from-amber-400 hover:to-yellow-400"
                )}
              >
                {isLastStep
                  ? isSubmittingGlobal
                    ? "Submitting..."
                    : mode === "edit"
                      ? "Save Changes"
                      : "Create Nation"
                  : "Continue"}
              </button>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>
    </TooltipProvider>
  );
}
