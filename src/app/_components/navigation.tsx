"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Globe, 
  Settings, 
  Crown,
  Rss
} from "lucide-react";
import { CommandPalette } from "~/components/DynamicIsland";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem
} from "~/components/ui/navigation-menu";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { createUserProfileQueryParams } from '~/lib/user-utils';
import { ThinkPagesIcon } from "~/components/icons/ThinkPagesIcon";
import { AnimatedShinyText } from "~/components/magicui/animated-shiny-text";
import { ShineBorder } from "~/components/magicui/shine-border";
import { FaWikipediaW } from "react-icons/fa";
import { GiCardRandom } from "react-icons/gi";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  requiresAuth?: boolean;
  requiresCountry?: boolean;
  adminOnly?: boolean;
  description?: string;
}

export function Navigation() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [scrollY, setScrollY] = useState(0);
  const [isSticky, setIsSticky] = useState(false);

  // Get user profile to show linked country
  const userProfileQueryParams = createUserProfileQueryParams(user);
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    userProfileQueryParams.input,
    { enabled: userProfileQueryParams.enabled }
  );


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
      name: "Countries",
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
      name: "ThinkPages",
      href: "/thinkpages",
      icon: Rss,
      requiresAuth: false,
      description: "Knowledge management and collaborative thinking",
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
    }
  ];

  const isCurrentPage = (href: string) => {
    return pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };

  const setupStatus = getSetupStatus();

  // Filter visible navigation items based on user state
  const visibleNavItems = navigationItems.filter(item => {
    if (item.requiresAuth && !user) return false;
    if (item.requiresCountry && setupStatus !== 'complete') return false;
    if (item.adminOnly && (user as any)?.publicMetadata?.role !== 'admin') return false;
    return true;
  });

  // Intelligent balancing: ensure visual symmetry around dynamic island
  const totalItems = visibleNavItems.length;
  
  // For better visual balance, try to keep sides equal or left-heavy by 1
  const leftCount = Math.ceil(totalItems / 2);
  const rightCount = totalItems - leftCount;
  
  // Create balanced arrays ensuring both sides have similar visual weight
  const leftNavItems = visibleNavItems.slice(0, leftCount);
  const rightNavItems = visibleNavItems.slice(leftCount);

  // Ensure minimum spacing for dynamic island - add padding divs if needed
  const minItemsPerSide = 1;
  const leftPadding = Math.max(0, minItemsPerSide - leftNavItems.length);
  const rightPadding = Math.max(0, minItemsPerSide - rightNavItems.length);

  return (
    <>
      <nav className="navigation-bar relative z-[10005] bg-gradient-to-r from-background/95 via-secondary/95 to-background/95 backdrop-blur-xl border-b border-border shadow-2xl">
      {/* Curved bottom edge to match dynamic island */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-background/20 rounded-b-3xl"></div>
      
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 w-full relative">
          
          {/* Left Side Navigation */}
          <div className="flex items-center justify-start gap-3 z-[9995] flex-1">
            <NavigationMenu>
              <NavigationMenuList className="flex items-center gap-2">
                {leftNavItems.map((item) => {
                  const Icon = item.icon;
                  const current = isCurrentPage(item.href);
                  return (
                    <NavigationMenuItem key={item.name}>
                      {current ? (
                        <Link
                          href={item.href}
                          className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto text-foreground bg-accent/20 overflow-hidden"
                          aria-current="page"
                        >
                          {/* Icon with color-coded gradient glow and slower rotation */}
                          <div className="relative">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                              <Icon className={`h-4 w-4 ${
                                item.name === "MyCountry®" ? "text-amber-400" :
                                item.name === "ThinkPages" ? "text-blue-400" :
                                item.name === "Dashboard" ? "text-emerald-400" :
                                item.name === "Countries" ? "text-purple-400" :
                                item.name === "Admin" ? "text-red-400" :
                                item.name === "Dossier" ? "text-orange-400" :
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
                          
                          {/* Animated shiny text */}
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
                          {/* Shine border on hover only - color coded by section */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <ShineBorder
                              shineColor={
                                item.name === "MyCountry®" ? ["#f59e0b", "#eab308", "#fbbf24"] :
                                item.name === "ThinkPages" ? ["#3b82f6", "#1d4ed8", "#60a5fa"] :
                                item.name === "Dashboard" ? ["#10b981", "#059669", "#34d399"] :
                                item.name === "Countries" ? ["#8b5cf6", "#7c3aed", "#a78bfa"] :
                                item.name === "Admin" ? ["#ef4444", "#dc2626", "#f87171"] :
                                item.name === "Dossier" ? ["#f97316", "#ea580c", "#fb923c"] :
                                item.name === "Cards" ? ["#06b6d4", "#0891b2", "#22d3ee"] :
                                ["#3b82f6", "#8b5cf6", "#06b6d4"]
                              }
                              duration={30}
                              borderWidth={1}
                              className="rounded-lg"
                            />
                          </div>
                          
                          {/* Icon with color-coded gradient glow and slower rotation */}
                          <div className="relative">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                              <Icon className={`h-4 w-4 ${
                                item.name === "MyCountry®" ? "text-amber-400" :
                                item.name === "ThinkPages" ? "text-blue-400" :
                                item.name === "Dashboard" ? "text-emerald-400" :
                                item.name === "Countries" ? "text-purple-400" :
                                item.name === "Admin" ? "text-red-400" :
                                item.name === "Dossier" ? "text-orange-400" :
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
                          
                          {/* Animated shiny text */}
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
          
          {/* CENTER: Command Palette - Absolutely positioned for perfect centering */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10010]">
            {/* Enhanced background glow for focal point */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/15 to-blue-500/10 rounded-full blur-3xl opacity-60 scale-150 pointer-events-none"></div>
            {!isSticky && <CommandPalette isSticky={false} scrollY={scrollY} />}
          </div>
          
          {/* Right Side Navigation */}
          <div className="flex items-center justify-end gap-3 z-[9995] flex-1">
            <NavigationMenu>
              <NavigationMenuList className="flex items-center gap-2">
                {rightNavItems.map((item) => {
                  const Icon = item.icon;
                  const current = isCurrentPage(item.href);
                  return (
                    <NavigationMenuItem key={item.name}>
                      {current ? (
                        <Link
                          href={item.href}
                          className="relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto text-foreground bg-accent/20 overflow-hidden"
                          aria-current="page"
                        >
                          {/* Icon with color-coded gradient glow and slower rotation */}
                          <div className="relative">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                              <Icon className={`h-4 w-4 ${
                                item.name === "MyCountry®" ? "text-amber-400" :
                                item.name === "ThinkPages" ? "text-blue-400" :
                                item.name === "Dashboard" ? "text-emerald-400" :
                                item.name === "Countries" ? "text-purple-400" :
                                item.name === "Admin" ? "text-red-400" :
                                item.name === "Dossier" ? "text-orange-400" :
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
                          
                          {/* Animated shiny text */}
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
                          {/* Shine border on hover only - color coded by section */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <ShineBorder
                              shineColor={
                                item.name === "MyCountry®" ? ["#f59e0b", "#eab308", "#fbbf24"] :
                                item.name === "ThinkPages" ? ["#3b82f6", "#1d4ed8", "#60a5fa"] :
                                item.name === "Dashboard" ? ["#10b981", "#059669", "#34d399"] :
                                item.name === "Countries" ? ["#8b5cf6", "#7c3aed", "#a78bfa"] :
                                item.name === "Admin" ? ["#ef4444", "#dc2626", "#f87171"] :
                                item.name === "Dossier" ? ["#f97316", "#ea580c", "#fb923c"] :
                                item.name === "Cards" ? ["#06b6d4", "#0891b2", "#22d3ee"] :
                                ["#3b82f6", "#8b5cf6", "#06b6d4"]
                              }
                              duration={30}
                              borderWidth={1}
                              className="rounded-lg"
                            />
                          </div>
                          
                          {/* Icon with color-coded gradient glow and slower rotation */}
                          <div className="relative">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md">
                              <Icon className={`h-4 w-4 ${
                                item.name === "MyCountry®" ? "text-amber-400" :
                                item.name === "ThinkPages" ? "text-blue-400" :
                                item.name === "Dashboard" ? "text-emerald-400" :
                                item.name === "Countries" ? "text-purple-400" :
                                item.name === "Admin" ? "text-red-400" :
                                item.name === "Dossier" ? "text-orange-400" :
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
                          
                          {/* Animated shiny text */}
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
      </div>
      
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <div className="border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="flex items-center justify-around px-4 py-2">
            {visibleNavItems.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const current = isCurrentPage(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto ${
                    current 
                      ? 'text-foreground bg-accent/15' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      </nav>

      {/* Persistent Dynamic Island - Ultra-smooth transitions with physics-based motion */}
      <div 
        className={`fixed z-[10020] will-change-transform ${
          isSticky ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ 
          top: isSticky ? '8px' : '64px',
          left: '50%',
          transform: 'translateX(-50%)', // Perfect horizontal centering
          transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        <CommandPalette isSticky={isSticky} scrollY={scrollY} />
      </div>
    </>
  );
}
