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
import type { SystemConfig, CalculationLog as CalculationLogType, AdminPageBotStatusView, SystemStatus, BaseCountryData, ImportAnalysis } from "~/types/ixstats";


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
  const [importChanges, setImportChanges] = useState<ImportAnalysis['changes']>([]);
  const [pendingFileData, setPendingFileData] = useState<string>("");
  const [pendingFileName, setPendingFileName] = useState<string | undefined>(undefined);


  // Get system configuration
  const { data: systemConfig, refetch: refetchConfig, isLoading: configLoading } = api.admin.getSystemConfig.useQuery();
  const { data: calculationLogsData, refetch: refetchLogs, isLoading: logsLoading } = api.admin.getCalculationLogs.useQuery();
  
  const { data: systemStatusData, refetch: refetchStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: botStatusData, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 10000, 
  });
  
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

  const analyzeImportMutation = api.countries.analyzeImport.useMutation({
    onSuccess: (data) => {
      setImportChanges(data.changes as ImportAnalysis['changes']); // Cast to ensure type alignment
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
      setPendingFileName(undefined);
      
      const message = data.imported > 0 
        ? `Successfully imported ${data.imported} of ${data.totalInFile} countries!`
        : `No new countries imported. ${data.totalInFile} countries were analyzed.`;
      alert(message);
      void refetchConfig(); 
      void refetchStatus();
      void refetchCountries(); // Refetch country list on dashboard/countries page
    },
    onError: (error) => {
      console.error("Import error:", error);
      alert(`Import Error: ${error.message}`);
      setIsUploading(false);
    },
  });
  
  // Added to potentially refetch countries data on other pages after import
  const { refetch: refetchCountries } = api.countries.getAll.useQuery(undefined, { enabled: false });


  useEffect(() => {
    const updateTimeDisplay = () => {
      if (botStatusView?.formattedIxTime) { 
        setCurrentIxTime(botStatusView.formattedIxTime);
      } else if (systemStatusView?.ixTime?.formattedIxTime) { 
        setCurrentIxTime(systemStatusView.ixTime.formattedIxTime);
      } else {
        setCurrentIxTime(IxTime.formatIxTime(IxTime.getCurrentIxTime(), true)); 
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
    setPendingFileName(file.name); 
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      setPendingFileData(base64);
      await analyzeImportMutation.mutateAsync({ fileData: base64, fileName: file.name }); 
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
        fileName: pendingFileName, 
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
    setPendingFileName(undefined);
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
        setBotTimeMutation.mutate({ ixTime: desiredIxTimeEpoch, multiplier: timeMultiplier }); // Pass multiplier
      } else {
         // If bot not synced, update local config directly if that's the desired behavior
        updateConfigMutation.mutate({
            configs: [
                { key: 'time_multiplier', value: '0' }, // Pause time by setting multiplier to 0
                // This approach for setting a specific date locally via config is not directly supported by current IxTime logic
                // IxTime.setTimeOverride() is local to the class instance and not persisted.
                // A robust solution for local custom time would involve a dedicated system config for the override timestamp.
            ]
        });
        alert("Bot not available or sync disabled. Time override set locally (multiplier to 0). Specific date override requires bot or different config setup.");
        console.warn("Attempting to set custom time. Bot sync enabled:", botSyncEnabled, "Bot available:", botStatusView?.botHealth?.available);
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
       // Optionally, also reset local multiplier if it's managed separately
       // For simplicity, we assume bot clear also handles this.
    } else {
      // Reset local config for time_multiplier
      setTimeMultiplier(4); // Default multiplier
      updateConfigMutation.mutate({
         configs: [
            { key: 'time_multiplier', value: '4' },
         ]
      });
      alert("Local time settings reset. Save config to persist.");
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
        
        { calculationLogs && calculationLogs.length > 0 && (
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Calculation Logs</h2>
                {logsLoading && <p>Loading logs...</p>}
                <ul className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
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