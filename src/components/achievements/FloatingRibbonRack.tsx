"use client";

import React from "react";
import { motion } from "motion/react";
import { Star, Trophy as Award } from "iconoir-react";
import { api } from "~/trpc/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { springSnappy } from "~/lib/design/motion";

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

/** Stripe colour per achievement category (system colours). */
const RIBBON_STRIPES: Record<string, string> = {
  Economic: "bg-green",
  Military: "bg-red",
  Diplomatic: "bg-teal",
  Government: "bg-indigo",
  Social: "bg-blue",
  General: "bg-yellow",
};

/** Star device colour per rarity: bronze, silver, gold, then a bright platinum star. */
const RIBBON_DEVICES: Record<string, string> = {
  Common: "fill-orange text-orange",
  Uncommon: "fill-label-secondary text-label-tertiary",
  Rare: "fill-yellow text-yellow",
  Epic: "fill-yellow text-yellow",
  Legendary: "fill-white text-white",
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
          whileHover={{ y: -2 }}
          transition={springSnappy}
          className="group/ribbon relative flex cursor-default flex-col items-center"
          aria-label={`${ribbon.title} ribbon (${ribbon.rarity})`}
          role="img"
        >
          {/* Ribbon artwork: category stripe, woven texture, gold edges and the rarity device. */}
          <div
            className={cn(
              "border-separator shadow-card relative isolate flex items-center justify-center overflow-hidden rounded-xs border",
              size === "sm" ? "h-5 w-4" : "h-7 w-10",
              ribbonStripe(ribbon.category)
            )}
          >
            <div className="bg-yellow absolute inset-x-0 top-0 h-px" />
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,rgba(0,0,0,0.25)_1px,rgba(0,0,0,0.25)_2px)]" />
            <Star
              aria-hidden
              className={cn(
                "relative",
                size === "sm" ? "size-2.5" : "size-3.5",
                ribbonDevice(ribbon.rarity)
              )}
            />
            <div className="bg-yellow absolute inset-x-0 bottom-0 h-px" />
          </div>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" sideOffset={8} className="max-w-xs p-3">
        <div className="border-separator mb-2 flex items-center gap-2 border-b pb-2">
          <Award aria-hidden className="text-label-secondary size-3.5 shrink-0" />
          <span className="text-headline text-label">{ribbon.title}</span>
        </div>
        {ribbon.description && (
          <p className="text-label-secondary text-footnote mb-2">{ribbon.description}</p>
        )}
        <div className="text-footnote flex items-center justify-between gap-3">
          <span className="text-label-secondary">
            {ribbon.category}
            {unlocked ? ` · ${unlocked}` : ""}
          </span>
          <Badge variant="warning">{ribbon.rarity}</Badge>
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
        className={cn("inline-flex items-center gap-2 select-none", className)}
        style={style}
        data-testid="ribbon-rack"
      >
        {shown.map((ribbon) => (
          <RibbonBar key={ribbon.key} ribbon={ribbon} />
        ))}
        {more > 0 && (
          <span className="bg-fill-2 text-label text-caption rounded-xs px-1 tabular-nums">
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
