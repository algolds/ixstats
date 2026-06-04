/**
 * Dashboard content-mode model for the command center.
 * Extracted from EnhancedCommandCenter.tsx (audit C2).
 */
import { Globe, Home, Activity, Shield, type LucideIcon } from "lucide-react";

export type DashboardContentMode = "discover" | "mycountry" | "activity" | "admin";

export interface DashboardModeOption {
  id: DashboardContentMode;
  label: string;
  icon: LucideIcon;
  description: string;
}

/** Build the available content modes based on whether the user has a country / is admin. */
export function buildContentModes(
  userCountry: unknown,
  isAdmin: boolean
): DashboardModeOption[] {
  return [
    { id: "discover", label: "Discover", icon: Globe, description: "Explore nations & trends" },
    ...(userCountry
      ? [
          {
            id: "mycountry" as const,
            label: "My Country",
            icon: Home,
            description: "Your nation's dashboard",
          },
        ]
      : []),
    { id: "activity", label: "Activity", icon: Activity, description: "Social feed & updates" },
    ...(isAdmin
      ? [
          {
            id: "admin" as const,
            label: "Admin",
            icon: Shield,
            description: "System administration",
          },
        ]
      : []),
  ];
}
