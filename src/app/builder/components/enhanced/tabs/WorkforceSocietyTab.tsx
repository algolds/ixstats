"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Group as Users, Globe } from "iconoir-react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";
import { LaborEmploymentTab } from "./LaborEmploymentTab";
import { DemographicsPopulationTab } from "./DemographicsPopulationTab";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";

export interface WorkforceSocietyTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

export function WorkforceSocietyTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false,
}: WorkforceSocietyTabProps) {
  const [subTab, setSubTab] = useState<"labor" | "demographics">("labor");

  return (
    <div className="space-y-6">
      <FacetCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <div className="flex flex-col gap-4 border-b border-border/40 bg-white/[0.02] px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-black/[0.1]">
          <div className="flex items-center gap-2">
            {subTab === "labor" ? (
              <Users className="h-5 w-5 text-emerald-400" />
            ) : (
              <Globe className="h-5 w-5 text-emerald-400" />
            )}
            <h3 className="text-base font-bold text-foreground">
              {subTab === "labor" ? "Labor Market & Employment" : "Demographics & Population"}
            </h3>
          </div>

          {/* Apple Sub-Segmented Control */}
          <div className="relative inline-flex items-center rounded-xl border border-border/40 bg-muted/40 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setSubTab("labor");
              }}
              data-cuelume-press
              className={cn(
                "relative z-10 flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.97]",
                subTab === "labor"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {subTab === "labor" && (
                <motion.span
                  layoutId="workforce-subtab-pill"
                  transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Labor & Wages
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setSubTab("demographics");
              }}
              data-cuelume-press
              className={cn(
                "relative z-10 flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.97]",
                subTab === "demographics"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {subTab === "demographics" && (
                <motion.span
                  layoutId="workforce-subtab-pill"
                  transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Demographics & Society
              </span>
            </button>
          </div>
        </div>

        <FacetCardContent className="p-6">
          {subTab === "labor" ? (
            <LaborEmploymentTab
              economyBuilder={economyBuilder}
              onEconomyBuilderChange={onEconomyBuilderChange}
              selectedComponents={selectedComponents}
              showAdvanced={showAdvanced}
            />
          ) : (
            <DemographicsPopulationTab
              economyBuilder={economyBuilder}
              onEconomyBuilderChange={onEconomyBuilderChange}
              selectedComponents={selectedComponents}
              showAdvanced={showAdvanced}
            />
          )}
        </FacetCardContent>
      </FacetCard>
    </div>
  );
}
