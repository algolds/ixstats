"use client";

/**
 * MyCountryDIPlugin — registers a DI plugin for /mycountry pages.
 *
 * Provides accent color, sticky label, and a center badge for the
 * standard DI pill. Note: MyCountryCompactView is a full pill
 * replacement used when the user toggles into "mycountry DI mode".
 * This plugin handles the *default* DI behavior on mycountry pages.
 */

import React, { useMemo } from "react";
import { Crown } from "lucide-react";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { PreText } from "~/components/ui/pretext";
import { MyCountryCommandPalette } from "~/components/DynamicIsland/MyCountryCommandPalette";

function MyCountryLabel() {
  return (
    <span className="flex items-center gap-1.5">
      <Crown className="h-3 w-3 shrink-0 text-amber-400 opacity-70" />
      <PreText className="text-foreground/80 text-xs font-medium" whiteSpace="nowrap">
        MyCountry®
      </PreText>
    </span>
  );
}

export function MyCountryDIPlugin() {
  const plugin = useMemo(
    () => ({
      id: "mycountry",
      priority: 5, // lower than wiki/forum so context-specific plugins win
      center: <MyCountryLabel />,
      expandedViews: { mycountry: MyCountryCommandPalette },
      accentColor: "#f59e0b",
      stickyLabel: "MyCountry",
    }),
    []
  );

  useDIPlugin(plugin);
  return null;
}
