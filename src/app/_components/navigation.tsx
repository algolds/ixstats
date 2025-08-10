// src/app/_components/navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Moon, 
  Sun, 
  BarChart3, 
  Globe, 
  Settings, 
  Database, 
  Building, 
  TestTube,
  User,
  Crown,
  Home,
  ChevronDown,
  LogOut,
  UserCheck,
  AlertCircle,
  Bell,
  Clock,
  X,
  Info,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { CommandPalette } from "~/components/CommandPalette";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent
} from "~/components/ui/navigation-menu";
import { useTheme } from "~/context/theme-context";
import { UserButton, SignInButton, SignedIn, SignedOut, useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { createUrl } from "~/lib/url-utils";

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
  const { theme, toggleTheme } = useTheme();
  const { user, isLoaded } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [hideSticky, setHideSticky] = useState(false);

  // Get user profile to show linked country
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Get flag for user's country
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(
    userProfile?.country?.name ? [userProfile.country.name] : []
  );
  const userCountryFlag = userProfile?.country?.name ? flagUrls[userProfile.country.name] : null;

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showUserMenu]);

  // Sticky navigation scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsSticky(scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationItems = [
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
      name: "ECI",
      href: "/eci",
      icon: Building,
      requiresAuth: true,
      requiresCountry: true,
      description: "Executive Command Interface",
    },
    {
      name: "SDI",
      href: "/sdi",
      icon: Database,
      requiresAuth: true,
      requiresCountry: true,
      description: "Sovereign Digital Interface",
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
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
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
        <div className="flex items-stretch h-16 relative">
          {/* Left: Logo */}
          <div className="flex items-center flex-shrink-0 z-[10005]">
            <Link
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent hover:from-blue-300 hover:to-purple-400 transition-all duration-300"
            >
              IxStats™
            </Link>
          </div>
          
          {/* Left Navigation Items */}
          <div className="flex items-center gap-2 z-[10005]">
            <NavigationMenu>
              <NavigationMenuList>
                {navigationItems.slice(0, Math.ceil(navigationItems.length / 2)).map((item) => {
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
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent/10 hover:backdrop-blur-sm ${current ? 'bg-accent/15 text-foreground shadow-lg' : 'text-muted-foreground'}`}
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
          
          {/* Center: Dynamic Island */}
          <div className="flex flex-grow justify-center items-center min-w-0 mx-6 relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 rounded-full blur-2xl opacity-40"></div>
            <div className="z-[10005] w-full flex justify-center">
              <CommandPalette />
            </div>
          </div>
          
          {/* Right: Navigation Items + User Profile */}
          <div className="flex items-center gap-4 z-[10005]">
            {/* Right Navigation Items */}
            <NavigationMenu>
              <NavigationMenuList>
                {navigationItems.slice(Math.ceil(navigationItems.length / 2)).map((item) => {
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
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent/10 hover:backdrop-blur-sm ${current ? 'bg-accent/15 text-foreground shadow-lg' : 'text-muted-foreground'}`}
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
            
            {/* User Profile */}
            <div className="flex items-center ml-2">
              <UserProfileMenu 
                user={user} 
                userProfile={userProfile} 
                setupStatus={setupStatus}
                userCountryFlag={userCountryFlag ?? null}
                flagsLoading={flagsLoading}
              />
            </div>
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
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${
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
              className="absolute -right-12 top-1/2 -translate-y-1/2 w-8 h-8 bg-background/90 backdrop-blur-xl border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/90 transition-all"
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
            className="w-10 h-10 bg-background/90 backdrop-blur-xl border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/90 transition-all"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

function UserProfileMenu({ user, userProfile, setupStatus, userCountryFlag, flagsLoading }: {
  user: any;
  userProfile: any;
  setupStatus: string;
  userCountryFlag: string | null;
  flagsLoading: boolean;
}) {
  const [showUserPopover, setShowUserPopover] = useState(false);

  if (!user) {
    return (
      <SignInButton className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-foreground transition-all duration-200">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="hidden md:block text-sm">Sign In</span>
        </div>
      </SignInButton>
    );
  }

  return (
    <Popover open={showUserPopover} onOpenChange={setShowUserPopover}>
      <PopoverTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200">
          {setupStatus === 'complete' && userProfile?.country && userCountryFlag ? (
            <img
              src={userCountryFlag}
              alt={`Flag of ${userProfile.country.name}`}
              className="w-8 h-8 rounded-full border-border object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium border-border">
              {user?.firstName?.[0] || (user as any)?.username?.[0] || 'U'}
            </div>
          )}
          <div className="hidden md:block text-left">
            <div className="text-foreground text-sm font-medium">
              {user?.firstName || (user as any)?.username || 'User'}
            </div>
            {setupStatus === 'complete' && userProfile?.country && (
              <div className="text-muted-foreground text-xs">
                {userProfile.country.name}
              </div>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="py-2">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-border-white/10">
            <div className="flex items-center gap-3">
              {setupStatus === 'complete' && userProfile?.country && userCountryFlag ? (
                <img
                  src={userCountryFlag}
                  alt={`Flag of ${userProfile.country.name}`}
                  className="w-12 h-12 rounded-full border-border object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-lg border-border">
                  {user?.firstName?.[0] || (user as any)?.username?.[0] || 'U'}
                </div>
              )}
              <div>
                <div className="font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {setupStatus === 'complete' && userProfile?.country ? userProfile.country.name : 'Not linked to country'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="py-1">
            {setupStatus === 'complete' && userProfile?.country && (
              <Link
                href={`/countries/${userProfile.country.id}`}
                className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              >
                <Crown className="h-4 w-4" />
                My Country Dashboard
              </Link>
            )}
            {setupStatus === 'needs-setup' && (
              <Link
                href="/setup"
                className="flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-300 hover:text-amber-700 dark:hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
              >
                <AlertCircle className="h-4 w-4" />
                Complete Setup
              </Link>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <User className="h-4 w-4" />
              Profile Settings
            </Link>
            <a
              href="https://accounts.ixwiki.com/user"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Account Management
            </a>
          </div>
          
          {/* Divider */}
          <div className="border-t border-border my-1" />
          
          {/* Sign Out */}
          <div className="px-4 py-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/sign-out';
                }
              }}
              className="w-full flex items-center gap-3 px-0 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}