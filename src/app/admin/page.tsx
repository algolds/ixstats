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
  // CalculationLogs, // Commented out as its export is not available/verified
  DataImportSection,
  WarningPanel
} from "./_components";

// Import SystemConfig from types
import type { SystemConfig, CalculationLog as CalculationLogType, AdminPageBotStatusView, SystemStatus } from "~/types/ixstats";


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
  const { data: calculationLogsData, refetch: refetchLogs, isLoading: logsLoading } = api.admin.getCalculationLogs.useQuery();
  
  // Type the data from useQuery hooks explicitly for clarity
  const { data: systemStatusData, refetch: refetchStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: botStatusData, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 10000, 
  });
  
  // Cast to the correct types for component props
  const botStatusView: AdminPageBotStatusView | undefined = botStatusData as AdminPageBotStatusView | undefined;
  const systemStatusView: SystemStatus | undefined = systemStatusData as SystemStatus | undefined;
  const calculationLogs: CalculationLogType[] | undefined = calculationLogsData as CalculationLogType[] | undefined;


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
      
      const message = data.imported > 0 
        ? `Successfully imported ${data.imported} of ${data.totalInFile} countries!`
        : `No new countries imported. ${data.totalInFile} countries were analyzed.`;
      alert(message);
      void refetchConfig(); // To update country count etc.
      void refetchStatus();
    },
    onError: (error) => {
      console.error("Import error:", error);
      alert(`Import Error: ${error.message}`);
      setIsUploading(false);
    },
  });

  useEffect(() => {
    const updateTimeDisplay = () => {
      if (botStatusView?.formattedIxTime) { // Prioritize botStatusView which comes from admin.getBotStatus
        setCurrentIxTime(botStatusView.formattedIxTime);
      } else if (systemStatusView?.ixTime?.formattedIxTime) { // Fallback to systemStatusView
        setCurrentIxTime(systemStatusView.ixTime.formattedIxTime);
      } else {
        setCurrentIxTime(IxTime.formatIxTime(IxTime.getCurrentIxTime(), true)); // Ultimate fallback
      }
    };

    updateTimeDisplay();
    const interval = setInterval(updateTimeDisplay, 1000);
    return () => clearInterval(interval);
  }, [botStatusView, systemStatusView]);

  useEffect(() => {
    if (systemConfig) {
      const multiplierConfig = systemConfig.find(c => c.key === 'time_multiplier');
      const growthConfig = systemConfig.find(c => c.key === 'global_growth_factor');
      const autoUpdateConfig = systemConfig.find(c => c.key === 'auto_update');
      const botSyncConfig = systemConfig.find(c => c.key === 'bot_sync_enabled');

      if (multiplierConfig) setTimeMultiplier(parseFloat(multiplierConfig.value));
      if (growthConfig) setGlobalGrowthFactor(parseFloat(growthConfig.value));
      if (autoUpdateConfig) setAutoUpdate(autoUpdateConfig.value === 'true');
      if (botSyncConfig) setBotSyncEnabled(botSyncConfig.value === 'true');
    }
  }, [systemConfig]);

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      setPendingFileData(base64);
      await analyzeImportMutation.mutateAsync({ fileData: base64 });
    } catch (error) {
      console.error("File analysis error:", error);
      setIsAnalyzing(false);
      alert(`Error preparing file for analysis: ${error instanceof Error ? error.message : String(error)}`);
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
      // Error is alerted in mutation's onError
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

      if (botSyncEnabled && botStatusView?.botHealth?.available) {
        setBotTimeMutation.mutate({ ixTime: desiredIxTimeEpoch });
      } else {
        // Fallback to legacy method - ensure this mutation exists or handle differently
        // For now, let's assume setBotTimeMutation is the preferred way and local is a fallback.
        // The original code had setCurrentIxTime which implies a different API.
        // We are using setBotTimeOverride for bot interaction.
        // If bot is not synced, changing time locally might be complex without a specific API endpoint for it.
        // We'll rely on the bot for custom time setting if bot_sync_enabled.
        alert("Bot sync is enabled. Custom time will be set via bot. If bot is offline, this might not take effect immediately on the bot.");
        console.warn("Attempting to set custom time. Bot sync enabled:", botSyncEnabled, "Bot available:", botStatusView?.botHealth?.available);
        // If truly local override is needed without bot, IxTime.setTimeOverride would be used,
        // but this doesn't persist or reflect centrally unless explicitly designed.
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
    if (botSyncEnabled && botStatusView?.botHealth?.available) {
      clearBotOverridesMutation.mutate();
    } else {
      // This part handles local reset if bot isn't synced/available
      setTimeMultiplier(4); 
      // IxTime.clearTimeOverride(); // Example if IxTime class handled this directly
      // IxTime.clearMultiplierOverride();
      // To persist, we should update config through mutation if these were config values
      updateConfigMutation.mutate({
         configs: [
            { key: 'time_multiplier', value: '4' }, // Reset to default
            // Potentially clear other local overrides if stored in DB via SystemConfig
         ]
      });
      alert("Local time settings reset towards default. Save config to persist.");
    }
  };

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
          onSync={handleSyncWithBot}
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
          analyzeError={analyzeImportMutation.error?.message || null}
          importError={importMutation.error?.message || null}
        />

        <BotControlPanel
          botStatus={botStatusView}
          onPauseBot={handlePauseBot}
          onResumeBot={handleResumeBot}
          onClearOverrides={handleClearBotOverrides}
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
          onForceCalculation={handleForceCalculation}
          calculationPending={forceCalculationMutation.isPending}
        />

        <ActionPanel
          lastUpdate={lastUpdate}
          onSaveConfig={handleSaveConfig}
          savePending={updateConfigMutation.isPending}
        />
        
        {/*
        <CalculationLogs
          logs={calculationLogs}
          isLoading={logsLoading}
        />
        */}
        { calculationLogs && calculationLogs.length > 0 && (
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Calculation Logs</h2>
                {logsLoading && <p>Loading logs...</p>}
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {calculationLogs.map(log => (
                        <li key={log.id} className="text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded">
                            {new Date(log.timestamp).toLocaleString()}: Updated {log.countriesUpdated} countries. IxTime: {new Date(log.ixTimeTimestamp).toLocaleTimeString()}. Duration: {log.executionTimeMs}ms.
                        </li>
                    ))}
                </ul>
            </div>
        )}


        <WarningPanel systemStatus={systemStatusView} />
      </div>
    </div>
  );
}