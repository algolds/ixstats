"use client";

import { useRouter } from "next/navigation";
import { Crown, Globe, Shield, Xmark as X, Hammer as Gavel } from "iconoir-react";
import { navigateWithBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { PreText } from "~/components/ui/pretext";
import { motion } from "motion/react";
import type { DIViewProps } from "~/components/halo/types";
import { soundCues } from "~/lib/sound/cuelume";
import { springSnappy } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

export function MyCountryActionsView({ onClose }: DIViewProps) {
  const router = useRouter();

  const navigateToSection = (section: string) => {
    onClose();
    navigateWithBasePath(section === "overview" ? "/mycountry" : `/mycountry/${section}`, router);
  };

  const quickActions = [
    {
      label: "Diplomacy",
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
      <div className="mb-4 flex items-center justify-between">
        <div className="text-headline text-yellow flex items-center gap-2">
          <Crown className="h-4 w-4" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            MyCountry quick actions
          </PreText>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            soundCues.dismiss();
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
