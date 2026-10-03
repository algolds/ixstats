import type { ShieldShape, Division, OrdinaryType, Tincture } from "~/lib/heraldry";
import { TINCTURE_HEX } from "~/lib/heraldry";

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
type PieceShape = { path: string } | { rect: Rect };
/** A division section and the tincture indices it takes its colour from (first one present wins). */
type Piece = [shape: PieceShape, ...colorIndices: number[]];

const rect = (x: number, y: number, width: number, height: number): PieceShape => ({
  rect: { x, y, width, height },
});

const PLAIN: Piece[] = [[rect(250, 250, 500, 500), 0]];

const DIVISION_PIECES: Partial<Record<Division, Piece[]>> = {
  plain: PLAIN,
  "per-pale": [
    [rect(250, 250, 250, 500), 0],
    [rect(500, 250, 250, 500), 1],
  ],
  "per-fess": [
    [rect(250, 250, 500, 250), 0],
    [rect(250, 500, 500, 250), 1],
  ],
  "per-bend": [
    [{ path: "M 250,250 L 750,250 L 750,750 Z" }, 0],
    [{ path: "M 250,250 L 250,750 L 750,750 Z" }, 1],
  ],
  "per-bend-sinister": [
    [{ path: "M 250,250 L 750,250 L 250,750 Z" }, 0],
    [{ path: "M 750,250 L 750,750 L 250,750 Z" }, 1],
  ],
  quarterly: [
    [rect(250, 250, 250, 250), 0],
    [rect(500, 250, 250, 250), 1],
    [rect(250, 500, 250, 250), 2, 1],
    [rect(500, 500, 250, 250), 3, 0],
  ],
  "per-saltire": [
    [{ path: "M 250,250 L 750,250 L 500,500 Z" }, 0],
    [{ path: "M 750,250 L 750,750 L 500,500 Z" }, 1],
    [{ path: "M 750,750 L 250,750 L 500,500 Z" }, 2, 0],
    [{ path: "M 250,750 L 250,250 L 500,500 Z" }, 3, 1],
  ],
  "per-chevron": [
    [{ path: "M 250,250 L 750,250 L 750,600 L 500,450 L 250,600 Z" }, 0],
    [{ path: "M 250,600 L 500,450 L 750,600 L 750,750 L 250,750 Z" }, 1],
  ],
};

export function renderDivisionPaths(
  division: Division,
  tinctures: Tincture[]
): {
  path?: string;
  rect?: Rect;
  color: string;
}[] {
  const colors = tinctures.map(getTinctureColor);
  return (DIVISION_PIECES[division] ?? PLAIN).map(([shape, ...colorIndices]) => ({
    ...shape,
    color: colorIndices.map((i) => colors[i]).find((c) => c != null) ?? "#FFFFFF",
  }));
}

const ORDINARY_PATHS: Partial<Record<OrdinaryType, string>> = {
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
};

export function renderOrdinaryPath(type: OrdinaryType): string {
  return ORDINARY_PATHS[type] ?? "";
}
