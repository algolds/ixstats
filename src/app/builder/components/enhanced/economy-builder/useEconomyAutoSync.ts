import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";
import type { BuilderContextValue } from "../context/BuilderStateContext";

interface UseEconomyAutoSyncProps {
  countryId?: string;
  economyBuilder: EconomyBuilderState;
  economicInputs: EconomicInputs;
  builderContext: BuilderContextValue | null;
  setLastSaved?: (date: Date | null) => void;
}

export function useEconomyAutoSync({
  countryId,
  economyBuilder,
  economicInputs,
  builderContext,
  setLastSaved,
}: UseEconomyAutoSyncProps) {
  const notify = useNotify();
  const [_showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const economyDataForSync = useMemo(() => {
    return {
      gdp: economyBuilder.structure.totalGDP,
      gdpPerCapita:
        economyBuilder.structure.totalGDP && economyBuilder.demographics.totalPopulation
          ? economyBuilder.structure.totalGDP / economyBuilder.demographics.totalPopulation
          : economicInputs.coreIndicators?.gdpPerCapita,
      population: economyBuilder.demographics.totalPopulation,
      unemploymentRate: economyBuilder.laborMarket.unemploymentRate,
      inflationRate: economicInputs.coreIndicators?.inflationRate,
      laborForceParticipation: economyBuilder.laborMarket.laborForceParticipationRate,
      averageWorkingHours: economyBuilder.laborMarket.averageWorkweekHours,
      minimumWage: economyBuilder.laborMarket.minimumWageHourly,
      literacyRate: economyBuilder.demographics.literacyRate,
      lifeExpectancy: economyBuilder.demographics.lifeExpectancy,
    };
  }, [economyBuilder, economicInputs]);

  const autosaveMutation = api.economics.autoSaveEconomyBuilder.useMutation();

  const sync = useGenericAutoSync(economyDataForSync, {
    enabled: !!countryId && !builderContext,
    debounceMs: 15000,
    syncFn: async (data) => {
      if (!countryId) return;
      const res = await autosaveMutation.mutateAsync({
        countryId,
        changes: data as Record<string, string | number | boolean | Date | null>,
      });
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      return res;
    },
    onSyncSuccess: () => {
      setLastSaved?.(new Date());
    },
    onSyncError: (error) => {
      console.error("[EconomyBuilder] Autosave failed:", error);
      notify.error("Failed to autosave economy data");
    },
  });

  const syncNow = sync.forceSync;

  useEffect(() => {
    if (builderContext && countryId) {
      builderContext.registerAutoSync("economy", async () => {
        await syncNow();
      });
      return () => {
        builderContext.unregisterAutoSync("economy");
      };
    }
    return;
  }, [countryId, syncNow, builderContext]);

  return {
    sync,
    syncNow,
    isSyncing: sync.isSyncing,
    lastSyncTime: sync.lastSyncTime,
    pendingChanges: sync.pendingChanges,
    syncError: sync.syncError?.message ?? null,
  };
}
