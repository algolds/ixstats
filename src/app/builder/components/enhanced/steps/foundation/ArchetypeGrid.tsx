"use client";

import React from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Sparks as Sparkles,
  Check,
  HelpCircle as CircleHelp,
  Search,
  InfoCircle as Info,
  Xmark as X,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { RealCountryData } from "~/app/builder/lib/economy-types";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import {
  containerVariants,
  itemVariants,
  stepVariants,
  getHighResFlagUrl,
  formatFullWordNumber,
  formatFullWordCurrency,
  getArchetypeIcon,
  getComplexityBadgeClass,
  getArchetypeColorClass,
} from "./foundationUtils";

interface ArchetypeGridProps {
  transitionDirection: number;
  selectedTemplate: RealCountryData | null;
  activeEra: "modern" | "historical";
  setActiveEra: (era: "modern" | "historical") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  complexityFilter: "all" | "Low" | "Medium" | "High";
  setComplexityFilter: (comp: "all" | "Low" | "Medium" | "High") => void;
  archetypes: EconomicArchetype[];
  filteredArchetypes: EconomicArchetype[];
  visibleArchetypes: EconomicArchetype[];
  isLoadingArchetypes: boolean;
  visibleCount: number;
  loaderRef: React.RefObject<HTMLDivElement | null>;
  localSelectedArchetype: EconomicArchetype | null;
  setLocalSelectedArchetype: (arch: EconomicArchetype | null) => void;
  onBackToBenchmark: () => void;
  onSkipArchetype: () => void;
  onOpenDetailsModal: (arch: EconomicArchetype) => void;
  onConfirmFaction: (arch?: EconomicArchetype) => void;
}

export function ArchetypeGrid({
  transitionDirection,
  selectedTemplate,
  activeEra,
  setActiveEra,
  searchQuery,
  setSearchQuery,
  complexityFilter,
  setComplexityFilter,
  archetypes,
  filteredArchetypes,
  visibleArchetypes,
  isLoadingArchetypes,
  visibleCount,
  loaderRef,
  localSelectedArchetype,
  setLocalSelectedArchetype,
  onBackToBenchmark,
  onSkipArchetype,
  onOpenDetailsModal,
  onConfirmFaction,
}: ArchetypeGridProps) {
  return (
    <motion.div
      key="substep-archetype"
      custom={transitionDirection}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="mx-auto max-w-6xl space-y-6 px-4 py-2"
    >
      {/* Sub-step 2 Header & Wayfinding */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToBenchmark}
              className="flex items-center gap-1.5 border-border/40 text-xs text-muted-foreground hover:text-foreground active:scale-[0.98]"
              data-cuelume-press
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Benchmark Country{selectedTemplate?.name ? ` (${selectedTemplate.name})` : ""}
            </Button>

            {/* Segmented Step Indicator */}
            <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-3.5 py-1 text-xs font-semibold backdrop-blur-md select-none">
              {selectedTemplate ? (
                <button
                  type="button"
                  onClick={onBackToBenchmark}
                  className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground cursor-pointer transition-colors"
                  title="Click to change benchmark country"
                  data-cuelume-press
                >
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Step 1: {selectedTemplate.name}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBackToBenchmark}
                  className="flex items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors"
                  title="Click to add a benchmark country"
                  data-cuelume-press
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  Step 1: Benchmark Country (Skipped)
                </button>
              )}
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Step 2: Archetype
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-2xl font-bold text-transparent">
                Archetype
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedTemplate ? (
                <>
                  Overlay a curated archetype onto <strong>{selectedTemplate.name}</strong>, or keep the real baseline.
                </>
              ) : (
                <>
                  Select an archetype to set up your country&apos;s starting economic policy and scale.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Actions & Filters Header Container */}
        <div className="flex shrink-0 items-center gap-3.5 self-start md:self-center">
          {/* Era Selector Tabs */}
          <div className="flex items-center rounded-lg border border-border/40 bg-card/50 p-1 shadow-xs backdrop-blur-md">
            <button
              onClick={() => {
                setActiveEra("modern");
                setLocalSelectedArchetype(null);
              }}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
                activeEra === "modern"
                  ? "bg-amber-500 font-bold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
              data-cuelume-press
            >
              Modern Archetypes
            </button>
            <button
              onClick={() => {
                setActiveEra("historical");
                setLocalSelectedArchetype(null);
              }}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
                activeEra === "historical"
                  ? "bg-amber-500 font-bold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
              data-cuelume-press
            >
              Historical Archetypes
            </button>
          </div>
        </div>
      </div>

      {/* Active Benchmark Overview Card or Benchmark Skipped Banner */}
      {selectedTemplate ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            {(selectedTemplate.flag || selectedTemplate.flagUrl) && (
              <img
                src={getHighResFlagUrl(selectedTemplate.flag || selectedTemplate.flagUrl) || undefined}
                alt={selectedTemplate.name}
                className="h-9 w-14 rounded-md object-cover shadow-xs border border-white/10"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Benchmark Country
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  {selectedTemplate.continent || selectedTemplate.region || "Global"}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-foreground tracking-tight">
                {selectedTemplate.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Population: {formatFullWordNumber(selectedTemplate.population)} • GDP: {formatFullWordCurrency(selectedTemplate.gdp)} • GDP per capita: ${selectedTemplate.gdpPerCapita ? selectedTemplate.gdpPerCapita.toLocaleString() : "0"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToBenchmark}
              className="text-xs border-border/40 text-muted-foreground hover:text-foreground active:scale-[0.98]"
              data-cuelume-press
            >
              Change Benchmark Country
            </Button>
            <Button
              size="sm"
              onClick={onSkipArchetype}
              className="bg-amber-500 hover:bg-amber-400 text-foreground font-bold text-xs shadow-md shadow-amber-500/20 active:scale-[0.98]"
              data-cuelume-press
            >
              Keep Real Baseline →
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  No Benchmark Country Selected
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                <span className="text-xs font-medium text-amber-400">
                  Default Demographic Scale
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Pure Archetype Foundation
              </h3>
              <p className="text-xs text-muted-foreground">
                Population: 10 million • Base GDP: $250 billion • Selected archetype sets economic structure and growth
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToBenchmark}
              className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 active:scale-[0.98]"
              data-cuelume-press
            >
              + Add Benchmark Country
            </Button>
          </div>
        </div>
      )}

      {/* Search & Complexity Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/40 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search archetypes by name, region, trait..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-border/40 bg-background/50 pl-8 pr-8 text-xs placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Complexity:
            </span>
            {(["all", "Low", "Medium", "High"] as const).map((comp) => (
              <button
                key={comp}
                type="button"
                onClick={() => setComplexityFilter(comp)}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95",
                  complexityFilter === comp
                    ? "bg-amber-500 font-bold text-foreground shadow-xs"
                    : "border border-border/40 bg-background/40 text-muted-foreground hover:text-foreground"
                )}
                data-cuelume-press
              >
                {comp === "all" ? "All" : comp}
              </button>
            ))}
          </div>

          <div className="text-muted-foreground shrink-0 text-xs font-semibold select-none">
            Showing {filteredArchetypes.length} of {archetypes.length} {activeEra === "modern" ? "Modern" : "Historical"} Presets
          </div>
        </div>
      </div>

      {isLoadingArchetypes ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Decoding faction templates...</p>
        </div>
      ) : filteredArchetypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No matching archetypes found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search query or complexity filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setComplexityFilter("all");
            }}
            className="mt-4 cursor-pointer rounded-lg border border-border/40 bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background active:scale-95"
            data-cuelume-press
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {visibleArchetypes.map((arch) => {
            const IconComponent = getArchetypeIcon(arch.id);
            const isSelected = localSelectedArchetype?.id === arch.id;
            const styleClasses = getArchetypeColorClass(arch.id);

            return (
              <motion.div
                key={arch.id}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                onClick={() => setLocalSelectedArchetype(arch)}
                className="h-full cursor-pointer"
              >
                <CutoutCard
                  className={cn(
                    cutoutCardSurfaceClassName,
                    "flex h-full flex-col justify-between overflow-hidden border transition-all duration-300",
                    isSelected
                      ? "border-amber-500 bg-amber-500/5 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/50 dark:bg-amber-500/10"
                      : "border-border hover:border-border/80"
                  )}
                  texture="dots"
                  textureOpacity={isSelected ? 0.08 : 0.03}
                >
                  <CutoutCardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            "rounded-lg border p-2",
                            styleClasses.split(" ")[1],
                            styleClasses.split(" ")[2]
                          )}
                        >
                          <IconComponent className={cn("h-5 w-5", styleClasses.split(" ")[0])} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetailsModal(arch);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-card/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-card/90 hover:text-foreground cursor-pointer active:scale-95"
                            title="View full preset details"
                            data-cuelume-press
                          >
                            <Info className="h-3 w-3" />
                            <span>Details</span>
                          </button>
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 font-bold text-foreground">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground transition-colors duration-200 group-hover:text-amber-500">
                          {arch.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <span className="rounded border border-border/60 bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                            {arch.region}
                          </span>
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                              getComplexityBadgeClass(arch.implementationComplexity)
                            )}
                          >
                            Complexity: {arch.implementationComplexity || "Medium"}
                          </span>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {arch.description}
                      </p>
                    </div>

                    {/* Faction traits / characteristics */}
                    <div className="space-y-2.5">
                      <div className="border-t border-border/40 pt-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                            Traits & Modifiers
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                                >
                                  <CircleHelp className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs border border-border/60 bg-card/95 px-3 py-2 text-[10px] text-foreground shadow-md backdrop-blur-md"
                              >
                                Traits & modifiers seed your country's starting bonuses, penalties,
                                and operational characteristics in the simulation.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(arch.characteristics || [])
                            .slice(0, 3)
                            .map((trait: string, idx: number) => (
                              <span
                                key={idx}
                                className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                              >
                                ✦ {trait}
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Stat Bars (Growth, Innovation, Stability) */}
                      {arch.growthMetrics && (
                        <div className="space-y-1.5 border-t border-border/40 pt-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                              Alignment Profile
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                                  >
                                    <CircleHelp className="h-3 w-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-xs border border-border/60 bg-card/95 px-3 py-2 text-[10px] text-foreground shadow-md backdrop-blur-md"
                                >
                                  The starting position of your country's values. Innovation
                                  represents reform/technology focus, while Stability represents
                                  order/institutions.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[9px] text-muted-foreground">
                                <span>Innovation</span>
                                <span>{arch.growthMetrics.innovationIndex || 50}%</span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-cyan-400"
                                  style={{
                                    width: `${arch.growthMetrics.innovationIndex || 50}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[9px] text-muted-foreground">
                                <span>Stability</span>
                                <span>{arch.growthMetrics.stability || 50}%</span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-emerald-400"
                                  style={{ width: `${arch.growthMetrics.stability || 50}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Action Buttons */}
                    <div className="mt-1 flex items-center gap-2 border-t border-border/40 pt-3">
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocalSelectedArchetype(arch);
                          onConfirmFaction(arch);
                        }}
                        size="sm"
                        className={cn(
                          "h-8 flex-1 cursor-pointer text-xs font-semibold transition-all active:scale-[0.98]",
                          isSelected
                            ? "border border-amber-500/40 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            : "bg-amber-500 font-bold text-foreground shadow-xs shadow-amber-500/20 hover:bg-amber-400"
                        )}
                        data-cuelume-press
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {isSelected ? "Model Selected" : "Select & Apply →"}
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetailsModal(arch);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-border/50 text-muted-foreground hover:bg-card/80 hover:text-foreground h-8 cursor-pointer text-xs font-medium active:scale-[0.98]"
                        data-cuelume-press
                      >
                        <Info className="mr-1.5 h-3.5 w-3.5" />
                        Details
                      </Button>
                    </div>
                  </CutoutCardContent>
                </CutoutCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Sentinel for infinite loading */}
      <div
        ref={loaderRef}
        className={cn(
          "flex justify-center py-8",
          (isLoadingArchetypes || visibleCount >= archetypes.length) && "hidden"
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border border-amber-500 border-t-transparent" />
          Loading more archetypes...
        </div>
      </div>
    </motion.div>
  );
}
