// src/app/admin/page.tsx
// FIXED: Updated admin page to work with current system

"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  StatusCards,
  BotStatusBanner,
  BotControlPanel,
  TimeControlPanel,
  EconomicControlPanel,
  ActionPanel,
  CalculationLogs,
  DataImportSection,
  WarningPanel,
  ImportPreviewDialog,
} from "./_components";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { CONFIG_CONSTANTS } from "~/lib/config-service";
import type { 
  SystemStatus, 
  AdminPageBotStatusView, 
  ImportAnalysis,
  BaseCountryData,
  CalculationLog
} from "~/types/ixstats";
import { AdminErrorBoundary } from "./_components/ErrorBoundary";
import { SignedIn, SignedOut, SignInButton, useUser, UserButton } from "@clerk/nextjs";

export default function AdminPage() {
  const { user, isLoaded } = useUser();

  // Show loading spinner while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is signed in but not an admin, show access denied
  if (user && user.publicMetadata?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    );
  }

  // State management
  const [config, setConfig] = useState({
    globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR as number,
    autoUpdate: true,
    botSyncEnabled: true,
    timeMultiplier: 4.0,
  });
  
  const [timeState, setTimeState] = useState({
    customDate: new Date().toISOString().split('T')[0] || "",
    customTime: "12:00",
  });
  
  const [importState, setImportState] = useState({
    isUploading: false,
    isAnalyzing: false,
    analyzeError: null as string | null,
    importError: null as string | null,
    previewData: null as ImportAnalysis | null,
    showPreview: false,
  });
  
  const [actionState, setActionState] = useState({
    calculationPending: false,
    setTimePending: false,
    savePending: false,
    syncPending: false,
    pausePending: false,
    resumePending: false,
    clearPending: false,
    lastUpdate: null as Date | null,
  });

  // TRPC Queries
  const { 
    data: systemStatus, 
    isLoading: statusLoading, 
    refetch: refetchStatus 
  } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: false,
  });

  const { 
    data: botStatus, 
    isLoading: botStatusLoading,
    refetch: refetchBotStatus 
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 15000, // Refresh every 15 seconds
    refetchOnWindowFocus: false,
  });

  const { 
    data: configData, 
    isLoading: configLoading,
    refetch: refetchConfig 
  } = api.admin.getConfig.useQuery();

  const { 
    data: calculationLogs, 
    isLoading: logsLoading,
    error: logsError 
  } = api.admin.getCalculationLogs.useQuery({ limit: 10 });

  // TRPC Mutations
  const saveConfigMutation = api.admin.saveConfig.useMutation();
  const forceCalculationMutation = api.countries.updateStats.useMutation();
  const setCustomTimeMutation = api.admin.setCustomTime.useMutation();
  const analyzeImportMutation = api.admin.analyzeImport.useMutation();
  const importDataMutation = api.admin.importRosterData.useMutation();

  // Bot control mutations
  const syncBotMutation = api.admin.syncBot.useMutation();
  const pauseBotMutation = api.admin.pauseBot.useMutation();
  const resumeBotMutation = api.admin.resumeBot.useMutation();
  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation();

  // Load initial config
  useEffect(() => {
    if (configData) {
      setConfig({
        globalGrowthFactor: configData.globalGrowthFactor || CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR,
        autoUpdate: configData.autoUpdate ?? true,
        botSyncEnabled: configData.botSyncEnabled ?? true,
        timeMultiplier: configData.timeMultiplier || 4.0,
      });
    }
  }, [configData]);

  // Handlers
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
  }, [config, saveConfigMutation, refetchConfig]);

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
  }, [forceCalculationMutation, refetchStatus]);

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
  }, [timeState, config.timeMultiplier, setCustomTimeMutation, refetchStatus, refetchBotStatus]);

  const handleResetToRealTime = useCallback(async () => {
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      await setCustomTimeMutation.mutateAsync({ 
        ixTime: IxTime.getCurrentIxTime(),
        multiplier: 4.0 
      });
      setConfig(prev => ({ ...prev, timeMultiplier: 4.0 }));
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to reset time:", error);
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [setCustomTimeMutation, refetchStatus, refetchBotStatus]);

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
  }, [syncBotMutation, refetchBotStatus, refetchStatus]);

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
  }, [pauseBotMutation, refetchBotStatus]);

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
  }, [resumeBotMutation, refetchBotStatus]);

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
  }, [clearBotOverridesMutation, refetchBotStatus]);

  // Import handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setImportState(prev => ({ 
      ...prev, 
      isAnalyzing: true, 
      analyzeError: null, 
      importError: null 
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Convert file to ArrayBuffer for the mutation
      const arrayBuffer = await file.arrayBuffer();
      
      const analysis = await analyzeImportMutation.mutateAsync({
        fileData: Array.from(new Uint8Array(arrayBuffer)),
        fileName: file.name,
      });
      
      setImportState(prev => ({ 
        ...prev, 
        previewData: analysis, 
        showPreview: true 
      }));
    } catch (error) {
      setImportState(prev => ({ 
        ...prev, 
        analyzeError: error instanceof Error ? error.message : "Failed to analyze file" 
      }));
    } finally {
      setImportState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [analyzeImportMutation]);

  const handleImportConfirm = useCallback(async (replaceExisting: boolean) => {
    if (!importState.previewData) return;
    
    setImportState(prev => ({ ...prev, isUploading: true, importError: null }));
    
    try {
      await importDataMutation.mutateAsync({
        analysisId: importState.previewData.totalCountries.toString(), // Use a simple ID
        replaceExisting,
      });
      
      setImportState(prev => ({ 
        ...prev, 
        showPreview: false, 
        previewData: null 
      }));
      
      // Refresh status and trigger recalculation
      await refetchStatus();
      await handleForceCalculation();
    } catch (error) {
      setImportState(prev => ({ 
        ...prev, 
        importError: error instanceof Error ? error.message : "Failed to import data" 
      }));
    } finally {
      setImportState(prev => ({ ...prev, isUploading: false }));
    }
  }, [importState.previewData, importDataMutation, refetchStatus, handleForceCalculation]);

  const handleImportClose = useCallback(() => {
    setImportState(prev => ({ 
      ...prev, 
      showPreview: false, 
      previewData: null,
      analyzeError: null,
      importError: null 
    }));
  }, []);

  const handleRefreshStatus = useCallback(async () => {
    await Promise.all([
      refetchStatus(),
      refetchBotStatus(),
      refetchConfig(),
    ]);
  }, [refetchStatus, refetchBotStatus, refetchConfig]);

  return (
    <>
      <SignedIn>
        <AdminErrorBoundary>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  IxStats Admin Dashboard
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  Manage system configuration, time settings, and data imports
                </p>
              </div>

              {/* Bot Status Banner */}
              <BotStatusBanner
                botStatus={botStatus}
                onSync={handleSyncBot}
                onRefresh={handleRefreshStatus}
                syncPending={actionState.syncPending}
              />

              {/* Status Cards */}
              <StatusCards
                systemStatus={systemStatus}
                botStatus={botStatus}
                statusLoading={statusLoading || botStatusLoading}
                configLoading={configLoading}
                globalGrowthFactor={config.globalGrowthFactor}
              />

              {/* Warning Panel */}
              <WarningPanel systemStatus={systemStatus} />

              {/* Control Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Time Control */}
                <TimeControlPanel
                  timeMultiplier={config.timeMultiplier}
                  customDate={timeState.customDate}
                  customTime={timeState.customTime}
                  botSyncEnabled={config.botSyncEnabled}
                  botStatus={botStatus}
                  onTimeMultiplierChange={(value) => 
                    setConfig(prev => ({ ...prev, timeMultiplier: value }))
                  }
                  onCustomDateChange={(value) => 
                    setTimeState(prev => ({ ...prev, customDate: value }))
                  }
                  onCustomTimeChange={(value) => 
                    setTimeState(prev => ({ ...prev, customTime: value }))
                  }
                  onSetCustomTime={handleSetCustomTime}
                  onResetToRealTime={handleResetToRealTime}
                  setTimePending={actionState.setTimePending}
                />

                {/* Economic Control */}
                <EconomicControlPanel
                  globalGrowthFactor={config.globalGrowthFactor}
                  autoUpdate={config.autoUpdate}
                  botSyncEnabled={config.botSyncEnabled}
                  onGlobalGrowthFactorChange={(value) => 
                    setConfig(prev => ({ ...prev, globalGrowthFactor: value as number }))
                  }
                  onAutoUpdateChange={(value) => 
                    setConfig(prev => ({ ...prev, autoUpdate: value }))
                  }
                  onBotSyncEnabledChange={(value) => 
                    setConfig(prev => ({ ...prev, botSyncEnabled: value }))
                  }
                  onForceCalculation={handleForceCalculation}
                  calculationPending={actionState.calculationPending}
                />
              </div>

              {/* Bot Control Panel */}
              <BotControlPanel
                botStatus={botStatus}
                onPauseBot={handlePauseBot}
                onResumeBot={handleResumeBot}
                onClearOverrides={handleClearOverrides}
                pausePending={actionState.pausePending}
                resumePending={actionState.resumePending}
                clearPending={actionState.clearPending}
              />

              {/* Data Import Section */}
              <DataImportSection
                onFileSelect={handleFileSelect}
                isUploading={importState.isUploading}
                isAnalyzing={importState.isAnalyzing}
                analyzeError={importState.analyzeError}
                importError={importState.importError}
              />

              {/* Action Panel */}
              <ActionPanel
                lastUpdate={actionState.lastUpdate}
                onSaveConfig={handleSaveConfig}
                savePending={actionState.savePending}
              />

              {/* Calculation Logs */}
              <CalculationLogs
                logs={calculationLogs}
                isLoading={logsLoading}
                error={logsError?.message}
              />

              {/* Flag Cache Manager */}
              <div className="mb-8">
                <FlagCacheManager />
              </div>

              {/* Import Preview Dialog */}
              {importState.showPreview && importState.previewData && (
                <ImportPreviewDialog
                  isOpen={importState.showPreview}
                  onClose={handleImportClose}
                  onConfirm={handleImportConfirm}
                  changes={importState.previewData.changes}
                  isLoading={importState.isUploading}
                />
              )}
            </div>
          </div>
        </AdminErrorBoundary>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
}