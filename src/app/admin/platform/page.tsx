// src/app/admin/platform/page.tsx
// Platform controls: time, bot, economy, import, system health, formulas, settings
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { ImportPreviewDialog } from "../_components";
import { CalculationEditor } from "../_components/CalculationEditor";
import { NavigationSettings } from "../_components/NavigationSettings";
import { IxTimeVisualizer } from "../_components/IxTimeVisualizer";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { SystemValidationDashboard } from "../_components/SystemValidationDashboard";
import { DatabaseExplorer } from "../_components/DatabaseExplorer";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import { useBotSync } from "../_hooks/useBotSync";
import {
  Settings,
  Clock,
  TrendingUp,
  HeartPulse,
  Wrench,
  Bell,
  Navigation,
  Database,
} from "lucide-react";
import { cn } from "~/lib/utils";

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

  const [activeTab, setActiveTab] = useState("time-bot");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Settings}
        title="Platform Controls"
        description="Time management, economy settings, bot controls, and system monitoring"
      />

      {/* Premium Glassmorphic Tab Switcher */}
      <div className="glass-surface border-border/40 mb-6 flex w-full max-w-full flex-wrap justify-start gap-2 rounded-xl p-1.5 shadow-sm backdrop-blur-md">
        {[
          {
            id: "time-bot",
            label: "Time & Bot",
            icon: Clock,
            color: "text-blue-500 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/30",
          },
          {
            id: "economy-import",
            label: "Economy & Import",
            icon: TrendingUp,
            color:
              "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30",
          },
          {
            id: "system-health",
            label: "System Health",
            icon: HeartPulse,
            color: "text-rose-500 border-rose-500/20 bg-rose-500/5 hover:border-rose-500/30",
          },
          {
            id: "calculation-editor",
            label: "Calculation Editor",
            icon: Wrench,
            color:
              "text-purple-500 border-purple-500/20 bg-purple-500/5 hover:border-purple-500/30",
          },
          {
            id: "navigation-settings",
            label: "Navigation Settings",
            icon: Navigation,
            color: "text-cyan-500 border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/30",
          },
          {
            id: "database-explorer",
            label: "Database Explorer",
            icon: Database,
            color:
              "text-indigo-500 border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/30",
          },
          {
            id: "notification-tests",
            label: "Notification Tests",
            icon: Bell,
            color: "text-amber-500 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30",
          },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold transition-all duration-200 select-none hover:scale-[1.02]",
                isActive
                  ? cn("shadow-sm", tab.color)
                  : "hover:bg-muted/10 hover:border-border/30 text-muted-foreground hover:text-foreground border-transparent bg-transparent"
              )}
            >
              <TabIcon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents with animations */}
      <div className="w-full">
        {/* Tab 1: Time & Bot */}
        {activeTab === "time-bot" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
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
          </div>
        )}

        {/* Tab 2: Economy & Import */}
        {activeTab === "economy-import" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <EconomicControlCard
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
          </div>
        )}

        {/* Tab 3: System Health */}
        {activeTab === "system-health" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <SystemMetricsCard />
            <SystemValidationDashboard />
            <FlagCacheManager />
          </div>
        )}

        {/* Tab 4: Calculation Editor */}
        {activeTab === "calculation-editor" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <CalculationEditor />
          </div>
        )}

        {/* Tab 5: Navigation Settings */}
        {activeTab === "navigation-settings" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <NavigationSettings />
          </div>
        )}

        {/* Tab 6: Database Explorer */}
        {activeTab === "database-explorer" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <DatabaseExplorer />
          </div>
        )}

        {/* Tab 7: Notification Tests */}
        {activeTab === "notification-tests" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <NotificationTestCard />
          </div>
        )}
      </div>

      <SaveConfigCard
        lastUpdate={actionState.lastUpdate}
        onSaveConfig={handleSaveConfig}
        savePending={actionState.savePending}
      />
    </div>
  );
}
