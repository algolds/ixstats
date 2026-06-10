/**
 * Navigation configuration: types, color theming, contextual (mobile) menus, and
 * the path -> context-key resolver. Extracted from navigation.tsx (audit C3).
 */
import {
  Activity,
  BarChart3,
  Brain,
  Command,
  Compass,
  Crown,
  Database,
  Globe,
  Layers,
  MessageSquare,
  Rss,
  Send,
  Settings,
  SlidersHorizontal,
  Trophy,
  Users,
  Vote,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  requiresAuth?: boolean;
  requiresCountry?: boolean;
  adminOnly?: boolean;
  premiumOnly?: boolean;
  description?: string;
  isDropdown?: boolean;
  dropdownItems?: DropdownItem[];
}

export interface DropdownItem {
  name: string;
  href: string;
  icon: any;
  description?: string;
  premiumOnly?: boolean;
}

export interface ContextualMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export interface ContextualMenuGroup {
  title: string;
  items: ContextualMenuItem[];
}

export interface ContextualMenuDefinition {
  title: string;
  description?: string;
  groups: ContextualMenuGroup[];
}

// ── Nav item color config (ShineBorder hex + icon glow/hover classes) ──
export const NAV_COLORS: Record<string, { shine: string[]; glow: string; hover: string }> = {
  "MyCountry®": {
    shine: ["#f59e0b", "#eab308", "#fbbf24"],
    glow: "text-amber-400",
    hover: "group-hover:text-amber-400",
  },
  ThinkPages: {
    shine: ["#3b82f6", "#1d4ed8", "#60a5fa"],
    glow: "text-blue-400",
    hover: "group-hover:text-blue-400",
  },
  Dashboard: {
    shine: ["#10b981", "#059669", "#34d399"],
    glow: "text-emerald-400",
    hover: "group-hover:text-emerald-400",
  },
  Feed: {
    shine: ["#8b5cf6", "#7c3aed", "#a78bfa"],
    glow: "text-purple-400",
    hover: "group-hover:text-purple-400",
  },
  Explore: {
    shine: ["#8b5cf6", "#7c3aed", "#a78bfa"],
    glow: "text-purple-400",
    hover: "group-hover:text-purple-400",
  },
  Countries: {
    shine: ["#8b5cf6", "#7c3aed", "#a78bfa"],
    glow: "text-purple-400",
    hover: "group-hover:text-purple-400",
  },
  Intelligence: {
    shine: ["#6366f1", "#4f46e5", "#818cf8"],
    glow: "text-indigo-400",
    hover: "group-hover:text-indigo-400",
  },
  Admin: {
    shine: ["#ef4444", "#dc2626", "#f87171"],
    glow: "text-red-400",
    hover: "group-hover:text-red-400",
  },
  Cards: {
    shine: ["#06b6d4", "#0891b2", "#22d3ee"],
    glow: "text-cyan-400",
    hover: "group-hover:text-cyan-400",
  },
  Help: {
    shine: ["#fb923c", "#f97316", "#fdba74"],
    glow: "text-orange-400",
    hover: "group-hover:text-orange-400",
  },
  Forum: {
    shine: ["#f97316", "#ea580c", "#fb923c"],
    glow: "text-orange-400",
    hover: "group-hover:text-orange-400",
  },
};
export const DEFAULT_NAV = {
  shine: ["#3b82f6", "#8b5cf6", "#06b6d4"],
  glow: "text-blue-400",
  hover: "group-hover:text-blue-400",
};

export const contextualMenus: Record<string, ContextualMenuDefinition> = {
  dashboard: {
    title: "Dashboard Hub",
    description: "Command your nation and monitor global signals.",
    groups: [
      {
        title: "Executive Oversight",
        items: [
          {
            name: "Analytics Overview",
            href: "/dashboard",
            icon: BarChart3,
            description: "Live performance metrics for your country.",
          },
          {
            name: "Executive Command",
            href: "/dashboard?panel=command-center",
            icon: Activity,
            description: "Jump directly into decision workflows.",
          },
        ],
      },
      {
        title: "Global Context",
        items: [
          {
            name: "World Leaderboards",
            href: "/leaderboards",
            icon: Trophy,
            description: "See how nations compare across metrics.",
          },
          {
            name: "Explore Countries",
            href: "/countries",
            icon: Globe,
            description: "Research nations and benchmark progress.",
          },
        ],
      },
    ],
  },
  feed: {
    title: "Activity Feed",
    description: "Stay connected with real-time platform activity and updates.",
    groups: [
      {
        title: "Feed Views",
        items: [
          {
            name: "Global Activity",
            href: "/feed",
            icon: Activity,
            description: "All platform activity in real-time.",
          },
          {
            name: "ThinkPages Social",
            href: "/dashboard",
            icon: Rss,
            description: "Social feed and diplomatic communications.",
          },
        ],
      },
      {
        title: "Discovery",
        items: [
          {
            name: "Trending Topics",
            href: "/feed?filter=trending",
            icon: Zap,
            description: "See what's trending across the platform.",
          },
          {
            name: "Explore Countries",
            href: "/countries",
            icon: Globe,
            description: "Discover nations and their activity.",
          },
        ],
      },
    ],
  },
  mycountry: {
    title: "MyCountry Operations",
    description: "Everything you need to run your nation on mobile.",
    groups: [
      {
        title: "Executive Systems",
        items: [
          {
            name: "National Overview",
            href: "/mycountry",
            icon: Crown,
            description: "Core KPIs and operational status at a glance.",
          },
          {
            name: "Executive Command",
            href: "/mycountry/executive",
            icon: Command,
            description: "Meetings, policies, plans, and executive decisions.",
          },
          {
            name: "Policy Studio",
            href: "/mycountry/editor",
            icon: Settings,
            description: "Adjust governance, culture, and growth levers.",
          },
        ],
      },
      {
        title: "Diplomatic & Security Operations",
        items: [
          {
            name: "Diplomacy",
            href: "/mycountry/diplomacy",
            icon: Globe,
            description: "Embassy network, missions, and diplomatic relations.",
          },
          {
            name: "Intelligence",
            href: "/mycountry/intelligence",
            icon: Brain,
            description: "Data analysis, trends, projections, and strategic forecasting.",
          },
          {
            name: "Defense Readiness",
            href: "/mycountry/defense",
            icon: Layers,
            description: "Force posture, stability, and risk mitigations.",
          },
          {
            name: "Politics",
            href: "/mycountry/politics",
            icon: Vote,
            description: "Legislature, parties, and elections.",
          },
        ],
      },
    ],
  },
  thinkpages: {
    title: "ThinkPages Workspace",
    description: "Diplomatic communications, intelligence sharing, and secure messaging networks.",
    groups: [
      {
        title: "Primary Views",
        items: [
          {
            name: "Social Feed",
            href: "/thinkpages",
            icon: Rss,
            description:
              "Public declarations, diplomatic announcements, and intelligence broadcasts.",
          },
          {
            name: "ThinkTanks",
            href: "/messages/groups?tab=discover",
            icon: Users,
            description: "Coordinate intelligence networks and diplomatic working groups.",
          },
          {
            name: "Messages",
            href: "/messages",
            icon: MessageSquare,
            description: "Unified messaging across all systems — DMs, diplomatic, wiki, forum.",
          },
        ],
      },
      {
        title: "Account Tools",
        items: [
          {
            name: "Account Manager",
            href: "/dashboard?panel=account-manager",
            icon: Settings,
            description: "Manage diplomatic personas and official government accounts.",
          },
          {
            name: "Workspace Settings",
            href: "/dashboard?panel=settings",
            icon: SlidersHorizontal,
            description: "Configure intelligence alerts and diplomatic communication preferences.",
          },
        ],
      },
    ],
  },
  admin: {
    title: "Platform Administration",
    description: "Operate governance and platform-wide systems.",
    groups: [
      {
        title: "Core Panels",
        items: [
          {
            name: "Admin Overview",
            href: "/admin",
            icon: Settings,
            description: "Configure feature flags and admin tooling.",
          },
          {
            name: "Audit & Activity",
            href: "/dashboard",
            icon: Activity,
            description: "Monitor platform-wide actions and alerts.",
          },
        ],
      },
      {
        title: "Navigation & Structure",
        items: [
          {
            name: "Navigation Settings",
            href: "/admin?tab=navigation",
            icon: Layers,
            description: "Reorder tabs and adjust visibility.",
          },
          {
            name: "User Management",
            href: "/admin?tab=users",
            icon: Users,
            description: "Review roles, permissions, and onboarding.",
          },
        ],
      },
    ],
  },
  builder: {
    title: "Builder Suite",
    description: "Create, import, or evolve your national model.",
    groups: [
      {
        title: "Nation Lifecycle",
        items: [
          {
            name: "Create Nation",
            href: "/builder",
            icon: Layers,
            description: "Start from scratch with guided setup.",
          },
          {
            name: "Import Scenario",
            href: "/builder/import",
            icon: Database,
            description: "Bring in external data or legacy nations.",
          },
        ],
      },
    ],
  },
  explore: {
    title: "Explore Nations",
    description: "Discover and benchmark countries across IxStats.",
    groups: [
      {
        title: "World Explorer",
        items: [
          {
            name: "Countries Directory",
            href: "/countries",
            icon: Globe,
            description: "Browse nations, stats, and intelligence.",
          },
          {
            name: "Leaderboards",
            href: "/leaderboards",
            icon: Trophy,
            description: "Rankings across economy, stability, and more.",
          },
        ],
      },
    ],
  },
  leaderboards: {
    title: "Leaderboards",
    description: "Track the top performers and emerging nations.",
    groups: [
      {
        title: "Platform Rankings",
        items: [
          {
            name: "Global Leaderboards",
            href: "/leaderboards",
            icon: Trophy,
            description: "Full leaderboard experience with filters.",
          },
          {
            name: "Dashboard Highlights",
            href: "/dashboard#leaderboards",
            icon: BarChart3,
            description: "Snapshot of rankings inside your dashboard.",
          },
        ],
      },
    ],
  },
  default: {
    title: "IxStats",
    description: "Quick links",
    groups: [
      {
        title: "Primary Areas",
        items: [
          {
            name: "Dashboard",
            href: "/dashboard",
            icon: BarChart3,
            description: "Your command center home.",
          },
          {
            name: "MyCountry®",
            href: "/mycountry",
            icon: Crown,
            description: "Operate your nation from anywhere.",
          },
          {
            name: "ThinkPages",
            href: "/thinkpages",
            icon: Rss,
            description: "Diplomatic communications and intelligence sharing.",
          },
          {
            name: "Explore Nations",
            href: "/countries",
            icon: Globe,
            description: "Research and compare global data.",
          },
        ],
      },
    ],
  },
  forum: {
    title: "Forum",
    description: "Community discussions and collaboration.",
    groups: [
      {
        title: "Browse",
        items: [
          {
            name: "All Forums",
            href: "/forum",
            icon: MessageSquare,
            description: "Browse forum categories and discussions.",
          },
          {
            name: "New Posts",
            href: "/forum?sort=new",
            icon: Rss,
            description: "Latest activity across all forums.",
          },
        ],
      },
      {
        title: "Community",
        items: [
          {
            name: "Messages",
            href: "/messages",
            icon: Send,
            description: "Unified messaging — DMs, diplomatic, wiki, forum.",
          },
          {
            name: "Search",
            href: "/forum/search",
            icon: Compass,
            description: "Search threads and posts.",
          },
        ],
      },
    ],
  },
};

export function getContextKey(path: string): keyof typeof contextualMenus {
  if (path.startsWith("/mycountry")) return "mycountry";
  if (path.startsWith("/thinkpages")) return "thinkpages";
  if (path.startsWith("/forum")) return "forum";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/builder")) return "builder";
  if (path.startsWith("/countries")) return "explore";
  if (path.startsWith("/leaderboards")) return "leaderboards";
  if (path.startsWith("/feed")) return "feed";
  if (path.startsWith("/dashboard")) return "dashboard";
  return "default";
}
