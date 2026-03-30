"use client";

import React from "react";
import {
  Crown,
  Flag,
  Building2,
  TrendingUp,
  CheckCircle,
  Sparkles,
  Import,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { SectionHeaderBackground } from "~/components/mycountry/primitives/SectionHeaderBackground";
import { motion } from "motion/react";
import { BUILDER_THEME, type BuilderSection, BUILD_STEPS } from "../lib/builder-theme";

interface BuilderSectionHeroProps {
  section: BuilderSection;
  /** Country name once the user has named it */
  countryName?: string;
  /** Overall completion percentage */
  completionPercent?: number;
  /** Completed step count */
  completedCount?: number;
}

const SECTION_ICONS: Record<BuilderSection, LucideIcon> = {
  welcome: Sparkles,
  import: Import,
  foundation: Crown,
  identity: Flag,
  government: Building2,
  economics: TrendingUp,
  preview: CheckCircle,
};

export const BuilderSectionHero = React.memo(function BuilderSectionHero({
  section,
  countryName,
  completionPercent,
  completedCount,
}: BuilderSectionHeroProps) {
  const theme = BUILDER_THEME[section];
  const Icon = SECTION_ICONS[section];
  const stepIdx = BUILD_STEPS.indexOf(section);
  const isStep = stepIdx >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="hero">
        <div className={`glass-hierarchy-parent rounded-xl border ${theme.border} p-3 sm:p-4`}>
          {/* Breadcrumb */}
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
              Nation Builder
            </Badge>
            <span className="text-muted-foreground text-sm">&rarr;</span>
            <Badge className={`bg-gradient-to-r ${theme.gradient} text-white`}>
              <Icon size={12} className="mr-1" />
              {theme.flavorTitle}
            </Badge>
            {isStep && (
              <span className="text-muted-foreground text-xs hidden sm:inline">
                Step {stepIdx + 1} of {BUILD_STEPS.length}
              </span>
            )}
          </div>

          {/* Main content */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`rounded-full bg-gradient-to-r ${theme.gradient} p-2 flex-shrink-0`}>
                <Icon size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {countryName || theme.flavorTitle}
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {theme.flavorSubtitle}
                </p>
              </div>
            </div>

            {/* Progress indicator (desktop only) */}
            {completionPercent !== undefined && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} transition-all duration-500`}
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {completionPercent}%
                  </span>
                </div>
                {completedCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{BUILD_STEPS.length} steps
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionHeaderBackground>
    </motion.div>
  );
});
