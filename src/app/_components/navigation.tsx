"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, useSpring } from "motion/react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  ChevronDown,
  Command,
  Compass,
  Crown,
  Database,
  Globe,
  Layers,
  Menu,
  MessageSquare,
  Rss,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Trophy,
  User,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommandPalette } from "~/components/DynamicIsland";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "~/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import { usePremium } from "~/hooks/usePremium";
import { AnimatedShinyText } from "~/components/magicui/animated-shiny-text";
import { ShineBorder } from "~/components/magicui/shine-border";
import { FaLanguage, FaWikipediaW } from "react-icons/fa";
import { GiCardRandom, GiFamilyTree } from "react-icons/gi";
import { GiSoapExperiment } from "react-icons/gi";
import { GiVibratingShield } from "react-icons/gi";
import { FaTreeCity } from "react-icons/fa6";
import { stripBasePath } from "~/lib/base-path";
import { UserProfileMenu } from "~/components/UserProfileMenu";
import { useCountryFlag } from "~/hooks/useCountryFlags";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { isStandaloneClient } from "~/lib/standalone-detection";

interface NavigationItem {
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

interface DropdownItem {
  name: string;
  href: string;
  icon: any;
  description?: string;
  premiumOnly?: boolean;
}

interface ContextualMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface ContextualMenuGroup {
  title: string;
  items: ContextualMenuItem[];
}

interface ContextualMenuDefinition {
  title: string;
  description?: string;
  groups: ContextualMenuGroup[];
}

// ── Nav item color config (ShineBorder hex + icon glow/hover classes) ──
const NAV_COLORS: Record<string, { shine: string[]; glow: string; hover: string }> = {
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
const DEFAULT_NAV = {
  shine: ["#3b82f6", "#8b5cf6", "#06b6d4"],
  glow: "text-blue-400",
  hover: "group-hover:text-blue-400",
};

const contextualMenus: Record<string, ContextualMenuDefinition> = {
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
            href: "/messages/groups",
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

function getContextKey(path: string): keyof typeof contextualMenus {
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

export function Navigation() {
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname || "/");
  const isWikiPage =
    normalizedPathname.startsWith("/w/") ||
    normalizedPathname.startsWith("/w/special/") ||
    normalizedPathname.startsWith("/blurbs");
  const { user, isLoaded } = useUser();
  const { totalUnread: messageUnreadCount } = useMessageUnreadCount();
  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 1023;
  });

  // Use new role management system
  const isAdmin = useHasRoleLevel(10); // Admin level or higher

  // Get premium status
  const { isPremium } = usePremium();

  const isStandalone = typeof window !== "undefined" && isStandaloneClient();

  // Get navigation settings from admin
  const { data: navigationSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    // Default to showing all tabs if query fails
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Get user profile to show linked country
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery();

  // Fetch country flag for user profile
  const { flag: userCountryFlag, loading: flagsLoading } = useCountryFlag(
    userProfile?.country?.name || ""
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setMobileMenuOpen(false);
  }, [normalizedPathname, isMobile]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (isMobile) return;
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen]);

  // Enhanced scroll detection with ultra-smooth transitions
  useEffect(() => {
    let rafId: number | undefined;
    let isScrolling = false;
    let lastScrollY = window.scrollY;
    let lastTimestamp = performance.now();

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        rafId = requestAnimationFrame((timestamp) => {
          const currentScrollY = window.scrollY;
          const deltaTime = timestamp - lastTimestamp;
          const direction = currentScrollY > lastScrollY ? "down" : "up";

          // Smooth interpolation for scroll position updates
          const smoothScrollY =
            lastScrollY + (currentScrollY - lastScrollY) * Math.min(deltaTime / 16, 1);

          // Update scroll position for ultra-smooth transitions
          setScrollY(smoothScrollY);

          // Determine sticky state with smooth transition zone and hysteresis
          const stickyThreshold = direction === "down" ? 60 : 40;
          const newStickyState = currentScrollY > stickyThreshold;
          setIsSticky(newStickyState);

          lastScrollY = currentScrollY;
          lastTimestamp = timestamp;
          isScrolling = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

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
        name: "Admin",
        href: "/admin",
        icon: Settings,
        requiresAuth: true,
        adminOnly: true,
      },
      {
        name: "Wiki",
        href: "/w",
        icon: FaWikipediaW,
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
        dropdownItems: [
          {
            name: "Vexel",
            href: "/labs/vexel",
            icon: GiVibratingShield,
            description: "Heraldry generator",
          },
          {
            name: "Onoma",
            href: "/labs/onoma",
            icon: Database,
            description: "Markov name generator",
          },
          {
            name: "Strata",
            href: "/labs/strata",
            icon: FaTreeCity,
            description: "City/roadmap generator",
          },
          {
            name: "Dynas",
            href: "/labs/dynas",
            icon: GiFamilyTree,
            description: "Family/Dynasty Generator",
          },
          {
            name: "Nomora",
            href: "/labs/nomora",
            icon: FaLanguage,
            description: "Conlang Generator",
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
  }, [isStandalone]);

  const isCurrentPage = (href: string) => {
    const cleanedHref = href.split("?")[0].split("#")[0] || "/";
    const normalizedHref = cleanedHref.startsWith("/") ? cleanedHref : `/${cleanedHref}`;
    if (normalizedPathname === normalizedHref) return true;
    return normalizedHref !== "/" && normalizedPathname.startsWith(`${normalizedHref}/`);
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return "loading";
    if (!user) return "unauthenticated";
    if (!userProfile?.countryId) return "needs-setup";
    return "complete";
  };

  const setupStatus = getSetupStatus();

  // Debug logging for navigation visibility
  // Navigation rendering logic follows

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
        if (item.name === "Labs" && !navigationSettings.showLabsTab) return false;
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

  const contextKey = getContextKey(normalizedPathname);
  const contextMenu = contextualMenus[contextKey] ?? contextualMenus.default;

  // Intelligent balancing: ensure visual symmetry around dynamic island
  const totalItems = visibleNavItems.length;
  const leftCount = Math.ceil(totalItems / 2);
  const leftNavItems = visibleNavItems.slice(0, leftCount);
  const rightNavItems = visibleNavItems.slice(leftCount);

  // ── Physics morph progress: 0 = full tabs, 1 = tabs fully absorbed ──
  const morphProgress = useMemo(() => {
    const start = 40;
    const end = 100;
    return Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
  }, [scrollY]);

  // Hide the global navigation entirely on maps pages since MapDynamicIsland handles it
  if (pathname?.startsWith("/maps")) return null;

  return (
    <>
      <nav
        className={`navigation-bar relative z-[var(--z-navigation)] border-b backdrop-blur-xl transition-colors duration-300 ${
          isWikiPage
            ? "border-[var(--wikios-border)] bg-[var(--wikios-bg)] shadow-lg"
            : "from-background/80 via-secondary/80 to-background/80 border-border bg-gradient-to-r shadow-2xl"
        }`}
        style={{
          opacity: 1 - morphProgress * 0.6,
          transition: "opacity 0.05s linear",
        }}
      >
        {!isWikiPage && (
          <div className="to-background/20 absolute right-0 bottom-0 left-0 h-2 rounded-b-3xl bg-gradient-to-b from-transparent" />
        )}

        <div className="mx-auto max-w-none px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="relative hidden h-16 w-full items-center justify-between lg:flex">
            {/* Left Side Navigation — morphs toward center */}
            <div
              className="z-[var(--z-floating)] flex flex-1 items-center justify-start gap-2 xl:gap-3"
              style={{
                transform: `translateX(${morphProgress * 30}%) scale(${1 - morphProgress * 0.3})`,
                opacity: 1 - morphProgress,
                pointerEvents: morphProgress > 0.8 ? "none" : "auto",
                transition: "transform 0.05s linear, opacity 0.05s linear",
              }}
            >
              <NavigationMenu>
                <NavigationMenuList className="flex items-center gap-2">
                  {leftNavItems.map((item) => {
                    const Icon = item.icon;
                    const current = isCurrentPage(item.href);

                    if (item.isDropdown && item.dropdownItems) {
                      return (
                        <NavigationMenuItem key={item.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="group hover:bg-accent/10 text-muted-foreground relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto">
                              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <ShineBorder
                                  shineColor={["#8b5cf6", "#7c3aed", "#a78bfa"]}
                                  duration={30}
                                  borderWidth={1}
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                                  <Icon className="h-4 w-4 text-purple-400" />
                                </div>
                                <Icon
                                  className="relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] group-hover:text-purple-400"
                                  aria-hidden="true"
                                />
                              </div>
                              <span className="relative hidden overflow-hidden lg:block">
                                <span className="transition-opacity duration-300 group-hover:opacity-0">
                                  {item.name}
                                </span>
                                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                  <AnimatedShinyText shimmerWidth={60}>
                                    {item.name}
                                  </AnimatedShinyText>
                                </div>
                              </span>
                              <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="glass-panel w-56">
                              {item.dropdownItems.map((subItem, index) => {
                                const SubIcon = subItem.icon;
                                return (
                                  <div key={subItem.name}>
                                    <DropdownMenuItem>
                                      <Link
                                        href={subItem.href}
                                        className="flex cursor-pointer items-center gap-3 px-3 py-3"
                                      >
                                        <SubIcon className="text-muted-foreground h-4 w-4" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{subItem.name}</span>
                                          {subItem.description && (
                                            <span className="text-muted-foreground text-xs">
                                              {subItem.description}
                                            </span>
                                          )}
                                        </div>
                                      </Link>
                                    </DropdownMenuItem>
                                    {index < item.dropdownItems!.length - 1 && (
                                      <DropdownMenuSeparator />
                                    )}
                                  </div>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </NavigationMenuItem>
                      );
                    }

                    return (
                      <NavigationMenuItem key={item.name}>
                        {current ? (
                          <Link
                            href={item.href}
                            className="group text-foreground bg-accent/20 relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto"
                            aria-current="page"
                          >
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                                <Icon
                                  className={`h-4 w-4 ${
                                    item.name === "MyCountry®"
                                      ? "text-amber-400"
                                      : item.name === "ThinkPages"
                                        ? "text-blue-400"
                                        : item.name === "Dashboard"
                                          ? "text-emerald-400"
                                          : item.name === "Feed"
                                            ? "text-purple-400"
                                            : item.name === "Explore"
                                              ? "text-purple-400"
                                              : item.name === "Intelligence"
                                                ? "text-indigo-400"
                                                : item.name === "Admin"
                                                  ? "text-red-400"
                                                  : item.name === "Cards"
                                                    ? "text-cyan-400"
                                                    : item.name === "Help"
                                                      ? "text-orange-400"
                                                      : "text-blue-400"
                                  }`}
                                />
                              </div>
                              <Icon
                                className={`relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] ${
                                  item.name === "MyCountry®"
                                    ? "group-hover:text-amber-400"
                                    : item.name === "ThinkPages"
                                      ? "group-hover:text-blue-400"
                                      : item.name === "Dashboard"
                                        ? "group-hover:text-emerald-400"
                                        : item.name === "Feed"
                                          ? "group-hover:text-purple-400"
                                          : item.name === "Countries" || item.name === "Explore"
                                            ? "group-hover:text-purple-400"
                                            : item.name === "Admin"
                                              ? "group-hover:text-red-400"
                                              : item.name === "Cards"
                                                ? "group-hover:text-cyan-400"
                                                : item.name === "Help"
                                                  ? "group-hover:text-orange-400"
                                                  : "group-hover:text-blue-400"
                                }`}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="relative hidden overflow-hidden lg:block">
                              <span className="transition-opacity duration-300 group-hover:opacity-0">
                                {item.name}
                              </span>
                              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
                              </div>
                            </span>
                          </Link>
                        ) : (
                          <Link
                            href={item.href}
                            className="group hover:bg-accent/10 text-muted-foreground relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto"
                          >
                            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <ShineBorder
                                shineColor={(NAV_COLORS[item.name] ?? DEFAULT_NAV).shine}
                                duration={30}
                                borderWidth={1}
                                className="rounded-lg"
                              />
                            </div>
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                                <Icon
                                  className={`h-4 w-4 ${(NAV_COLORS[item.name] ?? DEFAULT_NAV).glow}`}
                                />
                              </div>
                              <Icon
                                className={`relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] ${(NAV_COLORS[item.name] ?? DEFAULT_NAV).hover}`}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="relative hidden overflow-hidden text-sm whitespace-nowrap lg:block xl:text-base">
                              <span className="transition-opacity duration-300 group-hover:opacity-0">
                                {item.name}
                              </span>
                              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
                              </div>
                            </span>
                          </Link>
                        )}
                      </NavigationMenuItem>
                    );
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* Right Side Navigation — morphs toward center */}
            <div
              className="z-[var(--z-floating)] flex flex-1 items-center justify-end gap-2 xl:gap-3"
              style={{
                transform: `translateX(${-morphProgress * 30}%) scale(${1 - morphProgress * 0.3})`,
                opacity: 1 - morphProgress,
                pointerEvents: morphProgress > 0.8 ? "none" : "auto",
                transition: "transform 0.05s linear, opacity 0.05s linear",
              }}
            >
              <NavigationMenu>
                <NavigationMenuList className="flex items-center gap-2">
                  {rightNavItems.map((item) => {
                    const Icon = item.icon;
                    const current = isCurrentPage(item.href);

                    if (item.isDropdown && item.dropdownItems) {
                      return (
                        <NavigationMenuItem key={item.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="group hover:bg-accent/10 text-muted-foreground relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto">
                              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <ShineBorder
                                  shineColor={["#8b5cf6", "#7c3aed", "#a78bfa"]}
                                  duration={30}
                                  borderWidth={1}
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                                  <Icon className="h-4 w-4 text-purple-400" />
                                </div>
                                <Icon
                                  className="relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] group-hover:text-purple-400"
                                  aria-hidden="true"
                                />
                              </div>
                              <span className="relative hidden overflow-hidden lg:block">
                                <span className="transition-opacity duration-300 group-hover:opacity-0">
                                  {item.name}
                                </span>
                                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                  <AnimatedShinyText shimmerWidth={60}>
                                    {item.name}
                                  </AnimatedShinyText>
                                </div>
                              </span>
                              <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-panel w-56">
                              {item.dropdownItems.map((subItem, index) => {
                                const SubIcon = subItem.icon;
                                const isMessages = subItem.href === "/messages";
                                return (
                                  <div key={subItem.name}>
                                    <DropdownMenuItem>
                                      <Link
                                        href={subItem.href}
                                        className="flex cursor-pointer items-center gap-3 px-3 py-3"
                                      >
                                        <div className="relative">
                                          <SubIcon className="text-muted-foreground h-4 w-4" />
                                          {isMessages && messageUnreadCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                                              {messageUnreadCount > 9 ? "9+" : messageUnreadCount}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-1 flex-col">
                                          <span className="font-medium">{subItem.name}</span>
                                          {subItem.description && (
                                            <span className="text-muted-foreground text-xs">
                                              {subItem.description}
                                            </span>
                                          )}
                                        </div>
                                        {isMessages && messageUnreadCount > 0 && (
                                          <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                            {messageUnreadCount}
                                          </span>
                                        )}
                                      </Link>
                                    </DropdownMenuItem>
                                    {index < item.dropdownItems!.length - 1 && (
                                      <DropdownMenuSeparator />
                                    )}
                                  </div>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </NavigationMenuItem>
                      );
                    }

                    return (
                      <NavigationMenuItem key={item.name}>
                        {current ? (
                          <Link
                            href={item.href}
                            className="group text-foreground bg-accent/20 relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto"
                            aria-current="page"
                          >
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                                <Icon
                                  className={`h-4 w-4 ${
                                    item.name === "MyCountry®"
                                      ? "text-amber-400"
                                      : item.name === "ThinkPages"
                                        ? "text-blue-400"
                                        : item.name === "Dashboard"
                                          ? "text-emerald-400"
                                          : item.name === "Feed"
                                            ? "text-purple-400"
                                            : item.name === "Explore"
                                              ? "text-purple-400"
                                              : item.name === "Intelligence"
                                                ? "text-indigo-400"
                                                : item.name === "Admin"
                                                  ? "text-red-400"
                                                  : item.name === "Cards"
                                                    ? "text-cyan-400"
                                                    : item.name === "Help"
                                                      ? "text-orange-400"
                                                      : "text-blue-400"
                                  }`}
                                />
                              </div>
                              <Icon
                                className={`relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] ${
                                  item.name === "MyCountry®"
                                    ? "group-hover:text-amber-400"
                                    : item.name === "ThinkPages"
                                      ? "group-hover:text-blue-400"
                                      : item.name === "Dashboard"
                                        ? "group-hover:text-emerald-400"
                                        : item.name === "Feed"
                                          ? "group-hover:text-purple-400"
                                          : item.name === "Countries" || item.name === "Explore"
                                            ? "group-hover:text-purple-400"
                                            : item.name === "Admin"
                                              ? "group-hover:text-red-400"
                                              : item.name === "Cards"
                                                ? "group-hover:text-cyan-400"
                                                : item.name === "Help"
                                                  ? "group-hover:text-orange-400"
                                                  : "group-hover:text-blue-400"
                                }`}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="relative hidden overflow-hidden lg:block">
                              <span className="transition-opacity duration-300 group-hover:opacity-0">
                                {item.name}
                              </span>
                              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
                              </div>
                            </span>
                          </Link>
                        ) : (
                          <Link
                            href={item.href}
                            className="group hover:bg-accent/10 text-muted-foreground relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 transition-colors duration-200 will-change-auto"
                          >
                            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <ShineBorder
                                shineColor={(NAV_COLORS[item.name] ?? DEFAULT_NAV).shine}
                                duration={30}
                                borderWidth={1}
                                className="rounded-lg"
                              />
                            </div>
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100">
                                <Icon
                                  className={`h-4 w-4 ${(NAV_COLORS[item.name] ?? DEFAULT_NAV).glow}`}
                                />
                              </div>
                              <Icon
                                className={`relative z-10 h-4 w-4 transition-all duration-300 group-hover:scale-110 group-hover:animate-[spin_2s_linear_infinite] ${(NAV_COLORS[item.name] ?? DEFAULT_NAV).hover}`}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="relative hidden overflow-hidden text-sm whitespace-nowrap lg:block xl:text-base">
                              <span className="transition-opacity duration-300 group-hover:opacity-0">
                                {item.name}
                              </span>
                              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <AnimatedShinyText shimmerWidth={60}>{item.name}</AnimatedShinyText>
                              </div>
                            </span>
                          </Link>
                        )}
                      </NavigationMenuItem>
                    );
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          {/* Mobile Title Bar — DI pill replaces hamburger */}
          <div className="flex h-14 w-full items-center justify-between py-2 lg:hidden">
            <div className="flex min-w-0 flex-1 flex-col pr-3">
              <span className="text-muted-foreground/80 text-[10px] tracking-wide uppercase sm:text-[11px]">
                IxStats
              </span>
              <span className="text-foreground line-clamp-1 text-sm font-semibold sm:text-base">
                {contextMenu.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* DI pill on mobile */}
              <div className="max-w-[200px]">
                <CommandPalette isSticky={false} scrollY={0} />
              </div>
              {/* Compact nav trigger */}
              <button
                type="button"
                className="border-border/60 bg-background/80 text-foreground inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border p-2 shadow-sm backdrop-blur"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-controls="ixstats-mobile-navigation"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-[calc(var(--z-navigation)+100)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              id="ixstats-mobile-navigation"
              role="dialog"
              aria-modal="true"
              className="border-border/40 bg-background/98 absolute top-0 left-0 h-full w-[min(90vw,360px)] max-w-full overflow-y-auto border-r px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl backdrop-blur-xl sm:px-5"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-muted-foreground/80 text-[10px] tracking-wide uppercase sm:text-[11px]">
                    Currently viewing
                  </p>
                  <h2 className="text-foreground text-base font-semibold break-words sm:text-lg">
                    {contextMenu.title}
                  </h2>
                  {contextMenu.description && (
                    <p className="text-muted-foreground text-xs leading-snug break-words sm:text-sm">
                      {contextMenu.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="border-border/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground min-h-[44px] min-w-[44px] shrink-0 rounded-full border p-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Authentication Section */}
              <div className="border-border/40 mt-6 border-b pb-5">
                <div className="mb-3 flex items-center gap-2">
                  <User className="text-muted-foreground/70 h-3.5 w-3.5" />
                  <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
                    Account
                  </p>
                </div>
                <div className="bg-accent/5 border-border/30 rounded-xl border p-3">
                  <UserProfileMenu
                    user={user}
                    userProfile={userProfile}
                    setupStatus={setupStatus}
                    userCountryFlag={userCountryFlag?.flagUrl || null}
                    flagsLoading={flagsLoading}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Compass className="text-muted-foreground/70 h-3.5 w-3.5" />
                    <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
                      Global navigation
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {visibleNavItems.map((item) => {
                      const Icon = item.icon;
                      const current = isCurrentPage(item.href);

                      if (item.isDropdown && item.dropdownItems) {
                        return (
                          <div
                            key={item.name}
                            className="border-border/50 bg-card/60 rounded-2xl border px-3 py-3 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                                <Icon className="h-5 w-5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground text-sm font-semibold break-words">
                                  {item.name}
                                </p>
                                <p className="text-muted-foreground text-xs break-words">
                                  Select a lab to jump in.
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {item.dropdownItems.map((subItem) => {
                                const SubIcon = subItem.icon;
                                return (
                                  <Link
                                    key={subItem.name}
                                    href={subItem.href}
                                    className="text-muted-foreground hover:border-border/60 hover:text-foreground flex min-h-[44px] items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <span className="bg-muted/50 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                                      <SubIcon className="h-4 w-4" />
                                    </span>
                                    <span className="flex-1 break-words">{subItem.name}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex min-h-[60px] items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                            current
                              ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                              : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              current
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug font-semibold break-words">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-muted-foreground text-xs leading-tight break-words">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {current && (
                            <span className="text-primary shrink-0 text-[10px] font-semibold tracking-wide uppercase sm:text-[11px]">
                              Active
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Section Divider */}
                <div className="border-border/40 border-t pt-5">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="via-border/60 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
                    <span className="text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase">
                      Context Menu
                    </span>
                    <div className="via-border/60 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
                  </div>
                </div>

                {contextMenu.groups.map((group) => (
                  <div key={group.title}>
                    <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
                      {group.title}
                    </p>
                    <div className="mt-3 space-y-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const targetHref = item.href.split("?")[0].split("#")[0] || "/";
                        const active =
                          normalizedPathname === targetHref ||
                          (targetHref !== "/" && normalizedPathname.startsWith(`${targetHref}/`));

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                              active
                                ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                active ? "bg-primary text-primary-foreground" : "bg-muted/60"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug font-medium break-words">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="text-muted-foreground text-xs leading-tight break-words">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-8 space-y-3">
                <div className="border-border/60 bg-muted/40 text-muted-foreground rounded-2xl border border-dashed px-4 py-3 text-xs leading-relaxed">
                  <span className="font-semibold">💡 Smart Navigation:</span> This menu adapts to
                  your current page. Use it for rapid jumps across IxStats systems.
                </div>

                {/* Close Button for easier mobile UX */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-accent/20 hover:bg-accent/30 text-foreground border-border/40 min-h-[50px] w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                >
                  Close Menu
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <motion.div
          className="pointer-events-none fixed top-0 left-1/2 z-[var(--z-command)] flex justify-center"
          animate={{
            x: "-50%",
            y: isSticky ? 8 : Math.max(-100, 10 - scrollY),
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 1,
          }}
          style={{
            width: "100%",
            maxWidth: "100%",
          }}
        >
          {/* Large blur-3xl glow that moves and morphs with the DI */}
          <div
            className="pointer-events-none absolute inset-0 scale-150 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/15 to-blue-500/10 blur-3xl"
            style={{
              opacity: 0.6 * Math.max(0.2, 1 - morphProgress),
            }}
          />
          <CommandPalette isSticky={isSticky} scrollY={scrollY} />
        </motion.div>
      )}
    </>
  );
}
