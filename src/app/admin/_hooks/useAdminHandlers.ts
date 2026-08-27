// src/app/admin/_hooks/useAdminHandlers.ts
// Handler functions for admin panel actions
"use client";

import { useCallback } from "react";
import { IxTime } from "~/lib/ixtime";
import type { ActionState, AdminConfig, TimeState, ImportState } from "./useAdminState";
import { api } from "~/trpc/react";

interface UseAdminHandlersParams {
  config?: AdminConfig;
  timeState?: TimeState;
  importState?: ImportState;
  setActionState?: React.Dispatch<React.SetStateAction<ActionState>>;
  setConfig?: React.Dispatch<React.SetStateAction<AdminConfig>>;
  setImportState?: React.Dispatch<React.SetStateAction<ImportState>>;
  saveConfigMutation?: ReturnType<typeof api.admin.saveConfig.useMutation>;
  forceCalculationMutation?: ReturnType<typeof api.admin.forceRecalculation.useMutation>;
  setCustomTimeMutation?: ReturnType<typeof api.admin.setCustomTime.useMutation>;
  analyzeImportMutation?: ReturnType<typeof api.admin.analyzeImport.useMutation>;
  importDataMutation?: ReturnType<typeof api.admin.importRosterData.useMutation>;
  syncEpochMutation?: ReturnType<typeof api.admin.syncEpochWithData.useMutation>;
  syncBotMutation?: ReturnType<typeof api.admin.syncBot.useMutation>;
  pauseBotMutation?: ReturnType<typeof api.admin.pauseBot.useMutation>;
  resumeBotMutation?: ReturnType<typeof api.admin.resumeBot.useMutation>;
  clearBotOverridesMutation?: ReturnType<typeof api.admin.clearBotOverrides.useMutation>;
  refetchConfig?: () => Promise<unknown>;
  refetchStatus?: () => Promise<unknown>;
  refetchBotStatus?: () => Promise<unknown>;
}

export function useAdminHandlers(params: UseAdminHandlersParams = {}) {
  const {
    config,
    timeState,
    importState,
    setActionState = () => {},
    setConfig = () => {},
    setImportState = () => {},
  } = params;

  const defaultSaveConfig = api.admin.saveConfig.useMutation();
  const defaultForceCalculation = api.admin.forceRecalculation.useMutation();
  const defaultSetCustomTime = api.admin.setCustomTime.useMutation();
  const defaultAnalyzeImport = api.admin.analyzeImport.useMutation();
  const defaultImportData = api.admin.importRosterData.useMutation();
  const defaultSyncEpoch = api.admin.syncEpochWithData.useMutation();
  const defaultSyncBot = api.admin.syncBot.useMutation();
  const defaultPauseBot = api.admin.pauseBot.useMutation();
  const defaultResumeBot = api.admin.resumeBot.useMutation();
  const defaultClearBotOverrides = api.admin.clearBotOverrides.useMutation();

  const utils = api.useUtils();
  const refetchConfig = params.refetchConfig ?? (() => utils.admin.getConfig.refetch());
  const refetchStatus = params.refetchStatus ?? (() => utils.admin.getSystemStatus.refetch());
  const refetchBotStatus = params.refetchBotStatus ?? (() => utils.admin.getBotStatus.refetch());

  const saveConfigMutation = params.saveConfigMutation ?? defaultSaveConfig;
  const forceCalculationMutation = params.forceCalculationMutation ?? defaultForceCalculation;
  const setCustomTimeMutation = params.setCustomTimeMutation ?? defaultSetCustomTime;
  const analyzeImportMutation = params.analyzeImportMutation ?? defaultAnalyzeImport;
  const importDataMutation = params.importDataMutation ?? defaultImportData;
  const syncEpochMutation = params.syncEpochMutation ?? defaultSyncEpoch;
  const syncBotMutation = params.syncBotMutation ?? defaultSyncBot;
  const pauseBotMutation = params.pauseBotMutation ?? defaultPauseBot;
  const resumeBotMutation = params.resumeBotMutation ?? defaultResumeBot;
  const clearBotOverridesMutation = params.clearBotOverridesMutation ?? defaultClearBotOverrides;

  const handleSaveConfig = useCallback(async () => {
    if (!config) return;
    setActionState((prev) => ({ ...prev, savePending: true }));
    try {
      await saveConfigMutation.mutateAsync(config);
      setActionState((prev) => ({ ...prev, lastUpdate: new Date() }));
      await refetchConfig();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setActionState((prev) => ({ ...prev, savePending: false }));
    }
    // oxlint-disable-next-line
  }, [config, saveConfigMutation, refetchConfig, setActionState]);

  const handleForceCalculation = useCallback(async () => {
    setActionState((prev) => ({ ...prev, calculationPending: true }));
    try {
      await forceCalculationMutation.mutateAsync();
      await refetchStatus();
    } catch (error) {
      console.error("Failed to force calculation:", error);
    } finally {
      setActionState((prev) => ({ ...prev, calculationPending: false }));
    }
    // oxlint-disable-next-line
  }, [forceCalculationMutation, refetchStatus, setActionState]);

  const handleSetCustomTime = useCallback(async () => {
    if (!timeState?.customDate || !timeState?.customTime) return;
    setActionState((prev) => ({ ...prev, setTimePending: true }));
    try {
      const ixTime = IxTime.createGameTime(
        parseInt(timeState.customDate.split("-")[0]!),
        parseInt(timeState.customDate.split("-")[1]!),
        parseInt(timeState.customDate.split("-")[2]!),
        parseInt(timeState.customTime.split(":")[0]!),
        parseInt(timeState.customTime.split(":")[1]!)
      );
      await setCustomTimeMutation.mutateAsync({
        ixTime,
        multiplier: config?.timeMultiplier ?? 1.0,
      });
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to set custom time:", error);
    } finally {
      setActionState((prev) => ({ ...prev, setTimePending: false }));
    }
  }, [
    timeState?.customDate,
    timeState?.customTime,
    config?.timeMultiplier,
    setCustomTimeMutation,
    // oxlint-disable-next-line
    refetchStatus,
    // oxlint-disable-next-line
    refetchBotStatus,
    setActionState,
  ]);

  const handleResetToRealTime = useCallback(async () => {
    setActionState((prev) => ({ ...prev, resetPending: true }));
    try {
      const realTime = Date.now();
      await setCustomTimeMutation.mutateAsync({
        ixTime: realTime,
        multiplier: 1.0,
      });
      await syncBotMutation.mutateAsync();
      await refetchStatus();
      await refetchBotStatus();
      setConfig((prev) => ({ ...prev, timeMultiplier: 1.0 }));
    } catch (error) {
      console.error("Failed to reset to real time:", error);
    } finally {
      setActionState((prev) => ({ ...prev, resetPending: false }));
    }
    // oxlint-disable-next-line
  }, [
    setCustomTimeMutation,
    syncBotMutation,
    refetchStatus,
    refetchBotStatus,
    setConfig,
    setActionState,
  ]);

  const handleTimeMultiplierChange = useCallback(
    async (value: number) => {
      setConfig((prev) => ({ ...prev, timeMultiplier: value }));

      if (value < 0.1 || value > 10.0) {
        console.warn(`Time multiplier ${value} outside recommended range (0.1 - 10.0)`);
      }

      setActionState((prev) => ({ ...prev, setTimePending: true }));
      try {
        await setCustomTimeMutation.mutateAsync({
          ixTime: IxTime.getCurrentIxTime(),
          multiplier: value,
        });

        await syncBotMutation.mutateAsync();
        await refetchStatus();
        await refetchBotStatus();
      } catch (error) {
        console.error("Failed to set time multiplier:", error);
        setConfig((prev) => ({ ...prev, timeMultiplier: 2.0 }));
      } finally {
        setActionState((prev) => ({ ...prev, setTimePending: false }));
      }
    },
    // oxlint-disable-next-line
    [
      setCustomTimeMutation,
      syncBotMutation,
      refetchStatus,
      refetchBotStatus,
      setConfig,
      setActionState,
    ]
  );

  const handleSyncEpoch = useCallback(
    async (targetEpoch: number) => {
      setActionState((prev) => ({ ...prev, syncEpochPending: true }));
      try {
        await syncEpochMutation.mutateAsync({
          targetEpoch,
          reason: "Manual epoch sync from admin panel",
        });
        await refetchStatus();
        await refetchBotStatus();
      } catch (error) {
        console.error("Failed to sync epoch:", error);
      } finally {
        setActionState((prev) => ({ ...prev, syncEpochPending: false }));
      }
    },
    // oxlint-disable-next-line
    [syncEpochMutation, refetchStatus, refetchBotStatus, setActionState]
  );

  const handleSyncBot = useCallback(async () => {
    setActionState((prev) => ({ ...prev, syncPending: true }));
    try {
      await syncBotMutation.mutateAsync();
      await refetchBotStatus();
      await refetchStatus();
    } catch (error) {
      console.error("Failed to sync bot:", error);
    } finally {
      setActionState((prev) => ({ ...prev, syncPending: false }));
    }
    // oxlint-disable-next-line
  }, [syncBotMutation, refetchBotStatus, refetchStatus, setActionState]);

  const handleSyncFromBot = useCallback(async () => {
    setActionState((prev) => ({ ...prev, autoSyncPending: true }));
    try {
      await syncBotMutation.mutateAsync();
      setActionState((prev) => ({ ...prev, lastBotSync: new Date() }));
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Error syncing from Discord bot:", error);
    } finally {
      setActionState((prev) => ({ ...prev, autoSyncPending: false }));
    }
    // oxlint-disable-next-line
  }, [syncBotMutation, refetchStatus, refetchBotStatus, setActionState]);

  const handlePauseBot = useCallback(async () => {
    setActionState((prev) => ({ ...prev, pausePending: true }));
    try {
      await pauseBotMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to pause bot:", error);
    } finally {
      setActionState((prev) => ({ ...prev, pausePending: false }));
    }
    // oxlint-disable-next-line
  }, [pauseBotMutation, refetchBotStatus, setActionState]);

  const handleResumeBot = useCallback(async () => {
    setActionState((prev) => ({ ...prev, resumePending: true }));
    try {
      await resumeBotMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to resume bot:", error);
    } finally {
      setActionState((prev) => ({ ...prev, resumePending: false }));
    }
    // oxlint-disable-next-line
  }, [resumeBotMutation, refetchBotStatus, setActionState]);

  const handleClearOverrides = useCallback(async () => {
    setActionState((prev) => ({ ...prev, clearPending: true }));
    try {
      await clearBotOverridesMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to clear overrides:", error);
    } finally {
      setActionState((prev) => ({ ...prev, clearPending: false }));
    }
    // oxlint-disable-next-line
  }, [clearBotOverridesMutation, refetchBotStatus, setActionState]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setImportState((prev) => ({
        ...prev,
        isAnalyzing: true,
        analyzeError: null,
        importError: null,
        fileData: null,
        fileName: null,
      }));
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileData = Array.from(new Uint8Array(arrayBuffer));
        const fileName = file.name;
        const analysis = await analyzeImportMutation.mutateAsync({
          fileData,
          fileName,
        });
        setImportState((prev) => ({
          ...prev,
          previewData: analysis,
          showPreview: true,
          importError: null,
          fileData,
          fileName,
        }));
      } catch (error) {
        setImportState((prev) => ({
          ...prev,
          analyzeError: error instanceof Error ? error.message : "Failed to analyze file",
          showPreview: false,
          previewData: null,
          fileData: null,
          fileName: null,
        }));
      } finally {
        setImportState((prev) => ({ ...prev, isAnalyzing: false }));
      }
    },
    [analyzeImportMutation, setImportState]
  );

  const handleImportConfirm = useCallback(
    async (replaceExisting: boolean, syncEpoch?: boolean, targetEpoch?: number) => {
      if (!importState?.previewData || !importState?.fileData || !importState?.fileName) return;
      setImportState((prev) => ({ ...prev, isUploading: true, importError: null }));
      try {
        await importDataMutation.mutateAsync({
          analysisId: importState.previewData.totalCountries.toString(),
          replaceExisting,
          fileData: importState.fileData,
          fileName: importState.fileName,
        });

        if (syncEpoch && targetEpoch) {
          await syncEpochMutation.mutateAsync({
            targetEpoch,
            reason: `Import sync: ${importState.fileName}`,
          });
        }

        setImportState((prev) => ({
          ...prev,
          isUploading: false,
        }));
        await refetchStatus();
        await handleForceCalculation();
      } catch (error) {
        setImportState((prev) => ({
          ...prev,
          importError: error instanceof Error ? error.message : "Failed to import data",
          isUploading: false,
        }));
      }
    },
    [
      importState?.previewData,
      importState?.fileData,
      importState?.fileName,
      importDataMutation,
      syncEpochMutation,
      // oxlint-disable-next-line
      refetchStatus,
      handleForceCalculation,
      setImportState,
    ]
  );

  const handleImportClose = useCallback(() => {
    setImportState((prev) => ({
      ...prev,
      showPreview: false,
      previewData: null,
      analyzeError: null,
      importError: null,
      fileData: null,
      fileName: null,
    }));
  }, [setImportState]);

  const handleRefreshStatus = useCallback(async () => {
    await Promise.all([refetchStatus(), refetchBotStatus(), refetchConfig()]);
    // oxlint-disable-next-line
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
