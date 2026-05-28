"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface IxCreditsSymbolProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: "ic" | "double-slash";
}

/**
 * Custom currency symbol component for IxCredits (IXC)
 * Supports multiple premium vector currency glyph variants:
 * - "ic" (Default): Stylized capital 'I' wrapped by a 'C' curve in the center.
 * - "double-slash": Stylized 'C' curve intersected by double vertical strokes.
 *
 * Optimized with a tight 13:20 aspect ratio viewBox to remove horizontal padding
 * and sit flush next to numeric text values.
 */
export function IxCreditsSymbol({
  className,
  size = "1em",
  variant = "ic",
  ...props
}: IxCreditsSymbolProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="5 2 13 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block align-middle select-none", className)}
      {...props}
    >
      {variant === "ic" ? (
        <>
          {/* Central vertical stem of I */}
          <line x1="12" y1="3" x2="12" y2="21" />
          {/* Top serif bar */}
          <line x1="7" y1="3" x2="17" y2="3" />
          {/* Bottom serif bar */}
          <line x1="7" y1="21" x2="17" y2="21" />
          {/* Center wrapping C arc */}
          <path d="M 16 7 A 6.5 6.5 0 1 0 16 17" />
        </>
      ) : (
        <>
          {/* Circular C curve */}
          <path d="M 16 7 A 6.5 6.5 0 1 0 16 17" />
          {/* Double slanted vertical slashes */}
          <line x1="8.5" y1="2" x2="11.5" y2="22" />
          <line x1="11.5" y1="2" x2="14.5" y2="22" />
        </>
      )}
    </svg>
  );
}
