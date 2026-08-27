"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "~/components/ui/badge";
import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { FacetCard } from "~/components/ui/facet-container";
import { Group as Users, StatUp as TrendingUp, MapPin, Globe, Camera, Check, MediaImage as ImageIcon, WhiteFlag as Flag, Sparks as Sparkles, Palette } from "iconoir-react";
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
        className="relative overflow-hidden rounded-none border-0 border-b border-white/10 shadow-lg"
        style={flagThemeCSS}
      >
        {/* Banner image area */}
        <div
          className={cn(
            "relative h-64 w-full overflow-hidden transition-all duration-300 md:h-80 lg:h-96",
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
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />
            </div>
          ) : (
            <div className="to-background/80 absolute inset-0 bg-gradient-to-b from-transparent via-transparent" />
          )}

          {/* Flag-derived ambient glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-[var(--flag-glow-primary)] opacity-25 blur-3xl" />
            <div className="absolute -right-16 -bottom-16 h-72 w-72 rounded-full bg-[var(--flag-glow-secondary)] opacity-20 blur-3xl" />
          </div>

          {/* Flag-tinted top light wash */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-multiply"
            style={{
              background: `linear-gradient(to bottom, ${flagColors.primary}26 0%, transparent 55%)`,
            }}
          />

          {/* Apple Design Frosted glass bar behind content */}
          {hasImage && (
            <div className="absolute inset-x-0 bottom-0 h-32 border-t border-white/10 bg-black/40 [mask-image:linear-gradient(to_bottom,transparent,black_30%)] saturate-180 backdrop-blur-xl md:h-36" />
          )}

          {/* Country Header Content */}
          <div className="relative container mx-auto flex h-full flex-col justify-end px-4 pb-8">
            <div className="flex items-center gap-4 md:gap-6">
              {/* Flag (state seal emblem) */}
              <div className="h-14 w-14 shrink-0 transition-transform duration-200 hover:scale-105 md:h-16 md:w-16 lg:h-20 lg:w-20">
                <UnifiedCountryFlag
                  countryName={country.name}
                  size="xl"
                  flagUrl={flagUrl}
                  isLoading={flagLoading}
                  fitContainer={true}
                  rounded={true}
                  shadow={true}
                  border={true}
                  className="h-full w-full"
                />
              </div>

              {/* Country Name and Basic Info */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <h1
                    className={cn(
                      "text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl",
                      hasImage
                        ? "text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7),0_1px_4px_rgba(0,0,0,0.5)]"
                        : "text-foreground"
                    )}
                  >
                    {country.name.replace(/_/g, " ")}
                  </h1>
                  <FloatingRibbonRack />
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 md:gap-3">
                  <Badge
                    className={cn(
                      "cursor-pointer font-semibold transition-transform duration-100 ease-out active:scale-[0.96]",
                      microLabel
                    )}
                    style={badgeTint("primary", hasImage)}
                    onClick={onTogglePopulationDisplay}
                  >
                    <Users className="mr-1.5 h-3 w-3" />
                    {showFullPopulation
                      ? Math.round(country.currentPopulation).toLocaleString()
                      : formatPopulation(country.currentPopulation)}
                  </Badge>

                  <Badge
                    className={cn(
                      "cursor-pointer font-semibold transition-transform duration-100 ease-out active:scale-[0.96]",
                      microLabel
                    )}
                    style={badgeTint("secondary", hasImage)}
                    onClick={onToggleGdpDisplay}
                  >
                    <TrendingUp className="mr-1.5 h-3 w-3" />
                    {showGdpPerCapita
                      ? `${formatCurrency(country.currentGdpPerCapita)}/capita`
                      : formatTotalGdpVerbose(country.currentTotalGdp)}
                  </Badge>

                  {country.landArea && (
                    <Badge
                      className={cn("font-semibold", microLabel)}
                      style={badgeTint("accent", hasImage)}
                    >
                      <MapPin className="mr-1.5 h-3 w-3" />
                      {Math.round(country.landArea).toLocaleString()} km²
                    </Badge>
                  )}

                  {country.continent && (
                    <Badge
                      variant="outline"
                      className={cn("font-semibold", microLabel)}
                      style={badgeTint("accent", hasImage)}
                    >
                      <Globe className="mr-1 h-3 w-3" />
                      {country.continent}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Change Button (owner-only) */}
        {isOwnCountry && (
          <div className="absolute top-4 right-4 z-20">
            <Popover open={showBannerPicker} onOpenChange={setShowBannerPicker}>
              <PopoverTrigger
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-xl transition-all duration-100 active:scale-[0.96]",
                  hasImage
                    ? "border border-white/25 bg-black/50 text-white hover:bg-black/70"
                    : "border-border bg-background/80 text-foreground hover:bg-muted"
                )}
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="hidden text-xs sm:inline">Change Banner</span>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="glass-off border-border z-[100011] w-72 rounded-xl border bg-white p-2 shadow-2xl dark:bg-zinc-900"
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
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.98]",
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
