// src/app/admin/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Settings } from "lucide-react";

// Import all the components
import {
  ImportPreviewDialog,
  StatusCards,
  BotStatusBanner,
  BotControlPanel,
  TimeControlPanel,
  EconomicControlPanel,
  ActionPanel,
  DataImportSection,
  WarningPanel
} from "./_components";

// Import the CalculationLogs component
import { CalculationLogs } from "./_components/CalculationLogs";

// Import types with proper error handling
import type { 
  SystemConfig, 
  CalculationLog, 
  AdminPageBotStatusView, 
  SystemStatus, 
  BaseCountryData, 
  ImportAnalysis 
} from "~/types/ixstats";

export default function AdminDashboard() {
  // Local state
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [timeMultiplier, setTimeMultiplier] = useState(4);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [globalGrowthFactor, setGlobalGrowthFactor] = useState(1.0321);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [botSyncEnabled, setBotSyncEnabled] = useState(true);

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importChanges, setImportChanges] = useState<ImportAnalysis['changes']>([]);
  const [pendingFileData, setPendingFileData] = useState<string>("");
  const [pendingFileName, setPendingFileName] = useState<string | undefined>(undefined);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Data queries with proper error handling
  const { 
    data: systemConfig, 
    refetch: refetchConfig, 
    isLoading: configLoading,
    error: configError 
  } = api.admin.getSystemConfig.useQuery(undefined, {
    retry: 2,
    retryDelay: 1000,
  });

  const { 
    data: calculationLogsData, 
    refetch: refetchLogs, 
    isLoading: logsLoading,
    error: logsError 
  } = api.admin.getCalculationLogs.useQuery(undefined, {
    retry: 2,
    retryDelay: 1000,
  });
  
  const { 
    data: systemStatusData, 
    refetch: refetchStatus, 
    isLoading: statusLoading,
    error: statusError 
  } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 5000,
    retry: 2,
    retryDelay: 1000,
  });

  const { 
    data: botStatusData, 
    refetch: refetchBotStatus,
    error: botStatusError 
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 10000,
    retry: 1,
    retryDelay: 2000,
  });
  
  // Type-safe data parsing with fallbacks
  const botStatusView: AdminPageBotStatusView | undefined = (() => {
    try {
      return botStatusData ? (botStatusData as AdminPageBotStatusView) : undefined;
    } catch {
      return undefined;
    }
  })();

  const systemStatusView: SystemStatus | undefined = (() => {
    try {
      return systemStatusData ? (systemStatusData as SystemStatus) : undefined;
    } catch {
      return undefined;
    }
  })();

  const calculationLogs: CalculationLog[] | undefined = (() => {
    try {
      return calculationLogsData ? (calculationLogsData as CalculationLog[]) : undefined;
    } catch {
      return undefined;
    }
  })();

  // Mutations with proper error handling
  const updateConfigMutation = api.admin.updateSystemConfig.useMutation({
    onSuccess: () => {
      void refetchConfig();
      setLastUpdate(new Date());
    },
    onError: (error) => {
      console.error("Config update error:", error);
      alert(`Configuration update failed: ${error.message}`);
    },
  });

  const forceCalculationMutation = api.admin.forceCalculation.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      void refetchLogs();
      void refetchStatus();
      alert(`Calculation complete: ${data?.updated || 0} countries updated in ${data?.executionTime || 0}ms using ${data?.message?.includes('bot') ? 'bot' : 'local'} time.`);
    },
    onError: (error) => {
      console.error("Calculation error:", error);
      alert(`Calculation error: ${error.message}`);
    }
  });

  const setBotTimeMutation = api.admin.setBotTimeOverride.useMutation({
    onSuccess: () => {
      setLastUpdate(new Date());
      void refetchStatus();
      void refetchBotStatus();
    },
    onError: (error) => {
      console.error("Bot time override error:", error);
      alert(`Failed to set bot time: ${error.message}`);
    },
  });

  const syncWithBotMutation = api.admin.syncWithBot.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      void refetchStatus();
      void refetchBotStatus();
      alert(data?.success ? 'Successfully synced with Discord bot!' : `Sync failed: ${data?.message || 'Unknown error'}`);
    },
    onError: (error) => {
      console.error("Bot sync error:", error);
      alert(`Sync error: ${error.message}`);
    }
  });

  const pauseBotMutation = api.admin.pauseBotTime.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
    onError: (error) => {
      console.error("Pause bot error:", error);
      alert(`Failed to pause bot: ${error.message}`);
    },
  });

  const resumeBotMutation = api.admin.resumeBotTime.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
    onError: (error) => {
      console.error("Resume bot error:", error);
      alert(`Failed to resume bot: ${error.message}`);
    },
  });

  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
    onError: (error) => {
      console.error("Clear bot overrides error:", error);
      alert(`Failed to clear bot overrides: ${error.message}`);
    },
  });

  const analyzeImportMutation = api.countries.analyzeImport.useMutation({
    onSuccess: (data) => {
      setImportChanges((data.changes as ImportAnalysis['changes']) || []);
      setShowImportPreview(true);
      setIsAnalyzing(false);
      setAnalyzeError(null);
    },
    onError: (error) => {
      console.error("Import analysis error:", error);
      setAnalyzeError(error.message);
      setIsAnalyzing(false);
    },
  });

  const importMutation = api.countries.importFromExcel.useMutation({
    onSuccess: (data) => {
      setIsUploading(false);
      setShowImportPreview(false);
      setPendingFileData("");
      setPendingFileName(undefined);
      setImportError(null);
      
      const message = (data?.imported || 0) > 0 
        ? `Successfully imported ${data.imported} of ${data.totalInFile || 0} countries!`
        : `No new countries imported. ${data?.totalInFile || 0} countries were analyzed.`;
      alert(message);
      
      void refetchConfig(); 
      void refetchStatus();
    },
    onError: (error) => {
      console.error("Import error:", error);
      setImportError(error.message);
      setIsUploading(false);
    },
  });

  // Time display update effect
  const updateTimeDisplay = useCallback(() => {
    try {
      if (botStatusView?.formattedIxTime) { 
        setCurrentIxTime(botStatusView.formattedIxTime);
      } else if (systemStatusView?.ixTime?.formattedIxTime) { 
        setCurrentIxTime(systemStatusView.ixTime.formattedIxTime);
      } else {
        setCurrentIxTime(IxTime.formatIxTime(IxTime.getCurrentIxTime(), true)); 
      }
    } catch (error) {
      console.error("Error updating time display:", error);
      setCurrentIxTime("Error");
    }
  }, [botStatusView?.formattedIxTime, systemStatusView?.ixTime?.formattedIxTime]);

  useEffect(() => {
    updateTimeDisplay();
    const interval = setInterval(updateTimeDisplay, 1000);
    return () => clearInterval(interval);
  }, [updateTimeDisplay]);

  // System config effect
  useEffect(() => {
    if (systemConfig && Array.isArray(systemConfig)) {
      try {
        const multiplierConfig = systemConfig.find(c => c.key === 'time_multiplier');
        const growthConfig = systemConfig.find(c => c.key === 'global_growth_factor');
        const autoUpdateConfig = systemConfig.find(c => c.key === 'auto_update');
        const botSyncConfig = systemConfig.find(c => c.key === 'bot_sync_enabled');

        if (multiplierConfig) setTimeMultiplier(parseFloat(multiplierConfig.value) || 4);
        if (growthConfig) setGlobalGrowthFactor(parseFloat(growthConfig.value) || 1.0321);
        if (autoUpdateConfig) setAutoUpdate(autoUpdateConfig.value === 'true');
        if (botSyncConfig) setBotSyncEnabled(botSyncConfig.value === 'true');
      } catch (error) {
        console.error("Error parsing system config:", error);
      }
    }
  }, [systemConfig]);

  // Event handlers
  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setPendingFileName(file.name); 
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      setPendingFileData(base64);
      await analyzeImportMutation.mutateAsync({ fileData: base64, fileName: file.name }); 
    } catch (error) {
      console.error("File analysis error:", error);
      setAnalyzeError(error instanceof Error ? error.message : 'Unknown error');
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async (replaceExisting: boolean) => {
    if (!pendingFileData) return;
    setIsUploading(true);
    setImportError(null);
    
    try {
      await importMutation.mutateAsync({
        fileData: pendingFileData,
        fileName: pendingFileName, 
        replaceExisting,
      });
    } catch (error) {
      console.error("File import error:", error);
      setImportError(error instanceof Error ? error.message : 'Unknown error');
      setIsUploading(false);
    }
  };

  const handleClosePreview = () => {
    setShowImportPreview(false);
    setPendingFileData("");
    setPendingFileName(undefined);
    setImportChanges([]);
    setAnalyzeError(null);
    setImportError(null);
  };

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({
      configs: [
        { key: 'time_multiplier', value: timeMultiplier.toString() },
        { key: 'global_growth_factor', value: globalGrowthFactor.toString() },
        { key: 'auto_update', value: autoUpdate.toString() },
        { key: 'bot_sync_enabled', value: botSyncEnabled.toString() },
      ]
    });
  };

  const handleSetCustomTime = () => {
    if (customDate && customTime) {
      try {
        const [year, month, day] = customDate.split('-').map(Number);
        const [hour, minute] = customTime.split(':').map(Number);
        
        if (!year || !month || !day || hour === undefined || minute === undefined) {
          alert("Invalid date or time format");
          return;
        }
        
        const desiredIxTimeEpoch = IxTime.createGameTime(year, month, day, hour, minute);

        if (botSyncEnabled && botStatusView?.botHealth?.available) {
          setBotTimeMutation.mutate({ ixTime: desiredIxTimeEpoch, multiplier: timeMultiplier });
        } else {
          updateConfigMutation.mutate({
            configs: [
              { key: 'time_multiplier', value: '0' },
            ]
          });
          alert("Bot not available or sync disabled. Time multiplier set to 0 (paused). Specific date override requires bot sync.");
        }
      } catch (error) {
        console.error("Error setting custom time:", error);
        alert("Failed to set custom time. Please check your date and time values.");
      }
    }
  };

  const handleResetToRealTime = () => {
    if (botSyncEnabled && botStatusView?.botHealth?.available) {
      clearBotOverridesMutation.mutate();
    } else {
      setTimeMultiplier(4);
      updateConfigMutation.mutate({
        configs: [
          { key: 'time_multiplier', value: '4' },
        ]
      });
    }
  };

  // Show error state if critical queries fail
  if (configError || statusError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
              Admin Dashboard Error
            </h1>
            <p className="text-red-700 dark:text-red-300">
              Failed to load admin dashboard data. Please check your server configuration.
            </p>
            {configError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                Config Error: {configError.message}
              </p>
            )}
            {statusError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                Status Error: {statusError.message}
              </p>
            )}
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <ImportPreviewDialog
        isOpen={showImportPreview}
        onClose={handleClosePreview}
        onConfirm={handleConfirmImport}
        changes={importChanges}
        isLoading={isUploading}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Settings className="h-8 w-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            IxStats Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Control IxTime flow, global economic factors, data imports, and system operations. Current IxTime: {currentIxTime}
          </p>
        </div>

        <BotStatusBanner
          botStatus={botStatusView}
          onSync={() => syncWithBotMutation.mutate()}
          onRefresh={() => void refetchBotStatus()}
          syncPending={syncWithBotMutation.isPending}
        />

        <StatusCards
          systemStatus={systemStatusView}
          botStatus={botStatusView}
          statusLoading={statusLoading}
          configLoading={configLoading}
          globalGrowthFactor={globalGrowthFactor}
        />

        <DataImportSection
          onFileSelect={handleFileUpload}
          isUploading={isUploading}
          isAnalyzing={isAnalyzing}
          analyzeError={analyzeError}
          importError={importError}
        />

        <BotControlPanel
          botStatus={botStatusView}
          onPauseBot={() => pauseBotMutation.mutate()}
          onResumeBot={() => resumeBotMutation.mutate()}
          onClearOverrides={() => clearBotOverridesMutation.mutate()}
          pausePending={pauseBotMutation.isPending}
          resumePending={resumeBotMutation.isPending}
          clearPending={clearBotOverridesMutation.isPending}
        />

        <TimeControlPanel
          timeMultiplier={timeMultiplier}
          customDate={customDate}
          customTime={customTime}
          botSyncEnabled={botSyncEnabled}
          botStatus={botStatusView}
          onTimeMultiplierChange={setTimeMultiplier}
          onCustomDateChange={setCustomDate}
          onCustomTimeChange={setCustomTime}
          onSetCustomTime={handleSetCustomTime}
          onResetToRealTime={handleResetToRealTime}
          setTimePending={setBotTimeMutation.isPending}
        />

        <EconomicControlPanel
          globalGrowthFactor={globalGrowthFactor}
          autoUpdate={autoUpdate}
          botSyncEnabled={botSyncEnabled}
          onGlobalGrowthFactorChange={setGlobalGrowthFactor}
          onAutoUpdateChange={setAutoUpdate}
          onBotSyncEnabledChange={setBotSyncEnabled}
          onForceCalculation={() => forceCalculationMutation.mutate()}
          calculationPending={forceCalculationMutation.isPending}
        />

        <ActionPanel
          lastUpdate={lastUpdate}
          onSaveConfig={handleSaveConfig}
          savePending={updateConfigMutation.isPending}
        />
        
        <CalculationLogs
          logs={calculationLogs}
          isLoading={logsLoading}
          error={logsError?.message}
        />

        <WarningPanel systemStatus={systemStatusView} />
      </div>
    </div>
  );
}