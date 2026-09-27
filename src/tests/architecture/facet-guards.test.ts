/** @jest-environment node */
/**
 * Plan 346: pins the Facet anti-slop gates (docs/reference/facet-design-system.md §8) so they
 * cannot regrow. `src/app/labs/onoma` keeps its own type scale and motion, so it is excluded.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");
const excludedDirs = [path.join(srcDir, "tests"), path.join(srcDir, "app/labs/onoma")];

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return excludedDirs.includes(full) ? [] : listSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const sources = listSourceFiles(srcDir).map((file) => ({
  file: path.relative(srcDir, file),
  content: fs.readFileSync(file, "utf-8"),
}));

/** Every `<file>: <match>` hit of a global pattern, minus explicitly allowed hits. */
function hits(pattern: RegExp, allowed: ReadonlySet<string> = new Set()): string[] {
  return sources.flatMap(({ file, content }) =>
    (content.match(pattern) ?? [])
      .map((match) => `${file}: ${match}`)
      .filter((hit) => !allowed.has(hit))
  );
}

// Arbitrary text sizes below 12px (Facet has no tier below `text-xs`), in px or rem.
const MICRO_TYPE = /\btext-\[(?:(?:\d|1[01])(?:\.\d+)?px|0?\.(?:[0-6]\d*|7(?:[0-4]\d*)?)rem)\]/g;

// Fixed-geometry glyphs where a 12px line box cannot fit.
const MICRO_TYPE_ALLOWED = new Set([
  "components/sports/surfaces/FootballField.tsx: text-[3px]", // SVG user units, not CSS px
  "components/cards/display/CardDisplay.tsx: text-[7px]", // card-face stat glyph
  "components/cards/display/CardBack.tsx: text-[8.5px]", // card-back art label
  "components/cards/pack-opening/PackHolographicCover.tsx: text-[7px]", // size="sm" pack art
  "app/builder/components/enhanced/national-identity/CurrencyIcon.tsx: text-[8.5px]", // long symbols
  "app/builder/components/enhanced/national-identity/CurrencyIcon.tsx: text-[9.5px]",
  "components/thinkpages/composer/ComposerActionBar.tsx: text-[7px]", // 14px count badge
  "components/thinkpages/post/PostComposers.tsx: text-[7px]", // 14px count badge
]);

// Plan 346 gate: <= 180 repo-wide, of which 7 live in labs/onoma. Keep only skeletons
// (prefer <Skeleton>) and genuine live/unread indicators.
const ANIMATE_PULSE_CEILING = 173;

describe("Facet anti-slop guards", () => {
  it("has no arbitrary sub-12px text sizes", () => {
    expect(hits(MICRO_TYPE, MICRO_TYPE_ALLOWED)).toEqual([]);
  });

  it("has no transition-all (list the animated properties instead)", () => {
    expect(hits(/\btransition-all\b/g)).toEqual([]);
  });

  it("never collapses a motion keyframe to a bare scale(0)", () => {
    expect(hits(/scale:\s*0\s*\}/g)).toEqual([]);
  });

  it(`keeps animate-pulse at or below ${ANIMATE_PULSE_CEILING}`, () => {
    expect(hits(/animate-pulse/g).length).toBeLessThanOrEqual(ANIMATE_PULSE_CEILING);
  });

  it("keeps nested drill-sheet cards opaque (only the sheet itself blurs)", () => {
    const drillSheets = sources.find(({ file }) => file.endsWith("mycountry/shell/DrillSheets.tsx"));
    expect(drillSheets?.content.match(/backdrop-blur/g) ?? []).toHaveLength(1);
  });

  it("wraps the app in one reduced-motion MotionConfig and no route blur wrapper", () => {
    const layout = sources.find(({ file }) => file === path.join("app", "layout.tsx"));
    expect(layout?.content.match(/<MotionConfig reducedMotion="user">/g) ?? []).toHaveLength(1);
    expect(hits(/RackFocusBlurWrapper/g)).toEqual([]);
  });
});
