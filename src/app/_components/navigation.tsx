"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  FileText,
  Globe,
  Home,
  Layers,
  Menu,
  MessageSquare,
  Rss,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Trophy,
  Users,
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
import { createUserProfileQueryParams } from "~/lib/user-utils";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import { usePremium } from "~/hooks/usePremium";
import { ThinkPagesIcon } from "~/components/icons/ThinkPagesIcon";
import { AnimatedShinyText } from "~/components/magicui/animated-shiny-text";
import { ShineBorder } from "~/components/magicui/shine-border";
import { FaLanguage, FaWikipediaW } from "react-icons/fa";
import { GiCardRandom, GiFamilyTree } from "react-icons/gi";
import { GiSoapExperiment } from "react-icons/gi";
import { GiVibratingShield } from "react-icons/gi";
import { FaTreeCity } from "react-icons/fa6";
import { withBasePath, stripBasePath } from "~/lib/base-path";

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
            href: "/thinkpages",
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
            href: "/thinkpages?view=feed",
            icon: Rss,
            description: "Public declarations, diplomatic announcements, and intelligence broadcasts.",
          },
          {
            name: "ThinkTanks",
            href: "/thinkpages?view=thinktanks",
            icon: Users,
            description: "Coordinate intelligence networks and diplomatic working groups.",
          },
          {
            name: "ThinkShare Messaging",
            href: "/thinkpages?view=messages",
            icon: MessageSquare,
            description: "Secure diplomatic channels and encrypted government communications.",
          },
        ],
      },
      {
        title: "Account Tools",
        items: [
          {
            name: "Account Manager",
            href: "/thinkpages?panel=account-manager",
            icon: Settings,
            description: "Manage diplomatic personas and official government accounts.",
          },
          {
            name: "Workspace Settings",
            href: "/thinkpages?panel=settings",
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
    title: "IxStats Platform",
    description: "Quick links into the primary platform areas.",
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
};

function getContextKey(path: string): keyof typeof contextualMenus {
  if (path.startsWith("/mycountry")) return "mycountry";
  if (path.startsWith("/thinkpages")) return "thinkpages";
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
  const { user, isLoaded } = useUser();
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

  // Get navigation settings from admin
  const { data: navigationSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    // Default to showing all tabs if query fails
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Get user profile to show linked country
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery();

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

  const navigationItems: NavigationItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      requiresAuth: true,
    },
    {
      name: "Feed",
      href: "/feed",
      icon: Activity,
      requiresAuth: false,
      description: "Real-time platform activity and updates",
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
      isDropdown: true,
      dropdownItems: [
        {
          name: "National Overview",
          href: "/mycountry",
          icon: Crown,
          description: " National dashboard and vitality metrics",
        },
        {
          name: "Executive",
          href: "/mycountry/executive",
          icon: Command,
          description: "Meetings, policies, plans, and executive decisions",
        },
        {
          name: "Diplomacy",
          href: "/mycountry/diplomacy",
          icon: Globe,
          description: "Embassy network, missions, and diplomatic relations",
        },
        {
          name: "Intelligence",
          href: "/mycountry/intelligence",
          icon: Brain,
          description: "Data analysis, trends, projections, and data forecasting",
        },
        {
          name: "Defense & Security",
          href: "/mycountry/defense",
          icon: Shield,
          description: "Military readiness, force composition, and stability",
        },
      ],
    },
    {
      name: "Maps",
      href: "/maps",
      icon: Compass,
      requiresAuth: false,
      description: "Interactive world map and geographic exploration",
    },
    {
      name: "ThinkPages",
      href: "/thinkpages",
      icon: Rss,
      requiresAuth: false,
      description: "Diplomatic communications and intelligence sharing platform",
      isDropdown: true,
      dropdownItems: [
        {
          name: "Social Feed",
          href: "/thinkpages?view=feed",
          icon: MessageSquare,
          description: "Public declarations and diplomatic announcements",
        },
        {
          name: "ThinkTanks",
          href: "/thinkpages?view=thinktanks",
          icon: Users,
          description: "Intelligence networks and diplomatic working groups",
        },
        {
          name: "ThinkShare Messages",
          href: "/thinkpages?view=messages",
          icon: Send,
          description: "Secure diplomatic channels and encrypted communications",
        },
      ],
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
      href: "/wiki",
      icon: FaWikipediaW,
      requiresAuth: false,
    },
    {
      name: "Cards",
      href: "/vault",
      icon: GiCardRandom,
      requiresAuth: true,
      adminOnly: true,
      description: "IxCards trading card system (Admin Only)",
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
  console.log("[Navigation] Debug info:", {
    isLoaded,
    user: !!user,
    profileLoading,
    userProfile: userProfile
      ? { countryId: userProfile.countryId, hasCountry: !!userProfile.countryId }
      : null,
    setupStatus,
    isAdmin,
    isPremium,
  });

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

      // Check admin navigation settings
      if (navigationSettings) {
        if (item.name === "Wiki" && !navigationSettings.showWikiTab) return false;
        if (item.name === "Cards" && !navigationSettings.showCardsTab) return false;
        if (item.name === "Labs" && !navigationSettings.showLabsTab) return false;
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

  // For better visual balance, try to keep sides equal or left-heavy by 1
  const leftCount = Math.ceil(totalItems / 2);

  // Create balanced arrays ensuring both sides have similar visual weight
  const leftNavItems = visibleNavItems.slice(0, leftCount);
  const rightNavItems = visibleNavItems.slice(leftCount);

  return (
    <>
      <nav className="navigation-bar from-background/95 via-secondary/95 to-background/95 border-border relative z-[10005] border-b bg-gradient-to-r shadow-2xl backdrop-blur-xl">
        <div className="to-background/20 absolute right-0 bottom-0 left-0 h-2 rounded-b-3xl bg-gradient-to-b from-transparent" />

        <div className="mx-auto max-w-none px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="relative hidden h-16 w-full items-center justify-between lg:flex">
            {/* Left Side Navigation */}
            <div className="z-[9995] flex flex-1 items-center justify-start gap-2 xl:gap-3">
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
                                shineColor={
                                  item.name === "MyCountry®"
                                    ? ["#f59e0b", "#eab308", "#fbbf24"]
                                    : item.name === "ThinkPages"
                                      ? ["#3b82f6", "#1d4ed8", "#60a5fa"]
                                      : item.name === "Dashboard"
                                        ? ["#10b981", "#059669", "#34d399"]
                                        : item.name === "Feed"
                                          ? ["#8b5cf6", "#7c3aed", "#a78bfa"]
                                          : item.name === "Explore"
                                            ? ["#8b5cf6", "#7c3aed", "#a78bfa"]
                                            : item.name === "Intelligence"
                                              ? ["#6366f1", "#4f46e5", "#818cf8"]
                                              : item.name === "Admin"
                                                ? ["#ef4444", "#dc2626", "#f87171"]
                                                : item.name === "Cards"
                                                  ? ["#06b6d4", "#0891b2", "#22d3ee"]
                                                  : item.name === "Help"
                                                    ? ["#fb923c", "#f97316", "#fdba74"]
                                                    : ["#3b82f6", "#8b5cf6", "#06b6d4"]
                                }
                                duration={30}
                                borderWidth={1}
                                className="rounded-lg"
                              />
                            </div>
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
                            <span className="relative hidden overflow-hidden lg:block text-sm xl:text-base whitespace-nowrap">
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

            {/* Desktop Command Palette */}
            <div className="absolute top-1/2 left-1/2 z-[10010] -translate-x-1/2 -translate-y-1/2 transform max-w-[min(400px,calc(100%-320px))]">
              <div className="pointer-events-none absolute inset-0 scale-150 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/15 to-blue-500/10 opacity-60 blur-3xl" />
              {!isSticky && <CommandPalette isSticky={false} scrollY={scrollY} />}
            </div>

            {/* Right Side Navigation */}
            <div className="z-[9995] flex flex-1 items-center justify-end gap-2 xl:gap-3">
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
                                shineColor={
                                  item.name === "MyCountry®"
                                    ? ["#f59e0b", "#eab308", "#fbbf24"]
                                    : item.name === "ThinkPages"
                                      ? ["#3b82f6", "#1d4ed8", "#60a5fa"]
                                      : item.name === "Dashboard"
                                        ? ["#10b981", "#059669", "#34d399"]
                                        : item.name === "Feed"
                                          ? ["#8b5cf6", "#7c3aed", "#a78bfa"]
                                          : item.name === "Explore"
                                            ? ["#8b5cf6", "#7c3aed", "#a78bfa"]
                                            : item.name === "Intelligence"
                                              ? ["#6366f1", "#4f46e5", "#818cf8"]
                                              : item.name === "Admin"
                                                ? ["#ef4444", "#dc2626", "#f87171"]
                                                : item.name === "Cards"
                                                  ? ["#06b6d4", "#0891b2", "#22d3ee"]
                                                  : item.name === "Help"
                                                    ? ["#fb923c", "#f97316", "#fdba74"]
                                                    : ["#3b82f6", "#8b5cf6", "#06b6d4"]
                                }
                                duration={30}
                                borderWidth={1}
                                className="rounded-lg"
                              />
                            </div>
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
                            <span className="relative hidden overflow-hidden lg:block text-sm xl:text-base whitespace-nowrap">
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

          {/* Mobile Title Bar */}
          <div className="flex h-14 w-full items-center justify-between py-2 lg:hidden">
            <div className="flex flex-col min-w-0 flex-1 pr-3">
              <span className="text-muted-foreground/80 text-[10px] sm:text-[11px] tracking-wide uppercase">
                IxStats
              </span>
              <span className="text-foreground line-clamp-1 text-sm sm:text-base font-semibold">
                {contextMenu.title}
              </span>
            </div>
            <button
              type="button"
              className="border-border/60 bg-background/80 text-foreground inline-flex items-center justify-center rounded-lg border p-2 shadow-sm backdrop-blur flex-shrink-0 min-h-[44px] min-w-[44px]"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="ixstats-mobile-navigation"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-[10030]"
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
              className="border-border/40 bg-background/98 absolute top-0 left-0 h-full w-[min(90vw,360px)] max-w-full overflow-y-auto border-r px-4 sm:px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl backdrop-blur-xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-muted-foreground/80 text-[10px] sm:text-[11px] tracking-wide uppercase">
                    Currently viewing
                  </p>
                  <h2 className="text-foreground text-base sm:text-lg font-semibold break-words">{contextMenu.title}</h2>
                  {contextMenu.description && (
                    <p className="text-muted-foreground text-xs sm:text-sm leading-snug break-words">
                      {contextMenu.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="border-border/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground rounded-full border p-2 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
                    Global navigation
                  </p>
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
                              <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0">
                                <Icon className="h-5 w-5" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground text-sm font-semibold break-words">{item.name}</p>
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
                                    className="text-muted-foreground hover:border-border/60 hover:text-foreground flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors min-h-[44px]"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <span className="bg-muted/50 flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0">
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
                          href={withBasePath(item.href)}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors min-h-[60px] ${
                            current
                              ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                              : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${
                              current
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug font-semibold break-words">{item.name}</p>
                            {item.description && (
                              <p className="text-muted-foreground text-xs leading-tight break-words">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {current && (
                            <span className="text-primary text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase flex-shrink-0">
                              Active
                            </span>
                          )}
                        </Link>
                      );
                    })}
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
                            href={withBasePath(item.href)}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors min-h-[56px] ${
                              active
                                ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
                                active ? "bg-primary text-primary-foreground" : "bg-muted/60"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug font-medium break-words">{item.name}</p>
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

              <div className="border-border/60 bg-muted/40 text-muted-foreground mt-8 rounded-2xl border border-dashed px-4 py-3 text-xs">
                Menus adapt to the page you are working on. Use this drawer for rapid jumps across
                IxStats systems.
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <div
          className={`fixed z-[10020] will-change-transform ${
            isSticky ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            top: isSticky ? "8px" : "64px",
            left: "50%",
            transform: "translateX(-50%)",
            transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
        >
          <CommandPalette isSticky={isSticky} scrollY={scrollY} />
        </div>
      )}
    </>
  );
}
