/**
 * useEconomyBuilderSync - Consolidated synchronization hook for EconomyBuilderPage
 *
 * Phase 2 optimization: Consolidates multiple useEffect hooks for:
 * - Ref synchronization (keeping refs in sync with current values)
 * - Integration service updates (subscribing and pushing changes)
 * - Cross-builder synchronization (government, tax system)
 * - Sync status tracking
 *
 * This reduces the number of effects in EconomyBuilderPage from 14 to ~8
 */

import { useEffect, useRef, useState } from "react";
import { isEqual } from "lodash";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicInputs } from "../lib/economy-data-service";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { economyIntegrationService } from "../services/EconomyIntegrationService";
import { buildTaxSyncPayload } from "../components/enhanced/utils/taxSync";
import { api } from "~/trpc/react";

interface UseEconomyBuilderSyncProps {
  countryId?: string;
  // When false, the cross-builder server sync mutations are suppressed (the
  // unified builder's updateCountry is the single writer). Local refs and the
  // in-memory integration service still run. Defaults to true (standalone use).
  enabled?: boolean;
  economyBuilder: EconomyBuilderState;
  economicInputs: EconomicInputs;
  governmentComponents?: any[];
  taxSystemData?: TaxBuilderState | null;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  onPersistEconomyBuilder?: (builder: EconomyBuilderState) => void;
  setEconomyBuilder: (builder: EconomyBuilderState) => void;
}

interface SyncStatus {
  isSyncing: boolean;
  lastSync: Date | null;
  syncError: string | null;
}

interface UseEconomyBuilderSyncReturn {
  // Refs for stable callback access
  economyBuilderRef: React.MutableRefObject<EconomyBuilderState>;
  economicInputsRef: React.MutableRefObject<EconomicInputs>;
  onEconomicInputsChangeRef: React.MutableRefObject<(inputs: EconomicInputs) => void>;
  persistEconomyBuilderRef: React.MutableRefObject<
    ((builder: EconomyBuilderState) => void) | undefined
  >;
  // Sync status
  syncStatus: SyncStatus;
  // Sync mutations
  syncGovernmentMutation: ReturnType<typeof api.economics.syncEconomyWithGovernment.useMutation>;
  syncTaxMutation: ReturnType<typeof api.economics.syncEconomyWithTax.useMutation>;
}

/**
 * Consolidated hook for EconomyBuilderPage synchronization
 */
export function useEconomyBuilderSync({
  countryId,
  enabled = true,
  economyBuilder,
  economicInputs,
  governmentComponents,
  taxSystemData,
  onEconomicInputsChange,
  onPersistEconomyBuilder,
  setEconomyBuilder,
}: UseEconomyBuilderSyncProps): UseEconomyBuilderSyncReturn {
  // ============================================================
  // REFS - Keep stable references to current values for callbacks
  // ============================================================
  const economyBuilderRef = useRef(economyBuilder);
  const economicInputsRef = useRef(economicInputs);
  const onEconomicInputsChangeRef = useRef(onEconomicInputsChange);
  const persistEconomyBuilderRef = useRef(onPersistEconomyBuilder);

  // Consolidated ref sync effect (replaces 4 separate effects)
  useEffect(() => {
    economyBuilderRef.current = economyBuilder;
    economicInputsRef.current = economicInputs;
    onEconomicInputsChangeRef.current = onEconomicInputsChange;
    persistEconomyBuilderRef.current = onPersistEconomyBuilder;
  }, [economyBuilder, economicInputs, onEconomicInputsChange, onPersistEconomyBuilder]);

  // ============================================================
  // SYNC STATUS TRACKING
  // ============================================================
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    syncError: null,
  });

  // ============================================================
  // TRPC MUTATIONS FOR CROSS-BUILDER SYNC
  // ============================================================
  const syncGovernmentMutation = api.economics.syncEconomyWithGovernment.useMutation({
    onError: (error) => {
      console.warn("[EconomyBuilderSync] Government sync failed:", error);
      setSyncStatus((prev) => ({ ...prev, syncError: error.message }));
    },
  });

  const syncTaxMutation = api.economics.syncEconomyWithTax.useMutation({
    onError: (error) => {
      console.warn("[EconomyBuilderSync] Tax sync failed:", error);
      setSyncStatus((prev) => ({ ...prev, syncError: error.message }));
    },
  });

  // ============================================================
  // INTEGRATION SERVICE SUBSCRIPTION
  // ============================================================
  // When inside the unified builder (enabled === false), the integration service
  // is DISPLAY-ONLY: it must never push its regenerated/derived economyBuilder or
  // economicInputs back into builderState. That back-channel was the "edit one
  // thing and everything else resets" bug — e.g. changing atomic components
  // regenerates economyBuilder in the service, which then clobbered the user's
  // detailed economy config in builderState. builderState is the single source
  // of truth; only direct user edits write to it.
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const unsubscribe = economyIntegrationService.subscribe((state) => {
      if (!enabledRef.current) return;

      // Use refs for comparison to avoid stale closures
      if (state.economyBuilder && !isEqual(state.economyBuilder, economyBuilderRef.current)) {
        setEconomyBuilder(state.economyBuilder);
        persistEconomyBuilderRef.current?.(state.economyBuilder);
      }

      // Use isEqual instead of JSON.stringify for performance
      if (state.economicInputs && !isEqual(state.economicInputs, economicInputsRef.current)) {
        onEconomicInputsChangeRef.current(state.economicInputs);
      }
    });

    return () => unsubscribe();
  }, [setEconomyBuilder]); // Only setEconomyBuilder needed - refs handle the rest

  // ============================================================
  // INTEGRATION SERVICE UPDATES (push changes to service)
  // ============================================================
  useEffect(() => {
    if (economyBuilder) {
      if (economyBuilder.selectedAtomicComponents) {
        void economyIntegrationService.updateEconomicComponents(
          economyBuilder.selectedAtomicComponents
        );
      }
      void economyIntegrationService.updateEconomyBuilder(economyBuilder);
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (economicInputs) {
      economyIntegrationService.updateEconomicInputs(economicInputs);
    }
  }, [economicInputs]);

  // ============================================================
  // CROSS-BUILDER SYNCHRONIZATION
  // Consolidated government + tax sync (replaces 2 separate effects)
  // ============================================================
  const lastSyncedGovernmentRef = useRef<string | null>(null);
  const lastSyncedTaxRef = useRef<string | null>(null);

  useEffect(() => {
    if (!countryId || !enabled) return;

    // Sync government components if changed
    if (governmentComponents && governmentComponents.length > 0) {
      const govKey = JSON.stringify(governmentComponents.map((c) => c.toString()));
      if (govKey !== lastSyncedGovernmentRef.current) {
        lastSyncedGovernmentRef.current = govKey;
        syncGovernmentMutation.mutate({
          countryId,
          governmentComponents: governmentComponents.map((comp) => comp.toString()),
        });
      }
    }

    // Sync tax system if changed
    if (taxSystemData) {
      const taxKey = JSON.stringify(taxSystemData);
      if (taxKey !== lastSyncedTaxRef.current) {
        lastSyncedTaxRef.current = taxKey;
        const taxPayload = buildTaxSyncPayload(taxSystemData);
        syncTaxMutation.mutate({
          countryId,
          taxData: taxPayload,
        });
      }
    }
  }, [countryId, enabled, governmentComponents, taxSystemData, syncGovernmentMutation, syncTaxMutation]);

  // ============================================================
  // SYNC STATUS TRACKING (based on mutation states)
  // ============================================================
  useEffect(() => {
    const isAnyMutationLoading = syncGovernmentMutation.isPending || syncTaxMutation.isPending;

    setSyncStatus((prev) => ({
      ...prev,
      isSyncing: isAnyMutationLoading,
      lastSync: !isAnyMutationLoading && prev.isSyncing ? new Date() : prev.lastSync,
    }));
  }, [syncGovernmentMutation.isPending, syncTaxMutation.isPending]);

  return {
    economyBuilderRef,
    economicInputsRef,
    onEconomicInputsChangeRef,
    persistEconomyBuilderRef,
    syncStatus,
    syncGovernmentMutation,
    syncTaxMutation,
  };
}

export default useEconomyBuilderSync;
