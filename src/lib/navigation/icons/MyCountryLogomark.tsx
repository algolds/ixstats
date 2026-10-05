import type { SVGProps } from "react";
import { cn } from "~/lib/utils/cn";

/**
 * The MyCountry mark (a globe wearing a crown), the single source of the SVG. It lives in
 * `src/lib` so the navigation map (which must not import from components) can use it as the
 * MyCountry app icon; `mycountry-logo.tsx` re-exports it. Drawn in `currentColor` so the sidebar's
 * `text-tint` role colours it gold. Sized by its container like any icon (`size-*`).
 */
export function MyCountryLogomark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="MyCountry mark"
      role="img"
      className={cn("size-[1em] shrink-0", className)}
      {...props}
    >
      <circle cx="10.5" cy="13.5" r="8" />
      <ellipse cx="10.5" cy="13.5" rx="3.5" ry="8" />
      <path d="M2.5 13.5h16" />
      <path d="M15 8.5l.8-4.6 2.2 2.1 2.2-2.1.8 4.6z" fill="currentColor" />
    </svg>
  );
}
