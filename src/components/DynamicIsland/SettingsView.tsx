import React, { useCallback, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "~/components/ui/button";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { stripBasePath } from "~/lib/base-path";
import { useTheme } from "~/context/theme-context";
import { SignOutButton, useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { AnimatedThemeToggler } from "~/components/magicui/animated-theme-toggler";
import {
  Settings,
  X,
  Moon,
  Sun,
  User,
  Layout,
  RefreshCw,
  LogOut,
  ChevronRight,
  BookOpen,
  MessageSquare,
  List,
  ExternalLink,
} from "lucide-react";
import type { SettingsViewProps } from "./types";
import { useActiveDIPlugin } from "./plugin-context";

// ─── Local toggle hook ───────────────────────────────────────────────────────

function useLocalToggle(key: string, defaultValue: boolean): [boolean, () => void] {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setValue(stored === "true");
    } catch {
      /* SSR */
    }
  }, [key]);
  const toggle = useCallback(() => {
    setValue((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [key]);
  return [value, toggle];
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        enabled ? "bg-blue-500" : "bg-muted-foreground/25"
      }`}
    >
      <span
        className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ─── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider">
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SettingsView({ onClose }: SettingsViewProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { theme, effectiveTheme, compactMode, toggleCompactMode } = useTheme();
  const activePlugin = useActiveDIPlugin();
  const isOnWikiPage = activePlugin?.id === "wiki";

  // Wiki-specific toggles
  const [showCiteTooltips, toggleCiteTooltips] = useLocalToggle(
    "wikios:showCitationTooltips",
    true
  );
  const [autoExpandToc, toggleAutoExpandToc] = useLocalToggle("wikios:autoExpandToc", false);
  const [openInNewTab, toggleOpenInNewTab] = useLocalToggle("wikios:openInNewTab", false);

  // Refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refetch: refetchCountries } = api.countries.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  const { refetch: refetchNotifications } = api.notifications.getUserNotifications.useQuery(
    { limit: 5, unreadOnly: false },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const promises: Promise<any>[] = [refetchCountries()];
      if (isSignedIn && user?.id) {
        promises.push(refetchNotifications());
      }
      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchCountries, refetchNotifications, isSignedIn, user?.id]);

  const wikiUsername = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : (user?.firstName ?? "");

  // ─── Signed-out state ────────────────────────────────────────────────────

  if (isLoaded && !isSignedIn) {
    return (
      <div className="p-4">
        <SettingsHeader onClose={onClose} isOnWikiPage={isOnWikiPage} />
        <div className="py-6 text-center">
          <div className="bg-muted/30 rounded-xl p-6">
            <User className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
            <div className="text-foreground mb-1 text-sm font-medium">
              {isOnWikiPage ? "Welcome to WikiOS" : "Welcome to IxStats"}
            </div>
            <div className="text-muted-foreground mb-4 text-xs">
              Sign in to access your settings
            </div>
            <Button
              size="sm"
              onClick={() =>
                (window.location.href =
                  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
              }
              className="w-full"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="p-4">
        <SettingsHeader onClose={onClose} isOnWikiPage={isOnWikiPage} />
        <div className="py-8 text-center">
          <div className="text-muted-foreground text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  // ─── Signed-in state ─────────────────────────────────────────────────────

  return (
    <div className="p-4">
      <SettingsHeader
        onClose={onClose}
        isOnWikiPage={isOnWikiPage}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <div className="space-y-1">
        {/* ── Appearance ─────────────────────────────────────────────── */}
        <SectionLabel>Appearance</SectionLabel>

        {/* Theme — animated view-transition toggle */}
        <div className="hover:bg-accent/10 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
          <div className="bg-primary/15 shrink-0 rounded-md p-1.5">
            {effectiveTheme === "dark" ? (
              <Moon className="text-primary h-3.5 w-3.5" />
            ) : (
              <Sun className="text-primary h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-sm font-medium">Theme</div>
            <div className="text-muted-foreground text-xs">
              {theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
            </div>
          </div>
          <AnimatedThemeToggler className="h-8 w-8" />
        </div>

        {/* Compact Mode — only on non-wiki pages */}
        {!isOnWikiPage && (
          <SettingsRow
            icon={<Layout className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
            iconBg="bg-purple-500/15"
            label="Compact Mode"
            description="Denser UI layout"
          >
            <ToggleSwitch enabled={compactMode} onToggle={toggleCompactMode} />
          </SettingsRow>
        )}

        {/* ── Wiki Settings ──────────────────────────────────────────── */}
        {isOnWikiPage && (
          <>
            <SectionLabel>Wiki</SectionLabel>

            <SettingsRow
              icon={
                <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              }
              iconBg="bg-purple-500/15"
              label="Citation Tooltips"
              description="Hover footnotes to preview"
            >
              <ToggleSwitch enabled={showCiteTooltips} onToggle={toggleCiteTooltips} />
            </SettingsRow>

            <SettingsRow
              icon={<List className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
              iconBg="bg-cyan-500/15"
              label="Auto-Expand TOC"
              description="Table of contents starts open"
            >
              <ToggleSwitch enabled={autoExpandToc} onToggle={toggleAutoExpandToc} />
            </SettingsRow>

            <SettingsRow
              icon={
                <ExternalLink className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              }
              iconBg="bg-emerald-500/15"
              label="Open in New Tab"
              description="Wiki links open in new tabs"
            >
              <ToggleSwitch enabled={openInNewTab} onToggle={toggleOpenInNewTab} />
            </SettingsRow>
          </>
        )}

        {/* ── Account ────────────────────────────────────────────────── */}
        <SectionLabel>Account</SectionLabel>

        {/* Profile link */}
        <button
          onClick={() =>
            (window.location.href =
              isOnWikiPage && wikiUsername
                ? createAbsoluteUrl(`/w/special/user/${encodeURIComponent(wikiUsername)}`)
                : createAbsoluteUrl("/profile"))
          }
          className="hover:bg-accent/10 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
        >
          <div className="shrink-0 rounded-md bg-blue-500/15 p-1.5">
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-sm font-medium">
              {isOnWikiPage ? "Wiki Profile" : "Profile & Settings"}
            </div>
            <div className="text-muted-foreground text-xs">
              {isOnWikiPage ? "Contributions and awards" : "Account and preferences"}
            </div>
          </div>
          <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
        </button>

        {/* Sign Out */}
        <div className="border-border mt-1 border-t pt-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex w-full items-center justify-start gap-2 px-3 py-2"
          >
            <SignOutButton>
              <div className="flex items-center gap-2">
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-sm">Sign Out</span>
              </div>
            </SignOutButton>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function SettingsHeader({
  onClose,
  isOnWikiPage,
  onRefresh,
  isRefreshing,
}: {
  onClose: () => void;
  isOnWikiPage: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
        {isOnWikiPage ? (
          <BookOpen className="h-4 w-4 text-blue-400" />
        ) : (
          <Settings className="h-4 w-4 text-blue-400" />
        )}
        <span>{isOnWikiPage ? "Wiki Settings" : "Settings"}</span>
      </div>
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        )}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Reusable settings row ───────────────────────────────────────────────────

function SettingsRow({
  icon,
  iconBg,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hover:bg-accent/10 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
      <div className={`shrink-0 rounded-md p-1.5 ${iconBg}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-sm font-medium">{label}</div>
        {description && (
          <div className="text-muted-foreground text-xs">{description}</div>
        )}
      </div>
      {children}
    </div>
  );
}
