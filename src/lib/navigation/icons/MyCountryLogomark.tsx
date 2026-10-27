import type { SVGProps } from "react";
import { cn } from "~/lib/utils/cn";

/** iconoir's Crown, the crown of the MyCountry logo (`MyCountryLogo`). */
const CROWN_PATH = "M19.2 17L21 7L14.7 10L12 7L9.3 10L3 7L4.8 17H19.2Z";

/** The logo's crown badge at its `md` size: a 20 px crown in a padded, bordered disc 30 px across. */
const BADGE_SIZE = 30;
const CROWN_SIZE = 20;

/** Tailwind's amber 400 / 300 / 900 (`MyCountryLogo`'s classes) as literals, so the mark shows without the app CSS. */
const GOLD = "#ffb900";
const RIM = "#ffd230";
const INK = "#7b3306";

/**
 * The MyCountry crown badge from `MyCountryLogo`: the gold disc with its amber rim and the dark crown, drawn as
 * one SVG for the navigation. It keeps the logo's own colours rather than the row's tint, and scales with its
 * box (`size-*`, 1em by default). It lives in `src/lib` so the navigation map (which must not import from
 * components) can use it. Decorative by default; the app row carries the label.
 */
export function MyCountryLogomark({ className, ...props }: SVGProps<SVGSVGElement>) {
  const c = BADGE_SIZE / 2;
  return (
    <svg
      viewBox={`0 0 ${BADGE_SIZE} ${BADGE_SIZE}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-[1em] shrink-0", className)}
      {...props}
    >
      <circle cx={c} cy={c} r={c - 0.5} fill={GOLD} stroke={RIM} strokeWidth={1} />
      <path
        d={CROWN_PATH}
        transform={`translate(${c - CROWN_SIZE / 2} ${c - CROWN_SIZE / 2}) scale(${CROWN_SIZE / 24})`}
        stroke={INK}
        strokeWidth={1.5}
      />
    </svg>
  );
}
