import React, { useCallback } from 'react';
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
  ChevronDown
} from "lucide-react";
import type { SettingsViewProps } from './types';

export function SettingsView({ onClose }: SettingsViewProps) {
  const { user } = useUser();
  const { theme, effectiveTheme, setTheme, compactMode, toggleCompactMode } = useTheme();
  
  // API queries for refresh functionality
  const {
    refetch: refetchCountries,
  } = api.countries.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  const {
    refetch: refetchNotifications,
  } = api.notifications.getUserNotifications.useQuery({
    limit: 5,
    unreadOnly: false,
  }, {
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Handle refresh - debounced to prevent spam
  const handleRefresh = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [refetchCountries()];
      if (user?.id) {
        promises.push(refetchNotifications());
      }
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [refetchCountries, refetchNotifications, user?.id]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="text-xl font-bold text-foreground flex items-center gap-3 w-full justify-center">
          <Settings className="h-6 w-6 text-blue-400" />
          <span>User Settings</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-2 absolute right-6 top-6"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {/* Theme Switcher */}
        <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
          <div className="p-1.5 bg-primary/20 rounded flex-shrink-0">
            {effectiveTheme === 'dark' ? (
              <Moon className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">Theme</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
              className="p-1.5 h-7 w-7"
            >
              <Sun className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
              className="p-1.5 h-7 w-7"
            >
              <Moon className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => setTheme('system')}
              className="p-1.5 h-7 w-7"
            >
              <Monitor className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Profile Settings */}
        <Button
          size="sm"
          onClick={() => window.location.href = createAbsoluteUrl("/profile")}
          className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border w-full justify-start"
        >
          <div className="p-1.5 bg-blue-500/20 rounded flex-shrink-0">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-white">Profile & Settings</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Manage your account, billing, and preferences
            </div>
          </div>
          <ChevronDown className="h-4 w-4 rotate-[-90deg] text-muted-foreground" />
        </Button>

        {/* Layout Preferences */}
        <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
          <div className="p-1.5 bg-purple-500/20 rounded flex-shrink-0">
            <Layout className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">Compact Mode</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {compactMode ? 'Enabled - Denser UI layout' : 'Disabled - Standard spacing'}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleCompactMode}
            className="px-2 py-1 text-xs"
          >
            {compactMode ? 'Disable' : 'Enable'}
          </Button>
        </div>

        {/* Language Settings */}
        <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
          <div className="p-1.5 bg-blue-500/20 rounded flex-shrink-0">
            <Languages className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">Language</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              English
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="px-3 py-1 cursor-not-allowed opacity-50"
            disabled
          >
            Coming Soon
          </Button>
        </div>

        {/* Quick Action Buttons */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-3 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Data</span>
          </Button>
        </div>
        
        {/* Logout */}
        <div className="border-t border-border pt-3 mt-3">
          <Button
            asChild
            size="sm"
            className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all border-border w-full justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:border-red-200 dark:hover:border-red-800"
          >
            <SignOutButton>
              <div className="p-1.5 bg-red-500/20 rounded flex-shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-medium">Sign Out</div>
                <div className="text-xs opacity-70">
                  Sign out of your account
                </div>
              </div>
            </SignOutButton>
          </Button>
        </div>
      </div>
    </div>
  );
}
