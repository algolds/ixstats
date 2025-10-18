// src/app/admin/_hooks/useAdminHandlers.ts
// Handler functions for admin panel actions

import { useCallback } from "react";
import { withBasePath } from "~/lib/base-path";
import { IxTime } from "~/lib/ixtime";
import type { ActionState, AdminConfig, TimeState, ImportState } from "./useAdminState";
import type { api } from "~/trpc/react";

interface UseAdminHandlersParams {
  config: AdminConfig;
  timeState: TimeState;
  importState: ImportState;
  setActionState: React.Dispatch<React.SetStateAction<ActionState>>;
  setConfig: React.Dispatch<React.SetStateAction<AdminConfig>>;
  setImportState: React.Dispatch<React.SetStateAction<ImportState>>;
  saveConfigMutation: ReturnType<typeof api.admin.saveConfig.useMutation>;
  forceCalculationMutation: ReturnType<typeof api.countries.updateStats.useMutation>;
  setCustomTimeMutation: ReturnType<typeof api.admin.setCustomTime.useMutation>;
  analyzeImportMutation: ReturnType<typeof api.admin.analyzeImport.useMutation>;
  importDataMutation: ReturnType<typeof api.admin.importRosterData.useMutation>;
  syncEpochMutation: ReturnType<typeof api.admin.syncEpochWithData.useMutation>;
  syncBotMutation: ReturnType<typeof api.admin.syncBot.useMutation>;
  pauseBotMutation: ReturnType<typeof api.admin.pauseBot.useMutation>;
  resumeBotMutation: ReturnType<typeof api.admin.resumeBot.useMutation>;
  clearBotOverridesMutation: ReturnType<typeof api.admin.clearBotOverrides.useMutation>;
  refetchConfig: () => Promise<unknown>;
  refetchStatus: () => Promise<unknown>;
  refetchBotStatus: () => Promise<unknown>;
}

export function useAdminHandlers({
  config,
  timeState,
  importState,
  setActionState,
  setConfig,
  setImportState,
  saveConfigMutation,
  forceCalculationMutation,
  setCustomTimeMutation,
  analyzeImportMutation,
  importDataMutation,
  syncEpochMutation,
  syncBotMutation,
  pauseBotMutation,
  resumeBotMutation,
  clearBotOverridesMutation,
  refetchConfig,
  refetchStatus,
  refetchBotStatus,
}: UseAdminHandlersParams) {
  const handleSaveConfig = useCallback(async () => {
    setActionState(prev => ({ ...prev, savePending: true }));
    try {
      await saveConfigMutation.mutateAsync(config);
      setActionState(prev => ({ ...prev, lastUpdate: new Date() }));
      await refetchConfig();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setActionState(prev => ({ ...prev, savePending: false }));
    }
  }, [config, saveConfigMutation, refetchConfig, setActionState]);

  const handleForceCalculation = useCallback(async () => {
    setActionState(prev => ({ ...prev, calculationPending: true }));
    try {
      await forceCalculationMutation.mutateAsync({});
      await refetchStatus();
    } catch (error) {
      console.error("Failed to force calculation:", error);
    } finally {
      setActionState(prev => ({ ...prev, calculationPending: false }));
    }
  }, [forceCalculationMutation, refetchStatus, setActionState]);

  const handleSetCustomTime = useCallback(async () => {
    if (!timeState.customDate || !timeState.customTime) return;
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      const ixTime = IxTime.createGameTime(
        parseInt(timeState.customDate.split('-')[0]!),
        parseInt(timeState.customDate.split('-')[1]!),
        parseInt(timeState.customDate.split('-')[2]!),
        parseInt(timeState.customTime.split(':')[0]!),
        parseInt(timeState.customTime.split(':')[1]!)
      );
      await setCustomTimeMutation.mutateAsync({
        ixTime,
        multiplier: config.timeMultiplier
      });
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to set custom time:", error);
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [timeState, config.timeMultiplier, setCustomTimeMutation, refetchStatus, refetchBotStatus, setActionState]);

  const handleResetToRealTime = useCallback(async () => {
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      await setCustomTimeMutation.mutateAsync({
        ixTime: IxTime.getCurrentIxTime(),
        multiplier: 2.0
      });
      setConfig(prev => ({ ...prev, timeMultiplier: 2.0 }));
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to reset time:", error);
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [setCustomTimeMutation, refetchStatus, refetchBotStatus, setActionState, setConfig]);

  const handleTimeMultiplierChange = useCallback(async (value: number) => {
    // Update local state immediately for UI responsiveness
    setConfig(prev => ({ ...prev, timeMultiplier: value }));

    // Apply to bot with current time
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      // Use natural time setting if available, fallback to custom time
      try {
        const naturalResponse = await fetch(withBasePath('/api/ixtime/set-natural'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ multiplier: value })
        });

        if (naturalResponse.ok) {
          const naturalResult = await naturalResponse.json();
          console.log(`Time set naturally: ${naturalResult.message}`);
        } else {
          throw new Error('Natural time setting failed');
        }
      } catch (naturalError) {
        console.warn('Natural time setting failed, using override:', naturalError);

        // Fallback to custom time override
        await setCustomTimeMutation.mutateAsync({
          ixTime: IxTime.getCurrentIxTime(),
          multiplier: value
        });

        // Auto-sync with Discord bot
        try {
          const syncResponse = await fetch(withBasePath('/api/ixtime/sync-bot'), { method: 'POST' });
          if (syncResponse.ok) {
            console.log('Discord bot automatically synced with new time settings');
          } else {
            console.warn('Failed to auto-sync with Discord bot');
          }
        } catch (syncError) {
          console.warn('Discord bot sync failed:', syncError);
        }
      }

      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to set time multiplier:", error);
      // Revert local state on error
      setConfig(prev => ({ ...prev, timeMultiplier: 2.0 }));
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [setCustomTimeMutation, refetchStatus, refetchBotStatus, setConfig, setActionState]);

  const handleSyncEpoch = useCallback(async (targetEpoch: number) => {
    setActionState(prev => ({ ...prev, syncEpochPending: true }));
    try {
      await syncEpochMutation.mutateAsync({
        targetEpoch,
        reason: 'Manual epoch sync from admin panel'
      });
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to sync epoch:", error);
    } finally {
      setActionState(prev => ({ ...prev, syncEpochPending: false }));
    }
  }, [syncEpochMutation, refetchStatus, refetchBotStatus, setActionState]);

  // Bot control handlers
  const handleSyncBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, syncPending: true }));
    try {
      await syncBotMutation.mutateAsync();
      await refetchBotStatus();
      await refetchStatus();
    } catch (error) {
      console.error("Failed to sync bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, syncPending: false }));
    }
  }, [syncBotMutation, refetchBotStatus, refetchStatus, setActionState]);

  const handleSyncFromBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, autoSyncPending: true }));
    try {
      const response = await fetch(withBasePath('/api/ixtime/sync-from-bot'), { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        console.log('Successfully synced from Discord bot:', result.message);
        // Update local config to match bot
        if (result.currentState?.multiplier) {
          setConfig(prev => ({ ...prev, timeMultiplier: result.currentState.multiplier }));
        }
        setActionState(prev => ({ ...prev, lastBotSync: new Date() }));
        await refetchStatus();
        await refetchBotStatus();
      } else {
        console.error('Failed to sync from Discord bot:', result.error);
      }
    } catch (error) {
      console.error("Error syncing from Discord bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, autoSyncPending: false }));
    }
  }, [refetchStatus, refetchBotStatus, setActionState, setConfig]);

  const handlePauseBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, pausePending: true }));
    try {
      await pauseBotMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to pause bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, pausePending: false }));
    }
  }, [pauseBotMutation, refetchBotStatus, setActionState]);

  const handleResumeBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, resumePending: true }));
    try {
      await resumeBotMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to resume bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, resumePending: false }));
    }
  }, [resumeBotMutation, refetchBotStatus, setActionState]);

  const handleClearOverrides = useCallback(async () => {
    setActionState(prev => ({ ...prev, clearPending: true }));
    try {
      await clearBotOverridesMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to clear overrides:", error);
    } finally {
      setActionState(prev => ({ ...prev, clearPending: false }));
    }
  }, [clearBotOverridesMutation, refetchBotStatus, setActionState]);

  // Import handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setImportState(prev => ({
      ...prev,
      isAnalyzing: true,
      analyzeError: null,
      importError: null,
      fileData: null,
      fileName: null
    }));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = Array.from(new Uint8Array(arrayBuffer));
      const fileName = file.name;
      const analysis = await analyzeImportMutation.mutateAsync({
        fileData,
        fileName,
      });
      setImportState(prev => ({
        ...prev,
        previewData: analysis,
        showPreview: true,
        importError: null,
        fileData, // Save fileData for later import
        fileName, // Save fileName for later import
      }));
    } catch (error) {
      setImportState(prev => ({
        ...prev,
        analyzeError: error instanceof Error ? error.message : "Failed to analyze file",
        showPreview: false,
        previewData: null,
        fileData: null,
        fileName: null
      }));
    } finally {
      setImportState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [analyzeImportMutation, setImportState]);

  const handleImportConfirm = useCallback(async (replaceExisting: boolean, syncEpoch?: boolean, targetEpoch?: number) => {
    if (!importState.previewData || !importState.fileData || !importState.fileName) return;
    setImportState(prev => ({ ...prev, isUploading: true, importError: null }));
    try {
      // First, import the data
      await importDataMutation.mutateAsync({
        analysisId: importState.previewData.totalCountries.toString(),
        replaceExisting,
        fileData: importState.fileData,
        fileName: importState.fileName
      });

      // Then, if epoch sync is requested, sync the epoch time
      if (syncEpoch && targetEpoch) {
        await syncEpochMutation.mutateAsync({
          targetEpoch,
          reason: `Import sync: ${importState.fileName}`
        });
      }

      setImportState(prev => ({
        ...prev,
        isUploading: false,
      }));
      await refetchStatus();
      await handleForceCalculation();
    } catch (error) {
      setImportState(prev => ({
        ...prev,
        importError: error instanceof Error ? error.message : "Failed to import data",
        isUploading: false
      }));
    }
  }, [importState.previewData, importState.fileData, importState.fileName, importDataMutation, syncEpochMutation, refetchStatus, handleForceCalculation, setImportState]);

  const handleImportClose = useCallback(() => {
    setImportState(prev => ({
      ...prev,
      showPreview: false,
      previewData: null,
      analyzeError: null,
      importError: null,
      fileData: null,
      fileName: null
    }));
  }, [setImportState]);

  const handleRefreshStatus = useCallback(async () => {
    await Promise.all([
      refetchStatus(),
      refetchBotStatus(),
      refetchConfig(),
    ]);
  }, [refetchStatus, refetchBotStatus, refetchConfig]);

  return {
    handleSaveConfig,
    handleForceCalculation,
    handleSetCustomTime,
    handleResetToRealTime,
    handleTimeMultiplierChange,
    handleSyncEpoch,
    handleSyncBot,
    handleSyncFromBot,
    handlePauseBot,
    handleResumeBot,
    handleClearOverrides,
    handleFileSelect,
    handleImportConfirm,
    handleImportClose,
    handleRefreshStatus,
  };
}
