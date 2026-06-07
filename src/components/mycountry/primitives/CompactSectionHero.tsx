"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { accentForSection, ACCENT_CLASSES } from "~/components/mycountry/cards/accents";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";
import { HealthRing } from "~/components/ui/health-ring";

const sectionColor = (section: string) => {
  switch (section) {
    case "executive":
      return "#f59e0b"; // Amber
    case "diplomacy":
      return "#06b6d4"; // Cyan
    case "politics":
      return "#8b5cf6"; // Purple/Violet
    case "intelligence":
      return "#3b82f6"; // Blue
    case "defense":
      return "#ef4444"; // Red
    default:
      return "#10b981"; // Green
  }
};

/** Icon component type — supports both LucideIcon and custom SVG icons. */
type IconComponent = LucideIcon | React.ComponentType<{ size?: number; className?: string }>;

export interface StatusBadgeConfig {
  icon: IconComponent;
  count: number;
  colorClass: string;
}

export interface HeroStat {
  label: string;
  value: string | number;
  /** Render the value in the section accent color. */
  accentText?: boolean;
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
  /** Blurred country flag used as the hero backdrop (falls back to a themed wash). */
  flagUrl?: string | null;
  /** Key section stats shown inline on the right. */
  stats?: HeroStat[];
  /** Status badges (counts) shown on the right on desktop. */
  statusBadges?: StatusBadgeConfig[];
  /** Optional trailing actions (e.g. a settings button). */
  actions?: React.ReactNode;
  className?: string;
  /** Vitality/health percentage (0-100) to render a progress ring around the section icon. */
  health?: number;
}

/**
 * CompactSectionHero — the canonical hero band for every MyCountry gameplay
 * section. A single branded row with a blurred flag backdrop, section identity,
 * inline key stats and status badges. Richer than a plain bar, lighter than the
 * full flag hero used on the Overview/home page.
 */
export const CompactSectionHero = React.memo(function CompactSectionHero({
  section,
  title,
  subtitle,
  icon: Icon,
  countryName,
  flagUrl,
  stats,
  statusBadges,
  actions,
  className,
  health,
}: CompactSectionHeroProps) {
  const accent = accentForSection(section);
  const a = ACCENT_CLASSES[accent];
  const gradient = ICON_GRADIENTS[accent] ?? ICON_GRADIENTS.neutral;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn("relative overflow-hidden rounded-xl border", a.border, className)}
    >
      {/* Backdrop — blurred flag, or a themed accent wash as fallback */}
      {flagUrl ? (
        <div aria-hidden="true" className="absolute inset-0">
          <img
            src={flagUrl}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-70 blur-[16px] saturate-150"
            loading="eager"
          />
          <div className="from-card/90 via-card/75 to-card/55 absolute inset-0 bg-gradient-to-r" />
        </div>
      ) : (
        <div aria-hidden="true" className={cn("bg-card absolute inset-0")}>
          <div className={cn("absolute inset-0 bg-gradient-to-br", a.tint)} />
        </div>
      )}

      {/* Content */}
      <div className="relative flex items-center gap-3 px-4 py-3.5">
        {health !== undefined ? (
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center transition-all duration-200">
              <HealthRing value={health} size={48} color={sectionColor(section)} hideValue={true} />
            </div>
            <div
              className={cn(
                "relative z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br p-1.5 shadow-sm",
                gradient
              )}
            >
              <Icon size={16} className="text-white" />
            </div>
          </div>
        ) : (
          <div className={cn("shrink-0 rounded-xl bg-gradient-to-br p-2.5 shadow-sm", gradient)}>
            <Icon size={22} className="text-white" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
            {countryName && (
              <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                · {countryName}
              </span>
            )}
          </div>
          {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
        </div>

        {/* Inline key stats (desktop) */}
        {stats && stats.length > 0 && (
          <div className="hidden items-center gap-4 md:flex">
            {stats.map((s) => (
              <div key={s.label} className="text-right">
                <div className={cn("text-base leading-none font-bold", s.accentText && a.text)}>
                  {s.value}
                </div>
                <div className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {statusBadges && statusBadges.length > 0 && (
          <div className="hidden items-center gap-1.5 sm:flex">
            {statusBadges.map((b, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn("bg-card/60 px-1.5 py-0 text-[0.65rem]", b.colorClass)}
              >
                <b.icon className="mr-1 h-2.5 w-2.5" />
                {b.count}
              </Badge>
            ))}
          </div>
        )}

        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </motion.div>
  );
});
