"use client";

import { useState, useEffect } from 'react';
import { api } from '~/trpc/react';
import { buildTaxSyncPayload } from '../../utils/taxSync';

export function useEconomySyncStatus(
  countryId: string | undefined,
  governmentComponents: any[],
  taxSystemData: any
) {
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    lastSync: Date | null;
    syncError: string | null;
  }>({
    isSyncing: false,
    lastSync: null,
    syncError: null
  });

  const syncGovernmentMutation = api.economics.syncEconomyWithGovernment.useMutation({
    onSuccess: () => {
      // Silent success - toast shown elsewhere if needed
    },
    onError: (error: any) => {
      console.warn('Government sync failed:', error);
    }
  });

  const syncTaxMutation = api.economics.syncEconomyWithTax.useMutation({
    onSuccess: () => {
      // Silent success - toast shown elsewhere if needed
    },
    onError: (error: any) => {
      console.warn('Tax sync failed:', error);
    }
  });

  // Cross-builder synchronization with government
  useEffect(() => {
    if (!countryId || !governmentComponents) return;

    const syncWithGovernment = async () => {
      try {
        await syncGovernmentMutation.mutateAsync({
          countryId,
          governmentComponents: governmentComponents.map(comp => comp.toString())
        });
      } catch (error) {
        console.warn('Government sync failed:', error);
      }
    };

    syncWithGovernment();
  }, [countryId, governmentComponents, syncGovernmentMutation]);

  // Cross-builder synchronization with tax system
  useEffect(() => {
    if (!countryId || !taxSystemData) return;

    const syncWithTax = async () => {
      try {
        const taxPayload = buildTaxSyncPayload(taxSystemData);
        await syncTaxMutation.mutateAsync({
          countryId,
          taxData: taxPayload
        });
      } catch (error) {
        console.warn('Tax sync failed:', error);
      }
    };

    syncWithTax();
  }, [countryId, taxSystemData, syncTaxMutation]);

  // Update sync status based on mutation states
  useEffect(() => {
    const isAnyMutationLoading =
      syncGovernmentMutation.isPending ||
      syncTaxMutation.isPending;

    setSyncStatus(prev => ({
      ...prev,
      isSyncing: isAnyMutationLoading,
      lastSync: isAnyMutationLoading ? prev.lastSync : new Date(),
      syncError: null
    }));
  }, [
    syncGovernmentMutation.isPending,
    syncTaxMutation.isPending
  ]);

  return {
    syncStatus,
    syncGovernmentMutation,
    syncTaxMutation
  };
}
