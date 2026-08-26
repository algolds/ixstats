// src/app/admin/_components/BotIntegrationCenter.tsx
"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
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
      <AdminHeader
        icon={Cpu}
        title="Bot Settings"
        description="Monitor Discord bot synchronizations, toggle rate limits, clear override caches, and track automated cron schedules."
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger value="general" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-[0.98] transition-transform">
            <Cpu className="h-3.5 w-3.5" />
            General Controls & Crons
          </TabsTrigger>
          <TabsTrigger value="lorewards" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-[0.98] transition-transform">
            Lorewards Bot
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
