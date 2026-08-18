"use client";

import React from "react";
import { NotificationBadgeProvider } from "~/components/navigation/NotificationBadgeProvider";
import { DIPluginProvider } from "~/components/halo";
import { SportsLiveDIPlugin } from "~/components/halo/plugins/SportsLiveDIPlugin";

/**
 * Live game activity & notification plugins.
 * Only mounted for authenticated users via LazyGameProviders.
 */
export function GameProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationBadgeProvider>
      <DIPluginProvider>
        <SportsLiveDIPlugin />
        {children}
      </DIPluginProvider>
    </NotificationBadgeProvider>
  );
}
