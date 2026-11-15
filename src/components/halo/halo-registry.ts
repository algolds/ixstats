import { commandsFromApps } from "~/lib/halo/commands-from-apps";
import type { NavigationVisibilitySettings } from "~/lib/navigation/app-sections";

export type CommandCategory =
  "Statecraft" | "Vault" | "Geography" | "Knowledge" | "Community" | "Sports" | "Labs" | "System";

export type SystemActionId =
  | "toggle-theme"
  | "toggle-sound"
  | "toggle-compact"
  | "toggle-sidebar"
  | "daily-reward"
  | "open-feedback"
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
