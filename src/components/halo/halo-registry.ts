import { Compass, RefreshDouble, Search } from "iconoir-react";
import { commandsFromApps } from "~/lib/halo/commands-from-apps";
import type { NavigationVisibilitySettings } from "~/lib/navigation/app-sections";

export type CommandCategory =
  "Statecraft" | "Vault" | "Geography" | "Knowledge" | "Community" | "Sports" | "Labs" | "System";

export type SystemActionId =
  | "toggle-theme"
  | "toggle-sound"
  | "toggle-compact"
  | "mark-all-read"
  | "reload-data"
  | "random-wiki"
  | "random-country"
  | "sign-out";

export interface CommandEntry {
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  actionId?: SystemActionId;
  /** Listed only for admins (the same check as the Halo settings Admin button). */
  adminOnly?: boolean;
}

export interface FeatureEntry {
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  actionId?: SystemActionId;
}

/** The commands this viewer may see, derived from the sidebar navigation model. */
export function commandsFor(
  isAdmin: boolean,
  navigationSettings?: NavigationVisibilitySettings | null
): CommandEntry[] {
  return commandsFromApps({
    signedIn: true,
    isAdmin,
    canOpenAdmin: isAdmin,
    navigationSettings,
  });
}

/**
 * Feature shortcuts and quick interactive actions.
 */
export const CORE_FEATURES: FeatureEntry[] = [
  {
    name: "Refresh data",
    path: "#reload-data",
    icon: RefreshDouble,
    category: "System",
    actionId: "reload-data",
    description: "Reload the latest data",
    keywords: ["refresh", "reload", "sync"],
  },
  {
    name: "Notifications",
    path: "#notifications",
    icon: Compass,
    category: "System",
    description: "Open notifications and the diplomatic inbox",
    keywords: ["notifications", "alerts", "inbox"],
  },
  {
    name: "Search",
    path: "#search",
    icon: Search,
    category: "System",
    description: "Find a country, command or wiki article",
    keywords: ["search", "find", "lookup"],
  },
];
