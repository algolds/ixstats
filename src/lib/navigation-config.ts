/**
 * Navigation configuration: types, color theming, contextual (mobile) menus, and
 * the path -> context-key resolver. Extracted from navigation.tsx (audit C3).
 */
import {
  Activity,
  StatsReport as BarChart3,
  Brain,
  KeyCommand as Command,
  Compass,
  Crown,
  Database,
  Globe,
  Component as Layers,
  ChatBubble as MessageSquare,
  RssFeed as Rss,
  Send,
  Settings,
  ControlSlider as SlidersHorizontal,
  Trophy,
  Group as Users,
  CheckSquare as Vote,
  Flash as Zap,
} from "iconoir-react";

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
  icon: React.ComponentType<{ className?: string }>;
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
            href: "/thinktanks",
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
            href: "/mycountry/builder",
            icon: Layers,
            description: "Start from scratch with guided setup.",
          },
          {
            name: "Import Scenario",
            href: "/mycountry/builder?section=import",
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
  myleague: {
    title: "MyLeague",
    description: "Sports league simulation and management.",
    groups: [
      {
        title: "League Operations",
        items: [
          {
            name: "League Dashboard",
            href: "/myleague",
            icon: Trophy,
            description: "Overview of your leagues and competitions.",
          },
          {
            name: "Create League",
            href: "/myleague/create",
            icon: Layers,
            description: "Start a new league from scratch.",
          },
        ],
      },
      {
        title: "Competition",
        items: [
          {
            name: "Leaderboards",
            href: "/leaderboards",
            icon: BarChart3,
            description: "See how leagues rank globally.",
          },
          {
            name: "Explore Countries",
            href: "/countries",
            icon: Globe,
            description: "Research nations participating in leagues.",
          },
        ],
      },
    ],
  },
  myclub: {
    title: "MyClub",
    description: "Manage your sports franchises.",
    groups: [
      {
        title: "Franchise Hub",
        items: [
          {
            name: "Club Dashboard",
            href: "/myclub",
            icon: Users,
            description: "Your sports franchises at a glance.",
          },
          {
            name: "Create Club",
            href: "/myclub/create",
            icon: Layers,
            description: "Establish a new sports franchise.",
          },
        ],
      },
      {
        title: "League Access",
        items: [
          {
            name: "MyLeague",
            href: "/myleague",
            icon: Trophy,
            description: "Explore and join active leagues.",
          },
          {
            name: "Messages",
            href: "/messages",
            icon: MessageSquare,
            description: "Coordinate with league members.",
          },
        ],
      },
    ],
  },
  onoma: {
    title: "Onoma Lab",
    description: "Fantasy naming synthesis engine.",
    groups: [
      {
        title: "Name Generator",
        items: [
          {
            name: "Overview",
            href: "/labs/onoma",
            icon: Compass,
            description: "Onoma dashboard and statistics.",
          },
          {
            name: "Custom Studio",
            href: "/labs/onoma/studio",
            icon: SlidersHorizontal,
            description: "Markov chain workshop.",
          },
          {
            name: "Name Bank",
            href: "/labs/onoma/bank",
            icon: Database,
            description: "Saved names and dictionaries.",
          },
        ],
      },
    ],
  },
};

export function getContextKey(path: string): keyof typeof contextualMenus {
  if (path.startsWith("/labs/onoma")) return "onoma";
  if (path.startsWith("/mycountry/builder")) return "builder";
  if (path.startsWith("/mycountry")) return "mycountry";
  if (path.startsWith("/thinkpages")) return "thinkpages";
  if (path.startsWith("/forum")) return "forum";
  if (path.startsWith("/myleague")) return "myleague";
  if (path.startsWith("/myclub")) return "myclub";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/builder")) return "builder";
  if (path.startsWith("/countries")) return "explore";
  if (path.startsWith("/leaderboards")) return "leaderboards";
  if (path.startsWith("/feed")) return "feed";
  if (path.startsWith("/dashboard")) return "dashboard";
  return "default";
}
