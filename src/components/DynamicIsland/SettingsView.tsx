import React, { useCallback } from "react";
import { Button } from "~/components/ui/button";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { useTheme } from "~/context/theme-context";
import { SignOutButton, useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import {
  Settings,
  X,
  Sun,
  Moon,
  Monitor,
  User,
  Layout,
  Languages,
  RefreshCw,
  LogOut,
  ChevronDown,
} from "lucide-react";
import type { SettingsViewProps } from "./types";

export function SettingsView({ onClose }: SettingsViewProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { theme, effectiveTheme, setTheme, compactMode, toggleCompactMode } = useTheme();

  // API queries for refresh functionality
  const { refetch: refetchCountries } = api.countries.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  const { refetch: refetchNotifications } = api.notifications.getUserNotifications.useQuery(
    {
      limit: 5,
      unreadOnly: false,
    },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  // Handle refresh - debounced to prevent spam
  const handleRefresh = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [refetchCountries()];
      if (isSignedIn && user?.id) {
        promises.push(refetchNotifications());
      }
      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Refresh failed:", error);
    }
  }, [refetchCountries, refetchNotifications, isSignedIn, user?.id]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-foreground flex items-center gap-2 text-lg font-bold">
          <Settings className="h-5 w-5 text-blue-400" />
          <span>User Settings</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoaded && isSignedIn && user ? (
        // User is signed in - show full settings
        <div className="space-y-3">
          {/* Theme Switcher */}
          <div className="bg-card hover:bg-accent/10 border-border flex items-center gap-3 rounded-lg p-3 transition-all">
            <div className="bg-primary/20 flex-shrink-0 rounded p-1.5">
              {effectiveTheme === "dark" ? (
                <Moon className="text-primary h-4 w-4" />
              ) : (
                <Sun className="text-primary h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Theme</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className="h-7 w-7 p-1.5"
              >
                <Sun className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className="h-7 w-7 p-1.5"
              >
                <Moon className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
                className="h-7 w-7 p-1.5"
              >
                <Monitor className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Profile Settings */}
          <Button
            size="sm"
            onClick={() => (window.location.href = createAbsoluteUrl("/profile"))}
            className="bg-card hover:bg-accent/10 border-border flex w-full items-center justify-start gap-3 rounded-lg p-3 transition-all"
          >
            <div className="flex-shrink-0 rounded bg-blue-500/20 p-1.5">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Profile & Settings
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Manage your account, billing, and preferences
              </div>
            </div>
            <ChevronDown className="text-muted-foreground h-4 w-4 rotate-[-90deg]" />
          </Button>

          {/* Layout Preferences */}
          <div className="bg-card hover:bg-accent/10 border-border flex items-center gap-3 rounded-lg p-3 transition-all">
            <div className="flex-shrink-0 rounded bg-purple-500/20 p-1.5">
              <Layout className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Compact Mode</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {compactMode ? "Enabled - Denser UI layout" : "Disabled - Standard spacing"}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleCompactMode}
              className="px-2 py-1 text-xs"
            >
              {compactMode ? "Disable" : "Enable"}
            </Button>
          </div>

          {/* Language Settings */}
          <div className="bg-card hover:bg-accent/10 border-border flex items-center gap-3 rounded-lg p-3 transition-all">
            <div className="flex-shrink-0 rounded bg-blue-500/20 p-1.5">
              <Languages className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Language</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">English</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="cursor-not-allowed px-3 py-1 opacity-50"
              disabled
            >
              Coming Soon
            </Button>
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="flex w-full items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Data</span>
            </Button>
          </div>

          {/* Sign Out */}
          <div className="border-border border-t pt-3">
            <Button
              asChild
              size="sm"
              className="flex w-full items-center gap-2 border-red-200 bg-red-50 p-3 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
            >
              <SignOutButton>
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </div>
              </SignOutButton>
            </Button>
          </div>
        </div>
      ) : isLoaded && !isSignedIn ? (
        // User is not signed in - show sign in prompt
        <div className="py-6 text-center">
          <div className="bg-muted/50 rounded-xl p-6">
            <User className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <div className="mb-2 text-lg font-medium">Welcome to IxStats</div>
            <div className="text-muted-foreground mb-6 text-sm">
              Sign in to access your personalized dashboard and settings
            </div>
            <Button
              size="lg"
              onClick={() => (window.location.href = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))}
              className="w-full"
            >
              Sign In
            </Button>
          </div>
        </div>
      ) : (
        // Loading state
        <div className="py-6 text-center">
          <div className="text-muted-foreground">Loading authentication...</div>
        </div>
      )}
    </div>
  );
}
