// src/app/admin/platform/page.tsx
// Platform controls: time, economy, bot, system monitor, formulas, data import
"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import {
  BotControlPanel,
  TimeControlPanel,
  EconomicControlPanel,
  ActionPanel,
  CalculationLogs,
  DataImportSection,
  ImportPreviewDialog,
} from "../_components";
import { SystemOverview } from "../_components/SystemOverview";
import { CalculationEditor } from "../_components/CalculationEditor";
import { NavigationSettings } from "../_components/NavigationSettings";
import { IxTimeVisualizer } from "../_components/IxTimeVisualizer";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import { useBotSync } from "../_hooks/useBotSync";
import { Settings } from "lucide-react";

export default function PlatformPage() {
  usePageTitle({ title: "Admin - Platform" });

  const {
    config,
    setConfig,
    timeState,
    setTimeState,
    importState,
    setImportState,
    actionState,
    setActionState,
  } = useAdminState();

  // tRPC queries
  const {
    data: _systemStatus,
    refetch: refetchStatus,
  } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const {
    data: botStatus,
    refetch: refetchBotStatus,
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  const {
    data: configData,
    refetch: refetchConfig,
  } = api.admin.getConfig.useQuery();

  const {
    data: calculationLogs,
    isLoading: logsLoading,
    error: logsError,
  } = api.admin.getCalculationLogs.useQuery({ limit: 10 });

  // tRPC mutations
  const saveConfigMutation = api.admin.saveConfig.useMutation();
  const forceCalculationMutation = api.countries.updateStats.useMutation();
  const setCustomTimeMutation = api.admin.setCustomTime.useMutation();
  const analyzeImportMutation = api.admin.analyzeImport.useMutation();
  const importDataMutation = api.admin.importRosterData.useMutation();
  const syncEpochMutation = api.admin.syncEpochWithData.useMutation();
  const syncBotMutation = api.admin.syncBot.useMutation();
  const pauseBotMutation = api.admin.pauseBot.useMutation();
  const resumeBotMutation = api.admin.resumeBot.useMutation();
  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation();

  // Load config
  useEffect(() => {
    if (configData) {
      setConfig({
        globalGrowthFactor: configData.globalGrowthFactor || 1.0,
        autoUpdate: configData.autoUpdate ?? true,
        botSyncEnabled: configData.botSyncEnabled ?? true,
        timeMultiplier: configData.timeMultiplier || 2.0,
      });
    }
  }, [configData, setConfig]);

  // Bot sync
  useBotSync({
    botStatus,
    timeMultiplier: config.timeMultiplier,
    botSyncEnabled: config.botSyncEnabled,
    autoSyncPending: actionState.autoSyncPending,
    setActionState,
    setTimeMultiplier: (value) => setConfig((prev) => ({ ...prev, timeMultiplier: value })),
    refetchStatus,
    refetchBotStatus,
  });

  // Handlers
  const {
    handleSaveConfig,
    handleForceCalculation,
    handleSetCustomTime,
    handleResetToRealTime,
    handleTimeMultiplierChange,
    handleSyncEpoch,
    handleSyncFromBot,
    handlePauseBot,
    handleResumeBot,
    handleClearOverrides,
    handleFileSelect,
    handleImportConfirm,
    handleImportClose,
  } = useAdminHandlers({
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
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Settings}
        title="Platform Controls"
        description="Time management, economy settings, bot controls, and system monitoring"
      />

      <Tabs defaultValue="time-economy" className="w-full">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="time-economy">Time & Economy</TabsTrigger>
          <TabsTrigger value="bot-sync">Bot & Sync</TabsTrigger>
          <TabsTrigger value="system">System Monitor</TabsTrigger>
          <TabsTrigger value="formulas">Formulas</TabsTrigger>
          <TabsTrigger value="data-import">Data Import</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="time-economy" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="glass-card-parent rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/5 p-6">
              <TimeControlPanel
                timeMultiplier={config.timeMultiplier}
                customDate={timeState.customDate}
                customTime={timeState.customTime}
                botSyncEnabled={config.botSyncEnabled}
                botStatus={botStatus}
                onTimeMultiplierChange={handleTimeMultiplierChange}
                onCustomDateChange={(value) =>
                  setTimeState((prev) => ({ ...prev, customDate: value }))
                }
                onCustomTimeChange={(value) =>
                  setTimeState((prev) => ({ ...prev, customTime: value }))
                }
                onSetCustomTime={handleSetCustomTime}
                onResetToRealTime={handleResetToRealTime}
                onSyncEpoch={handleSyncEpoch}
                onSyncFromBot={handleSyncFromBot}
                setTimePending={actionState.setTimePending}
                syncEpochPending={actionState.syncEpochPending}
                autoSyncPending={actionState.autoSyncPending}
                lastBotSync={actionState.lastBotSync}
              />
            </div>
            <div className="glass-card-parent rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 p-6">
              <EconomicControlPanel
                globalGrowthFactor={config.globalGrowthFactor}
                autoUpdate={config.autoUpdate}
                botSyncEnabled={config.botSyncEnabled}
                onGlobalGrowthFactorChange={(value) =>
                  setConfig((prev) => ({ ...prev, globalGrowthFactor: value }))
                }
                onAutoUpdateChange={(value) =>
                  setConfig((prev) => ({ ...prev, autoUpdate: value }))
                }
                onBotSyncEnabledChange={(value) =>
                  setConfig((prev) => ({ ...prev, botSyncEnabled: value }))
                }
                onForceCalculation={handleForceCalculation}
                calculationPending={actionState.calculationPending}
              />
            </div>
          </div>
          <ActionPanel
            lastUpdate={actionState.lastUpdate}
            onSaveConfig={handleSaveConfig}
            savePending={actionState.savePending}
          />
          <IxTimeVisualizer />
        </TabsContent>

        <TabsContent value="bot-sync" className="space-y-6">
          <div className="glass-card-parent rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-600/5 p-6">
            <BotControlPanel
              botStatus={botStatus}
              onPauseBot={handlePauseBot}
              onResumeBot={handleResumeBot}
              onClearOverrides={handleClearOverrides}
              pausePending={actionState.pausePending}
              resumePending={actionState.resumePending}
              clearPending={actionState.clearPending}
            />
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <SystemOverview />
          <CalculationLogs
            logs={calculationLogs}
            isLoading={logsLoading}
            error={logsError?.message}
          />
          <FlagCacheManager />
        </TabsContent>

        <TabsContent value="formulas">
          <CalculationEditor />
        </TabsContent>

        <TabsContent value="data-import" className="space-y-6">
          <DataImportSection
            onFileSelect={handleFileSelect}
            isUploading={importState.isUploading}
            isAnalyzing={importState.isAnalyzing}
            analyzeError={importState.analyzeError}
            importError={importState.importError}
          />
          {importState.showPreview && importState.previewData && (
            <ImportPreviewDialog
              isOpen={importState.showPreview}
              onClose={handleImportClose}
              onConfirm={handleImportConfirm}
              changes={importState.previewData.changes}
              isLoading={importState.isUploading}
            />
          )}
        </TabsContent>

        <TabsContent value="settings">
          <NavigationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
