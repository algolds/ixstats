"use client";

import React from "react";
import { Lock } from "iconoir-react";
import { cn } from "~/lib/utils";

/**
 * The achievement's icon, in the colour of the pedestal it sits on. Unearned: a crisp muted icon
 * paired with a lock glyph (never blurred).
 */
export function AchievementIcon({
  icon: Icon,
  isUnlocked,
  className = "size-7",
}: {
  icon: React.ComponentType<{ className?: string }>;
  isUnlocked: boolean;
  className?: string;
}) {
  if (!isUnlocked) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <Icon aria-hidden className="size-5 opacity-20" />
        <Lock role="img" aria-label="Locked" className="text-label-secondary absolute size-4" />
      </div>
    );
  }

  return <Icon aria-hidden className={cn(className, "drop-shadow-sm")} />;
}
