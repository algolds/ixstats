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
  AlertCircle
} from "lucide-react";
import { useTheme } from "~/context/theme-context";
import { UserButton, SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { CountryFlag } from "./CountryFlag";

export function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, isLoaded } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Get user profile to show linked country
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showUserMenu]);

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      requiresAuth: true,
    },
    {
      name: "Explore",
      href: "/explore",
      icon: Globe,
      requiresAuth: false,
    },
    {
      name: "Economy Builder",
      href: "/builder",
      icon: Building,
      requiresAuth: true,
    },
    {
      name: "DM Controls",
      href: "/dm-dashboard",
      icon: Database,
      requiresAuth: true,
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Settings,
      requiresAuth: true,
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
    <nav className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-surface)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link
                href="/"
                className="text-2xl font-bold text-gradient hover:opacity-80 transition-opacity"
              >
                IxStats™
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const current = isCurrentPage(item.href);
                const showItem = !item.requiresAuth || (user && setupStatus === 'complete');

                if (!showItem) return null;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`nav-link ${current ? 'active' : ''}`}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: Theme toggle and Auth */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-secondary p-2 rounded-md"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {/* Authentication Section */}
            <SignedIn>
              <div className="relative">
                {/* User Status Display */}
                <div className="flex items-center gap-2">
                  {/* Setup Status Indicator */}
                  {setupStatus === 'needs-setup' && (
                    <Link
                      href="/setup"
                      className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Setup Required
                    </Link>
                  )}
                  
                  {/* User's Country Display */}
                  {setupStatus === 'complete' && userProfile?.country && (
                    <Link
                      href={`/countries/${userProfile.country.id}`}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      <Crown className="h-3 w-3" />
                      {userProfile.country.name}
                    </Link>
                  )}

                  {/* User Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {/* Avatar: Use country flag if available, else initials */}
                      {setupStatus === 'complete' && userProfile?.country ? (
                        <CountryFlag countryName={userProfile.country.name} size="md" className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                        </div>
                      )}
                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user?.firstName || user?.username || 'User'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {setupStatus === 'complete' ? 'Ready' : 'Setup Required'}
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                </div>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="py-2">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          {/* Avatar: Use country flag if available, else initials */}
                          {setupStatus === 'complete' && userProfile?.country ? (
                            <CountryFlag countryName={userProfile.country.name} size="lg" className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                              {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {user?.firstName} {user?.lastName}
                            </div>
                            {/* Email hidden intentionally */}
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        {setupStatus === 'complete' && userProfile?.country && (
                          <Link
                            href={`/countries/${userProfile.country.id}`}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <Crown className="h-4 w-4" />
                            My Country: {userProfile.country.name}
                          </Link>
                        )}
                        
                        {setupStatus === 'needs-setup' && (
                          <Link
                            href="/setup"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <AlertCircle className="h-4 w-4" />
                            Complete Setup
                          </Link>
                        )}

                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Home className="h-4 w-4" />
                          Dashboard
                        </Link>

                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <User className="h-4 w-4" />
                          Profile Settings
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                      {/* Sign Out */}
                      <div className="px-4 py-2">
                        <UserButton 
                          afterSignOutUrl="/"
                          appearance={{
                            elements: {
                              userButtonBox: "w-full",
                              userButtonTrigger: "w-full flex items-center gap-3 px-0 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SignedIn>
            
            <SignedOut>
              <SignInButton mode="modal">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md font-medium transition-colors">
                  <UserCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="sm:hidden border-t border-[var(--color-border-primary)]">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const current = isCurrentPage(item.href);
            const showItem = !item.requiresAuth || (user && setupStatus === 'complete');

            if (!showItem) return null;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-link block w-full ${current ? 'active' : ''}`}
                aria-current={current ? "page" : undefined}
              >
                <Icon className="h-4 w-4 mr-2 inline" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
          
          {/* Mobile Setup Link */}
          {setupStatus === 'needs-setup' && (
            <Link
              href="/setup"
              className="nav-link block w-full text-amber-700 dark:text-amber-300"
            >
              <AlertCircle className="h-4 w-4 mr-2 inline" aria-hidden="true" />
              Complete Setup
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}