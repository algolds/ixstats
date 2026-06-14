// src/app/admin/_components/GeneralSettingsContent.tsx
"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { ImportPreviewDialog } from "./ImportPreviewDialog";
import { NavigationSettings } from "./NavigationSettings";
import { IxTimeVisualizer } from "./IxTimeVisualizer";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { SystemValidationDashboard } from "./SystemValidationDashboard";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import { Settings, Clock, TrendingUp, HeartPulse, Navigation, Database } from "lucide-react";
import { cn } from "~/lib/utils";

import { TimeControlCard } from "./platform/TimeControlCard";
import { EconomicControlCard } from "./platform/EconomicControlCard";
import { SaveConfigCard } from "./platform/SaveConfigCard";
import { CalculationLogsCard } from "./platform/CalculationLogsCard";
import { DataImportCard } from "./platform/DataImportCard";
import { SystemMetricsCard } from "./platform/SystemMetricsCard";

export function GeneralSettingsContent() {
  usePageTitle({ title: "Admin - General Settings" });

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
  const { refetch: refetchStatus } = api.admin.getSystemStatus.useQuery(undefined, {
    enabled: false,
  });

  // eslint-disable-next-line unused-imports/no-unused-vars
  const { data: botStatus, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(
    undefined,
    { enabled: false }
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

  // Handlers
  const {
    handleSaveConfig,
    handleForceCalculation,
    handleSetCustomTime,
    handleResetToRealTime,
    handleTimeMultiplierChange,
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

  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Settings}
        title="General Settings"
        description="Configure time, economic rates, XML rosters, data validation, and navigation preferences."
      />

      {/* Premium Tab Switcher */}
      <div className="glass-surface border-border/40 mb-6 flex w-full max-w-full flex-wrap justify-start gap-2 rounded-xl p-1.5 shadow-sm backdrop-blur-md">
        {[
          {
            id: "general",
            label: "Economic Config",
            icon: TrendingUp,
            color:
              "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30",
          },
          {
            id: "time",
            label: "Time Override",
            icon: Clock,
            color: "text-blue-500 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/30",
          },
          {
            id: "system-health",
            label: "System Diagnostics",
            icon: HeartPulse,
            color: "text-rose-500 border-rose-500/20 bg-rose-500/5 hover:border-rose-500/30",
          },
          {
            id: "navigation",
            label: "Navigation Controls",
            icon: Navigation,
            color: "text-cyan-500 border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/30",
          },
          {
            id: "database",
            label: "Database Explorer",
            icon: Database,
            color:
              "text-indigo-500 border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/30",
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

      {/* Tab Contents */}
      <div className="w-full">
        {activeTab === "general" && (
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

        {activeTab === "time" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
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
            <IxTimeVisualizer />
          </div>
        )}

        {activeTab === "system-health" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <SystemMetricsCard />
            <SystemValidationDashboard />
            <FlagCacheManager />
          </div>
        )}

        {activeTab === "navigation" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <NavigationSettings />
          </div>
        )}

        {activeTab === "database" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <DatabaseExplorer />
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
