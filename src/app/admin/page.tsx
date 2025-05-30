// src/app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Settings } from "lucide-react";

// Import all the new components
import {
  ImportPreviewDialog,
  StatusCards,
  BotStatusBanner,
  BotControlPanel,
  TimeControlPanel,
  EconomicControlPanel,
  ActionPanel,
  CalculationLogs,
  DataImportSection,
  WarningPanel
} from "./_components";

// Import SystemConfig from types
import type { SystemConfig } from "~/types/ixstats";

interface CalculationLog {
  id: string;
  timestamp: Date;
  ixTimeTimestamp: Date;
  countriesUpdated: number;
  executionTimeMs: number;
  globalGrowthFactor: number;
}

export default function AdminDashboard() {
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
  const [importChanges, setImportChanges] = useState<any[]>([]);
  const [pendingFileData, setPendingFileData] = useState<string>("");

  // Get system configuration
  const { data: systemConfig, refetch: refetchConfig, isLoading: configLoading } = api.admin.getSystemConfig.useQuery();
  const { data: calculationLogs, refetch: refetchLogs, isLoading: logsLoading } = api.admin.getCalculationLogs.useQuery();
  const { data: systemStatus, refetch: refetchStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: botStatus, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 10000, // Check bot status every 10 seconds
  });

  // Mutations
  const updateConfigMutation = api.admin.updateSystemConfig.useMutation({
    onSuccess: () => {
      void refetchConfig();
      setLastUpdate(new Date());
    },
  });

  const forceCalculationMutation = api.admin.forceCalculation.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      void refetchLogs();
      alert(`Calculation complete: ${data?.updated} countries updated in ${data?.executionTime}ms using ${data.message.includes('bot') ? 'bot' : 'local'} time.`);
    },
    onError: (error) => {
        alert(`Calculation error: ${error.message}`);
    }
  });

  const setBotTimeMutation = api.admin.setBotTimeOverride.useMutation({
    onSuccess: () => {
      setLastUpdate(new Date());
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  const syncWithBotMutation = api.admin.syncWithBot.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      void refetchStatus();
      void refetchBotStatus();
      alert(data.success ? 'Successfully synced with Discord bot!' : `Sync failed: ${data.message}`);
    },
    onError: (error) => {
      alert(`Sync error: ${error.message}`);
    }
  });

  const pauseBotMutation = api.admin.pauseBotTime.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  const resumeBotMutation = api.admin.resumeBotTime.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  // File upload mutations
  const analyzeImportMutation = api.countries.analyzeImport.useMutation({
    onSuccess: (data) => {
      setImportChanges(data.changes);
      setShowImportPreview(true);
      setIsAnalyzing(false);
    },
    onError: (error) => {
      console.error("Import analysis error:", error);
      alert(`Analysis Error: ${error.message}`);
      setIsAnalyzing(false);
    },
  });

  const importMutation = api.countries.importFromExcel.useMutation({
    onSuccess: (data) => {
      setIsUploading(false);
      setShowImportPreview(false);
      setPendingFileData("");
      
      // Show success message
      const message = data.imported > 0 
        ? `Successfully imported ${data.imported} of ${data.totalInFile} countries!`
        : `No new countries imported. ${data.totalInFile} countries were analyzed.`;
      alert(message);
    },
    onError: (error) => {
      console.error("Import error:", error);
      alert(`Import Error: ${error.message}`);
      setIsUploading(false);
    },
  });

  // Update IxTime display from systemStatus if available, otherwise local IxTime
  useEffect(() => {
    const updateTimeDisplay = () => {
      if (systemStatus?.ixTime?.formattedIxTime) {
        setCurrentIxTime(systemStatus.ixTime.formattedIxTime);
      } else {
        setCurrentIxTime(IxTime.formatIxTime(IxTime.getCurrentIxTime(), true));
      }
    };

    updateTimeDisplay();
    const interval = setInterval(updateTimeDisplay, 1000);
    return () => clearInterval(interval);
  }, [systemStatus]);

  // Load system config into state with proper type handling
  useEffect(() => {
    if (systemConfig) {
      const multiplier = systemConfig.find((c) => c.key === 'time_multiplier');
      const growth = systemConfig.find((c) => c.key === 'global_growth_factor');
      const autoUpd = systemConfig.find((c) => c.key === 'auto_update');
      const botSync = systemConfig.find((c) => c.key === 'bot_sync_enabled');

      if (multiplier) setTimeMultiplier(parseFloat(multiplier.value));
      if (growth) setGlobalGrowthFactor(parseFloat(growth.value));
      if (autoUpd) setAutoUpdate(autoUpd.value === 'true');
      if (botSync) setBotSyncEnabled(botSync.value === 'true');
    }
  }, [systemConfig]);

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      setPendingFileData(base64);
      
      // First, analyze the import
      await analyzeImportMutation.mutateAsync({
        fileData: base64,
      });
    } catch (error) {
      console.error("File analysis error:", error);
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async (replaceExisting: boolean) => {
    if (!pendingFileData) return;
    
    setIsUploading(true);
    
    try {
      await importMutation.mutateAsync({
        fileData: pendingFileData,
        replaceExisting,
      });
    } catch (error) {
      console.error("File import error:", error);
      setIsUploading(false);
    }
  };

  const handleClosePreview = () => {
    setShowImportPreview(false);
    setPendingFileData("");
    setImportChanges([]);
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
      const [year, month, day] = customDate.split('-').map(Number);
      const [hour, minute] = customTime.split(':').map(Number);
      
      const desiredIxTimeEpoch = IxTime.createGameTime(year!, month!, day!, hour, minute);

      if (botSyncEnabled && botStatus?.botHealth?.available) {
        setBotTimeMutation.mutate({
          ixTime: desiredIxTimeEpoch,
        });
      } else {
        // Fallback to legacy method
        const setIxTimeMutation = api.admin.setCurrentIxTime.useMutation({
          onSuccess: () => {
            void refetchConfig();
            void refetchStatus();
          }
        });
        setIxTimeMutation.mutate({
          ixTime: desiredIxTimeEpoch,
        });
      }
    }
  };

  const handleForceCalculation = () => {
    forceCalculationMutation.mutate();
  };

  const handleSyncWithBot = () => {
    syncWithBotMutation.mutate();
  };

  const handlePauseBot = () => {
    pauseBotMutation.mutate();
  };

  const handleResumeBot = () => {
    resumeBotMutation.mutate();
  };

  const handleClearBotOverrides = () => {
    clearBotOverridesMutation.mutate();
  };

  const handleResetToRealTime = () => {
    if (botSyncEnabled && botStatus?.botHealth?.available) {
      clearBotOverridesMutation.mutate();
    } else {
      setTimeMultiplier(4);
      setGlobalGrowthFactor(1.0321);
      setAutoUpdate(true);
      const resetMutation = api.admin.resetIxTime.useMutation({
        onSuccess: () => {
          void refetchConfig();
          void refetchStatus();
        }
      });
      resetMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        isOpen={showImportPreview}
        onClose={handleClosePreview}
        onConfirm={handleConfirmImport}
        changes={importChanges}
        isLoading={isUploading}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Settings className="h-8 w-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            IxStats Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Control IxTime flow, global economic factors, data imports, and system operations
          </p>
        </div>

        {/* Bot Status Banner */}
        <BotStatusBanner
          botStatus={botStatus}
          onSync={handleSyncWithBot}
          onRefresh={() => void refetchBotStatus()}
          syncPending={syncWithBotMutation.isPending}
        />

        {/* Current Status Cards */}
        <StatusCards
          systemStatus={systemStatus}
          botStatus={botStatus}
          statusLoading={statusLoading}
          configLoading={configLoading}
          globalGrowthFactor={globalGrowthFactor}
        />

        {/* Data Import Section */}
        <DataImportSection
          onFileSelect={handleFileUpload}
          isUploading={isUploading}
          isAnalyzing={isAnalyzing}
          analyzeError={analyzeImportMutation.error?.message || null}
          importError={importMutation.error?.message || null}
        />

        {/* Bot Control Panel */}
        <BotControlPanel
          botStatus={botStatus}
          onPauseBot={handlePauseBot}
          onResumeBot={handleResumeBot}
          onClearOverrides={handleClearBotOverrides}
          pausePending={pauseBotMutation.isPending}
          resumePending={resumeBotMutation.isPending}
          clearPending={clearBotOverridesMutation.isPending}
        />

        {/* Time Control Panel */}
        <TimeControlPanel
          timeMultiplier={timeMultiplier}
          customDate={customDate}
          customTime={customTime}
          botSyncEnabled={botSyncEnabled}
          botStatus={botStatus}
          onTimeMultiplierChange={setTimeMultiplier}
          onCustomDateChange={setCustomDate}
          onCustomTimeChange={setCustomTime}
          onSetCustomTime={handleSetCustomTime}
          onResetToRealTime={handleResetToRealTime}
          setTimePending={setBotTimeMutation.isPending}
        />

        {/* Economic Control Panel */}
        <EconomicControlPanel
          globalGrowthFactor={globalGrowthFactor}
          autoUpdate={autoUpdate}
          botSyncEnabled={botSyncEnabled}
          onGlobalGrowthFactorChange={setGlobalGrowthFactor}
          onAutoUpdateChange={setAutoUpdate}
          onBotSyncEnabledChange={setBotSyncEnabled}
          onForceCalculation={handleForceCalculation}
          calculationPending={forceCalculationMutation.isPending}
        />

        {/* Action Panel */}
        <ActionPanel
          lastUpdate={lastUpdate}
          onSaveConfig={handleSaveConfig}
          savePending={updateConfigMutation.isPending}
        />

        {/* Recent Calculation Logs */}
        <CalculationLogs
          logs={calculationLogs}
          isLoading={logsLoading}
        />

        {/* Warning Panel */}
        <WarningPanel systemStatus={systemStatus} />
      </div>
    </div>
  );
}