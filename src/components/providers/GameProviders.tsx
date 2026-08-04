"use client";

import React from "react";
import { AbilityProvider } from "~/components/providers/AbilityProvider";
import { IxTimeProvider } from "~/contexts/IxTimeContext";
import { ExecutiveNotificationProvider } from "~/contexts/ExecutiveNotificationContext";
import { NotificationBadgeProvider } from "~/components/notifications/NotificationBadgeProvider";
import { GlobalNotificationSystem } from "~/components/notifications/GlobalNotificationSystem";
import { DIPluginProvider } from "~/components/DynamicIsland";
import { SportsLiveDIPlugin } from "~/components/DynamicIsland/plugins/SportsLiveDIPlugin";
import { CalendarLiveDIPlugin } from "~/components/DynamicIsland/plugins/CalendarLiveDIPlugin";
import { WikiContextProvider } from "~/components/wiki-os/shared/WikiContext";

export function GameProviders({ children }: { children: React.ReactNode }) {
  return (
    <AbilityProvider>
      <IxTimeProvider>
        <ExecutiveNotificationProvider>
          <NotificationBadgeProvider>
            <GlobalNotificationSystem>
              <DIPluginProvider>
                <SportsLiveDIPlugin />
                <CalendarLiveDIPlugin />
                <WikiContextProvider>{children}</WikiContextProvider>
              </DIPluginProvider>
            </GlobalNotificationSystem>
          </NotificationBadgeProvider>
        </ExecutiveNotificationProvider>
      </IxTimeProvider>
    </AbilityProvider>
  );
}
