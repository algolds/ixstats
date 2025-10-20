"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronDown,
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
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommandPalette } from "~/components/DynamicIsland";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem
} from "~/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "~/components/ui/dropdown-menu";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { createUserProfileQueryParams } from '~/lib/user-utils';
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
          { name: "Analytics Overview", href: "/dashboard", icon: BarChart3, description: "Live performance metrics for your country." },
          { name: "Executive Command", href: "/dashboard?panel=command-center", icon: Activity, description: "Jump directly into decision workflows." }
        ]
      },
      {
        title: "Global Context",
        items: [
          { name: "World Leaderboards", href: "/leaderboards", icon: Trophy, description: "See how nations compare across metrics." },
          { name: "Explore Countries", href: "/countries", icon: Globe, description: "Research nations and benchmark progress." }
        ]
      }
    ]
  },
  mycountry: {
    title: "MyCountry Operations",
    description: "Everything you need to run your nation on mobile.",
    groups: [
      {
        title: "Executive Systems",
        items: [
          { name: "National Overview", href: "/mycountry", icon: Crown, description: "Core KPIs and operational status at a glance." },
          { name: "Policy Studio", href: "/mycountry/editor", icon: Settings, description: "Adjust governance, culture, and growth levers." }
        ]
      },
      {
        title: "Security & Intelligence",
        items: [
          { name: "Intelligence Center", href: "/mycountry/intelligence", icon: Shield, description: "Context-aware briefs and data synthesis." },
          { name: "Defense Readiness", href: "/mycountry/defense", icon: Layers, description: "Force posture, stability, and risk mitigations." }
        ]
      }
    ]
  },
  thinkpages: {
    title: "ThinkPages Workspace",
    description: "Knowledge, collaboration, and persona management.",
    groups: [
      {
        title: "Primary Views",
        items: [
          { name: "Social Feed", href: "/thinkpages?view=feed", icon: Rss, description: "Broadcast updates and follow communities." },
          { name: "ThinkTanks", href: "/thinkpages?view=thinktanks", icon: Users, description: "Coordinate collaborative research groups." },
          { name: "ThinkShare Messaging", href: "/thinkpages?view=messages", icon: MessageSquare, description: "Direct conversations with your teams." }
        ]
      },
      {
        title: "Account Tools",
        items: [
          { name: "Account Manager", href: "/thinkpages?panel=account-manager", icon: Settings, description: "Switch and configure ThinkPages identities." },
          { name: "Workspace Settings", href: "/thinkpages?panel=settings", icon: SlidersHorizontal, description: "Tune notifications and collaboration defaults." }
        ]
      }
    ]
  },
  admin: {
    title: "Platform Administration",
    description: "Operate governance and platform-wide systems.",
    groups: [
      {
        title: "Core Panels",
        items: [
          { name: "Admin Overview", href: "/admin", icon: Settings, description: "Configure feature flags and admin tooling." },
          { name: "Audit & Activity", href: "/dashboard", icon: Activity, description: "Monitor platform-wide actions and alerts." }
        ]
      },
      {
        title: "Navigation & Structure",
        items: [
          { name: "Navigation Settings", href: "/admin?tab=navigation", icon: Layers, description: "Reorder tabs and adjust visibility." },
          { name: "User Management", href: "/admin?tab=users", icon: Users, description: "Review roles, permissions, and onboarding." }
        ]
      }
    ]
  },
  builder: {
    title: "Builder Suite",
    description: "Create, import, or evolve your national model.",
    groups: [
      {
        title: "Nation Lifecycle",
        items: [
          { name: "Create Nation", href: "/builder", icon: Layers, description: "Start from scratch with guided setup." },
          { name: "Import Scenario", href: "/builder/import", icon: Database, description: "Bring in external data or legacy nations." }
        ]
      }
    ]
  },
  explore: {
    title: "Explore Nations",
    description: "Discover and benchmark countries across IxStats.",
    groups: [
      {
        title: "World Explorer",
        items: [
          { name: "Countries Directory", href: "/countries", icon: Globe, description: "Browse nations, stats, and intelligence." },
          { name: "Leaderboards", href: "/leaderboards", icon: Trophy, description: "Rankings across economy, stability, and more." }
        ]
      }
    ]
  },
  leaderboards: {
    title: "Leaderboards",
    description: "Track the top performers and emerging nations.",
    groups: [
      {
        title: "Platform Rankings",
        items: [
          { name: "Global Leaderboards", href: "/leaderboards", icon: Trophy, description: "Full leaderboard experience with filters." },
          { name: "Dashboard Highlights", href: "/dashboard#leaderboards", icon: BarChart3, description: "Snapshot of rankings inside your dashboard." }
        ]
      }
    ]
  },
  default: {
    title: "IxStats Platform",
    description: "Quick links into the primary platform areas.",
    groups: [
      {
        title: "Primary Areas",
        items: [
          { name: "Dashboard", href: "/dashboard", icon: BarChart3, description: "Your command center home." },
          { name: "MyCountry®", href: "/mycountry", icon: Crown, description: "Operate your nation from anywhere." },
          { name: "ThinkPages", href: "/thinkpages", icon: Rss, description: "Collaborate and publish across the network." },
          { name: "Explore Nations", href: "/countries", icon: Globe, description: "Research and compare global data." }
        ]
      }
    ]
  }
};

function getContextKey(path: string): keyof typeof contextualMenus {
  if (path.startsWith("/mycountry")) return "mycountry";
  if (path.startsWith("/thinkpages")) return "thinkpages";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/builder")) return "builder";
  if (path.startsWith("/countries")) return "explore";
  if (path.startsWith("/leaderboards")) return "leaderboards";
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
          const direction = currentScrollY > lastScrollY ? 'down' : 'up';
          
          // Smooth interpolation for scroll position updates
          const smoothScrollY = lastScrollY + (currentScrollY - lastScrollY) * Math.min(deltaTime / 16, 1);
          
          // Update scroll position for ultra-smooth transitions
          setScrollY(smoothScrollY);
          
          // Determine sticky state with smooth transition zone and hysteresis
          const stickyThreshold = direction === 'down' ? 60 : 40;
          const newStickyState = currentScrollY > stickyThreshold;
          setIsSticky(newStickyState);
          
          lastScrollY = currentScrollY;
          lastTimestamp = timestamp;
          isScrolling = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
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
      name: "Intelligence",
      href: "/mycountry/intelligence",
      icon: Shield,
      requiresAuth: true,
      requiresCountry: true,
      description: "Intelligence operations and analytics",
    },
    {
      name: "ThinkPages",
      href: "/thinkpages",
      icon: Rss,
      requiresAuth: false,
      description: "Knowledge management and collaborative thinking",
      isDropdown: true,
      dropdownItems: [
        {
          name: "Social Feed",
          href: "/thinkpages?view=feed",
          icon: MessageSquare,
          description: "Broadcast updates and follow communities"
        },
        {
          name: "ThinkTanks",
          href: "/thinkpages?view=thinktanks",
          icon: Users,
          description: "Coordinate collaborative research groups"
        },
        {
          name: "ThinkShare Messages",
          href: "/thinkpages?view=messages",
          icon: Send,
          description: "Direct conversations with your teams"
        }
      ]
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
      href: "/cards",
      icon: GiCardRandom,
      requiresAuth: true,
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
          description: "Heraldry generator"
        },
        {
          name: "Onoma",
          href: "/labs/onoma",
          icon: Database,
          description: "Markov name generator"
        },
        {
          name: "Strata",
          href: "/labs/strata",
          icon: FaTreeCity,
          description: "City/roadmap generator"
        },
        {
          name: "Dynas",
          href: "/labs/dynas",
          icon: GiFamilyTree,
          description: "Family/Dynasty Generator"
        },
        {
          name: "Nomora",
          href: "/labs/nomora",
          icon: FaLanguage,
          description: "Conlang Generator"
        }
      ]
    }
  ];

  const isCurrentPage = (href: string) => {
    const cleanedHref = href.split("?")[0].split("#")[0] || "/";
    const normalizedHref = cleanedHref.startsWith("/") ? cleanedHref : `/${cleanedHref}`;
    if (normalizedPathname === normalizedHref) return true;
    return normalizedHref !== "/" && normalizedPathname.startsWith(`${normalizedHref}/`);
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };

  const setupStatus = getSetupStatus();

  // Filter visible navigation items based on user state and admin settings
  const visibleNavItems = navigationItems.filter(item => {
    if (item.requiresAuth && !user) return false;
    if (item.requiresCountry && setupStatus !== 'complete') return false;
    if (item.adminOnly && !isAdmin) return false;
    if (item.premiumOnly && !isPremium) return false;

    if (item.name === "Intelligence") {
      const showIntelligence = navigationSettings?.showIntelligenceTab ?? false;
      if (!showIntelligence) return false;
    }

    // Check admin navigation settings
    if (navigationSettings) {
      if (item.name === "Wiki" && !navigationSettings.showWikiTab) return false;
      if (item.name === "Cards" && !navigationSettings.showCardsTab) return false;
      if (item.name === "Labs" && !navigationSettings.showLabsTab) return false;
    }

    return true;
  }).map(item => {
    // Also filter dropdown items based on premium access
    if (item.isDropdown && item.dropdownItems) {
      return {
        ...item,
        dropdownItems: item.dropdownItems.filter(dropdownItem => {
          if (dropdownItem.premiumOnly && !isPremium) return false;
          return true;
        })
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
  const rightCount = totalItems - leftCount;
  
  // Create balanced arrays ensuring both sides have similar visual weight
  const leftNavItems = visibleNavItems.slice(0, leftCount);
  const rightNavItems = visibleNavItems.slice(leftCount);

  return (
    <>
      <nav className="navigation-bar relative z-[10005] bg-gradient-to-r from-background/95 via-secondary/95 to-background/95 backdrop-blur-xl border-b border-border shadow-2xl">
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-background/20 rounded-b-3xl" />

        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:flex items-center justify-between h-16 w-full relative">
            {/* Left Side Navigation */}
            <div className="flex items-center justify-start gap-3 z-[9995] flex-1">
              <NavigationMenu>
                <NavigationMenuList className="flex items-center gap-2">
                  {leftNavItems.map((item) => {
                    const Icon = item.icon;
                    const current = isCurrentPage(item.href);

                    if (item.isDropdown && item.dropdownItems) {
                      return (
                        <NavigationMenuItem key={item.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto hover:bg-accent/10 text-muted-foreground overflow-hidden">
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <ShineBorder
                                  shineColor={["#8b5cf6", "#7c3aed", "#a78bfa"]}
                                  duration={30}
                                  borderWidth={1}
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                                  <Icon className="h-4 w-4 text-purple-400" />
                                </div>
                                <Icon className="h-4 w-4 relative z-10 transition-all duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:scale-110 group-hover:text-purple-400" aria-hidden="true" />
                              </div>
                              <span className="hidden lg:block relative overflow-hidden">
                                <span className="group-hover:opacity-0 transition-opacity duration-300">{item.name}</span>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <AnimatedShinyText shimmerWidth={60}>
                                    {item.name}
                                  </AnimatedShinyText>
                                </div>
                              </span>
                              <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 glass-panel">
                              {item.dropdownItems.map((subItem, index) => {
                                const SubIcon = subItem.icon;
                                return (
                                  <div key={subItem.name}>
                                    <DropdownMenuItem>
                                      <Link href={subItem.href} className="flex items-center gap-3 px-3 py-3 cursor-pointer">
                                        <SubIcon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{subItem.name}</span>
                                          {subItem.description && (
                                            <span className="text-xs text-muted-foreground">{subItem.description}</span>
                                          )}
                                        </div>
                                      </Link>
                                    </DropdownMenuItem>
                                    {index < item.dropdownItems!.length - 1 && <DropdownMenuSeparator />}
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
                            className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto text-foreground bg-accent/20 overflow-hidden"
                            aria-current="page"
                          >
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                                <Icon className={`h-4 w-4 ${
                                  item.name === "MyCountry®" ? "text-amber-400" :
                                  item.name === "ThinkPages" ? "text-blue-400" :
                                  item.name === "Dashboard" ? "text-emerald-400" :
                                  item.name === "Explore" ? "text-purple-400" :
                                  item.name === "Intelligence" ? "text-indigo-400" :
                                  item.name === "Admin" ? "text-red-400" :
                                  item.name === "Cards" ? "text-cyan-400" :
                                  "text-blue-400"
                                }`} />
                              </div>
                              <Icon className={`h-4 w-4 relative z-10 transition-all duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:scale-110 ${
                                item.name === "MyCountry®" ? "group-hover:text-amber-400" :
                                item.name === "ThinkPages" ? "group-hover:text-blue-400" :
                                item.name === "Dashboard" ? "group-hover:text-emerald-400" :
                                item.name === "Countries" ? "group-hover:text-purple-400" :
                                item.name === "Admin" ? "group-hover:text-red-400" :
                                item.name === "Dossier" ? "group-hover:text-orange-400" :
                                item.name === "Cards" ? "group-hover:text-cyan-400" :
                                "group-hover:text-blue-400"
                              }`} aria-hidden="true" />
                            </div>
                            <span className="hidden lg:block relative overflow-hidden">
                              <span className="group-hover:opacity-0 transition-opacity duration-300">{item.name}</span>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <AnimatedShinyText shimmerWidth={60}>
                                  {item.name}
                                </AnimatedShinyText>
                              </div>
                            </span>
                          </Link>
                        ) : (
                          <Link
                            href={item.href}
                            className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto hover:bg-accent/10 text-muted-foreground overflow-hidden"
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                              <ShineBorder
                                shineColor={
                                  item.name === "MyCountry®" ? ["#f59e0b", "#eab308", "#fbbf24"] :
                                  item.name === "ThinkPages" ? ["#3b82f6", "#1d4ed8", "#60a5fa"] :
                                  item.name === "Dashboard" ? ["#10b981", "#059669", "#34d399"] :
                                  item.name === "Explore" ? ["#8b5cf6", "#7c3aed", "#a78bfa"] :
                                  item.name === "Intelligence" ? ["#6366f1", "#4f46e5", "#818cf8"] :
                                  item.name === "Admin" ? ["#ef4444", "#dc2626", "#f87171"] :
                                  item.name === "Cards" ? ["#06b6d4", "#0891b2", "#22d3ee"] :
                                  ["#3b82f6", "#8b5cf6", "#06b6d4"]
                                }
                                duration={30}
                                borderWidth={1}
                                className="rounded-lg"
                              />
                            </div>
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                                <Icon className={`h-4 w-4 ${
                                  item.name === "MyCountry®" ? "text-amber-400" :
                                  item.name === "ThinkPages" ? "text-blue-400" :
                                  item.name === "Dashboard" ? "text-emerald-400" :
                                  item.name === "Explore" ? "text-purple-400" :
                                  item.name === "Intelligence" ? "text-indigo-400" :
                                  item.name === "Admin" ? "text-red-400" :
                                  item.name === "Cards" ? "text-cyan-400" :
                                  "text-blue-400"
                                }`} />
                              </div>
                              <Icon className={`h-4 w-4 relative z-10 transition-all duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:scale-110 ${
                                item.name === "MyCountry®" ? "group-hover:text-amber-400" :
                                item.name === "ThinkPages" ? "group-hover:text-blue-400" :
                                item.name === "Dashboard" ? "group-hover:text-emerald-400" :
                                item.name === "Countries" ? "group-hover:text-purple-400" :
                                item.name === "Admin" ? "group-hover:text-red-400" :
                                item.name === "Dossier" ? "group-hover:text-orange-400" :
                                item.name === "Cards" ? "group-hover:text-cyan-400" :
                                "group-hover:text-blue-400"
                              }`} aria-hidden="true" />
                            </div>
                            <span className="hidden lg:block relative overflow-hidden">
                              <span className="group-hover:opacity-0 transition-opacity duration-300">{item.name}</span>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <AnimatedShinyText shimmerWidth={60}>
                                  {item.name}
                                </AnimatedShinyText>
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
            <div className="absolute left-1/2 top-1/2 z-[10010] -translate-x-1/2 -translate-y-1/2 transform">
              <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/15 to-blue-500/10 blur-3xl opacity-60 pointer-events-none" />
              {!isSticky && <CommandPalette isSticky={false} scrollY={scrollY} />}
            </div>

            {/* Right Side Navigation */}
            <div className="flex items-center justify-end gap-3 z-[9995] flex-1">
              <NavigationMenu>
                <NavigationMenuList className="flex items-center gap-2">
                  {rightNavItems.map((item) => {
                    const Icon = item.icon;
                    const current = isCurrentPage(item.href);

                    if (item.isDropdown && item.dropdownItems) {
                      return (
                        <NavigationMenuItem key={item.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto hover:bg-accent/10 text-muted-foreground overflow-hidden">
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <ShineBorder
                                  shineColor={["#8b5cf6", "#7c3aed", "#a78bfa"]}
                                  duration={30}
                                  borderWidth={1}
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                                  <Icon className="h-4 w-4 text-purple-400" />
                                </div>
                                <Icon className="h-4 w-4 relative z-10 transition-all duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:scale-110 group-hover:text-purple-400" aria-hidden="true" />
                              </div>
                              <span className="hidden lg:block relative overflow-hidden">
                                <span className="group-hover:opacity-0 transition-opacity duration-300">{item.name}</span>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <AnimatedShinyText shimmerWidth={60}>
                                    {item.name}
                                  </AnimatedShinyText>
                                </div>
                              </span>
                              <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 glass-panel">
                              {item.dropdownItems.map((subItem, index) => {
                                const SubIcon = subItem.icon;
                                return (
                                  <div key={subItem.name}>
                                    <DropdownMenuItem>
                                      <Link href={subItem.href} className="flex items-center gap-3 px-3 py-3 cursor-pointer">
                                        <SubIcon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{subItem.name}</span>
                                          {subItem.description && (
                                            <span className="text-xs text-muted-foreground">{subItem.description}</span>
                                          )}
                                        </div>
                                      </Link>
                                    </DropdownMenuItem>
                                    {index < item.dropdownItems!.length - 1 && <DropdownMenuSeparator />}
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
                            className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto text-foreground bg-accent/20 overflow-hidden"
                            aria-current="page"
                          >
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                                <Icon className={`h-4 w-4 ${
                                  item.name === "MyCountry®" ? "text-amber-400" :
                                  item.name === "ThinkPages" ? "text-blue-400" :
                                  item.name === "Dashboard" ? "text-emerald-400" :
                                  item.name === "Explore" ? "text-purple-400" :
                                  item.name === "Intelligence" ? "text-indigo-400" :
                                  item.name === "Admin" ? "text-red-400" :
                                  item.name === "Cards" ? "text-cyan-400" :
                                  "text-blue-400"
                                }`} />
                              </div>
                              <Icon className={`h-4 w-4 relative z-10 transition-all duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:scale-110 ${
                                item.name === "MyCountry®" ? "group-hover:text-amber-400" :
                                item.name === "ThinkPages" ? "group-hover:text-blue-400" :
                                item.name === "Dashboard" ? "group-hover:text-emerald-400" :
                                item.name === "Countries" ? "group-hover:text-purple-400" :
                                item.name === "Admin" ? "group-hover:text-red-400" :
                                item.name === "Dossier" ? "group-hover:text-orange-400" :
                                item.name === "Cards" ? "group-hover:text-cyan-400" :
                                "group-hover:text-blue-400"
                              }`} aria-hidden="true" />
                            </div>
                            <span className="hidden lg:block relative overflow-hidden">
                              <span className="group-hover:opacity-0 transition-opacity duration-300">{item.name}</span>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <AnimatedShinyText shimmerWidth={60}>
                                  {item.name}
                                </AnimatedShinyText>
                              </div>
                            </span>
                          </Link>
                        ) : (
                          <Link
                            href={item.href}
                            className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto hover:bg-accent/10 text-muted-foreground overflow-hidden"
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                              <ShineBorder
                                shineColor={
                                  item.name === "MyCountry®" ? ["#f59e0b", "#eab308", "#fbbf24"] :
                                  item.name === "ThinkPages" ? ["#3b82f6", "#1d4ed8", "#60a5fa"] :
                                  item.name === "Dashboard" ? ["#10b981", "#059669", "#34d399"] :
                                  item.name === "Explore" ? ["#8b5cf6", "#7c3aed", "#a78bfa"] :
                                  item.name === "Intelligence" ? ["#6366f1", "#4f46e5", "#818cf8"] :
                                  item.name === "Admin" ? ["#ef4444", "#dc2626", "#f87171"] :
                                  item.name === "Cards" ? ["#06b6d4", "#0891b2", "#22d3ee"] :
                                  ["#3b82f6", "#8b5cf6", "#06b6d4"]
                                }
                                duration={30}
                                borderWidth={1}
                                className="rounded-lg"
                              />
                            </div>
                            <div className="relative">
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                                <Icon className={`h-4 w-4 ${
                                  item.name === "MyCountry®" ? "text-amber-400" :
                                  item.name === "ThinkPages" ? "text-blue-400" :
                                  item.name === "Dashboard" ? "text-emerald-400" :
                                  item.name === "Explore" ? "text-purple-400" :
                                  item.name === "Intelligence" ? "text-indigo-400" :
                                  item.name === "Admin" ? "text-red-400" :
                                  item.name === "Cards" ? "text-cyan-400" :
                                  "text-blue-400"
                                }`} />
                              </div>
                              <Icon className={`h-4 w-4 relative z-10 transition-all duration-300 group-hover:animate-[spin_2s_linear_infinite] group-hover:scale-110 ${
                                item.name === "MyCountry®" ? "group-hover:text-amber-400" :
                                item.name === "ThinkPages" ? "group-hover:text-blue-400" :
                                item.name === "Dashboard" ? "group-hover:text-emerald-400" :
                                item.name === "Countries" ? "group-hover:text-purple-400" :
                                item.name === "Admin" ? "group-hover:text-red-400" :
                                item.name === "Dossier" ? "group-hover:text-orange-400" :
                                item.name === "Cards" ? "group-hover:text-cyan-400" :
                                "group-hover:text-blue-400"
                              }`} aria-hidden="true" />
                            </div>
                            <span className="hidden lg:block relative overflow-hidden">
                              <span className="group-hover:opacity-0 transition-opacity duration-300">{item.name}</span>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <AnimatedShinyText shimmerWidth={60}>
                                  {item.name}
                                </AnimatedShinyText>
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
          <div className="flex items-center justify-between h-14 w-full py-2 lg:hidden">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">IxStats</span>
              <span className="text-base font-semibold text-foreground line-clamp-1">{contextMenu.title}</span>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-border/60 bg-background/80 p-2 text-foreground shadow-sm backdrop-blur"
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
              className="absolute left-0 top-0 h-full w-[min(88vw,360px)] max-w-[360px] overflow-y-auto border-r border-border/40 bg-background/98 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] shadow-2xl backdrop-blur-xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Currently viewing</p>
                  <h2 className="text-lg font-semibold text-foreground">{contextMenu.title}</h2>
                  {contextMenu.description && (
                    <p className="text-sm leading-snug text-muted-foreground">{contextMenu.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-full border border-border/50 p-2 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Global navigation</p>
                  <div className="mt-3 space-y-2">
                    {visibleNavItems.map((item) => {
                      const Icon = item.icon;
                      const current = isCurrentPage(item.href);

                      if (item.isDropdown && item.dropdownItems) {
                        return (
                          <div
                            key={item.name}
                            className="rounded-2xl border border-border/50 bg-card/60 px-3 py-3 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="h-5 w-5" />
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                <p className="text-xs text-muted-foreground">Select a lab to jump in.</p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {item.dropdownItems.map((subItem) => {
                                const SubIcon = subItem.icon;
                                return (
                                  <Link
                                    key={subItem.name}
                                    href={subItem.href}
                                    className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                                      <SubIcon className="h-4 w-4" />
                                    </span>
                                    <span className="flex-1">{subItem.name}</span>
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
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                            current
                              ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                              : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                              current ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug">{item.name}</p>
                            {item.description && (
                              <p className="text-xs leading-tight text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                          {current && (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
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
                            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                              active
                                ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                active ? "bg-primary text-primary-foreground" : "bg-muted/60"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">{item.name}</p>
                              {item.description && (
                                <p className="text-xs leading-tight text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-dashed border-border/60 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                Menus adapt to the page you are working on. Use this drawer for rapid jumps across IxStats systems.
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <div
          className={`fixed z-[10020] will-change-transform ${
            isSticky ? "opacity-100" : "opacity-0 pointer-events-none"
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
