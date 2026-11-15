"use client";

import { useRouter } from "next/navigation";
import { Crown } from "iconoir-react";
import { navigateWithBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { motion } from "motion/react";
import type { DIViewProps } from "~/components/halo/types";
import { getCountryActions } from "~/components/halo/country-actions";
import { soundCues } from "~/lib/sound/cuelume";
import { springSnappy } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { HaloViewHeader } from "~/components/halo/views/shared/HaloViewParts";

const QUICK_ACTIONS = getCountryActions(["diplomacy", "executive", "defense"]);

export function MyCountryActionsView({ onClose }: DIViewProps) {
  const router = useRouter();

  const handleAction = (path: string) => {
    onClose();
    navigateWithBasePath(path, router);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={springSnappy}
      className="flex w-full flex-col p-4 text-left"
    >
      <HaloViewHeader
        className="mb-4"
        leading={<Crown className="text-yellow h-4 w-4 shrink-0" />}
        title="MyCountry quick actions"
        onClose={() => {
          soundCues.dismiss();
          onClose();
        }}
      />

      {/* Grid list */}
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === QUICK_ACTIONS.length - 1;
          return (
            <Button
              key={item.id}
              type="button"
              variant="secondary"
              onClick={() => handleAction(item.path)}
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
