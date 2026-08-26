"use client";

import { useMemo } from "react";
import { StatsReport as BarChart3, OpenBook as BookOpen, Compass, Crown, Globe, ChatBubble as MessageSquare, Trophy } from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { GiCardRandom } from "react-icons/gi";
import { GiSoapExperiment } from "react-icons/gi";
import { OnomaNavIcon } from "~/app/labs/onoma/components/shared/OnomaBrandLogo";
import type { NavigationItem } from "~/lib/navigation-config";

export interface UseNavigationItemsParams {
  user: unknown;
  isAdmin: boolean;
  isPremium: boolean;
  isStandalone: boolean;
  setupStatus: string;
  /** Per-user override: user has been granted Labs access (RBAC `labs.access`). */
  hasLabsAccess?: boolean;
  navigationSettings:
    | {
        showWikiTab?: boolean;
        showCardsTab?: boolean;
        showLabsTab?: boolean;
        showMapsTab?: boolean;
        showForumTab?: boolean;
        showHelpTab?: boolean;
      }
    | null
    | undefined;
}

/**
 * Builds the full navigation item array and filters it down to the items visible
 * for the current user/role/premium/auth/country state and admin navigation
 * settings. Extracted from navigation.tsx. Returns the filtered visible items.
 */
export function useNavigationItems({
  user,
  isAdmin,
  isPremium,
  isStandalone: _isStandalone,
  setupStatus,
  navigationSettings,
  hasLabsAccess = false,
}: UseNavigationItemsParams): NavigationItem[] {
  const navigationItems: NavigationItem[] = useMemo(() => {
    const items: NavigationItem[] = [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: BarChart3,
        requiresAuth: true,
      },
      {
        name: "Explore",
        href: "/countries",
        icon: Globe,
        requiresAuth: false,
      },
      {
        name: "MyCountry®",
        href: "/mycountry",
        icon: Crown,
        requiresAuth: true,
        requiresCountry: true,
        description: "Your national dashboard and executive command center",
      },
      {
        name: "Maps",
        href: "/maps",
        icon: Compass,
        requiresAuth: false,
        description: "Interactive world map and geographic exploration",
      },
      {
        name: "Forum",
        href: "/forum",
        icon: MessageSquare,
        requiresAuth: false,
        description: "Community discussion forums",
      },

      {
        name: "Wiki",
        href: "/wiki",
        icon: WikiOSLogomark,
        requiresAuth: false,
      },
      {
        name: "Cards",
        href: "/vault",
        icon: GiCardRandom,
        requiresAuth: true,
        description: "IxCards trading card system",
      },
      {
        name: "Labs",
        href: "",
        icon: GiSoapExperiment,
        requiresAuth: true,
        isDropdown: true,
        // Only labs with live routes. Vexel/Strata/Dynas/Nomora are not built yet
        // (no page routes) — listing them caused prefetch 404s. Re-add when shipped.
        dropdownItems: [
          {
            name: "MyLeague",
            href: "/myleague",
            icon: Trophy,
            description: "Sports management",
          },
          {
            name: "Onoma",
            href: "/labs/onoma",
            icon: OnomaNavIcon,
            description: "Linguistic Engine",
          },
        ],
      },
      {
        name: "Help",
        href: "/help",
        icon: BookOpen,
        requiresAuth: false,
        description: "Documentation and guides",
      },
    ];

    return items;
  }, []);

  // Filter visible navigation items based on user state and admin settings
  const visibleNavItems = navigationItems
    .filter((item) => {
      if (item.requiresAuth && !user) return false;

      // Special handling for MyCountry - show it even if setup is incomplete
      // so users can access the setup flow or see their country page
      if (item.name === "MyCountry®" && item.requiresCountry) {
        // Show MyCountry if user is authenticated, regardless of setup status
        if (!user) return false;
        return true;
      }

      if (item.requiresCountry && setupStatus !== "complete") return false;
      if (item.adminOnly && !isAdmin) return false;
      if (item.premiumOnly && !isPremium) return false;

      // Remove standalone nav restrictions so users can seamlessly jump to main app
      // Check admin navigation settings
      if (navigationSettings) {
        if (item.name === "Wiki" && !navigationSettings.showWikiTab) return false;
        if (item.name === "Cards" && !navigationSettings.showCardsTab) return false;
        // Admins/system owners (role level ≤ 10) and users explicitly granted
        // Labs access always see Labs, regardless of the global showLabsTab control.
        if (
          item.name === "Labs" &&
          !navigationSettings.showLabsTab &&
          !isAdmin &&
          !hasLabsAccess &&
          process.env.NODE_ENV !== "development"
        )
          return false;
        if (item.name === "Maps" && !navigationSettings.showMapsTab) return false;
        if (item.name === "Forum" && !navigationSettings.showForumTab) return false;
        if (item.name === "Help" && !navigationSettings.showHelpTab) return false;
      }

      return true;
    })
    .map((item) => {
      // Also filter dropdown items based on premium access
      if (item.isDropdown && item.dropdownItems) {
        return {
          ...item,
          dropdownItems: item.dropdownItems.filter((dropdownItem) => {
            if (dropdownItem.premiumOnly && !isPremium) return false;
            return true;
          }),
        };
      }
      return item;
    });

  return visibleNavItems;
}
