import React, { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { navigateWithBasePath } from "~/lib/base-path";
import { createAbsoluteUrl } from "~/lib/utils";
import { nextTheme, useTheme } from "~/context/theme-context";
import { SignOutButton, useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { cn } from "~/lib/utils";
import {
  Settings,
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
  HalfMoon as SunMoon,
  Square,
  SoundHigh,
  SoundOff,
} from "iconoir-react";
import type { SettingsViewProps } from "../types";
import { useActiveDIPlugin } from "../plugin-context";
import { useCanOpenAdmin } from "~/hooks/usePermissions";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { setHaloMaterial, useHaloMaterial, type HaloMaterial } from "../halo-material";
import { PreText } from "~/components/ui/pretext";
import { useSoundSettings } from "~/hooks/useSoundSettings";
import { soundCues } from "~/lib/sound/cuelume";
import { Switch } from "~/components/ui/switch";
import { useHaloSize, SIZE_PRESETS } from "../HaloPrimitives";
import { useLocalPref, ToggleSwitch, SectionLabel } from "./settings/SettingsControls";
import { HaloViewHeader, HaloWell } from "./shared/HaloViewParts";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
const HALO_MATERIAL_OPTIONS = [
  { value: "lens", label: "Lens" },
  { value: "chrome", label: "Chrome, Lens inside" },
] as const satisfies ReadonlyArray<{ value: HaloMaterial; label: string }>;

const NEXT_THEME_NAME = { light: "light", dark: "dark", system: "automatic" } as const;

/** Invalidation is kept out of the component body: the React Compiler skips components with `finally`. */
async function refreshAll(utils: ReturnType<typeof api.useUtils>) {
  try {
    await Promise.allSettled([utils.countries.invalidate(), utils.notifications.invalidate()]);
  } catch (error) {
    console.error("Refresh failed:", error);
    soundCues.error();
  }
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { theme, effectiveTheme, toggleTheme, compactMode, toggleCompactMode } = useTheme();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, previewSound } = useSoundSettings();
  const { mediaThemeMode, setMediaThemeMode } = useWikiMediaTheme();
  const activePlugin = useActiveDIPlugin();
  const isOnWikiPage = activePlugin?.id === "wiki";
  const isAdmin = useCanOpenAdmin();
  const material = useHaloMaterial();

  // Dynamic Island Popover Width Sizing via Apple HIG physics
  const { setSize } = useHaloSize();
  const [morePrefsExpanded, setMorePrefsExpanded] = useState(false);

  const handleToggleMorePrefs = (expanded: boolean) => {
    setMorePrefsExpanded(expanded);
    setSize(expanded ? SIZE_PRESETS.ULTRA : SIZE_PRESETS.MEDIUM);
  };

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

  const utils = api.useUtils();

  const handleRefresh = () => {
    setIsRefreshing(true);
    void refreshAll(utils).finally(() => setIsRefreshing(false));
  };

  if (!isLoaded) {
    return (
      <div className="space-y-3 p-3">
        <SettingsHeader onClose={onClose} isOnWikiPage={isOnWikiPage} />
        <HaloWell className="py-6 text-center">
          <PreText className="text-label-secondary text-body" whiteSpace="nowrap">
            Loading…
          </PreText>
        </HaloWell>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <SettingsHeader
        onClose={onClose}
        isOnWikiPage={isOnWikiPage}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <div
        className={cn(
          "grid gap-3",
          morePrefsExpanded ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        )}
      >
        {/* Primary Left Column (Always persistent in the same place) */}
        <div className="min-w-0 space-y-2">
          {/* Appearance */}
          <HaloWell className="space-y-1 p-2">
            <SectionLabel>Appearance</SectionLabel>
            <FacetList variant="plain">
              <FacetListSection aria-label="Appearance">
                <FacetRow
                  leading={
                    <span className="bg-tint/15 rounded-control-sm block p-2">
                      {effectiveTheme === "dark" ? (
                        <Moon className="text-tint size-3.5" />
                      ) : (
                        <Sun className="text-tint size-3.5" />
                      )}
                    </span>
                  }
                  title="Theme"
                  subtitle={theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
                  trailing={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={toggleTheme}
                      aria-label={`Switch to ${NEXT_THEME_NAME[nextTheme(theme)]} theme`}
                    >
                      {effectiveTheme === "dark" ? <Sun /> : <Moon />}
                    </Button>
                  }
                />

                <FacetRow
                  leading={
                    <span className="bg-indigo/15 rounded-control-sm block p-2">
                      <Layout className="text-indigo size-3.5" />
                    </span>
                  }
                  title="Compact mode"
                  subtitle="Denser UI layout"
                  trailing={
                    <ToggleSwitch
                      enabled={compactMode}
                      onToggle={() => {
                        toggleCompactMode();
                      }}
                    />
                  }
                />

                <FacetRow
                  leading={
                    soundEnabled ? (
                      <button
                        type="button"
                        onClick={() => previewSound("ready")}
                        title="Tap to test the notification sound"
                        aria-label="Tap to test the notification sound"
                        className="rounded-control-sm bg-green/15 focus-visible:outline-tint shrink-0 cursor-pointer p-2 transition-colors focus-visible:outline-2"
                      >
                        <SoundHigh className="text-green size-3.5" />
                      </button>
                    ) : (
                      <span className="bg-fill-4 rounded-control-sm block p-2">
                        <SoundOff className="text-label-secondary size-3.5" />
                      </span>
                    )
                  }
                  title="Sound"
                  subtitle={soundEnabled ? "Enabled" : "Muted"}
                  trailing={
                    <ToggleSwitch
                      enabled={soundEnabled}
                      onToggle={() => {
                        setSoundEnabled(!soundEnabled);
                      }}
                    />
                  }
                />

                {isOnWikiPage && effectiveTheme === "dark" && (
                  <FacetRow
                    leading={
                      <span
                        className={cn(
                          "rounded-control-sm block p-2",
                          mediaThemeMode === "plinth" ? "bg-green/15" : "bg-teal/15"
                        )}
                      >
                        {mediaThemeMode === "plinth" ? (
                          <Square className="text-green size-3.5" />
                        ) : (
                          <SunMoon className="text-teal size-3.5" />
                        )}
                      </span>
                    }
                    title="Image appearance"
                    subtitle={mediaThemeMode === "plinth" ? "Light backplate" : "Adaptive dark"}
                    trailing={
                      <Switch
                        checked={mediaThemeMode === "plinth"}
                        onCheckedChange={(checked) => {
                          setMediaThemeMode(checked ? "plinth" : "auto");
                        }}
                      />
                    }
                  />
                )}

                {isOnWikiPage && (
                  <FacetRow
                    onClick={() => handleToggleMorePrefs(!morePrefsExpanded)}
                    selected={morePrefsExpanded}
                    selectionStyle="tint"
                    aria-current={false}
                    leading={
                      <span
                        className={cn(
                          "rounded-control-sm block p-2",
                          morePrefsExpanded ? "bg-blue/20" : "bg-blue/15"
                        )}
                      >
                        <BookOpen className="text-blue size-3.5" />
                      </span>
                    }
                    title={morePrefsExpanded ? "Reader preferences" : "More preferences"}
                    subtitle={
                      morePrefsExpanded ? undefined : "Citations, contents, search and links"
                    }
                    accessory={
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          "duration-fast ease-out-facet size-4 transition-transform",
                          morePrefsExpanded ? "text-tint rotate-90" : "text-label-tertiary"
                        )}
                      />
                    }
                  />
                )}
              </FacetListSection>
            </FacetList>
          </HaloWell>

          {/* Temporary: admins compare the two island materials; remove once one is chosen. */}
          {isAdmin && (
            <HaloWell className="space-y-2 p-2">
              <SectionLabel>Halo material</SectionLabel>
              <SegmentedControl
                aria-label="Halo material"
                size="sm"
                fullWidth
                value={material}
                onValueChange={setHaloMaterial}
                options={HALO_MATERIAL_OPTIONS}
              />
            </HaloWell>
          )}

          {/* Account */}
          {isSignedIn ? (
            <>
              <HaloWell className="space-y-1 p-2">
                <SectionLabel>Account</SectionLabel>
                <FacetList variant="plain">
                  <FacetListSection aria-label="Account">
                    <FacetRow
                      onClick={() => {
                        onClose();
                        navigateWithBasePath("/settings", router);
                      }}
                      leading={
                        <span className="rounded-control-sm bg-blue/15 block p-2">
                          <User className="text-blue size-3.5" />
                        </span>
                      }
                      title="Account settings"
                      subtitle="Profile, preferences and security"
                      accessory="chevron"
                    />
                  </FacetListSection>
                </FacetList>
              </HaloWell>

              {/* Footer Actions: Admin (left) + Sign Out (right) */}
              <div className="flex items-center justify-between pt-1">
                {isAdmin ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-label-secondary hover:bg-red/10 hover:text-red"
                    onClick={() => {
                      onClose();
                      navigateWithBasePath("/admin", router);
                    }}
                  >
                    <Settings aria-hidden className="text-red" />
                    <span>Admin</span>
                  </Button>
                ) : (
                  <div />
                )}

                <SignOutButton>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-label-secondary hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut aria-hidden />
                    <PreText className="text-inherit" whiteSpace="nowrap">
                      Sign out
                    </PreText>
                  </Button>
                </SignOutButton>
              </div>
            </>
          ) : (
            <HaloWell className="p-2">
              <Button
                size="sm"
                onClick={() =>
                  (window.location.href =
                    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
                }
                className="w-full"
              >
                Sign in
              </Button>
            </HaloWell>
          )}
        </div>

        {/* Additive 2nd Column (Smoothly reveals alongside on More Preferences) */}
        {morePrefsExpanded && (
          <HaloWell className="min-w-0 space-y-1 self-start p-2">
            <SectionLabel>Reader preferences</SectionLabel>
            <FacetList variant="plain">
              <FacetListSection aria-label="Reader preferences">
                <FacetRow
                  leading={
                    <span className="bg-wiki/15 rounded-control-sm block p-2">
                      <MessageSquare className="text-wiki size-3.5" />
                    </span>
                  }
                  title="Citation tooltips"
                  subtitle="Hover source preview cards"
                  trailing={
                    <ToggleSwitch
                      enabled={showCiteTooltips}
                      onToggle={() => {
                        setShowCiteTooltips(!showCiteTooltips);
                      }}
                    />
                  }
                />

                <FacetRow
                  leading={
                    <span className="bg-teal/15 rounded-control-sm block p-2">
                      <List className="text-teal size-3.5" />
                    </span>
                  }
                  title="Article TOC"
                  subtitle="Floating outline navigator"
                  trailing={
                    <ToggleSwitch
                      enabled={showWikiToc}
                      onToggle={() => {
                        setShowWikiToc(!showWikiToc);
                      }}
                    />
                  }
                />

                <FacetRow
                  leading={
                    <span className="bg-blue/15 rounded-control-sm block p-2">
                      <Search className="text-blue size-3.5" />
                    </span>
                  }
                  title="Quick search"
                  subtitle="Index wiki articles in search"
                  trailing={
                    <ToggleSwitch
                      enabled={dynamicSearchWiki}
                      onToggle={() => {
                        setDynamicSearchWiki(!dynamicSearchWiki);
                      }}
                    />
                  }
                />

                <FacetRow
                  leading={
                    <span className="bg-green/15 rounded-control-sm block p-2">
                      <ExternalLink className="text-green size-3.5" />
                    </span>
                  }
                  title="Open in new tab"
                  subtitle="External link target"
                  trailing={
                    <ToggleSwitch
                      enabled={openInNewTab}
                      onToggle={() => {
                        setOpenInNewTab(!openInNewTab);
                      }}
                    />
                  }
                />

                <FacetRow
                  onClick={() => {
                    onClose();
                    router.push("/settings#wiki-settings");
                  }}
                  leading={
                    <span className="rounded-control-sm bg-indigo/15 block p-2">
                      <BookOpen className="text-indigo size-3.5" />
                    </span>
                  }
                  title="Wiki system settings"
                  subtitle="Lore scanner and sources"
                  accessory="chevron"
                />
              </FacetListSection>
            </FacetList>
          </HaloWell>
        )}
      </div>
    </div>
  );
}

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
    <HaloViewHeader
      leading={
        isOnWikiPage ? (
          <BookOpen className="text-blue h-4 w-4 shrink-0" />
        ) : (
          <Settings className="text-blue h-4 w-4 shrink-0" />
        )
      }
      title={isOnWikiPage ? "Wiki settings" : "Settings"}
      trailing={
        onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data"
            className="text-label-secondary hover:text-label"
            aria-label="Refresh data"
          >
            <RefreshCw aria-hidden className={isRefreshing ? "animate-spin" : ""} />
          </Button>
        ) : undefined
      }
      onClose={() => {
        soundCues.dismiss();
        onClose();
      }}
    />
  );
}
