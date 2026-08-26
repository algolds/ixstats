"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Badge } from "~/components/ui/badge";
import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Group as Users,
  GraphUp as TrendingUp,
  Pin as MapPin,
  Globe,
  Camera,
  Check,
  MediaImage as ImageIcon,
  WhiteFlag as Flag,
  Spark as Sparkles,
  Palette,
  User,
  Shield,
} from "iconoir-react";
import { formatCurrency, formatPopulation } from "~/lib/utils";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flags/flag-color-extractor";
import { cn } from "~/lib/utils";
import type { BannerMode, BannerOption } from "../_types";
import { FloatingRibbonRack } from "~/components/achievements/FloatingRibbonRack";

const MediaSearchModal = dynamic(
  () => import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface CountryHeaderProps {
  country: {
    name: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    landArea: number | null | undefined;
    adjustedGdpGrowth: number | null | undefined;
    continent: string | null | undefined;
  };
  delegate?: {
    username?: string | null;
    roleName?: string | null;
    forumAvatarUrl?: string | null;
    isStaff?: boolean;
    membershipTier?: string | null;
  } | null;
  flagUrl: string | null | undefined;
  flagLoading: boolean;
  unsplashImageUrl: string | undefined;
  isOwnCountry: boolean;
  showGdpPerCapita: boolean;
  showFullPopulation: boolean;
  bannerMode: BannerMode;
  customBannerUrl?: string;
  onToggleGdpDisplay: () => void;
  onTogglePopulationDisplay: () => void;
  onCountryActionsClick: () => void;
  onBannerModeChange: (mode: BannerMode, customUrl?: string) => void;
}

const bannerOptions = [
  {
    mode: "dynamic",
    label: "Dynamic Image",
    description: "Contextual photo from Unsplash",
    icon: Sparkles,
  },
  {
    mode: "flag",
    label: "Country Flag",
    description: "Use your national flag as banner",
    icon: Flag,
  },
  { mode: "gradient", label: "Gradient", description: "Clean gradient background", icon: Palette },
  {
    mode: "custom",
    label: "Image Repository",
    description: "Choose from media library",
    icon: ImageIcon,
  },
] satisfies BannerOption[];

// Uppercase micro-label treatment shared by all header stat badges.
const microLabel = "text-[10px] font-extrabold uppercase tracking-wider";

// Flag-derived tint for a badge: solid text + glass scrim over imagery, tinted glass otherwise.
const badgeTint = (
  color: "primary" | "secondary" | "accent",
  hasImage: boolean
): React.CSSProperties =>
  hasImage
    ? {
        color: "#ffffff",
        borderColor: `var(--flag-border-${color})`,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
      }
    : {
        color: `var(--flag-${color})`,
        borderColor: `var(--flag-${color})`,
        backgroundColor: `color-mix(in srgb, var(--flag-${color}) 12%, transparent)`,
      };

function formatTotalGdpVerbose(gdp: number): string {
  if (!gdp || isNaN(gdp)) return "$0 GDP";
  const absGdp = Math.abs(gdp);
  if (absGdp >= 1e12) {
    return `$${(gdp / 1e12).toFixed(1)} Trillion GDP`;
  }
  if (absGdp >= 1e9) {
    return `$${(gdp / 1e9).toFixed(1)} Billion GDP`;
  }
  if (absGdp >= 1e6) {
    return `$${(gdp / 1e6).toFixed(1)} Million GDP`;
  }
  return formatCurrency(gdp) + " GDP";
}

export function CountryHeader({
  country,
  delegate,
  flagUrl,
  flagLoading,
  unsplashImageUrl,
  isOwnCountry,
  showGdpPerCapita,
  showFullPopulation,
  bannerMode,
  customBannerUrl,
  onToggleGdpDisplay,
  onTogglePopulationDisplay,
  onCountryActionsClick: _onCountryActionsClick,
  onBannerModeChange,
}: CountryHeaderProps) {
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);

  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  const resolvedBannerUrl = (() => {
    switch (bannerMode) {
      case "dynamic":
        return unsplashImageUrl;
      case "flag":
        return flagUrl ?? undefined;
      case "custom":
        return customBannerUrl;
      case "gradient":
      default:
        return undefined;
    }
  })();

  const hasImage = !!resolvedBannerUrl;

  const handleModeSelect = (mode: BannerMode) => {
    if (mode === "custom") {
      setShowMediaSearch(true);
      setShowBannerPicker(false);
      return;
    }
    onBannerModeChange(mode);
    setShowBannerPicker(false);
  };

  const handleMediaSelect = (url: string) => {
    onBannerModeChange("custom", url);
    setShowMediaSearch(false);
  };

  return (
    <>
      <FacetCard
        depth={1}
        interactive="none"
        className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 shadow-xl"
        style={flagThemeCSS}
      >
        {/* Banner image & glass wash area */}
        <div
          className={cn(
            "relative w-full overflow-hidden transition-all duration-300 py-6 px-5 md:px-8",
            !hasImage && "from-primary/10 via-muted/30 to-accent/10 bg-gradient-to-br"
          )}
        >
          {/* Background Image */}
          {hasImage ? (
            <div
              className="absolute inset-0 bg-center bg-no-repeat transition-all duration-500"
              style={{
                backgroundImage: `url(${resolvedBannerUrl})`,
                backgroundSize: bannerMode === "flag" ? "100% auto" : "cover",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/85" />
            </div>
          ) : (
            <div className="to-background/90 absolute inset-0 bg-gradient-to-b from-transparent via-transparent" />
          )}

          {/* Flag-derived ambient glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-[var(--flag-glow-primary)] opacity-30 blur-3xl" />
            <div className="absolute -right-16 -bottom-16 h-72 w-72 rounded-full bg-[var(--flag-glow-secondary)] opacity-25 blur-3xl" />
          </div>

          {/* Apple Frosted Glass Scrim */}
          <div className="absolute inset-0 border-b border-white/10 bg-black/20 backdrop-blur-md" />

          {/* Bento Masthead Grid Content */}
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Sovereign Emblem & Statecraft Identity */}
            <div className="flex items-center gap-5 sm:gap-6 min-w-0">
              {/* Sovereign State Flag Seal */}
              <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 transition-transform duration-200 hover:scale-105">
                <UnifiedCountryFlag
                  countryName={country.name}
                  size="xl"
                  flagUrl={flagUrl}
                  isLoading={flagLoading}
                  fitContainer={true}
                  rounded={true}
                  shadow={true}
                  border={true}
                  className="h-full w-full shadow-2xl ring-2 ring-white/20"
                />
              </div>

              {/* Country Title & Sovereign Details */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1
                    className={cn(
                      "text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight",
                      hasImage
                        ? "text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.8),0_1px_4px_rgba(0,0,0,0.6)]"
                        : "text-foreground"
                    )}
                  >
                    {country.name.replace(/_/g, " ")}
                  </h1>
                  <FloatingRibbonRack />
                </div>

                {/* Statecraft & Realm Context Subtext */}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-300">
                  {country.continent && (
                    <span className="flex items-center gap-1 text-slate-200">
                      <Globe className="h-3.5 w-3.5 text-blue-400" />
                      <span>{country.continent} Realm</span>
                    </span>
                  )}
                </div>

                {/* Macro Telemetry Badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-2.5">
                  <Badge
                    className={cn(
                      "cursor-pointer font-bold transition-all duration-150 ease-out active:scale-[0.96] rounded-xl px-2.5 py-1 select-none",
                      microLabel
                    )}
                    style={badgeTint("primary", hasImage)}
                    onClick={onTogglePopulationDisplay}
                    data-cuelume-press="soft"
                    title="Toggle population view"
                  >
                    <Users className="mr-1.5 h-3 w-3" />
                    {showFullPopulation
                      ? Math.round(country.currentPopulation).toLocaleString()
                      : formatPopulation(country.currentPopulation)}{" "}
                    Pop
                  </Badge>

                  <Badge
                    className={cn(
                      "cursor-pointer font-bold transition-all duration-150 ease-out active:scale-[0.96] rounded-xl px-2.5 py-1 select-none",
                      microLabel
                    )}
                    style={badgeTint("secondary", hasImage)}
                    onClick={onToggleGdpDisplay}
                    data-cuelume-press="soft"
                    title="Toggle GDP view"
                  >
                    <TrendingUp className="mr-1.5 h-3 w-3" />
                    {showGdpPerCapita
                      ? `${formatCurrency(country.currentGdpPerCapita)}/capita`
                      : formatTotalGdpVerbose(country.currentTotalGdp)}
                  </Badge>

                  {country.landArea && (
                    <Badge
                      className={cn("font-bold rounded-xl px-2.5 py-1 select-none", microLabel)}
                      style={badgeTint("accent", hasImage)}
                    >
                      <MapPin className="mr-1.5 h-3 w-3" />
                      {Math.round(country.landArea).toLocaleString()} km²
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Citizen Delegate Persona Bento */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 p-3 backdrop-blur-xl shrink-0 self-start lg:self-center">
              {delegate?.username ? (
                <Link
                  href={`/id/@${delegate.username.replace(/^@/, "")}`}
                  data-cuelume-press="soft"
                  className="group flex items-center gap-3 rounded-xl p-1 -m-1 transition-all duration-150 hover:bg-white/10 active:scale-[0.98] cursor-pointer"
                  title={`View @${delegate.username}'s Global Passport`}
                >
                  {delegate.forumAvatarUrl ? (
                    <img
                      src={delegate.forumAvatarUrl}
                      alt={delegate.username}
                      className="h-10 w-10 rounded-xl border border-white/20 object-cover shadow-sm transition-transform duration-150 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-base font-black text-blue-400 border border-blue-500/30 transition-transform duration-150 group-hover:scale-105">
                      {delegate.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white group-hover:text-blue-300 transition-colors">
                        @{delegate.username}
                      </span>
                      {delegate.isStaff && (
                        <span className="rounded bg-orange-500/20 px-1.5 py-0.2 text-[9px] font-extrabold text-orange-400 border border-orange-500/30">
                          STAFF
                        </span>
                      )}
                    </div>
                    {delegate.roleName ? (
                      <p className="text-[10px] font-semibold text-purple-300">
                        {delegate.roleName}
                      </p>
                    ) : (
                      <p className="text-[10px] font-medium text-slate-400 capitalize">
                        {delegate.membershipTier ?? "Citizen"} Delegate
                      </p>
                    )}
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-2 px-1 text-xs text-slate-300">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold">Sovereign Territory</span>
                </div>
              )}

              {/* Banner Change Popover (Owner only) */}
              {isOwnCountry && (
                <div className="border-l border-white/10 pl-2">
                  <Popover open={showBannerPicker} onOpenChange={setShowBannerPicker}>
                    <PopoverTrigger
                      className={cn(
                        "inline-flex cursor-pointer items-center justify-center rounded-xl p-2 text-xs font-semibold shadow-md backdrop-blur-xl transition-all duration-100 active:scale-[0.94] text-white hover:bg-white/10"
                      )}
                      title="Customize Banner"
                      data-cuelume-press="soft"
                    >
                      <Camera className="h-4 w-4" />
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="glass-off border-border z-[100011] w-72 origin-top-right rounded-2xl border bg-white p-2 shadow-2xl dark:bg-zinc-900"
                    >
                      <div className="space-y-1">
                        <p className="text-muted-foreground px-2 py-1.5 text-[10px] font-extrabold tracking-wider uppercase">
                          Banner Style
                        </p>
                        {bannerOptions.map((option) => {
                          const Icon = option.icon;
                          const isActive = bannerMode === option.mode;
                          return (
                            <button
                              key={option.mode}
                              type="button"
                              onClick={() => handleModeSelect(option.mode)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer",
                                isActive
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-foreground hover:bg-muted"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{option.label}</p>
                                <p className="text-muted-foreground text-xs">{option.description}</p>
                              </div>
                              {isActive && <Check className="text-primary h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </div>
      </FacetCard>

      {/* Media Search Modal for custom banner */}
      {showMediaSearch && (
        <MediaSearchModal
          isOpen={showMediaSearch}
          onClose={() => setShowMediaSearch(false)}
          onImageSelect={handleMediaSelect}
        />
      )}
    </>
  );
}
