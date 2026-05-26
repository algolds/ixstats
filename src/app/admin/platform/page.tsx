// src/app/admin/platform/page.tsx
// Platform controls: time, bot, economy, import, system health, formulas, settings
"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { ImportPreviewDialog } from "../_components";
import { CalculationEditor } from "../_components/CalculationEditor";
import { NavigationSettings } from "../_components/NavigationSettings";
import { IxTimeVisualizer } from "../_components/IxTimeVisualizer";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { SystemValidationDashboard } from "../_components/SystemValidationDashboard";
import { SystemLogs } from "../_components/SystemLogs";
import { DatabaseExplorer } from "../_components/DatabaseExplorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import { useBotSync } from "../_hooks/useBotSync";
import { Settings, Clock, TrendingUp, HeartPulse, Wrench, Bell } from "lucide-react";

import { TimeControlCard } from "../_components/platform/TimeControlCard";
import { BotControlCard } from "../_components/platform/BotControlCard";
import { EconomicControlCard } from "../_components/platform/EconomicControlCard";
import { SaveConfigCard } from "../_components/platform/SaveConfigCard";
import { CalculationLogsCard } from "../_components/platform/CalculationLogsCard";
import { DataImportCard } from "../_components/platform/DataImportCard";
import { SystemMetricsCard } from "../_components/platform/SystemMetricsCard";
import { NotificationTestCard } from "../_components/platform/NotificationTestCard";

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
  const { data: _systemStatus, refetch: refetchStatus } = api.admin.getSystemStatus.useQuery(
    undefined,
    {
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    }
  );

  const { data: botStatus, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(
    undefined,
    {
      refetchInterval: 15000,
      refetchOnWindowFocus: false,
    }
  );

  const { data: configData, refetch: refetchConfig } = api.admin.getConfig.useQuery();

  const {
    data: calculationLogs,
    isLoading: logsLoading,
    error: logsError,
  } = api.admin.getCalculationLogs.useQuery({ limit: 10 });

  // tRPC mutations
  const saveConfigMutation = api.admin.saveConfig.useMutation();
  const forceCalculationMutation = api.admin.forceRecalculation.useMutation();
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
        baseInflationRate: configData.baseInflationRate ?? 0.02,
        tierGrowthModifiers: configData.tierGrowthModifiers ?? {
          Impoverished: 1.0,
          Developing: 1.0,
          Developed: 1.0,
          Healthy: 1.0,
          Strong: 1.0,
          "Very Strong": 1.0,
          Extravagant: 1.0,
        },
        diminishingReturnsThreshold: configData.diminishingReturnsThreshold ?? 60000,
        diminishingReturnsFactor: configData.diminishingReturnsFactor ?? 0.5,
        minGrowthFloor: configData.minGrowthFloor ?? -0.1,
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

      <Tabs defaultValue="time-bot" className="w-full">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="time-bot" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Time & Bot
          </TabsTrigger>
          <TabsTrigger value="economy-import" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Economy & Import
          </TabsTrigger>
          <TabsTrigger value="system-health" className="gap-1.5">
            <HeartPulse className="h-4 w-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="formulas-settings" className="gap-1.5">
            <Wrench className="h-4 w-4" />
            Formulas & Settings
          </TabsTrigger>
          <TabsTrigger value="notification-tests" className="gap-1.5">
            <Bell className="h-4 w-4" />
            Notification Tests
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Time & Bot */}
        <TabsContent value="time-bot" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TimeControlCard
              timeMultiplier={config.timeMultiplier}
              customDate={timeState.customDate}
              customTime={timeState.customTime}
              onTimeMultiplierChange={handleTimeMultiplierChange}
              onCustomDateChange={(value) =>
                setTimeState((prev) => ({ ...prev, customDate: value }))
              }
              onCustomTimeChange={(value) =>
                setTimeState((prev) => ({ ...prev, customTime: value }))
              }
              onSetCustomTime={handleSetCustomTime}
              onResetToRealTime={handleResetToRealTime}
              setTimePending={actionState.setTimePending}
            />
            <BotControlCard
              botStatus={botStatus}
              onPauseBot={handlePauseBot}
              onResumeBot={handleResumeBot}
              onClearOverrides={handleClearOverrides}
              onSyncFromBot={handleSyncFromBot}
              onSyncEpoch={handleSyncEpoch}
              pausePending={actionState.pausePending}
              resumePending={actionState.resumePending}
              clearPending={actionState.clearPending}
              autoSyncPending={actionState.autoSyncPending}
              syncEpochPending={actionState.syncEpochPending}
              lastBotSync={actionState.lastBotSync}
            />
          </div>
          <IxTimeVisualizer />
        </TabsContent>

        {/* Tab 2: Economy & Import */}
        <TabsContent value="economy-import" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <EconomicControlCard
              globalGrowthFactor={config.globalGrowthFactor}
              autoUpdate={config.autoUpdate}
              botSyncEnabled={config.botSyncEnabled}
              onGlobalGrowthFactorChange={(value) =>
                setConfig((prev) => ({ ...prev, globalGrowthFactor: value }))
              }
              onAutoUpdateChange={(value) => setConfig((prev) => ({ ...prev, autoUpdate: value }))}
              onBotSyncEnabledChange={(value) =>
                setConfig((prev) => ({ ...prev, botSyncEnabled: value }))
              }
              onForceCalculation={handleForceCalculation}
              calculationPending={actionState.calculationPending}
              baseInflationRate={config.baseInflationRate}
              onBaseInflationRateChange={(value) =>
                setConfig((prev) => ({ ...prev, baseInflationRate: value }))
              }
              tierGrowthModifiers={config.tierGrowthModifiers}
              onTierGrowthModifierChange={(tier, value) =>
                setConfig((prev) => ({
                  ...prev,
                  tierGrowthModifiers: { ...prev.tierGrowthModifiers, [tier]: value },
                }))
              }
              diminishingReturnsThreshold={config.diminishingReturnsThreshold}
              onDiminishingReturnsThresholdChange={(value) =>
                setConfig((prev) => ({ ...prev, diminishingReturnsThreshold: value }))
              }
              diminishingReturnsFactor={config.diminishingReturnsFactor}
              onDiminishingReturnsFactorChange={(value) =>
                setConfig((prev) => ({ ...prev, diminishingReturnsFactor: value }))
              }
              minGrowthFloor={config.minGrowthFloor}
              onMinGrowthFloorChange={(value) =>
                setConfig((prev) => ({ ...prev, minGrowthFloor: value }))
              }
            />
            <DataImportCard
              onFileSelect={handleFileSelect}
              isUploading={importState.isUploading}
              isAnalyzing={importState.isAnalyzing}
              analyzeError={importState.analyzeError}
              importError={importState.importError}
            />
          </div>
          {importState.showPreview && importState.previewData && (
            <ImportPreviewDialog
              isOpen={importState.showPreview}
              onClose={handleImportClose}
              onConfirm={handleImportConfirm}
              changes={importState.previewData.changes}
              isLoading={importState.isUploading}
            />
          )}
          <CalculationLogsCard
            logs={calculationLogs}
            isLoading={logsLoading}
            error={logsError?.message}
          />
        </TabsContent>

        {/* Tab 3: System Health */}
        <TabsContent value="system-health" className="space-y-6">
          <SystemMetricsCard />
          <SystemValidationDashboard />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <FlagCacheManager />
            <SystemLogs />
          </div>
        </TabsContent>

        {/* Tab 4: Formulas & Settings */}
        <TabsContent value="formulas-settings" className="space-y-6">
          <CalculationEditor />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <NavigationSettings />
            <DatabaseExplorer />
          </div>
        </TabsContent>

        {/* Tab 5: Notification Tests */}
        <TabsContent value="notification-tests" className="space-y-6">
          <NotificationTestCard />
        </TabsContent>
      </Tabs>

      <SaveConfigCard
        lastUpdate={actionState.lastUpdate}
        onSaveConfig={handleSaveConfig}
        savePending={actionState.savePending}
      />
    </div>
  );
}
