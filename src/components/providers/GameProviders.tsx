"use client";

import React from "react";
import { NotificationBadgeProvider } from "~/components/navigation/NotificationBadgeProvider";
import { DIPluginProvider } from "~/components/halo";
import { SportsLiveHalo } from "~/components/halo/plugins/sports";

/**
 * Live game activity & notification plugins.
 * Only mounted for authenticated users via LazyGameProviders.
 */
export function GameProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationBadgeProvider>
      <DIPluginProvider>
        <SportsLiveHalo />
        {children}
      </DIPluginProvider>
    </NotificationBadgeProvider>
  );
}
