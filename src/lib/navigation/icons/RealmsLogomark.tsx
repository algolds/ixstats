import { useId, type SVGProps } from "react";
import { Community } from "iconoir-react";
import { cn } from "~/lib/utils/cn";

/** iconoir's Hexagon outline (`Hexagon`), filled here to make the solid tile. */
const HEXAGON =
  "M11.7 1.1732C11.8856 1.06603 12.1144 1.06603 12.3 1.17321L21.2263 6.3268C21.4119 6.43397 21.5263 6.63205 21.5263 6.84641V17.1536C21.5263 17.3679 21.4119 17.566 21.2263 17.6732L12.3 22.8268C12.1144 22.934 11.8856 22.934 11.7 22.8268L2.77372 17.6732C2.58808 17.566 2.47372 17.3679 2.47372 17.1536V6.84641C2.47372 6.63205 2.58808 6.43397 2.77372 6.32679L11.7 1.1732Z";

/** The figures' box inside the hexagon, and the width of their cut: sized so they stay open at 20 px. */
const FIGURES = 15.5;
const CUT = 2.2;

/**
 * The Realms mark: a solid hexagon (a tile of land) with iconoir's Community figures cut out of it, so a
 * realm reads as people sharing a world. Solid with a cut-out like iconoir's solid Compass (the Maps mark),
 * and in the row's tint (`currentColor`) like the other app icons. It lives in `src/lib` so the navigation
 * map (which must not import from components) can use it. Decorative by default; the app row carries the
 * label. Each instance gets its own mask id.
 */
export function RealmsLogomark({ className, ...props }: SVGProps<SVGSVGElement>) {
  const maskId = `realms-mark-${useId()}`;
  const offset = (24 - FIGURES) / 2;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-[1em] shrink-0", className)}
      {...props}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <Community
            x={offset}
            y={offset}
            width={FIGURES}
            height={FIGURES}
            color="black"
            strokeWidth={CUT}
          />
        </mask>
      </defs>
      <path
        d={HEXAGON}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
