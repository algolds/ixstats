"use client";
// src/app/admin/_components/BotIntegrationCenter.tsx

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { SystemCronScheduleWidget } from "./SystemCronScheduleWidget";
import { BotControlCard } from "./platform/BotControlCard";
import { api } from "~/trpc/react";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";
import { Cpu } from "iconoir-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { LorewardsBotSection } from "./platform/LorewardsBotSection";

export function BotIntegrationCenter() {
  usePageTitle({ title: "Admin - Bot Settings" });

  // oxlint-disable-next-line eslint/no-unused-vars
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

  // oxlint-disable-next-line eslint/no-unused-vars
  const { data: configData, refetch: refetchConfig } = api.admin.getConfig.useQuery();

  // Handlers
  const {
    handleSyncEpoch,
    handleSyncFromBot,
    handlePauseBot,
    handleResumeBot,
    handleClearOverrides,
  } = useAdminHandlers({
    config,
    setActionState,
    setConfig,
    refetchStatus,
    refetchBotStatus,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bot settings"
        subtitle="Discord bot sync, rate limits, override caches and cron schedules."
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-fill-3 rounded-row mb-4 flex w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger
            value="general"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            <Cpu className="h-3.5 w-3.5" />
            General controls & crons
          </TabsTrigger>
          <TabsTrigger
            value="lorewards"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
          >
            Lorewards bot
          </TabsTrigger>
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
