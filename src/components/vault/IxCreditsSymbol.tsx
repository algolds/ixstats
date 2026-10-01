"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface IxCreditsSymbolProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: "ic" | "double-slash";
  /**
   * Hide the symbol from assistive technology. By default it is the unit of the figure next to
   * it (`role="img"`, `aria-label="IxCredits"`), so "1,250" is announced as "IxCredits 1,250".
   * Pass `decorative` when a visible unit label already names the currency ("IxCredits",
   * "IxC") or the symbol is pure ornament, so it is not announced twice. An explicit
   * `aria-hidden` does the same.
   */
  decorative?: boolean;
}

/**
 * Custom currency symbol component for IxCredits (IXC)
 * Supports multiple premium vector currency glyph variants:
 * - "ic" (Default): Stylized capital 'I' wrapped by a 'C' curve in the center.
 * - "double-slash": Stylized 'C' curve intersected by double vertical strokes.
 *
 * Optimized with a tight 13:20 aspect ratio viewBox to remove horizontal padding
 * and sit flush next to numeric text values.
 *
 * Accessible name: "IxCredits" (`role="img"`) unless `decorative` (or `aria-hidden`).
 */
export function IxCreditsSymbol({
  className,
  size = "1em",
  variant = "ic",
  decorative = false,
  ...props
}: IxCreditsSymbolProps) {
  const hidden = decorative || props["aria-hidden"] === true || props["aria-hidden"] === "true";
  const a11y = hidden
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": "IxCredits" } as const);
  return (
    <svg
      {...a11y}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="3.5 0.5 16 23"
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
