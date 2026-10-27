"use client";

/**
 * MyCountryHalo — Halo overlay plugin for /mycountry routes.
 *
 * Provides national executive indicators, alert status, and expanded
 * quick actions for domestic and foreign policy, diplomacy, and defense.
 */

import React, { useMemo } from "react";
import { Crown } from "iconoir-react";
import { useDIPlugin } from "~/components/halo/plugin-context";
import { PreText } from "~/components/ui/pretext";
import { MyCountryActionsView, MyCountryView } from "./views";

function MyCountryLabel() {
  return (
    <span className="flex items-center gap-2">
      <Crown className="text-yellow h-3 w-3 shrink-0 opacity-70" />
      <PreText className="text-label text-caption" whiteSpace="nowrap">
        MyCountry®
      </PreText>
    </span>
  );
}

export function MyCountryHalo() {
  const plugin = useMemo(
    () => ({
      id: "mycountry",
      priority: 5,
      center: <MyCountryLabel />,
      expandedViews: {
        mycountry: MyCountryActionsView,
        mycountry_stats: MyCountryView,
      },
      accentColor: "var(--color-yellow)",
      stickyLabel: "MyCountry",
    }),
    []
  );

  useDIPlugin(plugin);
  return null;
}

// Backwards compatibility alias
