"use client";

import React from "react";
import { NotificationBadgeProvider } from "~/components/notifications/NotificationBadgeProvider";
import { GlobalNotificationSystem } from "~/components/notifications/GlobalNotificationSystem";
import { DIPluginProvider } from "~/components/DynamicIsland";
import { SportsLiveDIPlugin } from "~/components/DynamicIsland/plugins/SportsLiveDIPlugin";

/**
 * Live game activity & notification plugins.
 * Only mounted for authenticated users via LazyGameProviders.
 */
export function GameProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationBadgeProvider>
      <GlobalNotificationSystem>
        <DIPluginProvider>
          <SportsLiveDIPlugin />
          {children}
        </DIPluginProvider>
      </GlobalNotificationSystem>
    </NotificationBadgeProvider>
  );
}
