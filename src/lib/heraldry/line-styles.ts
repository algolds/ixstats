/**
 * Heraldic lines: the patterned edge each line style draws between two points of a division piece
 * or an ordinary. An edge is a repeating motif, stretched so a whole number of motifs fits.
 */
import type { LineStyle } from "./types";

export type Point = readonly [x: number, y: number];

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const pointText = ([x, y]: Point) => `${round2(x)},${round2(y)}`;

/** A path segment: control points (if any) then its end point. An arc carries its radius and sweep. */
type Segment =
  { cmd: "L" | "Q" | "C"; pts: Point[] } | { cmd: "A"; r: number; sweep: 0 | 1; pts: [Point] };

/**
 * A motif in its own frame: `u` runs along the edge from 0 to the motif length `m`, `v` is the
 * offset to the right of the direction of travel (into a piece wound clockwise on screen).
 * `a` is the amplitude.
 */
type Motif = (m: number, a: number) => Segment[];

const L = (...pts: Point[]): Segment[] => pts.map((p) => ({ cmd: "L", pts: [p] }));

/** A shallow arc across the motif with sagitta `a`, bulging into the piece (sweep 0) or out of it. */
const arc =
  (sweep: 0 | 1): Motif =>
  (m, a) => [{ cmd: "A", r: (m * m) / (8 * a) + a / 2, sweep, pts: [[m, 0]] }];

/** One full wave: a crest out of the piece, then a trough into it. */
const wavy: Motif = (m, a) => [
  {
    cmd: "Q",
    pts: [
      [m / 4, -2 * a],
      [m / 2, 0],
    ],
  },
  {
    cmd: "Q",
    pts: [
      [(3 * m) / 4, 2 * a],
      [m, 0],
    ],
  },
];

/** Two lobes, one each side, wider at the top than at the neck. */
const nebuly: Motif = (m, a) => {
  const c = (4 * a) / 3;
  return [
    {
      cmd: "C",
      pts: [
        [-m / 4, -c],
        [(3 * m) / 4, -c],
        [m / 2, 0],
      ],
    },
    {
      cmd: "C",
      pts: [
        [m / 4, c],
        [(5 * m) / 4, c],
        [m, 0],
      ],
    },
  ];
};

/** A tooth out of the piece and one into it; the edge closes onto its end point after the last. */
const zigzag: Motif = (m, a) => L([m / 4, -a], [(3 * m) / 4, a]);

/** Square merlons out of the piece alternating with square crenels into it. */
const embattled: Motif = (m, a) => L([0, -a], [m / 2, -a], [m / 2, a], [m, a], [m, 0]);

/** Like embattled, but each merlon and crenel is wider at its tip than at its neck. */
const dovetailed: Motif = (m, a) => {
  const s = m / 16;
  return L([-s, -a], [m / 2 + s, -a], [m / 2 - s, a], [m + s, a], [m, 0]);
};

/** Interlocking T shapes: a narrow stem, then a wide head, on each side. */
const potenty: Motif = (m, a) => {
  const [s, h] = [m / 8, a / 2];
  return L(
    [0, -h],
    [-s, -h],
    [-s, -a],
    [m / 2 + s, -a],
    [m / 2 + s, -h],
    [m / 2, -h],
    [m / 2, h],
    [m / 2 - s, h],
    [m / 2 - s, a],
    [m + s, a],
    [m + s, h],
    [m, h],
    [m, 0]
  );
};

/** Stubs slanting forward, out of the piece only, like the lopped branches of a ragged staff. */
const raguly: Motif = (m, a) => L([m / 4, -a], [(3 * m) / 4, -a], [m / 2, 0], [m, 0]);

/** Interlocking pales with pointed ends. */
const urdy: Motif = (m, a) =>
  L(
    [0, -a / 2],
    [m / 4, -a],
    [m / 2, -a / 2],
    [m / 2, a / 2],
    [(3 * m) / 4, a],
    [m, a / 2],
    [m, 0]
  );

/** Each patterned style's motif, and how many periods one motif spans. */
const MOTIFS: Record<Exclude<LineStyle, "straight">, { draw: Motif; span: number }> = {
  engrailed: { draw: arc(0), span: 1 },
  invected: { draw: arc(1), span: 1 },
  wavy: { draw: wavy, span: 1 },
  nebuly: { draw: nebuly, span: 1 },
  indented: { draw: zigzag, span: 1 },
  dancetty: { draw: zigzag, span: 2 },
  embattled: { draw: embattled, span: 1 },
  dovetailed: { draw: dovetailed, span: 1 },
  potenty: { draw: potenty, span: 1 },
  raguly: { draw: raguly, span: 1 },
  urdy: { draw: urdy, span: 1 },
};

/** The segment with every point moved by `place`. */
const placed = (seg: Segment, place: (p: Point) => Point): Segment =>
  seg.cmd === "A"
    ? { ...seg, pts: [place(seg.pts[0])] }
    : { cmd: seg.cmd, pts: seg.pts.map(place) };

function edgeSegments(from: Point, to: Point, style: LineStyle, period: number): Segment[] {
  const [[x1, y1], [x2, y2]] = [from, to];
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (style === "straight" || length === 0) return [{ cmd: "L", pts: [to] }];

  const { draw, span } = MOTIFS[style];
  const n = Math.max(1, Math.round(length / (period * span)));
  const m = length / n;
  const [ux, uy] = [(x2 - x1) / length, (y2 - y1) / length];
  const segments = Array.from({ length: n }, (_, i) =>
    draw(m, (period * span) / 4).map((seg) =>
      placed(seg, ([u, v]) => [x1 + (i * m + u) * ux - v * uy, y1 + (i * m + u) * uy + v * ux])
    )
  ).flat();

  // Land exactly on the end point: snap a motif that ends on the line, or close onto it.
  const last = segments[segments.length - 1]!;
  const [lx, ly] = last.pts[last.pts.length - 1]!;
  if (Math.hypot(lx - x2, ly - y2) < 1e-6) last.pts[last.pts.length - 1] = to;
  else segments.push({ cmd: "L", pts: [to] });
  return segments;
}

/** The same curve walked the other way, starting from the old end and finishing at `start`. */
function reversed(start: Point, segments: Segment[]): Segment[] {
  const ends = [start, ...segments.map((s) => s.pts[s.pts.length - 1]!)];
  return segments
    .map((seg, i): Segment => {
      const to = ends[i]!;
      return seg.cmd === "A"
        ? { ...seg, sweep: seg.sweep === 0 ? 1 : 0, pts: [to] }
        : { cmd: seg.cmd, pts: [...seg.pts.slice(0, -1).reverse(), to] };
    })
    .reverse();
}

const segmentText = (seg: Segment) =>
  seg.cmd === "A"
    ? `A ${round2(seg.r)} ${round2(seg.r)} 0 0 ${seg.sweep} ${pointText(seg.pts[0])}`
    : `${seg.cmd} ${seg.pts.map(pointText).join(" ")}`;

/**
 * The edge from (x1,y1) to (x2,y2) in `style`, as path commands that continue from (x1,y1). Its
 * motif faces the right of the direction of travel: for a piece wound clockwise on screen, an
 * engrailed edge's arcs bite into the piece and an invected edge's bulge out of it.
 */
export function styledEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: LineStyle,
  period = 50
): string {
  return edgeSegments([x1, y1], [x2, y2], style, period).map(segmentText).join(" ");
}

/**
 * A partition line between two pieces: the same curve whichever way a piece walks it, so the
 * pieces on either side share every point and no seam shows. Its motif faces the right of the line
 * walked left to right (or top to bottom): an engrailed per fess line's arcs dip into the base.
 */
export function partitionEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: LineStyle,
  period = 50
): string {
  const forward = x1 < x2 || (x1 === x2 && y1 <= y2);
  const segments = forward
    ? edgeSegments([x1, y1], [x2, y2], style, period)
    : reversed([x2, y2], edgeSegments([x2, y2], [x1, y1], style, period));
  return segments.map(segmentText).join(" ");
}
