import { useId, type SVGProps } from "react";
import { cn } from "~/lib/utils/cn";

type Point = readonly [number, number];

const n = (value: number) => Number(value.toFixed(2));

/** A lattice mark: the card face's gem, a diamond `r` tall and 0.8 `r` wide. */
const diamond = ([x, y]: Point, r: number) =>
  `M${n(x)} ${n(y - r)}L${n(x + 0.8 * r)} ${n(y)}L${n(x)} ${n(y + r)}L${n(x - 0.8 * r)} ${n(y)}Z`;

/** A stamp's perforations: a notch at each corner and evenly along every edge of the paper. */
function perforations(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  across: number,
  down: number
) {
  const notches: Point[] = [];
  for (let i = 0; i <= across; i++) {
    const x = x0 + ((x1 - x0) * i) / across;
    notches.push([x, y0], [x, y1]);
  }
  for (let j = 1; j < down; j++) {
    const y = y0 + ((y1 - y0) * j) / down;
    notches.push([x0, y], [x1, y]);
  }
  return notches;
}

/** The card back's lattice around (24, 24): rows half a pitch apart, every other one shifted half a pitch. */
function lattice(pitch: number, reach: number): Point[] {
  const marks: Point[] = [];
  const steps = Math.ceil(reach / pitch) + 1;
  for (let row = -2 * steps; row <= 2 * steps; row++) {
    const y = 24 + (row * pitch) / 2;
    const shift = row % 2 === 0 ? 0 : pitch / 2;
    for (let col = -steps; col <= steps; col++) {
      const x = 24 + col * pitch + shift;
      if (Math.abs(x - 24) <= reach && Math.abs(y - 24) <= reach) marks.push([x, y]);
    }
  }
  return marks;
}

/** The engraved cut, for 48 px and up: fine perforations, an inner frame, a guilloché seal. */
const DETAILED_NOTCHES = perforations(8, 3, 40, 45, 8, 10);
const SEAL_TURNS = Array.from({ length: 18 }, (_, i) => i * 10);
/** The seal's centre, a window onto the back's lattice, which runs on past its edge. */
const WINDOW = 7.2;
const WINDOW_LATTICE = lattice(4.2, WINDOW)
  .map((mark) => diamond(mark, 1.4))
  .join("");

/** The small cut, for 32 px and down: bigger notches and five lattice marks cut out. */
const SMALL_NOTCHES = perforations(9, 4, 39, 44, 4, 5);
const SMALL_LATTICE = (
  [
    [24, 24],
    [17.4, 17.4],
    [30.6, 17.4],
    [17.4, 30.6],
    [30.6, 30.6],
  ] as const
)
  .map((mark) => diamond(mark, 3.5))
  .join("");

interface CardsLogomarkProps extends SVGProps<SVGSVGElement> {
  /** The engraved seal with its window onto the lattice, for 48 px and up; else the small cut. */
  detailed?: boolean;
}

/**
 * The Cards mark: a perforated stamp (collecting's oldest paper) in `currentColor`. The detailed cut engraves a
 * guilloché seal into it whose centre is a window onto the card back's lattice, painted `--cards-centre` (a card back
 * sets its rarity there, card-art.css), else the mark's colour. The small cut has five lattice marks cut straight out,
 * because the seal's lines run together below 48 px. It lives in `src/lib` so the navigation map can use it, like the
 * other app marks. Decorative by default; each instance gets its own mask and clip ids.
 */
export function CardsLogomark({ detailed = false, className, ...props }: CardsLogomarkProps) {
  const id = useId();
  const maskId = `cards-mark-${id}`;
  const clipId = `cards-window-${id}`;
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("size-[1em] shrink-0", className)}
      {...props}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          {detailed ? (
            <>
              <rect x="8" y="3" width="32" height="42" fill="white" />
              {DETAILED_NOTCHES.map(([x, y]) => (
                <circle key={`${x},${y}`} cx={x} cy={y} r="1.45" fill="black" />
              ))}
              <rect x="11.6" y="6.6" width="24.8" height="34.8" stroke="black" strokeWidth="0.8" />
              <g stroke="black">
                <circle cx="24" cy="24" r="12.4" strokeWidth="0.9" />
                <circle cx="24" cy="24" r="11.5" strokeWidth="0.3" />
                {SEAL_TURNS.map((turn) => (
                  <ellipse
                    key={turn}
                    cx="24"
                    cy="24"
                    rx="11.4"
                    ry="4.3"
                    strokeWidth="0.28"
                    transform={`rotate(${turn} 24 24)`}
                  />
                ))}
              </g>
              <circle cx="24" cy="24" r={WINDOW} fill="black" />
            </>
          ) : (
            <>
              <rect x="9" y="4" width="30" height="40" fill="white" />
              {SMALL_NOTCHES.map(([x, y]) => (
                <circle key={`${x},${y}`} cx={x} cy={y} r="2.3" fill="black" />
              ))}
              <path d={SMALL_LATTICE} fill="black" />
            </>
          )}
        </mask>
        {detailed && (
          <clipPath id={clipId}>
            <circle cx="24" cy="24" r={WINDOW - 0.9} />
          </clipPath>
        )}
      </defs>
      <rect width="48" height="48" fill="currentColor" mask={`url(#${maskId})`} />
      {detailed && (
        <path
          d={WINDOW_LATTICE}
          clipPath={`url(#${clipId})`}
          className="fill-[var(--cards-centre,currentColor)]"
        />
      )}
    </svg>
  );
}
