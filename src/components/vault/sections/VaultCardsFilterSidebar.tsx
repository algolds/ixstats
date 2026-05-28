"use client";

import { type ReactNode } from "react";
import { cn } from "~/lib/utils";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

interface VaultCardsFilterSidebarProps {
  children: ReactNode;
}

export function VaultCardsFilterSidebar({ children }: VaultCardsFilterSidebarProps) {
  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-64 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      <CutoutCardContent className="space-y-4 p-3">{children}</CutoutCardContent>
    </CutoutCard>
  );
}
