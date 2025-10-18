// src/app/admin/_hooks/useBotSync.ts
// Bot synchronization logic

import { useEffect } from "react";
import { withBasePath } from "~/lib/base-path";
import type { AdminPageBotStatusView } from "~/types/ixstats";
import type { ActionState } from "./useAdminState";

interface UseBotSyncParams {
  botStatus: AdminPageBotStatusView | undefined;
  timeMultiplier: number;
  botSyncEnabled: boolean;
  autoSyncPending: boolean;
  setActionState: React.Dispatch<React.SetStateAction<ActionState>>;
  setTimeMultiplier: (value: number) => void;
  refetchStatus: () => Promise<unknown>;
  refetchBotStatus: () => Promise<unknown>;
}

export function useBotSync({
  botStatus,
  timeMultiplier,
  botSyncEnabled,
  autoSyncPending,
  setActionState,
  setTimeMultiplier,
  refetchStatus,
  refetchBotStatus,
}: UseBotSyncParams) {
  useEffect(() => {
    if (!botSyncEnabled || !botStatus || autoSyncPending) return;

    const currentMultiplier = timeMultiplier;
    // Check if bot multiplier differs from dashboard config
    const botMultiplier = botStatus.multiplier;
    const dashboardMultiplier = currentMultiplier;

    // If bot multiplier differs from what we expect, sync from bot
    if (botMultiplier && botMultiplier !== dashboardMultiplier) {
      console.log(`Bot multiplier (${botMultiplier}) differs from dashboard (${dashboardMultiplier}), syncing...`);

      setActionState(prev => ({ ...prev, autoSyncPending: true }));

      // Sync from bot to admin panel
      fetch(withBasePath('/api/ixtime/sync-from-bot'), { method: 'POST' })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            console.log('Successfully synced from Discord bot:', result.message);
            // Update local config to match bot
            setTimeMultiplier(botMultiplier);
            setActionState(prev => ({ ...prev, lastBotSync: new Date() }));
            // Refresh status data
            refetchStatus();
            refetchBotStatus();
          } else {
            console.warn('Failed to sync from Discord bot:', result.error);
          }
        })
        .catch(error => {
          console.warn('Error syncing from Discord bot:', error);
        })
        .finally(() => {
          setActionState(prev => ({ ...prev, autoSyncPending: false }));
        });
    }
  }, [botStatus, timeMultiplier, botSyncEnabled, autoSyncPending, setActionState, setTimeMultiplier, refetchStatus, refetchBotStatus]);
}
