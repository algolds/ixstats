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
    sm: "text-base tracking-normal",
    md: "text-lg tracking-normal",
    lg: "text-2xl tracking-tight",
    xl: "text-3xl sm:text-4xl tracking-tight leading-none",
    "2xl": "text-4xl sm:text-5xl lg:text-[50px] tracking-[-0.02em] leading-none",
    "3xl": "text-5xl sm:text-6xl lg:text-7xl tracking-[-0.03em] leading-none",
    hero: "text-5xl sm:text-6xl lg:text-[64px] tracking-[-0.03em] leading-none",
  };

  return (
    <span
      className={cn(
        "text-foreground inline-flex items-baseline font-['SangBleu_Empire',serif] font-bold subpixel-antialiased select-none",
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
          <span className="text-blue-500 dark:text-blue-400">Ix</span>
          <span className="text-foreground">Wiki</span>
        </>
      ) : (
        "IxWiki"
      )}
    </span>
  );
}
