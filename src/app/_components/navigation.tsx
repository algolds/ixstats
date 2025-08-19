"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Globe, 
  Settings, 
  Crown,
  Bell,
  X,
  Rss
} from "lucide-react";
import { CommandPalette } from "~/components/CommandPalette";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem
} from "~/components/ui/navigation-menu";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { ThinkPagesIcon } from "~/components/icons/ThinkPagesIcon";


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
  const [isSticky, setIsSticky] = useState(false);
  const [hideSticky, setHideSticky] = useState(false);

  // Get user profile to show linked country
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );


  // Sticky navigation scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsSticky(scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

  return (
    <>
      <nav className="navigation-bar relative z-[10005] bg-gradient-to-r from-background/95 via-secondary/95 to-background/95 backdrop-blur-xl border-b border-border shadow-2xl">
      {/* Curved bottom edge to match dynamic island */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-background/20 rounded-b-3xl"></div>
      
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-16 gap-6">
          
          {/* Left Side Navigation - Directly to the left of dynamic island */}
          <div className="flex items-center gap-3 z-[9995]">
            <NavigationMenu>
              <NavigationMenuList className="flex items-center gap-2">
                {navigationItems.slice(0, 2).map((item) => {
                  const Icon = item.icon;
                  const current = isCurrentPage(item.href);
                  let showItem = true;
                  if (item.requiresAuth && !user) showItem = false;
                  if (item.requiresCountry && setupStatus !== 'complete') showItem = false;
                  if (item.adminOnly && (user as any)?.publicMetadata?.role !== 'admin') showItem = false;
                  if (!showItem) return null;
                  return (
                    <NavigationMenuItem key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto hover:bg-accent/10 ${current ? 'bg-accent/15 text-foreground shadow-lg' : 'text-muted-foreground'}`}
                        aria-current={current ? 'page' : undefined}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden lg:block">{item.name}</span>
                      </Link>
                    </NavigationMenuItem>
                  );
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          
          {/* CENTER: Command Palette - The Focal Point */}
          <div className="relative z-[10010]">
            {/* Enhanced background glow for focal point */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/15 to-blue-500/10 rounded-full blur-3xl opacity-60 scale-150 pointer-events-none"></div>
            <CommandPalette />
          </div>
          
          {/* Right Side Navigation - Directly to the right of dynamic island */}
          <div className="flex items-center gap-3 z-[9995]">
            <NavigationMenu>
              <NavigationMenuList className="flex items-center gap-2">
                {navigationItems.slice(2).map((item) => {
                  const Icon = item.icon;
                  const current = isCurrentPage(item.href);
                  let showItem = true;
                  if (item.requiresAuth && !user) showItem = false;
                  if (item.requiresCountry && setupStatus !== 'complete') showItem = false;
                  if (item.adminOnly && (user as any)?.publicMetadata?.role !== 'admin') showItem = false;
                  if (!showItem) return null;
                  return (
                    <NavigationMenuItem key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 will-change-auto hover:bg-accent/10 ${current ? 'bg-accent/15 text-foreground shadow-lg' : 'text-muted-foreground'}`}
                        aria-current={current ? 'page' : undefined}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden lg:block">{item.name}</span>
                      </Link>
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
            {navigationItems.filter(item => {
              let showItem = true;
              if (item.requiresAuth && !user) showItem = false;
              if (item.requiresCountry && setupStatus !== 'complete') showItem = false;
              if (item.adminOnly && (user as any)?.publicMetadata?.role !== 'admin') showItem = false;
              return showItem;
            }).slice(0, 5).map((item) => {
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

      {/* Sticky Navigation with Dynamic Island */}
      {isSticky && !hideSticky && (
        <div className="fixed top-0 left-0 right-0 z-[10010] flex justify-center pt-2">
          <div className="relative">
            <CommandPalette isSticky={true} />
            {/* Hide/Show Toggle */}
            <button
              onClick={() => setHideSticky(!hideSticky)}
              className="absolute -right-12 top-1/2 -translate-y-1/2 w-8 h-8 bg-background/90 backdrop-blur-xl border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/90 transition-colors duration-200 will-change-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Show Sticky Toggle when hidden */}
      {isSticky && hideSticky && (
        <div className="fixed top-2 right-4 z-[100]">
          <button
            onClick={() => setHideSticky(false)}
            className="w-10 h-10 bg-background/90 backdrop-blur-xl border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/90 transition-colors duration-200 will-change-auto"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
