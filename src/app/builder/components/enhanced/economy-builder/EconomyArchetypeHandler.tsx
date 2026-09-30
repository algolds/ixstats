"use client";

import React from "react";
import { useNotify } from "~/hooks/useNotify";
import { mapLegacyGovernmentComponents } from "~/hooks/useArchetypes";
import { EconomicArchetypeModal } from "../EconomicArchetypeModal";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { BuilderContextValue } from "../context/BuilderStateContext";
import type { GovernmentType } from "~/types/government";

interface EconomyArchetypeHandlerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  economyBuilder: EconomyBuilderState;
  handleEconomyBuilderChange: (state: EconomyBuilderState) => void;
  builderContext: BuilderContextValue | null;
}

export function EconomyArchetypeHandler({
  open,
  onOpenChange,
  economyBuilder,
  handleEconomyBuilderChange,
  builderContext,
}: EconomyArchetypeHandlerProps) {
  const notify = useNotify();

  return (
    <EconomicArchetypeModal
      open={open}
      onOpenChange={onOpenChange}
      currentState={economyBuilder}
      onArchetypeApplied={(newState, archetypeId, archetype) => {
        const nextState: EconomyBuilderState = {
          ...economyBuilder,
          ...newState,
          version: economyBuilder.version,
          lastUpdated: new Date(),
          isValid: true,
          errors: {},
        };

        handleEconomyBuilderChange(nextState);

        if (builderContext) {
          builderContext.setBuilderState((prev) => {
            const updatedState = { ...prev };

            if (archetypeId) {
              updatedState.selectedArchetypeId = archetypeId;
            }

            if (archetype) {
              if (archetype.governmentComponents) {
                updatedState.governmentComponents = mapLegacyGovernmentComponents(
                  archetype.governmentComponents as string[]
                );
              }

              if (archetype.name && updatedState.governmentStructure?.structure) {
                updatedState.governmentStructure = {
                  ...updatedState.governmentStructure,
                  structure: {
                    ...updatedState.governmentStructure.structure,
                    governmentType: archetype.name as GovernmentType,
                  },
                };
              }

              if (archetype.taxProfile && updatedState.taxSystemData) {
                const updatedCategories = updatedState.taxSystemData.categories.map((cat) => {
                  const name = cat.categoryName.toLowerCase();
                  if (name.includes("corporate")) {
                    return { ...cat, baseRate: archetype.taxProfile!.corporateRate };
                  }
                  if (name.includes("personal") || name.includes("income")) {
                    return { ...cat, baseRate: archetype.taxProfile!.incomeRate };
                  }
                  if (
                    name.includes("consumption") ||
                    name.includes("sales") ||
                    name.includes("value added")
                  ) {
                    return { ...cat, baseRate: archetype.taxProfile!.consumptionRate };
                  }
                  return cat;
                });
                updatedState.taxSystemData = {
                  ...updatedState.taxSystemData,
                  categories: updatedCategories,
                };
              }
            }

            return updatedState;
          });
        }

        notify.success("Economic archetype applied successfully!");
      }}
    />
  );
}
