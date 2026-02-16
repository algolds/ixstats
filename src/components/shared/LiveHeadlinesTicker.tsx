"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  Rss,
  Handshake,
  Newspaper,
  Radio,
  AlertTriangle,
  Shield,
  Landmark,
  Trophy,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { Marquee } from "~/components/ui/marquee";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

// ── Category → icon/color mapping for server-generated headlines ──
const HEADLINE_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  economic:    { icon: TrendingUp,    color: "text-green-400" },
  crisis:      { icon: AlertTriangle, color: "text-red-400" },
  diplomatic:  { icon: Handshake,     color: "text-cyan-400" },
  military:    { icon: Shield,        color: "text-orange-400" },
  social:      { icon: Rss,           color: "text-blue-400" },
  political:   { icon: Landmark,      color: "text-purple-400" },
  achievement: { icon: Trophy,        color: "text-yellow-400" },
  wiki:        { icon: BookOpen,      color: "text-teal-400" },
  forum:       { icon: MessageCircle, color: "text-indigo-400" },
};

type TickerHeadline = {
  id: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  priority: string;
  url?: string;
};

/**
 * Self-contained live headlines ticker.
 * Fetches from `activities.getGlobalHeadlines` and renders a scrolling marquee.
 * Drop into any page — no props required.
 */
export function LiveHeadlinesTicker({ limit = 30, className }: { limit?: number; className?: string }) {
  const { data: headlineData } = api.activities.getGlobalHeadlines.useQuery(
    { limit },
    { refetchInterval: 90_000 },
  );

  const headlines = useMemo((): TickerHeadline[] => {
    if (!headlineData?.headlines?.length) return [];
    return headlineData.headlines.map((h: any) => {
      const style = HEADLINE_STYLE[h.category] ?? { icon: Newspaper, color: "text-slate-400" };
      return { id: h.id, text: h.text, icon: style.icon, color: style.color, priority: h.priority, url: h.url };
    });
  }, [headlineData]);

  if (headlines.length === 0) return null;

  return <TickerBar headlines={headlines} className={className} />;
}

// ── Visual ticker bar ──
const TickerBar = React.memo(function TickerBar({
  headlines,
  className,
}: {
  headlines: TickerHeadline[];
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;
    const animatedEls = el.querySelectorAll<HTMLElement>("[style*='animation']");
    animatedEls.forEach((child) => {
      child.style.animationPlayState = paused ? "paused" : "running";
    });
  }, [paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.08 }}
      className={cn("glass-hierarchy-child relative overflow-hidden rounded-xl border border-white/10", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center">
        {/* LIVE badge */}
        <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-white/10 bg-red-500/10 px-3 py-2.5">
          <Radio className="h-3 w-3 text-red-400" />
          <span className="text-[0.65rem] font-bold tracking-wider text-red-400">LIVE</span>
          <div className={cn("h-1.5 w-1.5 rounded-full bg-red-400", !paused && "animate-pulse")} />
        </div>

        {/* Scrolling headlines */}
        <div ref={marqueeRef} className="min-w-0 flex-1 overflow-hidden">
          <Marquee speed={80} pauseOnHover={false} gap="3rem" autoFill={true} fade={true} className="py-2">
            {headlines.map((headline) => {
              const Icon = headline.icon;
              const isCritical = headline.priority === "critical";
              const isHigh = headline.priority === "high";
              const inner = (
                <div className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap px-1",
                  isCritical && "font-semibold",
                  headline.url ? "cursor-pointer hover:opacity-80" : "cursor-default",
                )}>
                  {isCritical && (
                    <span className="rounded bg-red-500/20 px-1 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-red-400">Breaking</span>
                  )}
                  {isHigh && !isCritical && (
                    <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-amber-400">Alert</span>
                  )}
                  <Icon className={cn("h-3 w-3 shrink-0", headline.color)} />
                  <span className={cn(
                    "max-w-[320px] truncate text-xs font-medium sm:max-w-none",
                    isCritical ? "text-red-300" : "text-foreground/80",
                  )}>
                    {headline.text}
                  </span>
                  <span className="text-muted-foreground/40 shrink-0 select-none">|</span>
                </div>
              );
              return (
                <Tooltip key={headline.id}>
                  <TooltipTrigger asChild>
                    {headline.url ? (
                      <a href={headline.url} target="_blank" rel="noopener noreferrer">
                        {inner}
                      </a>
                    ) : inner}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8} className="max-w-xs">
                    <div className="flex items-start gap-2">
                      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", headline.color)} />
                      <p className="text-sm leading-relaxed">{headline.text}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </Marquee>
        </div>
      </div>
    </motion.div>
  );
});
