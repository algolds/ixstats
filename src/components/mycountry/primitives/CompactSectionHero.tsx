"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { GlassPanel } from "~/components/mycountry/cards";
import { accentForSection } from "~/components/mycountry/cards/accents";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";

/** Icon component type — supports both LucideIcon and custom SVG icons. */
type IconComponent = LucideIcon | React.ComponentType<{ size?: number; className?: string }>;

export interface StatusBadgeConfig {
  icon: IconComponent;
  count: number;
  colorClass: string;
}

/** Icon-chip gradients per accent (kept literal for Tailwind JIT). */
const ICON_GRADIENTS: Record<string, string> = {
  amber: "from-amber-500 to-yellow-500",
  cyan: "from-cyan-500 to-blue-500",
  blue: "from-blue-500 to-cyan-500",
  red: "from-red-500 to-orange-500",
  indigo: "from-indigo-500 to-violet-500",
  emerald: "from-emerald-500 to-green-500",
  neutral: "from-slate-500 to-slate-700",
};

interface CompactSectionHeroProps {
  section: MyCountrySection;
  /** Section name shown as the primary title (e.g. "Diplomacy"). */
  title: string;
  subtitle?: string;
  icon: IconComponent;
  /** Country name shown as a breadcrumb suffix on larger screens. */
  countryName?: string;
  /** Status badges (counts) shown on the right on desktop. */
  statusBadges?: StatusBadgeConfig[];
  /** Optional trailing actions (e.g. a settings button). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * CompactSectionHero — the canonical single-row hero bar for every MyCountry
 * gameplay section. Built on the theme-compliant GlassPanel. The large
 * flag-background hero (`primitives/hero/HeroSection`) is reserved for the
 * Overview/home page.
 */
export const CompactSectionHero = React.memo(function CompactSectionHero({
  section,
  title,
  subtitle,
  icon: Icon,
  countryName,
  statusBadges,
  actions,
  className,
}: CompactSectionHeroProps) {
  const accent = accentForSection(section);
  const gradient = ICON_GRADIENTS[accent] ?? ICON_GRADIENTS.neutral;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <GlassPanel accent={accent} texture="none" className={cn("px-3 py-2.5 sm:px-4", className)}>
        <div className="flex items-center gap-3">
          <div className={cn("shrink-0 rounded-lg bg-gradient-to-br p-2 shadow-sm", gradient)}>
            <Icon size={18} className="text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
              {countryName && (
                <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                  · {countryName}
                </span>
              )}
            </div>
            {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
          </div>

          {statusBadges && statusBadges.length > 0 && (
            <div className="hidden items-center gap-1.5 sm:flex">
              {statusBadges.map((b, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={cn("px-1.5 py-0 text-[0.65rem]", b.colorClass)}
                >
                  <b.icon className="mr-1 h-2.5 w-2.5" />
                  {b.count}
                </Badge>
              ))}
            </div>
          )}

          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      </GlassPanel>
    </motion.div>
  );
});
