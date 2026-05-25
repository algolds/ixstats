"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { SectionHeaderBackground } from "./SectionHeaderBackground";
import type { ImageContext } from "~/lib/country-image-engine";
import { motion } from "motion/react";

/** Icon component type — supports both LucideIcon and custom SVG icons */
type IconComponent = LucideIcon | React.ComponentType<{ size?: number; className?: string }>;

/** Theme gradient mappings for the section icon circle and badge */
const THEME_GRADIENTS: Record<string, string> = {
  amber: "from-amber-500 to-yellow-500",
  cyan: "from-cyan-500 to-blue-500",
  indigo: "from-indigo-500 to-violet-500",
  red: "from-red-500 to-orange-500",
  blue: "from-blue-500 to-cyan-500",
  emerald: "from-emerald-500 to-green-500",
};

const THEME_BORDERS: Record<string, string> = {
  amber: "border-amber-500/30 dark:border-amber-500/20",
  cyan: "border-cyan-500/30 dark:border-cyan-500/20",
  indigo: "border-indigo-500/30 dark:border-indigo-500/20",
  red: "border-red-500/30 dark:border-red-500/20",
  blue: "border-blue-500/30 dark:border-blue-500/20",
  emerald: "border-emerald-500/30 dark:border-emerald-500/20",
};

export interface StatusBadgeConfig {
  icon: IconComponent;
  count: number;
  colorClass: string;
}

interface SectionHeroProps {
  context: ImageContext;
  sectionTitle: string;
  sectionSubtitle: string;
  sectionIcon: IconComponent;
  accentColor: string;
  countryName: string;
  /** Optional status badges shown on desktop (right side) */
  statusBadges?: StatusBadgeConfig[];
}

/**
 * Unified hero component for all MyCountry gameplay sections.
 * Provides consistent visual structure with section-specific theming.
 */
export const SectionHero = React.memo(function SectionHero({
  context,
  sectionTitle,
  sectionSubtitle,
  sectionIcon: Icon,
  accentColor,
  countryName,
  statusBadges,
}: SectionHeroProps) {
  const gradient = THEME_GRADIENTS[accentColor] ?? THEME_GRADIENTS.amber;
  const borderClass = THEME_BORDERS[accentColor] ?? THEME_BORDERS.amber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context={context}>
        <div className={`glass-hierarchy-parent rounded-xl border ${borderClass} p-3 sm:p-4`}>
          {/* Breadcrumb + section badge */}
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
              MyCountry&reg;
            </Badge>
            <span className="text-muted-foreground text-sm">&rarr;</span>
            <Badge className={`bg-gradient-to-r ${gradient} text-white`}>
              <Icon size={12} className="mr-1" />
              {sectionTitle}
            </Badge>
          </div>

          {/* Icon + country name + subtitle + status badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`rounded-full bg-gradient-to-r ${gradient} shrink-0 p-2`}>
                <Icon size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold sm:text-2xl">{countryName}</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">{sectionSubtitle}</p>
              </div>
            </div>

            {/* Status badges (desktop only) */}
            {statusBadges && statusBadges.length > 0 && (
              <div className="hidden items-center gap-1.5 sm:flex">
                {statusBadges.map((badge, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`px-1.5 py-0 text-[0.65rem] ${badge.colorClass}`}
                  >
                    <badge.icon className="mr-1 h-2.5 w-2.5" />
                    {badge.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionHeaderBackground>
    </motion.div>
  );
});
