/**
 * PNG realm maps (decisions 10–11): the upload limit shared by the pipeline router and the wizard, and the
 * colour → nation mapping the admin builds from the colours the pipeline detected. Pure — no I/O.
 */

/** Largest PNG/JPEG (decoded bytes) the Full Pipeline accepts. */
export const MAX_PNG_BYTES = 25 * 1024 * 1024;

/** Base64 length of a MAX_PNG_BYTES image — the bound runPipeline's input enforces. */
export const MAX_PNG_BASE64_LENGTH = Math.ceil(MAX_PNG_BYTES / 3) * 4;

/** Largest map image, in pixels, the pipeline decodes (8192×8192): bounds the raw buffers it allocates. */
export const MAX_PNG_MEGAPIXELS = 64;
export const MAX_PNG_PIXELS = MAX_PNG_MEGAPIXELS * 1024 * 1024;

/** The uploaded map image could not be decoded, or is too large to decode: the admin's input, not a fault. */
export class PngDecodeError extends Error {
  constructor(reason: string) {
    super(
      `The map image could not be read (PNG or JPEG, at most ${MAX_PNG_MEGAPIXELS} megapixels): ${reason}`
    );
    this.name = "PngDecodeError";
  }
}

export interface DetectedColour {
  hex: string;
  pixelCount: number;
}

export interface RankedColour extends DetectedColour {
  /** Fraction (0–1) of all detected pixels. */
  share: number;
}

/** Largest region first, hex lower-cased, with each colour's share of the detected pixels. */
export function rankColours(colours: readonly DetectedColour[]): RankedColour[] {
  const total = colours.reduce((sum, c) => sum + c.pixelCount, 0);
  return [...colours]
    .sort((a, b) => b.pixelCount - a.pixelCount)
    .map((c) => ({
      hex: c.hex.toLowerCase(),
      pixelCount: c.pixelCount,
      share: total > 0 ? c.pixelCount / total : 0,
    }));
}

/** The target realm's nation names: its countries plus its claimable nation pages, deduplicated and sorted. */
export function nationNameOptions(
  countries: ReadonlyArray<{ name: string }> | undefined,
  nationPages: ReadonlyArray<{ title: string }> | undefined
): string[] {
  const names = new Set([
    ...(countries ?? []).map((c) => c.name),
    ...(nationPages ?? []).map((p) => p.title),
  ]);
  return [...names].sort((a, b) => a.localeCompare(b));
}

export interface ColourMappingPlan {
  /** hex → nation name, for runPipeline's pngConfig.colorMapping. */
  colorMapping: Record<string, string>;
  mapped: number;
  ignored: number;
  /** Colours with no nation that are not ignored — dropped from the map. */
  unmapped: number;
  /** Nations given more than one colour: each feature id holds one region, so only one would survive. */
  duplicates: string[];
}

/** What the second pipeline run vectorises: assigned, non-ignored colours only. */
export function planColourMapping(
  colours: readonly RankedColour[],
  assignments: Readonly<Record<string, string>>,
  ignored: ReadonlySet<string>
): ColourMappingPlan {
  const colorMapping: Record<string, string> = {};
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let ignoredCount = 0;
  for (const { hex } of colours) {
    const nation = assignments[hex]?.trim() ?? "";
    if (ignored.has(hex)) ignoredCount++;
    if (ignored.has(hex) || !nation) continue;
    if (seen.has(nation)) duplicates.add(nation);
    seen.add(nation);
    colorMapping[hex] = nation;
  }
  const mapped = Object.keys(colorMapping).length;
  return {
    colorMapping,
    mapped,
    ignored: ignoredCount,
    unmapped: colours.length - mapped - ignoredCount,
    duplicates: [...duplicates],
  };
}
