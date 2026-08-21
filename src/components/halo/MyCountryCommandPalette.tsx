"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Crown, Briefcase, Globe, Shield, X, Gavel } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { createAbsoluteUrl } from "~/lib/utils";
import { cn } from "~/lib/utils";
import { PreText } from "~/components/ui/pretext";
import { motion } from "motion/react";
import type { DIViewProps } from "./types";
import { soundEffects } from "~/lib/sound/cuelume";

export function MyCountryCommandPalette({ onClose }: DIViewProps) {
  const router = useRouter();

  React.useEffect(() => {
    soundEffects.scan();
  }, []);

  const navigateToSection = useCallback(
    (section: string) => {
      onClose();
      const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
      if (typeof window !== "undefined" && window.location.pathname.includes("/mycountry")) {
        window.history.pushState(null, "", withBasePath(href));
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        window.location.href = createAbsoluteUrl(href);
      }
    },
    [onClose]
  );

  const actionButtonClass = (colors: string) =>
    `flex w-full items-center justify-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3 text-xs font-semibold backdrop-blur-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${colors}`;

  // 1. Quick Actions items
  const quickActions = [
    {
      label: "Meetings",
      icon: Briefcase,
      colors:
        "border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 text-purple-400 hover:from-purple-500/15 hover:to-indigo-500/15",
      action: () => navigateToSection("executive"),
    },
    {
      label: "Embassies",
      icon: Globe,
      colors:
        "border-teal-500/20 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 text-teal-400 hover:from-teal-500/15 hover:to-emerald-500/15",
      action: () => navigateToSection("diplomacy"),
    },
    {
      label: "Foreign Policy",
      icon: Globe,
      colors:
        "border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 text-cyan-400 hover:from-cyan-500/15 hover:to-blue-500/15",
      action: () => navigateToSection("diplomacy"),
    },
    {
      label: "Domestic Policy",
      icon: Gavel,
      colors:
        "border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-amber-500/5 text-orange-400 hover:from-orange-500/15 hover:to-amber-500/15",
      action: () => navigateToSection("executive"),
    },
    {
      label: "Operations",
      icon: Shield,
      colors:
        "border-red-500/20 bg-gradient-to-r from-red-500/5 to-rose-500/5 text-red-400 hover:from-red-500/15 hover:to-rose-500/15",
      action: () => navigateToSection("defense"),
      isPremium: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex w-full flex-col p-4 text-left"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]">
          <Crown className="h-4 w-4 animate-pulse" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            MyCountry® Quick Actions
          </PreText>
        </div>
        <button
          onClick={() => {
            soundEffects.droplet();
            onClose();
          }}
          data-cuelume-press="droplet"
          className="text-muted-foreground hover:text-foreground hover:bg-accent/15 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          aria-label="Close Quick Actions"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid list */}
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === quickActions.length - 1;
          return (
            <button
              key={idx}
              data-cuelume-hover="tick"
              data-cuelume-press="press"
              onClick={item.action}
              className={cn(actionButtonClass(item.colors), isLast && "col-span-2")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">{item.label}</span>
              {item.isPremium && (
                <span className="flex shrink-0 items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-500 uppercase shadow-[0_0_8px_rgba(245,158,11,0.05)]">
                  <Crown className="h-2.5 w-2.5 text-amber-400" />
                  Premium
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
