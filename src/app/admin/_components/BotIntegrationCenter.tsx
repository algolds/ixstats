// src/app/admin/_components/BotIntegrationCenter.tsx
"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { SystemCronScheduleWidget } from "./SystemCronScheduleWidget";
import { BotControlCard } from "./platform/BotControlCard";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import { useBotSync } from "../_hooks/useBotSync";
import { Cpu } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { LorewardsBotSection } from "./platform/LorewardsBotSection";

export function BotIntegrationCenter() {
  usePageTitle({ title: "Admin - Bot Settings" });

  const { config, setConfig, timeState, importState, setImportState, actionState, setActionState } =
    useAdminState();

  // tRPC queries
  const { refetch: refetchStatus } = api.admin.getSystemStatus.useQuery(undefined, {
    enabled: false,
  });

  const { data: botStatus, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(
    undefined,
    {
      refetchInterval: 15000,
      refetchOnWindowFocus: false,
    }
  );

  const { data: configData, refetch: refetchConfig } = api.admin.getConfig.useQuery();

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

  // Sync Bot
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
    handleSyncEpoch,
    handleSyncFromBot,
    handlePauseBot,
    handleResumeBot,
    handleClearOverrides,
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
        icon={Cpu}
        title="Bot Settings"
        description="Monitor Discord bot synchronizations, toggle rate limits, clear override caches, and track automated cron schedules."
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General Controls</TabsTrigger>
          <TabsTrigger value="lorewards">Lorewards Bot</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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

            <SystemCronScheduleWidget />
          </div>
        </TabsContent>
        <TabsContent value="lorewards" className="mt-6">
          <LorewardsBotSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
