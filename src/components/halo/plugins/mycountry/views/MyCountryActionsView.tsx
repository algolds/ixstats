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
import { springSnappy } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

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

  const quickActions = [
    {
      label: "Meetings",
      icon: Briefcase,
      iconClass: "text-yellow",
      action: () => navigateToSection("executive"),
    },
    {
      label: "Embassies",
      icon: Globe,
      iconClass: "text-teal",
      action: () => navigateToSection("diplomacy"),
    },
    {
      label: "Foreign policy",
      icon: Globe,
      iconClass: "text-teal",
      action: () => navigateToSection("diplomacy"),
    },
    {
      label: "Domestic policy",
      icon: Gavel,
      iconClass: "text-indigo",
      action: () => navigateToSection("executive"),
    },
    {
      label: "Operations",
      icon: Shield,
      iconClass: "text-red",
      action: () => navigateToSection("defense"),
      isPremium: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={springSnappy}
      className="flex w-full flex-col p-4 text-left"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-headline text-yellow flex items-center gap-2">
          <Crown className="h-4 w-4" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            MyCountry® Quick actions
          </PreText>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            soundEffects.droplet();
            onClose();
          }}
          className="text-label-secondary hover:text-label"
          aria-label="Close quick actions"
        >
          <X aria-hidden />
        </Button>
      </div>

      {/* Grid list */}
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === quickActions.length - 1;
          return (
            <Button
              key={idx}
              type="button"
              variant="secondary"
              onClick={item.action}
              className={cn("w-full justify-start", isLast && "col-span-2")}
            >
              <Icon aria-hidden className={item.iconClass} />
              <span className="flex-1 truncate text-left">{item.label}</span>
              {item.isPremium && (
                <Badge variant="warning">
                  <Crown aria-hidden />
                  Premium
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </motion.div>
  );
}

// Backwards compatibility alias
export const MyCountryCommandPalette = MyCountryActionsView;
