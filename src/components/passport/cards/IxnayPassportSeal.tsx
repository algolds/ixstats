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
    container: "h-9 w-9 rounded-xl p-1",
  },
  md: {
    container: "h-11 w-11 rounded-2xl p-1.5",
  },
  lg: {
    container: "h-14 w-14 rounded-3xl p-2",
  },
};

/**
 * IxnayPassportSeal (/apple-design)
 * 
 * Official Ixnay sovereign passport seal medallion.
 * Built with Apple design restraint: precision frosted glass, micro-specular rim highlight,
 * and zero distortion filters.
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
        "group relative flex shrink-0 items-center justify-center select-none overflow-hidden",
        "border border-black/[0.08] dark:border-white/[0.12]",
        "bg-black/[0.03] dark:bg-white/[0.06] backdrop-blur-md",
        "shd-vault-recess",
        "transition-transform duration-150 ease-out active:scale-[0.96]",
        config.container,
        className
      )}
      aria-hidden="true"
    >
      {/* Official Crisp Ixnay Emblem (Original Colors & Zero Distortion) */}
      <img
        src={logoUrl}
        alt="Ixnay"
        className="h-full w-full object-contain select-none transition-transform duration-200 ease-out group-hover:scale-105 filter dark:brightness-110"
      />
    </div>
  );
});
