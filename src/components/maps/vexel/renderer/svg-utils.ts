import type { ShieldShape, Division, OrdinaryType, Tincture } from "~/lib/heraldry";
import { TINCTURE_HEX } from "~/lib/heraldry";

export function getTinctureColor(tincture: Tincture): string {
  return TINCTURE_HEX[tincture] ?? "#FFFFFF";
}

export function renderShieldOutline(shape: ShieldShape): string {
  switch (shape) {
    case "heater":
      // Heater shape (shield box: 250,250 to 750,750; center: 500,500)
      return "M 250,250 L 750,250 C 750,550 650,700 500,750 C 350,700 250,550 250,250 Z";
    case "kite":
      // Norman kite shape
      return "M 250,250 L 750,250 C 750,250 720,550 500,750 C 280,550 250,250 250,250 Z";
    case "round":
      // Round shield
      return "M 500,250 A 250,250 0 1,1 500,750 A 250,250 0 1,1 500,250 Z";
    case "lozenge":
      // Diamond shape
      return "M 500,250 L 750,500 L 500,750 L 250,500 Z";
    case "oval":
      // Oval shape (expressed as path)
      return "M 500,250 C 638,250 750,362 750,500 C 750,638 638,750 500,750 C 362,750 250,638 250,500 C 250,362 362,250 500,250 Z";
    case "renaissance":
      // Renaissance target ornate shape
      return "M 250,250 Q 300,220 500,250 Q 700,220 750,250 C 770,400 730,600 500,750 C 270,600 230,400 250,250 Z";
    case "pointed":
      // Spanish pointed bottom shape
      return "M 250,250 L 750,250 L 750,600 C 750,680 620,750 500,750 C 380,750 250,680 250,600 Z";
    default:
      return "M 250,250 L 750,250 C 750,550 650,700 500,750 C 350,700 250,550 250,250 Z";
  }
}

export function renderDivisionPaths(
  division: Division,
  tinctures: Tincture[]
): {
  path?: string;
  rect?: { x: number; y: number; width: number; height: number };
  color: string;
}[] {
  const colors = tinctures.map(getTinctureColor);

  switch (division) {
    case "plain":
      return [{ rect: { x: 250, y: 250, width: 500, height: 500 }, color: colors[0] ?? "#FFFFFF" }];

    case "per-pale":
      return [
        { rect: { x: 250, y: 250, width: 250, height: 500 }, color: colors[0] ?? "#FFFFFF" },
        { rect: { x: 500, y: 250, width: 250, height: 500 }, color: colors[1] ?? "#FFFFFF" },
      ];

    case "per-fess":
      return [
        { rect: { x: 250, y: 250, width: 500, height: 250 }, color: colors[0] ?? "#FFFFFF" },
        { rect: { x: 250, y: 500, width: 500, height: 250 }, color: colors[1] ?? "#FFFFFF" },
      ];

    case "per-bend":
      return [
        { path: "M 250,250 L 750,250 L 750,750 Z", color: colors[0] ?? "#FFFFFF" },
        { path: "M 250,250 L 250,750 L 750,750 Z", color: colors[1] ?? "#FFFFFF" },
      ];

    case "per-bend-sinister":
      return [
        { path: "M 250,250 L 750,250 L 250,750 Z", color: colors[0] ?? "#FFFFFF" },
        { path: "M 750,250 L 750,750 L 250,750 Z", color: colors[1] ?? "#FFFFFF" },
      ];

    case "quarterly":
      return [
        { rect: { x: 250, y: 250, width: 250, height: 250 }, color: colors[0] ?? "#FFFFFF" },
        { rect: { x: 500, y: 250, width: 250, height: 250 }, color: colors[1] ?? "#FFFFFF" },
        {
          rect: { x: 250, y: 500, width: 250, height: 250 },
          color: colors[2] ?? colors[1] ?? "#FFFFFF",
        },
        {
          rect: { x: 500, y: 500, width: 250, height: 250 },
          color: colors[3] ?? colors[0] ?? "#FFFFFF",
        },
      ];

    case "per-saltire":
      return [
        // Top triangle
        { path: "M 250,250 L 750,250 L 500,500 Z", color: colors[0] ?? "#FFFFFF" },
        // Right triangle
        { path: "M 750,250 L 750,750 L 500,500 Z", color: colors[1] ?? "#FFFFFF" },
        // Bottom triangle
        { path: "M 750,750 L 250,750 L 500,500 Z", color: colors[2] ?? colors[0] ?? "#FFFFFF" },
        // Left triangle
        { path: "M 250,750 L 250,250 L 500,500 Z", color: colors[3] ?? colors[1] ?? "#FFFFFF" },
      ];

    case "per-chevron":
      return [
        // Top section
        {
          path: "M 250,250 L 750,250 L 750,600 L 500,450 L 250,600 Z",
          color: colors[0] ?? "#FFFFFF",
        },
        // Bottom section
        {
          path: "M 250,600 L 500,450 L 750,600 L 750,750 L 250,750 Z",
          color: colors[1] ?? "#FFFFFF",
        },
      ];

    default:
      return [{ rect: { x: 250, y: 250, width: 500, height: 500 }, color: colors[0] ?? "#FFFFFF" }];
  }
}

export function renderOrdinaryPath(type: OrdinaryType): string {
  switch (type) {
    case "chief":
      // Top 25% bar
      return "M 250,250 L 750,250 L 750,375 L 250,375 Z";
    case "fess":
      // Center horizontal bar (25% height)
      return "M 250,437.5 L 750,437.5 L 750,562.5 L 250,562.5 Z";
    case "pale":
      // Center vertical bar (25% width)
      return "M 437.5,250 L 562.5,250 L 562.5,750 L 437.5,750 Z";
    case "bend":
      // Diagonal top-left to bottom-right
      return "M 250,250 L 350,250 L 750,650 L 750,750 L 650,750 L 250,350 Z";
    case "bend-sinister":
      // Diagonal top-right to bottom-left
      return "M 750,250 L 750,350 L 350,750 L 250,750 L 250,650 L 650,250 Z";
    case "chevron":
      // Chevron shape pointing up
      return "M 250,625 L 500,375 L 750,625 L 750,725 L 500,475 L 250,725 Z";
    case "cross":
      // Pale + Fess combination
      return "M 437.5,250 L 562.5,250 L 562.5,437.5 L 750,437.5 L 750,562.5 L 562.5,562.5 L 562.5,750 L 437.5,750 L 437.5,562.5 L 250,562.5 L 250,437.5 L 437.5,437.5 Z";
    case "saltire":
      // Bend + Bend Sinister combination
      return "M 250,250 L 310,250 L 500,440 L 690,250 L 750,250 L 750,310 L 560,500 L 750,690 L 750,750 L 690,750 L 500,560 L 310,750 L 250,750 L 250,690 L 440,500 L 250,310 Z";
    case "orle":
      // Inset border frame
      return "M 280,280 L 720,280 L 720,720 L 280,720 Z M 320,320 L 320,680 L 680,680 L 680,320 Z";
    case "canton":
      // Small box in top-left (30% size)
      return "M 250,250 L 400,250 L 400,400 L 250,400 Z";
    default:
      return "";
  }
}
