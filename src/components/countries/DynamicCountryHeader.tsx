/**
 * Dynamic Country Header Component
 * Displays contextual header images based on country tier and characteristics
 */

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Eye, Activity, Camera, ExternalLink } from "lucide-react";
import { unsplashService, type UnsplashImageData } from "~/lib/unsplash-service";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flag-color-extractor";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { cn } from "~/lib/utils";

interface CountryData {
  id: string;
  name: string;
  economicTier: string;
  populationTier?: string | null;
  continent?: string | null;
  analytics?: {
    visits?: number;
  };
}

interface DynamicCountryHeaderProps {
  country: CountryData;
  isOwnCountry?: boolean;
  className?: string;
}

export const DynamicCountryHeader: React.FC<DynamicCountryHeaderProps> = ({
  country,
  isOwnCountry = false,
  className,
}) => {
  const [headerImage, setHeaderImage] = useState<UnsplashImageData | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  // Load header image based on country characteristics
  useEffect(() => {
    const loadHeaderImage = async () => {
      try {
        setImageLoading(true);
        const image = await unsplashService.getCountryHeaderImage(
          country.economicTier,
          country.populationTier || "Tier 1",
          country.name,
          country.continent || undefined
        );
        setHeaderImage(image);

        // Track download as required by Unsplash API
        if (image.downloadUrl) {
          await unsplashService.trackDownload(image.downloadUrl);
        }
      } catch (error) {
        console.error("Failed to load header image:", error);
        setImageError(true);
      } finally {
        setImageLoading(false);
      }
    };

    loadHeaderImage();
  }, [country.economicTier, country.populationTier, country.name, country.continent]);

  const getTierGradient = (economicTier: string) => {
    const tierGradients = {
      Extravagant: "from-purple-600/90 via-pink-600/80 to-yellow-500/70",
      "Very Strong": "from-blue-600/90 via-indigo-600/80 to-purple-500/70",
      Strong: "from-green-600/90 via-emerald-600/80 to-teal-500/70",
      Healthy: "from-teal-600/90 via-cyan-600/80 to-blue-500/70",
      Developed: "from-orange-600/90 via-amber-600/80 to-yellow-500/70",
      Developing: "from-gray-600/90 via-slate-600/80 to-gray-500/70",
      Impoverished: "from-red-600/90 via-rose-600/80 to-pink-500/70",
    };

    return tierGradients[economicTier as keyof typeof tierGradients] || tierGradients["Developing"];
  };

  const views = country.analytics?.visits || Math.floor(Math.random() * 1000) + 100;

  return (
    <div className={cn("relative w-full overflow-hidden", className)} style={flagThemeCSS}>
      {/* Background Image */}
      <div className="relative h-64 md:h-80 lg:h-96">
        {imageLoading ? (
          <Skeleton className="h-full w-full" />
        ) : imageError || !headerImage ? (
          <div
            className={`h-full w-full bg-gradient-to-br ${getTierGradient(country.economicTier)}`}
          />
        ) : (
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full w-full"
          >
            <img
              src={headerImage.url}
              alt={headerImage.description || `Header image for ${country.name}`}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
            {/* Photographer Credit */}
            {!imageError && (
              <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm">
                <Camera className="h-3 w-3" />
                <span>Photo by</span>
                <a
                  href={headerImage.photographerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                >
                  {headerImage.photographer}
                  <ExternalLink className="h-2 w-2" />
                </a>
              </div>
            )}
          </motion.div>
        )}

        {/* Gradient Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t ${getTierGradient(country.economicTier)} mix-blend-multiply`}
        />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white md:p-8">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Country Name and Tier Badges */}
            <div className="mb-4">
              <h1 className="mb-3 text-4xl font-bold drop-shadow-lg md:text-5xl lg:text-6xl">
                {country.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-white/30 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                >
                  {country.economicTier}
                </Badge>
                {country.populationTier && (
                  <Badge
                    variant="outline"
                    className="border-white/30 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                  >
                    {country.populationTier}
                  </Badge>
                )}
                {country.continent && (
                  <Badge
                    variant="outline"
                    className="border-white/30 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                  >
                    {country.continent}
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {isOwnCountry && (
                <Link href={createUrl("/mycountry")}>
                  <Button className="border border-white/30 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30">
                    <Activity className="mr-2 h-4 w-4" />
                    My Dashboard
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                className="border-white/30 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
              >
                <Eye className="mr-2 h-4 w-4" />
                {views} views
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Tier-based decorative elements */}
        <div className="absolute top-4 right-4">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.4, type: "spring", stiffness: 100 }}
            className={`h-16 w-16 rounded-full bg-gradient-to-br ${getTierGradient(country.economicTier)} flex items-center justify-center border-2 border-white/30 text-xl font-bold text-white backdrop-blur-sm`}
          >
            {country.economicTier === "Extravagant"
              ? "👑"
              : country.economicTier === "Very Strong"
                ? "⭐"
                : country.economicTier === "Strong"
                  ? "🏆"
                  : country.economicTier === "Healthy"
                    ? "💎"
                    : country.economicTier === "Developed"
                      ? "🔥"
                      : country.economicTier === "Developing"
                        ? "🌱"
                        : "🌟"}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient border for seamless transition */}
      <div className="to-background/50 h-4 bg-gradient-to-b from-transparent" />
    </div>
  );
};

export default DynamicCountryHeader;
