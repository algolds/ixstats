"use client";

import React, { useCallback } from "react";
import {
  Crown,
  Suitcase as Briefcase,
  Globe,
  Shield,
  Xmark as X,
  Hammer as Gavel,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { createAbsoluteUrl, cn } from "~/lib/utils";
import { PreText } from "~/components/ui/pretext";
import { motion } from "motion/react";
import type { DIViewProps } from "~/components/halo/types";
import { soundEffects } from "~/lib/sound/cuelume";

export function MyCountryActionsView({ onClose }: DIViewProps) {
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
    `flex w-full items-center justify-start gap-2.5 rounded-row border border-separator bg-fill-4 px-3.5 py-3 text-caption font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 hover:scale-[1.02] active:scale-[0.98] ${colors}`;

  const quickActions = [
    {
      label: "Meetings",
      icon: Briefcase,
      colors: "border-yellow/20 bg-yellow/5 text-yellow hover:bg-yellow/15",
      action: () => navigateToSection("executive"),
    },
    {
      label: "Embassies",
      icon: Globe,
      colors: "border-teal/20 bg-teal/5 text-teal hover:bg-teal/15",
      action: () => navigateToSection("diplomacy"),
    },
    {
      label: "Foreign Policy",
      icon: Globe,
      colors: "border-teal/20 bg-teal/5 text-teal hover:bg-teal/15",
      action: () => navigateToSection("diplomacy"),
    },
    {
      label: "Domestic Policy",
      icon: Gavel,
      colors: "border-indigo/20 bg-indigo/5 text-indigo hover:bg-indigo/15",
      action: () => navigateToSection("executive"),
    },
    {
      label: "Operations",
      icon: Shield,
      colors: "border-red/20 bg-red/5 text-red hover:bg-red/15",
      action: () => navigateToSection("defense"),
      isPremium: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className="flex w-full flex-col p-4 text-left"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-headline text-yellow flex items-center gap-2">
          <Crown className="h-4 w-4" />
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
          className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control flex h-7 w-7 items-center justify-center transition-colors"
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
                <span className="rounded-control-sm border-yellow/20 bg-yellow/10 text-caption text-yellow flex shrink-0 items-center gap-1 border px-1.5 py-0.5">
                  <Crown className="text-yellow h-2.5 w-2.5" />
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

// Backwards compatibility alias
export const MyCountryCommandPalette = MyCountryActionsView;
