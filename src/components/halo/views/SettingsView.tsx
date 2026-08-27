import React, { useCallback, useState, useEffect } from "react";
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
// oxlint-disable-next-line eslint/no-unused-vars
import {
  Settings,
  Xmark as X,
  HalfMoon as Moon,
  SunLight as Sun,
  User,
  ViewGrid as Layout,
  Refresh as RefreshCw,
  LogOut,
  NavArrowRight as ChevronRight,
  OpenBook as BookOpen,
  ChatBubble as MessageSquare,
  List,
  OpenNewWindow as ExternalLink,
  Search,
  SoundOff as VolumeX,
  HalfMoon as SunMoon,
  Square,
} from "iconoir-react";
import type { SettingsViewProps } from "../types";
import { useActiveDIPlugin } from "../plugin-context";
import { useIsAdmin } from "~/hooks/usePermissions";
import { PreText } from "~/components/ui/pretext";
import { useSoundSettings } from "~/hooks/useSoundSettings";
import { soundEffects } from "~/lib/sound/cuelume";
import { Switch } from "~/components/ui/switch";
import { useDynamicIslandSize, SIZE_PRESETS } from "../HaloPrimitives";
import {
  useLocalPref,
  ToggleSwitch,
  SectionLabel,
  AnimatedVolumeIcon,
} from "./settings/SettingsControls";
import { InlineRealmSwitcher } from "./settings/InlineRealmSwitcher";

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
        <div className="min-w-0 space-y-1">
          {/* Appearance */}
          <SectionLabel>Appearance</SectionLabel>

          {/* Theme */}
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 select-none hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
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

          {/* Compact Mode */}
          <SettingsRow
            icon={<Layout className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
            iconBg="bg-purple-500/15"
            label="Compact Mode"
            description="Denser UI layout"
          >
            <ToggleSwitch
              enabled={compactMode}
              onToggle={() => {
                soundEffects.toggle();
                toggleCompactMode();
              }}
            />
          </SettingsRow>

          {/* Sound */}
          <SettingsRow
            icon={<AnimatedVolumeIcon enabled={soundEnabled} isHovered={soundIconHovered} />}
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
                  <Square className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <SunMoon className="h-3.5 w-3.5 text-sky-500" />
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

          {/* More Preferences Trigger Row (Wiki) — smoothly toggles the side panel */}
          {isOnWikiPage && (
            <button
              type="button"
              onClick={() => handleToggleMorePrefs(!morePrefsExpanded)}
              className={cn(
                "group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 select-none active:scale-[0.985]",
                morePrefsExpanded
                  ? "border border-blue-500/25 bg-blue-500/10 text-blue-400 shadow-xs"
                  : "border border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={cn(
                    "shrink-0 rounded-md p-1.5",
                    morePrefsExpanded ? "bg-blue-500/20" : "bg-blue-500/15"
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5 text-blue-500" />
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
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 select-none hover:bg-black/[0.04] active:scale-[0.985] dark:hover:bg-white/[0.06]"
              >
                <div className="shrink-0 rounded-md bg-blue-500/15 p-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <PreText
                    className="text-foreground block text-sm font-medium"
                    whiteSpace="nowrap"
                  >
                    Account Settings
                  </PreText>
                  <PreText className="text-muted-foreground block text-xs" whiteSpace="nowrap">
                    Profile, preferences, &amp; security
                  </PreText>
                </div>
                <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
              </button>

              {/* Active Realm */}
              <InlineRealmSwitcher onClose={onClose} />

              {/* Footer Actions: Admin (left) + Sign Out (right) */}
              <div className="border-border/40 mt-1 flex items-center justify-between border-t pt-2 dark:border-white/10">
                {isAdmin ? (
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground h-7 px-2.5 text-xs hover:bg-red-500/10 hover:text-red-500"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.location.href = createAbsoluteUrl("/admin");
                      }}
                      className="flex cursor-pointer items-center gap-1.5"
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
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 px-2.5 text-xs"
                >
                  <SignOutButton>
                    <div className="flex cursor-pointer items-center gap-1.5">
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
          <div className="animate-in fade-in slide-in-from-right-4 min-w-0 space-y-1 border-t border-white/10 pt-2 duration-200 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
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
                className="hover:bg-accent/10 group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="shrink-0 rounded-md bg-indigo-500/15 p-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-xs font-semibold">
                      Wiki System Settings
                    </span>
                    <span className="text-muted-foreground block truncate text-[10px]">
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
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 select-none hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
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
            "shrink-0 cursor-pointer rounded-md p-1.5 transition-colors active:scale-95",
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
