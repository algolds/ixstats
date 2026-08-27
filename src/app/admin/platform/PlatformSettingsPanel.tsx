// src/app/admin/platform/PlatformSettingsPanel.tsx
// Unified General Settings & Platform Control Panel
"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { ImportPreviewDialog } from "../_components/ImportPreviewDialog";
import { NavigationSettings } from "../_components/NavigationSettings";
import { IxTimeVisualizer } from "../_components/IxTimeVisualizer";
import { SystemValidationDashboard } from "../_components/SystemValidationDashboard";
import { DatabaseExplorer } from "../_components/DatabaseExplorer";
import { AutosaveMonitoringDashboard } from "../_components/AutosaveMonitoringDashboard";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import {
  Settings,
  Clock,
  StatUp as TrendingUp,
  Heart as HeartPulse,
  Navigator as Navigation,
  Database,
  Activity,
} from "iconoir-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { TimeControlCard } from "../_components/platform/TimeControlCard";
import { EconomicControlCard } from "../_components/platform/EconomicControlCard";
import { CalculationLogsCard } from "../_components/platform/CalculationLogsCard";
import { DataImportCard } from "../_components/platform/DataImportCard";

interface PlatformSettingsPanelProps {
  defaultTab?: string;
}

export function PlatformSettingsPanel({ defaultTab = "general" }: PlatformSettingsPanelProps) {
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

  const { refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(undefined, {
    enabled: false,
  });

  const { data: configData, refetch: refetchConfig } = api.admin.getConfig.useQuery();

  const {
    data: calculationLogs,
    isLoading: logsLoading,
    error: logsError,
  } = api.admin.getCalculationLogs.useQuery({ limit: 10 });

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
    handleTimeMultiplierChange,
    handleSetCustomTime,
    handleResetToRealTime,
    handleForceCalculation,
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
    refetchConfig,
    refetchStatus,
    refetchBotStatus,
  });

  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Settings}
        title="General Settings & Platform Controls"
        description="Global engine parameters, time override multipliers, spatial autosave telemetry, and system diagnostic monitors."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="general"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Economic Controls
          </TabsTrigger>
          <TabsTrigger
            value="autosave"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Activity className="h-4 w-4 text-emerald-400" />
            Autosave Monitor
          </TabsTrigger>
          <TabsTrigger
            value="time"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Clock className="h-4 w-4 text-blue-400" />
            Time Override
          </TabsTrigger>
          <TabsTrigger
            value="system-health"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <HeartPulse className="h-4 w-4 text-rose-400" />
            System Diagnostics
          </TabsTrigger>
          <TabsTrigger
            value="navigation"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4 text-cyan-400" />
            Navigation Controls
          </TabsTrigger>
          <TabsTrigger
            value="database"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Database className="h-4 w-4 text-indigo-400" />
            Database Explorer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6 focus-visible:outline-none">
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

        <TabsContent value="autosave" className="mt-6 space-y-6 focus-visible:outline-none">
          <AutosaveMonitoringDashboard />
        </TabsContent>

        <TabsContent value="time" className="mt-6 space-y-6 focus-visible:outline-none">
          <TimeControlCard
            timeMultiplier={config.timeMultiplier}
            customDate={timeState.customDate}
            customTime={timeState.customTime}
            onTimeMultiplierChange={handleTimeMultiplierChange}
            onCustomDateChange={(value) => setTimeState((prev) => ({ ...prev, customDate: value }))}
            onCustomTimeChange={(value) => setTimeState((prev) => ({ ...prev, customTime: value }))}
            onSetCustomTime={handleSetCustomTime}
            onResetToRealTime={handleResetToRealTime}
            setTimePending={actionState.setTimePending}
          />
          <IxTimeVisualizer />
        </TabsContent>

        <TabsContent value="system-health" className="mt-6 space-y-6 focus-visible:outline-none">
          <SystemValidationDashboard />
        </TabsContent>

        <TabsContent value="navigation" className="mt-6 space-y-6 focus-visible:outline-none">
          <NavigationSettings />
        </TabsContent>

        <TabsContent value="database" className="mt-6 space-y-6 focus-visible:outline-none">
          <DatabaseExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PlatformSettingsPanel;
