"use client";

import React from "react";
import { motion } from "motion/react";
import { Star, Trophy as Award } from "iconoir-react";
import { api } from "~/trpc/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

/**
 * A ribbon is an unlocked achievement (`UserAchievement`) worn as a service ribbon: the stripe comes
 * from the achievement's category, the star device from its rarity.
 */
export interface RibbonView {
  key: string;
  title: string;
  description?: string | null;
  category: string;
  rarity: string;
  unlockedAt?: string | null;
  pinned?: boolean;
}

/** Stripe gradient per achievement category. */
const RIBBON_STRIPES: Record<string, string> = {
  Economic: "from-emerald-700 via-emerald-300 to-emerald-700",
  Military: "from-red-800 via-red-400 to-red-800",
  Diplomatic: "from-cyan-700 via-sky-300 to-cyan-700",
  Government: "from-indigo-800 via-indigo-400 to-indigo-800",
  Social: "from-blue-700 via-blue-300 to-blue-700",
  General: "from-amber-700 via-yellow-300 to-amber-700",
};

/** Star device colour per rarity: bronze, silver, gold, then a bright platinum star. */
const RIBBON_DEVICES: Record<string, string> = {
  Common: "fill-orange-400 text-orange-400",
  Uncommon: "fill-slate-200 text-slate-200",
  Rare: "fill-amber-300 text-amber-300",
  Epic: "fill-amber-200 text-amber-200",
  Legendary: "fill-white text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]",
};

export function ribbonStripe(category: string): string {
  return RIBBON_STRIPES[category] ?? RIBBON_STRIPES.General!;
}

export function ribbonDevice(rarity: string): string {
  return RIBBON_DEVICES[rarity] ?? RIBBON_DEVICES.Common!;
}

interface RibbonBarProps {
  ribbon: RibbonView;
  size?: "sm" | "md";
}

/** One ribbon bar with its tooltip (title, category, rarity and unlock date). */
export function RibbonBar({ ribbon, size = "sm" }: RibbonBarProps) {
  const unlocked = ribbon.unlockedAt
    ? new Date(ribbon.unlockedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.18, y: -2 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="group/ribbon relative flex cursor-pointer flex-col items-center"
          aria-label={`${ribbon.title} ribbon (${ribbon.rarity})`}
          role="img"
        >
          <div
            className={cn(
              "border-border/60 relative flex items-center justify-center overflow-hidden rounded-xs border bg-gradient-to-b shadow-md transition-[border-color,box-shadow] duration-150 group-hover/ribbon:border-amber-400 group-hover/ribbon:shadow-[0_0_12px_rgba(251,191,36,0.4)]",
              size === "sm" ? "h-5 w-4" : "h-7 w-10",
              ribbonStripe(ribbon.category)
            )}
          >
            <div className="absolute inset-x-0 top-0 z-20 h-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-95" />
            <div className="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,rgba(0,0,0,0.25)_1px,rgba(0,0,0,0.25)_2px)]" />
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-white/35 via-transparent to-black/45" />
            <Star
              className={cn(
                "relative z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform duration-150 group-hover/ribbon:scale-110",
                size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
                ribbonDevice(ribbon.rarity)
              )}
            />
            <div className="absolute inset-x-0 bottom-0 z-20 h-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-95" />
          </div>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        sideOffset={8}
        className="bg-popover/95 text-popover-foreground z-[100] max-w-xs rounded-xl border border-amber-500/30 p-3 text-xs shadow-2xl backdrop-blur-2xl dark:border-amber-400/35"
      >
        <div className="border-border/60 mb-1.5 flex items-center gap-2 border-b pb-1.5">
          <Award className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
          <span className="text-xs font-extrabold tracking-wider text-amber-600 uppercase dark:text-amber-400">
            {ribbon.title}
          </span>
        </div>
        {ribbon.description && (
          <p className="text-muted-foreground mb-1.5 text-xs leading-snug font-medium">
            {ribbon.description}
          </p>
        )}
        <div className="border-border/50 flex items-center justify-between gap-3 border-t pt-1 text-xs">
          <span className="text-muted-foreground font-medium">
            {ribbon.category}
            {unlocked ? ` · ${unlocked}` : ""}
          </span>
          <span className="rounded-xs border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono font-semibold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            {ribbon.rarity}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface FloatingRibbonRackProps {
  ribbons?: ReadonlyArray<RibbonView>;
  /** How many ribbons to show at most. */
  max?: number;
  /** Every ribbon the holder has; when larger than what is shown, a "+N" counter follows. */
  total?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** A compact rack of real ribbons. Renders nothing when there are none. */
export function FloatingRibbonRack({
  ribbons = [],
  max = 3,
  total,
  className,
  style,
}: FloatingRibbonRackProps) {
  const shown = ribbons.slice(0, max);
  if (shown.length === 0) return null;
  const more = Math.max(0, (total ?? ribbons.length) - shown.length);

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "inline-flex items-center gap-1.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] select-none",
          className
        )}
        style={style}
        data-testid="ribbon-rack"
      >
        {shown.map((ribbon) => (
          <RibbonBar key={ribbon.key} ribbon={ribbon} />
        ))}
        {more > 0 && (
          <span className="rounded-xs bg-black/45 px-1 font-mono text-xs font-bold text-white">
            +{more}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

/** The country page's rack: the owning user's top ribbons, or nothing. */
export function CountryOwnerRibbonRack({
  countrySlug,
}: {
  countrySlug: string | null | undefined;
}) {
  const { data } = api.ixnayid.getCountryRibbons.useQuery(
    { countrySlug: countrySlug ?? "" },
    { enabled: Boolean(countrySlug), staleTime: 5 * 60 * 1000 }
  );
  if (!data) return null;
  return <FloatingRibbonRack ribbons={data.ribbons} total={data.total} />;
}
