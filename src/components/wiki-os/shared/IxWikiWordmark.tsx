"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface IxWikiWordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "hero";
  highlightIx?: boolean;
}

export function IxWikiWordmark({
  className,
  size = "xl",
  highlightIx = false,
  ...props
}: IxWikiWordmarkProps) {
  const sizeClasses = {
    sm: "text-body",
    md: "text-title-3",
    lg: "text-title-1",
    xl: "text-large-title sm:text-large-title",
    "2xl": "text-large-title sm:text-large-title lg:text-[50px] tracking-[-0.02em]",
    "3xl": "text-large-title sm:text-large-title lg:text-7xl tracking-[-0.03em]",
    hero: "text-large-title sm:text-large-title lg:text-[64px] tracking-[-0.03em]",
  };

  return (
    <span
      className={cn(
        "text-label inline-flex items-baseline font-['SangBleu_Empire',serif] font-semibold subpixel-antialiased select-none",
        sizeClasses[size],
        className
      )}
      style={{
        fontFamily: 'var(--font-sangbleu-empire), "SangBleu Empire", "SangBleu", Georgia, serif',
      }}
      {...props}
    >
      {highlightIx ? (
        <>
          <span className="text-tint">Ix</span>
          <span className="text-label">Wiki</span>
        </>
      ) : (
        "IxWiki"
      )}
    </span>
  );
}
