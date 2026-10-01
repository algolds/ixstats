"use client";

import React from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Sparks as Sparkles,
  Check,
  HelpCircle as CircleHelp,
  InfoCircle as Info,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { RealCountryData } from "~/app/builder/lib/economy-types";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
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
  getComplexityBadgeVariant,
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

const ERA_OPTIONS = [
  { value: "modern", label: "Modern Archetypes" },
  { value: "historical", label: "Historical Archetypes" },
] as const;

const COMPLEXITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
] as const;

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="More information"
            onClick={(e) => e.stopPropagation()}
            className="text-label-secondary hover:text-label cursor-pointer"
          >
            <CircleHelp aria-hidden className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
      <div className="border-separator flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <Button variant="bordered" size="sm" onClick={onBackToBenchmark}>
              <ArrowLeft aria-hidden /> Back to Benchmark Country
              {selectedTemplate?.name ? ` (${selectedTemplate.name})` : ""}
            </Button>

            {/* Step indicator */}
            <div className="border-separator bg-surface text-caption flex items-center gap-2 rounded-full border px-3 py-1 select-none">
              {selectedTemplate ? (
                <button
                  type="button"
                  onClick={onBackToBenchmark}
                  className="text-label-secondary hover:text-label flex cursor-pointer items-center gap-1 transition-colors"
                  title="Click to change benchmark country"
                >
                  <Check aria-hidden className="text-green size-3.5" />
                  Step 1: {selectedTemplate.name}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBackToBenchmark}
                  className="text-label-tertiary hover:text-label-secondary flex cursor-pointer items-center gap-1 transition-colors"
                  title="Click to add a benchmark country"
                >
                  <span aria-hidden className="bg-label-tertiary size-1.5 rounded-full" />
                  Step 1: Benchmark Country (Skipped)
                </button>
              )}
              <span aria-hidden className="text-label-tertiary">
                •
              </span>
              <span className="text-tint flex items-center gap-1">
                <span aria-hidden className="bg-tint size-2 rounded-full" />
                Step 2: Archetype
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-title-1 text-label">Archetype</h2>
            <p className="text-footnote text-label-secondary mt-0.5">
              {selectedTemplate ? (
                <>
                  Overlay a curated archetype onto <strong>{selectedTemplate.name}</strong>, or keep
                  the real baseline.
                </>
              ) : (
                <>
                  Select an archetype to set up your country&apos;s starting economic policy and
                  scale.
                </>
              )}
            </p>
          </div>
        </div>

        <SegmentedControl
          aria-label="Archetype era"
          size="sm"
          className="shrink-0 self-start md:self-center"
          value={activeEra}
          onValueChange={(era) => {
            setActiveEra(era);
            setLocalSelectedArchetype(null);
          }}
          options={ERA_OPTIONS}
        />
      </div>

      {/* Active Benchmark Overview Card or Benchmark Skipped Banner */}
      {selectedTemplate ? (
        <FacetCard className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {(selectedTemplate.flag || selectedTemplate.flagUrl) && (
              <img
                src={
                  getHighResFlagUrl(selectedTemplate.flag || selectedTemplate.flagUrl) || undefined
                }
                alt={selectedTemplate.name}
                className="border-separator rounded-control-sm h-9 w-14 border object-cover"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-eyebrow text-tint">Benchmark Country</span>
                <span aria-hidden className="bg-separator-opaque size-1.5 rounded-full" />
                <span className="text-caption text-label-secondary">
                  {selectedTemplate.continent || selectedTemplate.region || "Global"}
                </span>
              </div>
              <h3 className="text-headline text-label">{selectedTemplate.name}</h3>
              <p className="text-footnote text-label-secondary tabular-nums">
                Population: {formatFullWordNumber(selectedTemplate.population)} • GDP:{" "}
                {formatFullWordCurrency(selectedTemplate.gdp)} • GDP per capita: $
                {selectedTemplate.gdpPerCapita
                  ? selectedTemplate.gdpPerCapita.toLocaleString()
                  : "0"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center">
            <Button variant="bordered" size="sm" onClick={onBackToBenchmark}>
              Change Benchmark Country
            </Button>
            <Button size="sm" onClick={onSkipArchetype}>
              Keep Real Baseline →
            </Button>
          </div>
        </FacetCard>
      ) : (
        <FacetCard className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="bg-tint-fill text-tint rounded-control flex size-10 shrink-0 items-center justify-center">
              <Sparkles aria-hidden className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-eyebrow text-label-secondary">
                  No Benchmark Country Selected
                </span>
                <span aria-hidden className="bg-separator-opaque size-1.5 rounded-full" />
                <span className="text-caption text-tint">Default Demographic Scale</span>
              </div>
              <h3 className="text-headline text-label">Pure Archetype Foundation</h3>
              <p className="text-footnote text-label-secondary">
                Population: 10 million • Base GDP: $250 billion • Selected archetype sets economic
                structure and growth
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center">
            <Button variant="tinted" size="sm" onClick={onBackToBenchmark}>
              + Add Benchmark Country
            </Button>
          </div>
        </FacetCard>
      )}

      {/* Search & Complexity Filter Bar */}
      <FacetCard className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          size="sm"
          containerClassName="flex-1"
          placeholder="Search archetypes by name, region, trait..."
          aria-label="Search archetypes"
          value={searchQuery}
          onValueChange={setSearchQuery}
        />

        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2">
            <span id="archetype-complexity-label" className="text-caption text-label-secondary">
              Complexity
            </span>
            <SegmentedControl
              aria-labelledby="archetype-complexity-label"
              size="sm"
              value={complexityFilter}
              onValueChange={setComplexityFilter}
              options={COMPLEXITY_OPTIONS}
            />
          </div>

          <div className="text-caption text-label-secondary shrink-0 tabular-nums select-none">
            Showing {filteredArchetypes.length} of {archetypes.length}{" "}
            {activeEra === "modern" ? "Modern" : "Historical"} Presets
          </div>
        </div>
      </FacetCard>

      {isLoadingArchetypes ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-20">
          <div className="border-tint size-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-body text-label-secondary">Decoding faction templates...</p>
        </div>
      ) : filteredArchetypes.length === 0 ? (
        <FacetCard>
          <EmptyState
            title="No matching archetypes found"
            message="Try adjusting your search query or complexity filter."
            action={
              <Button
                type="button"
                variant="bordered"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setComplexityFilter("all");
                }}
              >
                Reset Filters
              </Button>
            }
          />
        </FacetCard>
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
              <motion.div key={arch.id} variants={itemVariants} className="h-full">
                <FacetCard
                  onClick={() => setLocalSelectedArchetype(arch)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex h-full flex-col justify-between gap-4 p-5",
                    isSelected && "border-tint ring-tint ring-1"
                  )}
                >
                  {/* Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className={cn("rounded-control p-2", styleClasses)}>
                        <IconComponent className="size-5" aria-hidden />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="gray"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetailsModal(arch);
                          }}
                          title="View full preset details"
                        >
                          <Info aria-hidden />
                          <span>Details</span>
                        </Button>
                        {isSelected && (
                          <span className="bg-tint text-on-tint flex size-5 items-center justify-center rounded-full">
                            <Check aria-hidden className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-title-3 text-label">{arch.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="neutral">{arch.region}</Badge>
                        <Badge variant={getComplexityBadgeVariant(arch.implementationComplexity)}>
                          Complexity: {arch.implementationComplexity || "Medium"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-footnote text-label-secondary line-clamp-3">
                      {arch.description}
                    </p>
                  </div>

                  {/* Faction traits / characteristics */}
                  <div className="space-y-3">
                    <div className="border-separator border-t pt-3">
                      <div className="flex items-center gap-1">
                        <span className="text-caption text-label-secondary">
                          Traits & modifiers
                        </span>
                        <InfoTip>
                          Traits & modifiers seed your country's starting bonuses, penalties, and
                          operational characteristics in the simulation.
                        </InfoTip>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(arch.characteristics || [])
                          .slice(0, 3)
                          .map((trait: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              ✦ {trait}
                            </Badge>
                          ))}
                      </div>
                    </div>

                    {/* Stat Bars (Growth, Innovation, Stability) */}
                    {arch.growthMetrics && (
                      <div className="border-separator space-y-2 border-t pt-3">
                        <div className="flex items-center gap-1">
                          <span className="text-caption text-label-secondary">
                            Alignment profile
                          </span>
                          <InfoTip>
                            The starting position of your country's values. Innovation represents
                            reform/technology focus, while Stability represents order/institutions.
                          </InfoTip>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div className="space-y-1">
                            <div className="text-footnote text-label-secondary flex justify-between tabular-nums">
                              <span>Innovation</span>
                              <span>{arch.growthMetrics.innovationIndex || 50}%</span>
                            </div>
                            <Progress
                              value={arch.growthMetrics.innovationIndex || 50}
                              tone="info"
                              className="h-1"
                              aria-label="Innovation"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-footnote text-label-secondary flex justify-between tabular-nums">
                              <span>Stability</span>
                              <span>{arch.growthMetrics.stability || 50}%</span>
                            </div>
                            <Progress
                              value={arch.growthMetrics.stability || 50}
                              tone="success"
                              className="h-1"
                              aria-label="Stability"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Action Buttons */}
                  <div className="border-separator flex items-center gap-2 border-t pt-3">
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocalSelectedArchetype(arch);
                        onConfirmFaction(arch);
                      }}
                      size="sm"
                      variant={isSelected ? "tinted" : "filled"}
                      className="flex-1"
                    >
                      <Check aria-hidden />
                      {isSelected ? "Model Selected" : "Select & Apply →"}
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetailsModal(arch);
                      }}
                      variant="bordered"
                      size="sm"
                    >
                      <Info aria-hidden />
                      Details
                    </Button>
                  </div>
                </FacetCard>
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
        <div className="text-footnote text-label-secondary flex items-center gap-2">
          <div className="border-tint size-4 animate-spin rounded-full border border-t-transparent" />
          Loading more archetypes...
        </div>
      </div>
    </motion.div>
  );
}
