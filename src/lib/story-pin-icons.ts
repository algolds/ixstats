/**
 * story-pin-icons.ts — Canvas-generated category icons for story pin markers.
 *
 * Generates 14 category-specific icons at 3 importance levels (normal/major/legendary)
 * and registers them with a MapLibre map instance via map.addImage().
 *
 * Categories are aligned with actual IxWiki lore content analysis (March 2026):
 *   - battle (97 military conflict articles)
 *   - founding (169 country + 67 former country articles)
 *   - treaty (104 diplomacy articles)
 *   - cultural (49 culture + 63 cuisine + 19 music)
 *   - religious (90 religion sections across top articles)
 *   - trade (66 company + 83 economy articles)
 *   - naval (122 ship articles — community passion)
 *   - settlement (160 settlement articles — #2 infobox type)
 *   - government (37 agency + 16 legislature + 33 party articles)
 *   - biography (32 officeholder + 19 person articles)
 *   - linguistic (23 ethnic group + 19 language articles)
 *   - upheaval (revolutions, civil wars, coups — e.g. Velvet Revolution 58KB)
 *   - natural (kept for geographic/environmental events)
 *   - exploration (kept for discovery/expedition events)
 *
 * Icon naming convention: "story-pin-{category}-{importance}"
 */

import type { Map as MapLibreMap } from "maplibre-gl";

// ─── Category colors (aligned with wiki lore analysis) ───────────────────────

export const STORY_PIN_COLORS: Record<string, string> = {
  battle: "#dc2626",       // red — military conflicts
  founding: "#2563eb",     // blue — nation origins
  treaty: "#16a34a",       // green — diplomatic agreements
  cultural: "#9333ea",     // purple — arts, cuisine, traditions
  religious: "#ca8a04",    // gold — faith, churches, religious events
  trade: "#ea580c",        // orange — commerce, companies, economy
  naval: "#1e40af",        // dark blue — ships, maritime history
  settlement: "#7c3aed",   // violet — city founding, settlement stories
  government: "#475569",   // slate — political events, reforms, coups
  biography: "#be185d",    // pink — notable people, leaders
  linguistic: "#65a30d",   // lime — language origins, ethnic identity
  upheaval: "#991b1b",     // dark red — revolutions, civil wars, collapses
  natural: "#059669",      // teal — geographic/environmental
  exploration: "#0891b2",  // cyan — discovery, expeditions
};

export const STORY_PIN_CATEGORIES = Object.keys(STORY_PIN_COLORS);

// Importance level → base icon size (px)
const IMPORTANCE_SIZES: Record<number, number> = {
  0: 28, // normal
  1: 36, // major
  2: 44, // legendary
};

// ─── Category shape drawing functions ────────────────────────────────────────

type ShapeDrawer = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;

/** Crossed swords */
const drawBattle: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // Sword 1 (top-left to bottom-right)
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx - s * 0.3, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.3);
  // Sword 2 (top-right to bottom-left)
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx - s, cy + s);
  ctx.moveTo(cx + s * 0.3, cy + s * 0.3);
  ctx.lineTo(cx - s * 0.3, cy - s * 0.3);
  ctx.stroke();
  // Blade tips
  ctx.fillStyle = ctx.strokeStyle;
  for (const [dx, dy] of [[-s, -s], [s, -s], [s, s], [-s, s]]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Castle tower */
const drawFounding: ShapeDrawer = (ctx, cx, cy, r) => {
  const w = r * 0.7;
  const h = r * 0.8;
  const top = cy - h * 0.5;
  const bot = cy + h * 0.5;
  // Tower body
  ctx.beginPath();
  ctx.rect(cx - w * 0.4, top + h * 0.25, w * 0.8, h * 0.75);
  ctx.fill();
  ctx.stroke();
  // Battlements (3 merlons)
  const mw = w * 0.25;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.rect(cx + i * mw - mw * 0.4, top, mw * 0.7, h * 0.3);
    ctx.fill();
    ctx.stroke();
  }
  // Door
  ctx.beginPath();
  ctx.arc(cx, bot - h * 0.15, w * 0.12, Math.PI, 0);
  ctx.lineTo(cx + w * 0.12, bot);
  ctx.lineTo(cx - w * 0.12, bot);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle; // dark door
  ctx.fill();
};

/** Scroll / treaty document */
const drawTreaty: ShapeDrawer = (ctx, cx, cy, r) => {
  const w = r * 0.55;
  const h = r * 0.7;
  // Paper body
  ctx.beginPath();
  ctx.rect(cx - w * 0.5, cy - h * 0.4, w, h * 0.8);
  ctx.fill();
  ctx.stroke();
  // Scroll curls (top and bottom)
  for (const yOff of [-h * 0.4, h * 0.4]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + yOff, w * 0.55, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Text lines
  ctx.strokeStyle = ctx.fillStyle === "#fff" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy + i * h * 0.15);
    ctx.lineTo(cx + w * 0.3, cy + i * h * 0.15);
    ctx.stroke();
  }
};

/** Theater mask */
const drawCultural: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.6;
  // Mask outline
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.7, s * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Eyes
  const eyeY = cy - s * 0.15;
  for (const dx of [-s * 0.25, s * 0.25]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, eyeY, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }
  // Smile
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.05, s * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
};

/** Six-pointed star */
const drawReligious: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // Draw two overlapping triangles
  for (const rot of [0, Math.PI]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rot - Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const x = cx + Math.cos(angle) * s;
      const y = cy + Math.sin(angle) * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
};

/** Leaf */
const drawNatural: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.65;
  ctx.beginPath();
  // Leaf shape using bezier curves
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 0.6, cx + s * 0.6, cy + s * 0.4, cx, cy + s);
  ctx.bezierCurveTo(cx - s * 0.6, cy + s * 0.4, cx - s * 0.8, cy - s * 0.6, cx, cy - s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Center vein
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.7);
  ctx.lineTo(cx, cy + s * 0.7);
  ctx.stroke();
  // Side veins
  for (const dir of [-1, 1]) {
    for (const t of [0.3, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - s + s * 2 * t);
      ctx.lineTo(cx + dir * s * 0.3, cy - s + s * 2 * (t - 0.15));
      ctx.stroke();
    }
  }
};

/** Coin */
const drawTrade: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  // Dollar/currency symbol (simple vertical line + horizontal bars)
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.45);
  ctx.lineTo(cx, cy + s * 0.45);
  ctx.moveTo(cx - s * 0.25, cy - s * 0.15);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
  ctx.moveTo(cx - s * 0.25, cy + s * 0.15);
  ctx.lineTo(cx + s * 0.25, cy + s * 0.15);
  ctx.stroke();
};

/** Compass rose */
const drawExploration: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // 4 cardinal points as triangles
  const points: [number, number, number][] = [
    [0, -1, s],        // N (longer)
    [1, 0, s * 0.7],   // E
    [0, 1, s * 0.7],   // S
    [-1, 0, s * 0.7],  // W
  ];
  for (const [dx, dy, len] of points) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * len, cy + dy * len);
    ctx.lineTo(cx + dy * s * 0.2, cy - dx * s * 0.2);
    ctx.lineTo(cx - dy * s * 0.2, cy + dx * s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
};

/** Flame */
const drawDisaster: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.65;
  ctx.beginPath();
  // Main flame body
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.3, cx + s * 0.6, cy + s * 0.2, cx + s * 0.3, cy + s * 0.7);
  ctx.quadraticCurveTo(cx + s * 0.1, cy + s * 0.9, cx, cy + s * 0.7);
  ctx.quadraticCurveTo(cx - s * 0.1, cy + s * 0.9, cx - s * 0.3, cy + s * 0.7);
  ctx.bezierCurveTo(cx - s * 0.6, cy + s * 0.2, cx - s * 0.5, cy - s * 0.3, cx, cy - s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner flame
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.2, cy, cx + s * 0.2, cy + s * 0.3, cx, cy + s * 0.5);
  ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.3, cx - s * 0.2, cy, cx, cy - s * 0.3);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fill();
};

/** Anchor — naval/maritime */
const drawNaval: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // Anchor body (vertical line)
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.7);
  ctx.lineTo(cx, cy + s * 0.5);
  ctx.stroke();
  // Cross bar
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.3);
  ctx.stroke();
  // Ring at top
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.7, s * 0.15, 0, Math.PI * 2);
  ctx.stroke();
  // Curved arms at bottom
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.5, s * 0.4, Math.PI * 0.8, Math.PI * 0.2, true);
  ctx.stroke();
};

/** House/building — settlement */
const drawSettlement: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.6;
  // House body
  ctx.beginPath();
  ctx.rect(cx - s * 0.5, cy - s * 0.1, s, s * 0.7);
  ctx.fill();
  ctx.stroke();
  // Roof (triangle)
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.65, cy - s * 0.1);
  ctx.lineTo(cx, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.65, cy - s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Door
  ctx.beginPath();
  ctx.rect(cx - s * 0.12, cy + s * 0.15, s * 0.24, s * 0.45);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
};

/** Column/pillar — government */
const drawGovernment: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // Top beam
  ctx.beginPath();
  ctx.rect(cx - s * 0.6, cy - s * 0.7, s * 1.2, s * 0.15);
  ctx.fill();
  ctx.stroke();
  // Triangle pediment
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.65, cy - s * 0.7);
  ctx.lineTo(cx, cy - s * 0.95);
  ctx.lineTo(cx + s * 0.65, cy - s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Three columns
  for (const dx of [-s * 0.35, 0, s * 0.35]) {
    ctx.beginPath();
    ctx.rect(cx + dx - s * 0.06, cy - s * 0.55, s * 0.12, s * 0.95);
    ctx.fill();
    ctx.stroke();
  }
  // Base
  ctx.beginPath();
  ctx.rect(cx - s * 0.55, cy + s * 0.4, s * 1.1, s * 0.12);
  ctx.fill();
  ctx.stroke();
};

/** Person silhouette — biography */
const drawBiography: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.55;
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.4, s * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Shoulders/body
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.35, s * 0.55, s * 0.45, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.stroke();
};

/** Speech bubble — linguistic */
const drawLinguistic: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.6;
  // Rounded rectangle bubble
  const bx = cx - s * 0.55;
  const by = cy - s * 0.5;
  const bw = s * 1.1;
  const bh = s * 0.8;
  const br = s * 0.15;
  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + s * 0.4, by + bh);
  // Tail
  ctx.lineTo(bx + s * 0.3, by + bh + s * 0.3);
  ctx.lineTo(bx + s * 0.2, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Text lines inside
  ctx.strokeStyle = ctx.fillStyle === "#fff" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)";
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy - s * 0.25 + i * s * 0.25);
    ctx.lineTo(cx + s * 0.3 - i * s * 0.15, cy - s * 0.25 + i * s * 0.25);
    ctx.stroke();
  }
};

/** Lightning bolt — upheaval */
const drawUpheaval: ShapeDrawer = (ctx, cx, cy, r) => {
  const s = r * 0.65;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.lineTo(cx - s * 0.3, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.15, cy + s);
  ctx.lineTo(cx + s * 0.35, cy + s * 0.05);
  ctx.lineTo(cx + s * 0.0, cy + s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const SHAPE_DRAWERS: Record<string, ShapeDrawer> = {
  battle: drawBattle,
  founding: drawFounding,
  treaty: drawTreaty,
  cultural: drawCultural,
  religious: drawReligious,
  natural: drawNatural,
  trade: drawTrade,
  exploration: drawExploration,
  naval: drawNaval,
  settlement: drawSettlement,
  government: drawGovernment,
  biography: drawBiography,
  linguistic: drawLinguistic,
  upheaval: drawUpheaval,
};

// ─── Icon generation ─────────────────────────────────────────────────────────

/**
 * Generate a single story pin icon as ImageData.
 * Structure: colored circle background → white border → category shape in white.
 */
function createStoryPinIcon(
  size: number,
  category: string,
  importance: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const bgRadius = size / 2 - 2;

  // Background circle with category color
  const color = STORY_PIN_COLORS[category] ?? "#6b7280";
  ctx.beginPath();
  ctx.arc(cx, cy, bgRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // White outer ring
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = importance >= 2 ? 2.5 : importance >= 1 ? 2 : 1.5;
  ctx.stroke();

  // Legendary: add a second subtle gold ring
  if (importance >= 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, bgRadius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw the category shape (white on colored bg)
  const shapeR = bgRadius * 0.7;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = Math.max(1, size / 24);

  const drawer = SHAPE_DRAWERS[category];
  if (drawer) {
    ctx.save();
    drawer(ctx, cx, cy, shapeR);
    ctx.restore();
  }

  return ctx.getImageData(0, 0, size, size);
}

// ─── Registration ────────────────────────────────────────────────────────────

// Module-level cache: avoids re-creating 42 canvas icons when map remounts
const iconCache = new Map<string, ImageData>();

/**
 * Register all story pin icons with a MapLibre map.
 * Call this after map style is loaded.
 *
 * Creates 42 icons: 14 categories × 3 importance levels.
 * Name format: "story-pin-{category}-{importance}"
 */
export function registerStoryPinIcons(map: MapLibreMap): void {
  for (const category of STORY_PIN_CATEGORIES) {
    for (const importance of [0, 1, 2]) {
      const size = IMPORTANCE_SIZES[importance] ?? 28;
      const name = `story-pin-${category}-${importance}`;

      if (map.hasImage(name)) continue;

      let imageData = iconCache.get(name);
      if (!imageData) {
        imageData = createStoryPinIcon(size, category, importance);
        iconCache.set(name, imageData);
      }
      map.addImage(name, imageData, { sdf: false });
    }
  }
}

/**
 * Get the icon name for a given category and importance.
 * Falls back to "cultural-0" if category is unknown.
 */
export function getStoryPinIconName(category: string, importance: number = 0): string {
  const validCat = STORY_PIN_CATEGORIES.includes(category) ? category : "cultural";
  const validImp = Math.min(Math.max(Math.round(importance), 0), 2);
  return `story-pin-${validCat}-${validImp}`;
}
