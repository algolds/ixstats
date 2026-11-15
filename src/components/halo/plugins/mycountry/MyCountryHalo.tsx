"use client";

/**
 * MyCountryHalo — Halo plugin for /mycountry routes.
 *
 * Contributes contextual "On this page" commands for MyCountry sections to Halo Search
 * while leaving Halo's center capsule greeting connected to AccountView.
 */

import type * as React from "react";
import { useMemo } from "react";
import { getCountryActions, type CountryActionId } from "~/components/halo/country-actions";
import { useDIPlugin } from "~/components/halo/plugin-context";
import type { PluginCommand } from "~/components/halo/types";

const ACTION_META: Record<
  Exclude<CountryActionId, "profile" | "overview" | "vault" | "messages">,
  { title: string; description: string; keywords: readonly string[] }
> = {
  executive: {
    title: "Declare directive",
    description: "Issue executive directives and cabinet orders",
    keywords: ["directive", "directives", "executive", "orders", "policy"],
  },
  diplomacy: {
    title: "Open diplomacy",
    description: "Manage embassies, treaties, and foreign relations",
    keywords: ["diplomacy", "embassy", "treaties", "ambassadors"],
  },
  economy: {
    title: "Open economy",
    description: "Review fiscal policy, taxation, and national budget",
    keywords: ["economy", "budget", "fiscal", "tax"],
  },
  defense: {
    title: "Open defense",
    description: "Force readiness, security posture, and operations",
    keywords: ["defense", "military", "security", "readiness"],
  },
  politics: {
    title: "Open politics",
    description: "Legislature, political parties, and elections",
    keywords: ["politics", "parliament", "legislature", "parties", "elections"],
  },
  editor: {
    title: "Open country editor",
    description: "Edit national identity, flag, constitution, and baselines",
    keywords: ["editor", "flag", "symbols", "constitution"],
  },
  "map-editor": {
    title: "Open map editor",
    description: "Edit national borders and provincial subdivisions",
    keywords: ["map", "borders", "territory", "provinces"],
  },
};

export const MYCOUNTRY_PLUGIN_COMMANDS: readonly PluginCommand[] = getCountryActions([
  "executive",
  "diplomacy",
  "economy",
  "defense",
  "politics",
  "editor",
  "map-editor",
]).map((action) => {
  const meta = ACTION_META[action.id as keyof typeof ACTION_META];
  return {
    key: action.id,
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    icon: action.icon as React.ComponentType<{ className?: string }>,
    path: action.path,
  };
});

export function MyCountryHalo() {
  const plugin = useMemo(
    () => ({
      id: "mycountry",
      priority: 5,
      commands: MYCOUNTRY_PLUGIN_COMMANDS,
      accentColor: "var(--color-yellow)",
    }),
    []
  );

  useDIPlugin(plugin);
  return null;
}
