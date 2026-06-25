"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "~/components/ui/badge";
import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { Button } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Users,
  TrendingUp,
  MapPin,
  Globe,
  Camera,
  Check,
  Image as ImageIcon,
  Flag,
  Sparkles,
  Palette,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";
import type { BannerMode } from "../_hooks/useCountryPageState";

const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
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

const bannerOptions: Array<{
  mode: BannerMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
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
];

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
  onCountryActionsClick,
  onBannerModeChange,
}: CountryHeaderProps) {
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);

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
      <div className="relative">
        {/* Banner image area */}
        <div
          className={cn(
            "relative h-64 w-full overflow-hidden md:h-80 lg:h-96",
            !hasImage && "from-primary/10 via-muted/30 to-accent/10 bg-gradient-to-br"
          )}
        >
          {/* Background Image */}
          {hasImage ? (
            <div
              className="absolute inset-0 bg-center bg-no-repeat"
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

          {/* Frosted glass bar behind content for readability */}
          {hasImage && (
            <div className="absolute inset-x-0 bottom-0 h-32 bg-black/40 [mask-image:linear-gradient(to_bottom,transparent,black_30%)] backdrop-blur-md md:h-36" />
          )}

          {/* Country Header Content */}
          <div className="relative container mx-auto flex h-full flex-col justify-end px-4 pb-8">
            <div className="flex items-center gap-4 md:gap-6">
              {/* Flag */}
              <div className="h-14 w-14 shrink-0 md:h-16 md:w-16 lg:h-20 lg:w-20">
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
                <h1
                  className={cn(
                    "mb-1 text-3xl font-bold md:text-4xl lg:text-5xl",
                    hasImage
                      ? "text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7),0_1px_4px_rgba(0,0,0,0.5)]"
                      : "text-foreground"
                  )}
                >
                  {country.name.replace(/_/g, " ")}
                </h1>
                <div className="mb-2 flex flex-wrap items-center gap-2 md:gap-3">
                  <Badge
                    className={cn(
                      "cursor-pointer font-semibold transition-colors",
                      hasImage
                        ? "border-blue-400/30 bg-blue-600/85 text-white backdrop-blur-md hover:bg-blue-500/90"
                        : "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200 dark:hover:bg-blue-500/30"
                    )}
                    onClick={onTogglePopulationDisplay}
                  >
                    <Users className="mr-1.5 h-3 w-3" />
                    {showFullPopulation
                      ? Math.round(country.currentPopulation).toLocaleString()
                      : formatPopulation(country.currentPopulation)}
                  </Badge>

                  <Badge
                    className={cn(
                      "cursor-pointer font-semibold transition-colors",
                      hasImage
                        ? "border-green-400/30 bg-green-600/85 text-white backdrop-blur-md hover:bg-green-500/90"
                        : "border-green-200 bg-green-100 text-green-800 hover:bg-green-200 dark:border-green-500/30 dark:bg-green-500/20 dark:text-green-200 dark:hover:bg-green-500/30"
                    )}
                    onClick={onToggleGdpDisplay}
                  >
                    <TrendingUp className="mr-1.5 h-3 w-3" />
                    {showGdpPerCapita
                      ? `${formatCurrency(country.currentGdpPerCapita)}/capita`
                      : formatCurrency(country.currentTotalGdp)}
                  </Badge>

                  {country.landArea && (
                    <Badge
                      className={cn(
                        "font-semibold",
                        hasImage
                          ? "border-purple-400/30 bg-purple-600/85 text-white backdrop-blur-md"
                          : "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-200"
                      )}
                    >
                      <MapPin className="mr-1.5 h-3 w-3" />
                      {country.landArea.toLocaleString()} km²
                    </Badge>
                  )}

                  <Badge
                    className={cn(
                      "font-semibold",
                      hasImage
                        ? (country.adjustedGdpGrowth ?? 0) > 0
                          ? "border-emerald-400/30 bg-emerald-600/85 text-white backdrop-blur-md"
                          : "border-red-400/30 bg-red-600/85 text-white backdrop-blur-md"
                        : (country.adjustedGdpGrowth ?? 0) > 0
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200"
                          : "border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200"
                    )}
                  >
                    <GrowthArrow
                      value={(country.adjustedGdpGrowth ?? 0) * 100}
                      size={12}
                      iconOnly
                      inheritColor
                      className="mr-1.5"
                    />
                    {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}% growth
                  </Badge>

                  {country.continent && (
                    <Badge
                      variant="outline"
                      className={cn(
                        hasImage
                          ? "border-white/30 bg-black/40 text-white backdrop-blur-md"
                          : "border-border bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <Globe className="mr-1 h-3 w-3" />
                      {country.continent}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 items-end gap-2">
                <Button
                  size="lg"
                  variant={isOwnCountry ? "default" : "outline"}
                  onClick={onCountryActionsClick}
                  className={cn(
                    "shadow-lg",
                    !isOwnCountry &&
                      (hasImage
                        ? "text-foreground border-white/30 bg-white/95 backdrop-blur-md hover:bg-white dark:bg-gray-900/95 dark:hover:bg-gray-900"
                        : "")
                  )}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">
                    {isOwnCountry ? "Country Management" : "Country Actions"}
                  </span>
                  <span className="md:hidden">Actions</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Change Button (owner-only) - outside overflow-hidden */}
        {isOwnCountry && (
          <div className="absolute top-4 right-4 z-20">
            <Popover open={showBannerPicker} onOpenChange={setShowBannerPicker}>
              <PopoverTrigger
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium shadow-lg backdrop-blur-md transition-colors",
                  hasImage
                    ? "border border-white/20 bg-black/50 text-white hover:bg-black/70"
                    : "border-border bg-background/80 text-foreground hover:bg-muted border"
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
                  <p className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">
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
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
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
