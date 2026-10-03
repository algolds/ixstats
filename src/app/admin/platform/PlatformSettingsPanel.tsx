"use client";
// src/app/admin/platform/PlatformSettingsPanel.tsx
// Unified General Settings & Platform Control Panel

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
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
      <PageHeader
        title="Platform settings"
        subtitle="Engine parameters, time overrides, autosave telemetry and diagnostics."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-fill-3 rounded-row flex w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="general" className="text-caption flex items-center gap-2">
            <TrendingUp className="text-green h-4 w-4" />
            Economic controls
          </TabsTrigger>
          <TabsTrigger value="autosave" className="text-caption flex items-center gap-2">
            <Activity className="text-green h-4 w-4" />
            Autosave monitor
          </TabsTrigger>
          <TabsTrigger value="time" className="text-caption flex items-center gap-2">
            <Clock className="text-blue h-4 w-4" />
            Time override
          </TabsTrigger>
          <TabsTrigger value="system-health" className="text-caption flex items-center gap-2">
            <HeartPulse className="text-red h-4 w-4" />
            System diagnostics
          </TabsTrigger>
          <TabsTrigger value="navigation" className="text-caption flex items-center gap-2">
            <Navigation className="text-teal h-4 w-4" />
            Navigation controls
          </TabsTrigger>
          <TabsTrigger value="database" className="text-caption flex items-center gap-2">
            <Database className="text-indigo h-4 w-4" />
            Database explorer
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
