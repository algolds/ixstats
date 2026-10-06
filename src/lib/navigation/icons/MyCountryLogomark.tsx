import type { SVGProps } from "react";
import { cn } from "~/lib/utils/cn";

/** iconoir's Globe, the globe of the MyCountry logo (`MyCountryLogo`). */
const GLOBE_PATHS = [
  "M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z",
  "M2.5 12.5L8 14.5L7 18L8 21",
  "M17 20.5L16.5 18L14 17V13.5L17 12.5L21.5 13",
  "M19 5.5L18.5 7L15 7.5V10.5L17.5 9.5H19.5L21.5 10.5",
  "M2.5 10.5L5 8.5L7.5 8L9.5 5L8.5 3",
];

/** iconoir's Crown, the crown badge of the logo. */
const CROWN_PATH = "M19.2 17L21 7L14.7 10L12 7L9.3 10L3 7L4.8 17H19.2Z";

/** The crown badge: a disc at the top right, as the logo's crown sits over the globe's corner. */
const BADGE = { cx: 18.25, cy: 5.75, r: 5.25 } as const;

/**
 * The MyCountry mark: the logo's globe with its crown badge (`MyCountryLogo`), drawn in one colour so the
 * sidebar's `text-tint` role colours it gold like every app icon. The crown is cut out of a solid disc, and the
 * globe's lines stop short of the disc so the badge reads at 16 px. It lives in `src/lib` so the navigation map
 * (which must not import from components) can use it. Decorative by default (the app row carries the label);
 * sized by its container like any icon (`size-*`). The mask ids are fixed: every instance draws the same masks.
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
      aria-hidden="true"
      className={cn("size-[1em] shrink-0", className)}
      {...props}
    >
      <defs>
        <mask id="mycountry-mark-globe" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" stroke="none" />
          <circle cx={BADGE.cx} cy={BADGE.cy} r={BADGE.r + 2} fill="black" stroke="none" />
        </mask>
        <mask id="mycountry-mark-crown" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" stroke="none" />
          <path
            d={CROWN_PATH}
            fill="black"
            stroke="black"
            strokeWidth={2}
            transform={`translate(${BADGE.cx} ${BADGE.cy}) scale(0.38) translate(-12 -12)`}
          />
        </mask>
      </defs>
      <g mask="url(#mycountry-mark-globe)">
        <g transform="translate(0.5 3.5) scale(0.82)" strokeWidth={1.8}>
          {GLOBE_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <circle
        cx={BADGE.cx}
        cy={BADGE.cy}
        r={BADGE.r}
        fill="currentColor"
        stroke="none"
        mask="url(#mycountry-mark-crown)"
      />
    </svg>
  );
}
