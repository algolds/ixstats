"use client";

import React from "react";
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
import type { BuilderSection } from "../lib/builder-theme";

interface BuilderPreviewWidgetProps {
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
  activeSection?: BuilderSection;
}

export function BuilderPreviewWidget({
  heroCollapsed,
  onHeroExpand,
  activeSection,
}: BuilderPreviewWidgetProps) {
  const { builderState, foundationPreviewCountry } = useBuilderContext();
  const foundationFilter = useBuilderFilter();
  const { economicInputs, selectedCountry } = builderState;
  const { setPreviewWidgetHeight } = foundationFilter;

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
  if (previewCountry) {
    return (
      <div ref={containerRef} className="w-56">
        <CutoutCard
          className={cn(cutoutCardSurfaceClassName, "group w-56 overflow-hidden rounded-xl")}
          trackPointerHover={false}
          texture="dots"
          textureOpacity={0.06}
        >
          <DistortedGlass asBackground className="bg-black/20" />
          <div className="relative bg-blue-500/10 px-3 pt-2.5 pb-4">
            <div className="text-card-foreground flex items-center gap-1.5 text-[10px] font-bold">
              <Globe className="h-3 w-3 text-blue-400" />
              <span>{foundationPreviewCountry ? "Live Preview" : "Selected Base"}</span>
            </div>
            <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
            <CutoutCorner
              className="text-card absolute right-0 -bottom-px -scale-x-100"
              size={16}
            />
          </div>
          <CutoutCardContent className="p-3 pt-1">
            <CountryPreview country={previewCountry} size="small" />
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
    <div ref={containerRef} className="w-56">
      <CutoutCard
        className={cn(cutoutCardSurfaceClassName, "group w-56 overflow-hidden rounded-xl")}
        trackPointerHover={false}
        texture="dots"
        textureOpacity={0.06}
      >
        <DistortedGlass asBackground className="bg-black/20" />
        {/* Cutout tab header with background flag */}
        <div className="relative flex min-h-[80px] flex-col items-center justify-center overflow-hidden bg-blue-500/10 px-3 pt-3 pb-6">
          {flagUrl ? (
            <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
              <UnifiedCountryFlag
                countryName={countryName}
                flagUrl={flagUrl}
                fitContainer={true}
                showTooltip={false}
                rounded={false}
                className="h-full w-full object-cover opacity-45 brightness-75 transition-all duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
            </div>
          ) : (
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-indigo-600/10">
              <Globe className="h-8 w-8 text-blue-500/20" />
            </div>
          )}

          <span className="relative z-20 line-clamp-2 text-center text-xs font-bold tracking-wide text-zinc-100 drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)]">
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
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      symbolsConfigured
                        ? "bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-700"
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
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      coreConfigured
                        ? "bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-700"
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
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      govConfigured
                        ? "bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-700"
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
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      taxConfigured
                        ? "bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-700"
                    )}
                  />
                </div>
              </div>
            </div>
          )}
        </CutoutCardContent>
      </CutoutCard>
    </div>
  );
}
