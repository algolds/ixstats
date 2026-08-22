import React, { useCallback, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "~/components/ui/button";
import { createAbsoluteUrl } from "~/lib/utils";
import { useTheme } from "~/context/theme-context";
import { SignOutButton, useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { AnimatedThemeToggler } from "~/components/ui/magicui/animated-theme-toggler";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { cn } from "~/lib/utils";
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
  Search,
  Volume2,
  VolumeX,
  SunMoon,
  Square,
} from "lucide-react";
import type { SettingsViewProps } from "../types";
import { useActiveDIPlugin } from "../plugin-context";
import { useIsAdmin } from "~/hooks/usePermissions";
import { PreText } from "~/components/ui/pretext";
import { useSoundSettings } from "~/hooks/useSoundSettings";
import { soundEffects } from "~/lib/sound/cuelume";
import { Switch } from "~/components/ui/switch";
import { useDynamicIslandSize, SIZE_PRESETS } from "~/components/ui/dynamic-island";

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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("wikios-settings-changed"));
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [key]);
  return [value, toggle];
}

function useLocalPref(key: string, defaultValue: boolean): [boolean, (checked: boolean) => void] {
  const [val, setVal] = useState(defaultValue);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setVal(stored === "true");
    } catch {
      /* SSR */
    }
  }, [key]);

  const update = useCallback(
    (checked: boolean) => {
      setVal(checked);
      try {
        localStorage.setItem(key, String(checked));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("wikios-settings-changed"));
        }
      } catch {
        /* ignore */
      }
    },
    [key]
  );

  return [val, update];
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <Switch checked={enabled} onCheckedChange={onToggle} />;
}

// ─── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
      {typeof children === "string" ? <PreText whiteSpace="nowrap">{children}</PreText> : children}
    </div>
  );
}

// ─── Animated Volume Icon (Apple SF Symbols Wave Radiation) ──────────────────

function AnimatedVolumeIcon({
  enabled,
  isHovered = false,
  className = "h-3.5 w-3.5",
}: {
  enabled: boolean;
  isHovered?: boolean;
  className?: string;
}) {
  if (!enabled) {
    return <VolumeX className={cn("text-muted-foreground", className)} />;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-emerald-600 dark:text-emerald-400 overflow-visible", className)}
    >
      {/* Speaker Cone (Static stable anchor) */}
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />

      {/* Inner Sound Wave Arc — radiates smoothly on hover */}
      <motion.path
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        className="origin-[11px_12px]"
        initial={{ opacity: 1, scale: 1 }}
        animate={
          isHovered
            ? {
                opacity: [0.35, 1, 0.35],
                scale: [0.95, 1.08, 0.95],
              }
            : { opacity: 1, scale: 1 }
        }
        transition={
          isHovered
            ? {
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : { duration: 0.2 }
        }
      />

      {/* Outer Sound Wave Arc — radiates sequentially after inner wave */}
      <motion.path
        d="M19.07 4.93a10 10 0 0 1 0 14.14"
        className="origin-[11px_12px]"
        initial={{ opacity: 1, scale: 1 }}
        animate={
          isHovered
            ? {
                opacity: [0.2, 1, 0.2],
                scale: [0.9, 1.15, 0.9],
              }
            : { opacity: 1, scale: 1 }
        }
        transition={
          isHovered
            ? {
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.16,
              }
            : { duration: 0.2 }
        }
      />
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function SettingsViewComponent({ onClose }: SettingsViewProps) {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { theme, effectiveTheme, compactMode, toggleCompactMode } = useTheme();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, previewSound } = useSoundSettings();
  const { mediaThemeMode, setMediaThemeMode } = useWikiMediaTheme();
  const activePlugin = useActiveDIPlugin();
  const isOnWikiPage = activePlugin?.id === "wiki";
  const isAdmin = useIsAdmin();

  const [soundIconHovered, setSoundIconHovered] = useState(false);

  // Dynamic Island Popover Width Sizing via Apple HIG physics
  const { setSize } = useDynamicIslandSize();
  const [morePrefsExpanded, setMorePrefsExpanded] = useState(false);

  const handleToggleMorePrefs = useCallback(
    (expanded: boolean) => {
      soundEffects.press();
      setMorePrefsExpanded(expanded);
      setSize(expanded ? SIZE_PRESETS.ULTRA : SIZE_PRESETS.MEDIUM);
    },
    [setSize]
  );

  // Clean up size on unmount
  useEffect(() => {
    return () => {
      setSize(SIZE_PRESETS.MEDIUM);
    };
  }, [setSize]);

  // Reader inline preferences
  const [showCiteTooltips, setShowCiteTooltips] = useLocalPref("wikios:showCitationTooltips", true);
  const [dynamicSearchWiki, setDynamicSearchWiki] = useLocalPref("wikios:dynamicSearchWiki", true);
  const [showWikiToc, setShowWikiToc] = useLocalPref("wikios:showWikiToc", true);
  const [openInNewTab, setOpenInNewTab] = useLocalPref("wikios:openInNewTab", false);

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
    soundEffects.loading();
    try {
      const promises: Promise<unknown>[] = [refetchCountries()];
      if (isSignedIn && user?.id) {
        promises.push(refetchNotifications());
      }
      await Promise.allSettled(promises);
      soundEffects.ready();
    } catch (error) {
      console.error("Refresh failed:", error);
      soundEffects.error();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchCountries, refetchNotifications, isSignedIn, user?.id]);

  if (!isLoaded) {
    return (
      <div className="p-4">
        <SettingsHeader onClose={onClose} isOnWikiPage={isOnWikiPage} />
        <div className="py-8 text-center">
          <PreText className="text-muted-foreground text-sm" whiteSpace="nowrap">
            Loading…
          </PreText>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 transition-all duration-300">
      <SettingsHeader
        onClose={onClose}
        isOnWikiPage={isOnWikiPage}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <div
        className={cn(
          "grid gap-4 transition-all duration-300",
          morePrefsExpanded ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        )}
      >
        {/* ── Primary Left Column (Always persistent in the same place) ── */}
        <div className="space-y-1 min-w-0">
          {/* Appearance */}
          <SectionLabel>Appearance</SectionLabel>

          {/* Theme */}
          <div className="hover:bg-accent/10 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
            <div className="bg-primary/15 shrink-0 rounded-md p-1.5">
              {effectiveTheme === "dark" ? (
                <Moon className="text-primary h-3.5 w-3.5" />
              ) : (
                <Sun className="text-primary h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <PreText className="text-foreground block text-sm font-medium" whiteSpace="nowrap">
                Theme
              </PreText>
              <PreText className="text-muted-foreground block text-xs" whiteSpace="nowrap">
                {theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
              </PreText>
            </div>
            <AnimatedThemeToggler className="h-8 w-8" />
          </div>

          {/* Sound */}
          <SettingsRow
            icon={
              <AnimatedVolumeIcon
                enabled={soundEnabled}
                isHovered={soundIconHovered}
              />
            }
            iconBg={soundEnabled ? "bg-emerald-500/15" : "bg-muted/15"}
            label="Sound"
            description={soundEnabled ? "Enabled" : "Muted"}
            onIconClick={soundEnabled ? () => previewSound("chime") : undefined}
            onIconHover={soundEnabled ? setSoundIconHovered : undefined}
            iconTitle={soundEnabled ? "Tap to test sound chime" : undefined}
          >
            <ToggleSwitch
              enabled={soundEnabled}
              onToggle={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) soundEffects.toggle();
              }}
            />
          </SettingsRow>

          {/* Image Appearance (Wiki — Dark Mode only) */}
          {isOnWikiPage && effectiveTheme === "dark" && (
            <SettingsRow
              icon={
                mediaThemeMode === "plinth" ? (
                  <Square className="text-emerald-500 h-3.5 w-3.5" />
                ) : (
                  <SunMoon className="text-sky-500 h-3.5 w-3.5" />
                )
              }
              iconBg={mediaThemeMode === "plinth" ? "bg-emerald-500/15" : "bg-sky-500/15"}
              label="Image Appearance"
              description={mediaThemeMode === "plinth" ? "Light Backplate" : "Adaptive Dark"}
            >
              <Switch
                checked={mediaThemeMode === "plinth"}
                onCheckedChange={(checked) => {
                  soundEffects.toggle();
                  setMediaThemeMode(checked ? "plinth" : "auto");
                }}
              />
            </SettingsRow>
          )}

          {/* Compact Mode (Non-Wiki) */}
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

          {/* More Preferences Trigger Row (Wiki) — smoothly toggles the side panel */}
          {isOnWikiPage && (
            <button
              type="button"
              onClick={() => handleToggleMorePrefs(!morePrefsExpanded)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer group",
                morePrefsExpanded
                  ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                  : "hover:bg-accent/10"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={cn(
                    "shrink-0 rounded-md p-1.5",
                    morePrefsExpanded ? "bg-blue-500/20" : "bg-blue-500/15"
                  )}
                >
                  <BookOpen className="text-blue-500 h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <PreText
                    className={cn(
                      "block text-sm font-medium",
                      morePrefsExpanded ? "text-blue-400" : "text-foreground"
                    )}
                    whiteSpace="nowrap"
                  >
                    {morePrefsExpanded ? "Reader Preferences" : "More Preferences"}
                  </PreText>
                  <PreText className="text-muted-foreground block text-xs" whiteSpace="nowrap">
                    {morePrefsExpanded ? "" : "Citations, TOC, search, & links"}
                  </PreText>
                </div>
              </div>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  morePrefsExpanded
                    ? "rotate-90 text-blue-400"
                    : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                )}
              />
            </button>
          )}

          {/* Account */}
          {isSignedIn ? (
            <>
              <SectionLabel>Account</SectionLabel>
              <button
                onClick={() => (window.location.href = createAbsoluteUrl("/settings"))}
                className="hover:bg-accent/10 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer"
              >
                <div className="shrink-0 rounded-md bg-blue-500/15 p-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <PreText className="text-foreground block text-sm font-medium" whiteSpace="nowrap">
                    Account Settings
                  </PreText>
                  <PreText className="text-muted-foreground block text-xs" whiteSpace="nowrap">
                    Profile, preferences, &amp; security
                  </PreText>
                </div>
                <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
              </button>

              {/* Footer Actions: Admin (left) + Sign Out (right) */}
              <div className="border-border mt-1 border-t pt-2 flex items-center justify-between">
                {isAdmin ? (
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-7 text-xs px-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.location.href = createAbsoluteUrl("/admin");
                      }}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="h-3 w-3 text-red-500" />
                      <span>Admin</span>
                    </button>
                  </Button>
                ) : (
                  <div />
                )}

                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 text-xs px-2.5"
                >
                  <SignOutButton>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <LogOut className="h-3 w-3" />
                      <PreText className="text-xs" whiteSpace="nowrap">
                        Sign Out
                      </PreText>
                    </div>
                  </SignOutButton>
                </Button>
              </div>
            </>
          ) : (
            <div className="border-border mt-3 border-t pt-4 text-center">
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
          )}
        </div>

        {/* ── Additive 2nd Column (Smoothly reveals alongside on More Preferences) ── */}
        {morePrefsExpanded && (
          <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-white/10 sm:pl-4 pt-2 sm:pt-0 animate-in fade-in slide-in-from-right-4 duration-200 min-w-0">
            <SectionLabel>Reader Preferences</SectionLabel>

            {/* Citations */}
            <SettingsRow
              icon={<MessageSquare className="h-3.5 w-3.5 text-purple-400" />}
              iconBg="bg-purple-500/15"
              label="Citation Tooltips"
              description="Hover source preview cards"
            >
              <ToggleSwitch
                enabled={showCiteTooltips}
                onToggle={() => {
                  soundEffects.toggle();
                  setShowCiteTooltips(!showCiteTooltips);
                }}
              />
            </SettingsRow>

            {/* Article TOC */}
            <SettingsRow
              icon={<List className="h-3.5 w-3.5 text-cyan-400" />}
              iconBg="bg-cyan-500/15"
              label="Article TOC"
              description="Floating outline navigator"
            >
              <ToggleSwitch
                enabled={showWikiToc}
                onToggle={() => {
                  soundEffects.toggle();
                  setShowWikiToc(!showWikiToc);
                }}
              />
            </SettingsRow>

            {/* Quick Search */}
            <SettingsRow
              icon={<Search className="h-3.5 w-3.5 text-blue-400" />}
              iconBg="bg-blue-500/15"
              label="Quick Search"
              description="Index wiki articles in search"
            >
              <ToggleSwitch
                enabled={dynamicSearchWiki}
                onToggle={() => {
                  soundEffects.toggle();
                  setDynamicSearchWiki(!dynamicSearchWiki);
                }}
              />
            </SettingsRow>

            {/* Open in New Tab */}
            <SettingsRow
              icon={<ExternalLink className="h-3.5 w-3.5 text-emerald-400" />}
              iconBg="bg-emerald-500/15"
              label="Open in New Tab"
              description="External link target"
            >
              <ToggleSwitch
                enabled={openInNewTab}
                onToggle={() => {
                  soundEffects.toggle();
                  setOpenInNewTab(!openInNewTab);
                }}
              />
            </SettingsRow>

            {/* Deep Wiki Settings Link */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(withBasePath("/settings#wiki-settings"));
                }}
                className="hover:bg-accent/10 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer group border border-white/5 bg-white/[0.02]"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="bg-indigo-500/15 shrink-0 rounded-md p-1.5">
                    <BookOpen className="text-indigo-400 h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      Wiki System Settings
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Autonomous lore scanner &amp; sources
                    </span>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )}
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
        <PreText whiteSpace="nowrap">{isOnWikiPage ? "Wiki Settings" : "Settings"}</PreText>
      </div>
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
        <button
          onClick={() => {
            soundEffects.droplet();
            onClose();
          }}
          data-cuelume-press="droplet"
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
  onIconClick,
  onIconHover,
  iconTitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description?: string;
  onIconClick?: () => void;
  onIconHover?: (hovered: boolean) => void;
  iconTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hover:bg-accent/10 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
      {onIconClick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIconClick();
          }}
          onMouseEnter={() => onIconHover?.(true)}
          onMouseLeave={() => onIconHover?.(false)}
          title={iconTitle}
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-colors cursor-pointer active:scale-95",
            iconBg
          )}
        >
          {icon}
        </button>
      ) : (
        <div className={`shrink-0 rounded-md p-1.5 ${iconBg}`}>{icon}</div>
      )}
      <div className="min-w-0 flex-1">
        <PreText className="text-foreground block text-sm font-medium" whiteSpace="nowrap">
          {label}
        </PreText>
        {description && (
          <PreText className="text-muted-foreground block text-xs" whiteSpace="nowrap">
            {description}
          </PreText>
        )}
      </div>
      {children}
    </div>
  );
}

export const SettingsView = React.memo(SettingsViewComponent);
