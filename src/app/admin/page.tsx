// src/app/admin/page.tsx
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
} from "./_components"; // Assuming these are correctly refactored and exported from index
import { AdminErrorBoundary } from "./_components/ErrorBoundary"; // Keep your error boundary

import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { CONFIG_CONSTANTS } from "~/lib/config-service";
import type { 
  ImportAnalysis,
  CalculationLog // Make sure this type is correctly defined or imported
} from "~/types/ixstats";

// Shadcn UI imports (if not handled by individual components)
// import { Button } from "~/components/ui/button";
// import { Toaster } from "~/components/ui/toaster"; // If you use toasts for notifications
// import { useToast } from "~/components/ui/use-toast"; // For toast notifications

export default function AdminPage() {
  // const { toast } = useToast(); // For notifications

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
    previewData: null as ImportAnalysis | null, // Ensure ImportAnalysis has a 'changes' field
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
    refetchInterval: 30000,
    refetchOnWindowFocus: true, // Consider if this is desired
  });

  const { 
    data: botStatus, 
    isLoading: botStatusLoading,
    refetch: refetchBotStatus 
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: true, // Consider if this is desired
  });

  const { 
    data: configData, 
    isLoading: configLoading,
    refetch: refetchConfig 
  } = api.admin.getConfig.useQuery();

  const { 
    data: calculationLogsData, // Renamed to avoid conflict if CalculationLog type is also named 'calculationLogs'
    isLoading: logsLoading,
    error: logsError 
  } = api.admin.getCalculationLogs.useQuery({ limit: 10 });
  
  const calculationLogs: CalculationLog[] | null | undefined = calculationLogsData;


  // TRPC Mutations
  const saveConfigMutation = api.admin.saveConfig.useMutation();
  const forceCalculationMutation = api.countries.updateStats.useMutation(); // Assuming this is the correct mutation
  const setCustomTimeMutation = api.admin.setCustomTime.useMutation();
  const analyzeImportMutation = api.admin.analyzeImport.useMutation();
  const importDataMutation = api.admin.importRosterData.useMutation();

  const syncBotMutation = api.admin.syncBot.useMutation();
  const pauseBotMutation = api.admin.pauseBot.useMutation();
  const resumeBotMutation = api.admin.resumeBot.useMutation();
  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation();

  // Load initial config
  useEffect(() => {
    if (configData) {
      setConfig({
        globalGrowthFactor: configData.globalGrowthFactor ?? (CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR as number),
        autoUpdate: configData.autoUpdate ?? true,
        botSyncEnabled: configData.botSyncEnabled ?? true,
        timeMultiplier: configData.timeMultiplier ?? 4.0,
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
      // toast({ title: "Success", description: "Configuration saved." });
    } catch (error) {
      console.error("Failed to save config:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to save configuration." });
    } finally {
      setActionState(prev => ({ ...prev, savePending: false }));
    }
  }, [config, saveConfigMutation, refetchConfig /*, toast*/]);

  const handleForceCalculation = useCallback(async () => {
    setActionState(prev => ({ ...prev, calculationPending: true }));
    try {
      await forceCalculationMutation.mutateAsync({});
      await refetchStatus();
      // toast({ title: "Initiated", description: "Forced calculation started." });
    } catch (error) {
      console.error("Failed to force calculation:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to start calculation." });
    } finally {
      setActionState(prev => ({ ...prev, calculationPending: false }));
    }
  }, [forceCalculationMutation, refetchStatus /*, toast*/]);

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
      // toast({ title: "Success", description: "Custom time set." });
    } catch (error) {
      console.error("Failed to set custom time:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to set custom time." });
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [timeState, config.timeMultiplier, setCustomTimeMutation, refetchStatus, refetchBotStatus /*, toast*/]);

  const handleResetToRealTime = useCallback(async () => {
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      await setCustomTimeMutation.mutateAsync({ 
        ixTime: IxTime.getCurrentIxTime(), // Ensure this provides the correct structure
        multiplier: 4.0 
      });
      setConfig(prev => ({ ...prev, timeMultiplier: 4.0 }));
      await refetchStatus();
      await refetchBotStatus();
      // toast({ title: "Success", description: "Time reset to real-time." });
    } catch (error) {
      console.error("Failed to reset time:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to reset time." });
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [setCustomTimeMutation, refetchStatus, refetchBotStatus /*, toast*/]);

  const handleSyncBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, syncPending: true }));
    try {
      await syncBotMutation.mutateAsync();
      await refetchBotStatus();
      await refetchStatus(); // Also refresh system status as bot sync might impact it
      // toast({ title: "Initiated", description: "Bot synchronization started." });
    } catch (error) {
      console.error("Failed to sync bot:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to sync bot." });
    } finally {
      setActionState(prev => ({ ...prev, syncPending: false }));
    }
  }, [syncBotMutation, refetchBotStatus, refetchStatus /*, toast*/]);

  const handlePauseBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, pausePending: true }));
    try {
      await pauseBotMutation.mutateAsync();
      await refetchBotStatus();
      // toast({ title: "Success", description: "Bot paused." });
    } catch (error) {
      console.error("Failed to pause bot:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to pause bot." });
    } finally {
      setActionState(prev => ({ ...prev, pausePending: false }));
    }
  }, [pauseBotMutation, refetchBotStatus /*, toast*/]);

  const handleResumeBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, resumePending: true }));
    try {
      await resumeBotMutation.mutateAsync();
      await refetchBotStatus();
      // toast({ title: "Success", description: "Bot resumed." });
    } catch (error) {
      console.error("Failed to resume bot:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to resume bot." });
    } finally {
      setActionState(prev => ({ ...prev, resumePending: false }));
    }
  }, [resumeBotMutation, refetchBotStatus /*, toast*/]);

  const handleClearOverrides = useCallback(async () => {
    setActionState(prev => ({ ...prev, clearPending: true }));
    try {
      await clearBotOverridesMutation.mutateAsync();
      await refetchBotStatus();
      // toast({ title: "Success", description: "Bot overrides cleared." });
    } catch (error) {
      console.error("Failed to clear overrides:", error);
      // toast({ variant: "destructive", title: "Error", description: "Failed to clear overrides." });
    } finally {
      setActionState(prev => ({ ...prev, clearPending: false }));
    }
  }, [clearBotOverridesMutation, refetchBotStatus /*, toast*/]);

  const handleFileSelect = useCallback(async (file: File) => {
    setImportState(prev => ({ 
      ...prev, 
      isAnalyzing: true, 
      analyzeError: null, 
      importError: null 
    }));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const analysis = await analyzeImportMutation.mutateAsync({
        fileData: Array.from(new Uint8Array(arrayBuffer)), // Ensure this matches backend expectations
        fileName: file.name,
      });
      
      setImportState(prev => ({ 
        ...prev, 
        previewData: analysis, 
        showPreview: true 
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze file";
      setImportState(prev => ({ ...prev, analyzeError: errorMessage }));
      // toast({ variant: "destructive", title: "Analysis Error", description: errorMessage });
    } finally {
      setImportState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [analyzeImportMutation /*, toast*/]);

  const handleImportConfirm = useCallback(async (replaceExisting: boolean) => {
    if (!importState.previewData) return;
    
    setImportState(prev => ({ ...prev, isUploading: true, importError: null }));
    
    try {
      // Assuming analysisId is part of previewData or can be derived
      // For example, if previewData itself is the analysis object expected by the backend
      // or if it contains an ID. Using a simple string for now.
      const analysisId = importState.previewData.totalCountries?.toString() ?? Date.now().toString();

      await importDataMutation.mutateAsync({
        analysisId: analysisId, 
        replaceExisting,
        // Pass the actual data or reference if your backend analyzeImport created a temporary store
        // This example assumes importRosterData uses the analysisId to fetch the analyzed data
      });
      
      setImportState(prev => ({ 
        ...prev, 
        showPreview: false, 
        previewData: null 
      }));
      
      await refetchStatus();
      await handleForceCalculation(); // Optionally trigger recalculation
      // toast({ title: "Success", description: "Data imported successfully." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to import data";
      setImportState(prev => ({ ...prev, importError: errorMessage }));
      // toast({ variant: "destructive", title: "Import Error", description: errorMessage });
    } finally {
      setImportState(prev => ({ ...prev, isUploading: false }));
    }
  }, [importState.previewData, importDataMutation, refetchStatus, handleForceCalculation /*, toast*/]);


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
    // toast({ title: "Refreshing...", description: "Fetching latest status." });
    await Promise.all([
      refetchStatus(),
      refetchBotStatus(),
      refetchConfig(),
    ]);
  }, [refetchStatus, refetchBotStatus, refetchConfig /*, toast*/]);

  return (
    <AdminErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              IxStats Admin Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage system configuration, time settings, and data imports.
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

          {/* Control Panels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

            <EconomicControlPanel
              globalGrowthFactor={config.globalGrowthFactor}
              autoUpdate={config.autoUpdate}
              botSyncEnabled={config.botSyncEnabled}
              onGlobalGrowthFactorChange={(value) => 
                setConfig(prev => ({ ...prev, globalGrowthFactor: value }))
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
            logs={calculationLogs} // Use the renamed variable
            isLoading={logsLoading}
            error={logsError?.message}
          />

          {/* Import Preview Dialog */}
          {importState.showPreview && importState.previewData && (
            <ImportPreviewDialog
              isOpen={importState.showPreview}
              onClose={handleImportClose}
              onConfirm={handleImportConfirm}
              // Ensure previewData.changes exists and matches ImportChange[]
              changes={importState.previewData.changes ?? []} 
              isLoading={importState.isUploading}
            />
          )}
        </div>
        {/* <Toaster /> */}
      </div>
    </AdminErrorBoundary>
  );
}
