"use client";

import { cn } from "~/lib/utils";

interface ThinkPagesIconProps {
  size?: number;
  className?: string;
}

/**
 * ThinkPages brand mark — a thought-bubble with a "T" letterform.
 * Renders as an inline SVG so it works at any size and respects theme colors.
 */
export function ThinkPagesIcon({ size = 20, className }: ThinkPagesIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Thought bubble */}
      <path
        d="M12 2C6.48 2 2 5.58 2 10c0 2.52 1.56 4.76 4 6.2V20l3.2-1.8c.9.2 1.84.3 2.8.3 5.52 0 10-3.58 10-8S17.52 2 12 2Z"
        className="fill-foreground/10 stroke-foreground/70"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* T letterform */}
      <path
        d="M8.5 8.5H15.5M12 8.5V16"
        className="stroke-foreground/90"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
