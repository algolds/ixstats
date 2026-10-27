"use client";

import React, { memo } from "react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

interface IxnayPassportSealProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "size-9 rounded-row p-1",
  },
  md: {
    container: "size-11 rounded-card p-2",
  },
  lg: {
    container: "size-14 rounded-card p-2",
  },
};

/**
 * IxnayPassportSeal: the Ixnay emblem on a faint fill (decorative).
 */
export const IxnayPassportSeal = memo(function IxnayPassportSeal({
  size = "md",
  className,
}: IxnayPassportSealProps) {
  const config = sizeConfig[size];
  const logoUrl = withBasePath("/images/ix-logo.svg");

  return (
    <div
      className={cn(
        "bg-fill-4 border-separator relative flex shrink-0 items-center justify-center overflow-hidden border select-none",
        config.container,
        className
      )}
      aria-hidden="true"
    >
      <img src={logoUrl} alt="" className="size-full object-contain select-none" />
    </div>
  );
});
