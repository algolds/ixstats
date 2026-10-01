"use client";

import React, { memo } from "react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

export interface IxnayPassportSealProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "h-9 w-9 rounded-row p-1",
  },
  md: {
    container: "h-11 w-11 rounded-card p-2",
  },
  lg: {
    container: "h-14 w-14 rounded-card p-2",
  },
};

/**
 * IxnayPassportSeal: the Ixnay emblem on a faint fill medallion (decorative).
 */
export const IxnayPassportSeal = memo(function IxnayPassportSeal({
  size = "md",
  className,
}: IxnayPassportSealProps) {
  const config = sizeConfig[size] || sizeConfig.md;
  const logoUrl = withBasePath("/images/ix-logo.svg");

  return (
    <div
      className={cn(
        // v2 medallion: a faint fill with an inset (pressed-in) shadow; the emblem grows on hover.
        "group/seal bg-fill-4 border-separator relative flex shrink-0 items-center justify-center overflow-hidden border shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)] select-none",
        config.container,
        className
      )}
      aria-hidden="true"
    >
      {/* Official Ixnay emblem (original colours) */}
      <img
        src={logoUrl}
        alt=""
        className="ease-out-facet h-full w-full object-contain transition-[scale] duration-200 select-none group-hover/seal:scale-105 motion-reduce:transition-none motion-reduce:group-hover/seal:scale-100"
      />
    </div>
  );
});
