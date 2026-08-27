import type { ComponentType } from "react";
import {
  User,
  Palette,
  Bell,
  Coins,
  ChatBubble as MessageCircle,
  ShieldCheck,
  Crown as Gem,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { MyCountryLogomark } from "~/components/ui/mycountry-logo";

export type SettingSectionId =
  | "account"
  | "country"
  | "appearance"
  | "wikios"
  | "notifications"
  | "social"
  | "privacy"
  | "vault"
  | "cosmetics"
  | "cards";

export interface SettingSectionConfig {
  id: SettingSectionId;
  label: string;
  category: "Profile & Identity" | "MyCountry" | "Platform & Preferences" | "Vault";
  description: string;
  icon: ComponentType<{ className?: string }>;
  glyphClass: string;
  accentColor: string;
  requiresCountry?: boolean;
}

export const SETTINGS_SECTIONS: SettingSectionConfig[] = [
  {
    id: "account",
    label: "IxnayID & Passport",
    category: "Profile & Identity",
    description:
      "Public passport presentation, multi-tenant realms, and connected community accounts",
    icon: User,
    glyphClass: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
    accentColor: "text-blue-500",
  },
  {
    id: "country",
    label: "MyCountry Settings",
    category: "MyCountry",
    description: "MyCountry details, custom flag, map data sync, and nation preferences",
    icon: MyCountryLogomark,
    glyphClass: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    accentColor: "text-emerald-500",
    requiresCountry: true,
  },
  {
    id: "appearance",
    label: "Appearance & Theme",
    category: "Platform & Preferences",
    description: "Light/dark mode, motion physics, and visual density toggles",
    icon: Palette,
    glyphClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
    accentColor: "text-indigo-500",
  },
  {
    id: "wikios",
    label: "WikiOS Options",
    category: "Platform & Preferences",
    description: "Reader layout, article navigation, media backplate, and scanner automation",
    icon: WikiOSLogomark,
    glyphClass: "bg-teal-500/15 text-teal-500 dark:text-teal-400",
    accentColor: "text-teal-500",
  },
  {
    id: "notifications",
    label: "Notifications",
    category: "Platform & Preferences",
    description: "Email summaries, desktop push alerts, and category urgency filters",
    icon: Bell,
    glyphClass: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    accentColor: "text-rose-500",
  },
  {
    id: "social",
    label: "Social & Thinkpages",
    category: "Platform & Preferences",
    description: "Autonomous bot persona, post frequency, political lean, and writing tone",
    icon: MessageCircle,
    glyphClass: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
    accentColor: "text-purple-500",
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    category: "Platform & Preferences",
    description: "Country factbook visibility, covert intelligence masking, and data export",
    icon: ShieldCheck,
    glyphClass: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400",
    accentColor: "text-cyan-500",
  },
  {
    id: "vault",
    label: "Vault Status",
    category: "Vault",
    description: "IxCredits balance, daily login streak, account level, and yield multipliers",
    icon: Coins,
    glyphClass: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
    accentColor: "text-amber-500",
  },
  {
    id: "cosmetics",
    label: "Cosmetics & Upgrades",
    category: "Vault",
    description: "Owned profile cosmetics, glowing card frames, and permanent upgrades",
    icon: Gem,
    glyphClass: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
    accentColor: "text-purple-500",
  },
  {
    id: "cards",
    label: "NationStates Card Sync",
    category: "Vault",
    description: "Trading card collections, deck synchronization, 3D inspect, and takedown options",
    icon: NationStatesLogo,
    glyphClass: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    accentColor: "text-emerald-500",
  },
];

export function getSectionById(id: SettingSectionId): SettingSectionConfig | undefined {
  return SETTINGS_SECTIONS.find((s) => s.id === id);
}

export function getSectionsByCategory(): Record<
  SettingSectionConfig["category"],
  SettingSectionConfig[]
> {
  const groups: Record<SettingSectionConfig["category"], SettingSectionConfig[]> = {
    "Profile & Identity": [],
    MyCountry: [],
    "Platform & Preferences": [],
    Vault: [],
  };

  for (const section of SETTINGS_SECTIONS) {
    groups[section.category].push(section);
  }

  return groups;
}
