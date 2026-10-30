import type { ShieldShape, Division, OrdinaryType, Tincture, LineStyle } from "./types";
import { DIVISION_SECTIONS_COUNT, TINCTURE_HEX } from "./constants";
import { partitionEdge, pointText, round2, styledEdge, type Point } from "./line-styles";

export function getTinctureColor(tincture: Tincture): string {
  return TINCTURE_HEX[tincture] ?? "#FFFFFF";
}

// Shield box: 250,250 to 750,750; centre 500,500.
const HEATER = "M 250,250 L 750,250 C 750,550 650,700 500,750 C 350,700 250,550 250,250 Z";

const SHIELD_OUTLINES: Partial<Record<ShieldShape, string>> = {
  heater: HEATER,
  kite: "M 250,250 L 750,250 C 750,250 720,550 500,750 C 280,550 250,250 250,250 Z",
  round: "M 500,250 A 250,250 0 1,1 500,750 A 250,250 0 1,1 500,250 Z",
  lozenge: "M 500,250 L 750,500 L 500,750 L 250,500 Z",
  oval: "M 500,250 C 638,250 750,362 750,500 C 750,638 638,750 500,750 C 362,750 250,638 250,500 C 250,362 362,250 500,250 Z",
  renaissance:
    "M 250,250 Q 300,220 500,250 Q 700,220 750,250 C 770,400 730,600 500,750 C 270,600 230,400 250,250 Z",
  pointed: "M 250,250 L 750,250 L 750,600 C 750,680 620,750 500,750 C 380,750 250,680 250,600 Z",
};

export function renderShieldOutline(shape: ShieldShape): string {
  return SHIELD_OUTLINES[shape] ?? HEATER;
}

type Rect = { x: number; y: number; width: number; height: number };
type PieceShape = { points: Point[] } | { rect: Rect };
/** A division section and the tincture indices it takes its colour from (first one present wins). */
type Piece = [shape: PieceShape, ...colorIndices: number[]];

const rect = (x: number, y: number, width: number, height: number): PieceShape => ({
  rect: { x, y, width, height },
});

/**
 * A closed piece through the given points. Its partition lines are drawn in the field's line style
 * when it is rendered (see `loopPath`). Overflow past the shield is clipped.
 */
const polygon = (points: Point[]): PieceShape => ({ points });

/** True when the edge lies along (or past) one side of the shield box, where the shield clip trims it. */
const onBoxSide = ([px, py]: Point, [qx, qy]: Point) =>
  (px <= 250 && qx <= 250) ||
  (px >= 750 && qx >= 750) ||
  (py <= 250 && qy <= 250) ||
  (py >= 750 && qy >= 750);

type Edge = (from: Point, to: Point) => string;

/**
 * The closed path through `points`, each edge drawn by `edge` (a line style), except the edges
 * along the shield box: those are the shield's own edge, not a line of partition, and stay straight.
 */
function loopPath(points: Point[], edge: Edge): string {
  const sides = points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    return onBoxSide(p, q) ? `L ${pointText(q)}` : edge(p, q);
  });
  return `M ${pointText(points[0]!)} ${sides.join(" ")} Z`;
}

/** The rectangle from (x0,y0) to (x1,y1) as a polygon, so its edges can take a line style. */
const box = (x0: number, y0: number, x1: number, y1: number) =>
  polygon([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);

/** Position `i` of `n` equal steps across the 250..750 shield box. */
const step = (i: number, n: number) => 250 + (500 * i) / n;

/** Piece `i` takes tincture `i`, or alternates the first two when fewer are set. */
const bands = (n: number, shape: (i: number) => PieceShape): Piece[] =>
  Array.from({ length: n }, (_, i): Piece => [shape(i), i, i % 2]);

const paleBands = (n: number) => bands(n, (i) => box(step(i, n), 250, step(i + 1, n), 750));

const fessBands = (n: number) => bands(n, (i) => box(250, step(i, n), 750, step(i + 1, n)));

/** Bands parallel to the bend (dexter chief to sinister base), the first in sinister chief. */
const bendBands = (n: number) =>
  bands(n, (i) => {
    // Offsets of the bend lines along the top edge, from the sinister chief corner (+500) to dexter base (-500).
    const [c0, c1] = [500 - (1000 * i) / n, 500 - (1000 * (i + 1)) / n];
    return polygon([
      [250 + c1, 250],
      [250 + c0, 250],
      [750 + c0, 750],
      [750 + c1, 750],
    ]);
  });

/** Stacked chevrons with the per-chevron slope (150 down over half the width). */
const chevronBands = (n: number) => {
  // Apex height of each chevron line: the outer two lie wholly past the box, the inner ones are evenly spaced.
  const apex = (j: number) => (j === 0 ? 100 : j === n ? 750 : step(j, n) - 75);
  const line = (k: number): Point[] => [
    [250, k + 150],
    [500, k],
    [750, k + 150],
  ];
  return bands(n, (i) => polygon([...line(apex(i)), ...line(apex(i + 1)).reverse()]));
};

/** Eight triangles about the fess point, clockwise from dexter chief. */
const gyrons = (): Piece[] => {
  const rim: Point[] = [
    [250, 250],
    [500, 250],
    [750, 250],
    [750, 500],
    [750, 750],
    [500, 750],
    [250, 750],
    [250, 500],
  ];
  return bands(rim.length, (i) => polygon([[500, 500], rim[i]!, rim[(i + 1) % rim.length]!]));
};

/** A 6 by 6 grid of squares, alternating from dexter chief. */
const checks = (): Piece[] =>
  Array.from({ length: 36 }, (_, cell): Piece => {
    const [row, col] = [Math.floor(cell / 6), cell % 6];
    return [box(step(col, 6), step(row, 6), step(col + 1, 6), step(row + 1, 6)), (row + col) % 2];
  });

/**
 * A lattice of lozenges, 4 across and 3 down: the field takes the first tincture, and the lozenges
 * centred between its lattice points take the second.
 */
const lozenges = (): Piece[] => {
  const [w, h] = [125, 500 / 3];
  const inner = Array.from({ length: 12 }, (_, cell): Piece => {
    const [cx, cy] = [250 + ((cell % 4) + 0.5) * w, 250 + (Math.floor(cell / 4) + 0.5) * h];
    return [
      polygon([
        [cx, cy - h / 2],
        [cx + w / 2, cy],
        [cx, cy + h / 2],
        [cx - w / 2, cy],
      ]),
      1,
    ];
  });
  return [[rect(250, 250, 500, 500), 0], ...inner];
};

const DIVISION_PIECES: Record<Division, Piece[]> = {
  plain: [[rect(250, 250, 500, 500), 0]],
  "per-pale": [
    [box(250, 250, 500, 750), 0],
    [box(500, 250, 750, 750), 1],
  ],
  "per-fess": [
    [box(250, 250, 750, 500), 0],
    [box(250, 500, 750, 750), 1],
  ],
  "per-bend": [
    [
      polygon([
        [250, 250],
        [750, 250],
        [750, 750],
      ]),
      0,
    ],
    [
      polygon([
        [250, 250],
        [250, 750],
        [750, 750],
      ]),
      1,
    ],
  ],
  "per-bend-sinister": [
    [
      polygon([
        [250, 250],
        [750, 250],
        [250, 750],
      ]),
      0,
    ],
    [
      polygon([
        [750, 250],
        [750, 750],
        [250, 750],
      ]),
      1,
    ],
  ],
  quarterly: [
    [box(250, 250, 500, 500), 0],
    [box(500, 250, 750, 500), 1],
    [box(250, 500, 500, 750), 2, 1],
    [box(500, 500, 750, 750), 3, 0],
  ],
  "per-saltire": bands(4, (i) => {
    const corners: Point[] = [
      [250, 250],
      [750, 250],
      [750, 750],
      [250, 750],
    ];
    return polygon([corners[i]!, corners[(i + 1) % 4]!, [500, 500]]);
  }),
  "per-chevron": [
    [
      polygon([
        [250, 250],
        [750, 250],
        [750, 600],
        [500, 450],
        [250, 600],
      ]),
      0,
    ],
    [
      polygon([
        [250, 600],
        [500, 450],
        [750, 600],
        [750, 750],
        [250, 750],
      ]),
      1,
    ],
  ],
  gyronny: gyrons(),
  "tierced-in-pale": paleBands(DIVISION_SECTIONS_COUNT["tierced-in-pale"]),
  "tierced-in-fess": fessBands(DIVISION_SECTIONS_COUNT["tierced-in-fess"]),
  barry: fessBands(DIVISION_SECTIONS_COUNT.barry),
  paly: paleBands(DIVISION_SECTIONS_COUNT.paly),
  bendy: bendBands(DIVISION_SECTIONS_COUNT.bendy),
  checky: checks(),
  lozengy: lozenges(),
  chevronny: chevronBands(DIVISION_SECTIONS_COUNT.chevronny),
};

export function renderDivisionPaths(
  division: Division,
  tinctures: Tincture[],
  lineStyle: LineStyle
): {
  path?: string;
  rect?: Rect;
  color: string;
}[] {
  const colors = tinctures.map(getTinctureColor);
  const edge: Edge = ([x1, y1], [x2, y2]) => partitionEdge(x1, y1, x2, y2, lineStyle);
  return DIVISION_PIECES[division].map(([shape, ...colorIndices]) => ({
    ...("rect" in shape ? shape : { path: loopPath(shape.points, edge) }),
    color: colorIndices.map((i) => colors[i]).find((c) => c != null) ?? "#FFFFFF",
  }));
}

/**
 * The shield outline scaled about the fess point (500,500), for figures that follow the shield's
 * shape. Outlines use absolute M, L, C, Q and A commands; an arc keeps its rotation and flags.
 */
function scaleOutline(outline: string, k: number): string {
  const at = (v: number) => round2(500 + (v - 500) * k);
  return outline.replace(/([MLCQA])([^MLCQAZ]*)/g, (_, cmd: string, args: string) => {
    const values = args
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const scaled =
      cmd === "A"
        ? values.map((v, i) => (i % 7 < 2 ? round2(v * k) : i % 7 < 5 ? v : at(v)))
        : values.map(at);
    return `${cmd} ${scaled.join(" ")} `;
  });
}

/** A square past the shield box on every side; the shield clip trims it to the outline. */
const OVERFLOW = "M 200,200 L 800,200 L 800,800 L 200,800 Z";

type OrdinaryPath = string | ((outline: string) => string);

/**
 * Ordinary paths, filled with the even-odd rule so nested sub-paths (orle, bordure, tressure) leave
 * holes. A straight-edged ordinary is written as `M x,y L x,y ... Z` loops, each wound so the
 * ordinary lies to the right of travel (clockwise on screen, a hole the other way round), which is
 * the side a line style's motif faces.
 */
const ORDINARY_PATHS: Record<OrdinaryType, OrdinaryPath> = {
  chief: "M 250,250 L 750,250 L 750,375 L 250,375 Z",
  fess: "M 250,437.5 L 750,437.5 L 750,562.5 L 250,562.5 Z",
  pale: "M 437.5,250 L 562.5,250 L 562.5,750 L 437.5,750 Z",
  bend: "M 250,250 L 350,250 L 750,650 L 750,750 L 650,750 L 250,350 Z",
  "bend-sinister": "M 750,250 L 750,350 L 350,750 L 250,750 L 250,650 L 650,250 Z",
  chevron: "M 250,625 L 500,375 L 750,625 L 750,725 L 500,475 L 250,725 Z",
  // Pale + fess
  cross:
    "M 437.5,250 L 562.5,250 L 562.5,437.5 L 750,437.5 L 750,562.5 L 562.5,562.5 L 562.5,750 L 437.5,750 L 437.5,562.5 L 250,562.5 L 250,437.5 L 437.5,437.5 Z",
  // Bend + bend sinister
  saltire:
    "M 250,250 L 310,250 L 500,440 L 690,250 L 750,250 L 750,310 L 560,500 L 750,690 L 750,750 L 690,750 L 500,560 L 310,750 L 250,750 L 250,690 L 440,500 L 250,310 Z",
  // Inset border frame
  orle: "M 280,280 L 720,280 L 720,720 L 280,720 Z M 320,320 L 320,680 L 680,680 L 680,320 Z",
  canton: "M 250,250 L 400,250 L 400,400 L 250,400 Z",
  // A band inside the shield's own edge, a tenth of its width
  bordure: (outline) => `${OVERFLOW} ${scaleOutline(outline, 0.8)}`,
  // Two narrow bands inside the shield's edge
  tressure: (outline) => [0.78, 0.74, 0.7, 0.66].map((k) => scaleOutline(outline, k)).join(" "),
  // Triangle from the chief, its point near the base
  pile: "M 350,250 L 650,250 L 500,700 Z",
  // Arms from both chief corners meeting at the fess point, then a pale to the base
  pall: "M 250,250 L 320.71,250 L 500,429.29 L 679.29,250 L 750,250 L 750,320.71 L 550,520.71 L 550,750 L 450,750 L 450,520.71 L 250,320.71 Z",
  // Dexter chief corner, fess point and dexter flank
  gyron: "M 250,250 L 500,500 L 250,500 Z",
  "lozenge-ordinary": "M 500,330 L 610,500 L 500,670 L 390,500 Z",
};

/** The point loops of a path written as `M x,y L x,y ... Z` sub-paths. */
const loopsOf = (path: string): Point[][] =>
  path
    .split("M")
    .filter((sub) => sub.trim())
    .map((sub) =>
      [...sub.matchAll(/([\d.]+),([\d.]+)/g)].map((m): Point => [Number(m[1]), Number(m[2])])
    );

/**
 * The ordinary's path, its edges facing the field drawn in `lineStyle`. The bordure and tressure
 * follow the shield's curved outline and keep it unpatterned.
 */
export function renderOrdinaryPath(
  type: OrdinaryType,
  shape: ShieldShape,
  lineStyle: LineStyle
): string {
  const path = ORDINARY_PATHS[type];
  if (typeof path !== "string") return path(renderShieldOutline(shape));
  const edge: Edge = ([x1, y1], [x2, y2]) => styledEdge(x1, y1, x2, y2, lineStyle);
  return loopsOf(path)
    .map((loop) => loopPath(loop, edge))
    .join(" ");
}
