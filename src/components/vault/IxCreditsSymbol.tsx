"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { BNB_GLYPH } from "~/lib/navigation/icons/VaultLogomark";

interface IxCreditsSymbolProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
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
 * The IxCredits (IXC) currency symbol: the BNB glyph the owner picked, the same one the Vault app
 * mark cuts out of its card. Drawn bare in `currentColor` so it sits flush beside a figure.
 *
 * Accessible name: "IxCredits" (`role="img"`) unless `decorative` (or `aria-hidden`).
 */
export function IxCreditsSymbol({
  className,
  size = "1em",
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
      viewBox={BNB_GLYPH.viewBox}
      fill="currentColor"
      className={cn("inline-block align-middle select-none", className)}
      {...props}
    >
      <path d={BNB_GLYPH.path} />
    </svg>
  );
}
