"use client";

/**
 * MapsDIPlugin — registers a DI plugin for /maps pages.
 *
 * Note: Maps uses its own MapDynamicIsland component for the full DI,
 * so the standard CommandPalette is already hidden on /maps.
 * This plugin exists as a forward-compatible registration point
 * for when we unify the maps DI into the standard one.
 */

import React, { useMemo } from "react";
import { Map } from "lucide-react";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";

function MapsLabel() {
  return (
    <span className="flex items-center gap-1.5">
      <Map className="h-3 w-3 shrink-0 text-cyan-400 opacity-70" />
      <span className="text-foreground/80 text-xs font-medium">IxWorld</span>
    </span>
  );
}

export function MapsDIPlugin() {
  const plugin = useMemo(
    () => ({
      id: "maps",
      priority: 10,
      center: <MapsLabel />,
      accentColor: "#06b6d4",
      stickyLabel: "Maps",
    }),
    []
  );

  useDIPlugin(plugin);
  return null;
}
