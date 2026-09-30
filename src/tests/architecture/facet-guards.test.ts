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

// Plan 346 gate, lowered after the 2026-09-30 Facet conversion (was 173). Keep only skeletons
// (prefer <Skeleton>) and genuine live/unread indicators.
const ANIMATE_PULSE_CEILING = 84;

/** Surfaces converted to Facet primitives (2026-09-30); their stricter gates live below. */
const FACET_CONVERTED = [
  "components/mycountry/",
  "components/maps/",
  "components/shared/atomic-picker/",
  "app/help/",
  "app/builder/components/editor/",
].map((dir) => dir.split("/").join(path.sep));

const inConverted = (file: string) => FACET_CONVERTED.some((dir) => file.startsWith(dir));

function convertedHits(pattern: RegExp, allowed: ReadonlySet<string> = new Set()): string[] {
  return hits(pattern, allowed).filter((hit) => inConverted(hit.slice(0, hit.indexOf(": "))));
}

// Brand artwork, a monochrome logo image, typography-plugin inversion, and a comment describing
// legacy class strings.
const DARK_OVERRIDE_ALLOWED = new Set([
  `${path.join("components", "mycountry", "shared", "primitives", "mycountry-logo.tsx")}: dark:text-amber-400`,
  `${path.join("components", "mycountry", "shared", "primitives", "SectionTabBar.tsx")}: dark:text-`,
  `${path.join("components", "maps", "core", "MapLoadingScreen.tsx")}: dark:invert`,
  `${path.join("components", "maps", "core", "StoryPinModal.tsx")}: dark:prose-invert`,
]);

// Image scrims (flag photos, card art) and the MyCountry logo.
const CONVERTED_GRADIENT_CEILING = 10;

describe("Facet anti-slop guards", () => {
  it("never nests block elements (Skeleton renders a div) inside <p> — a hydration error", () => {
    const paragraph = /<p(?:\s[^>]*)?>((?:(?!<\/p>)[\s\S]){0,600}?)<\/p>/g;
    const offenders = sources.flatMap(({ file, content }) =>
      [...content.matchAll(paragraph)]
        .filter((m) =>
          /<(Skeleton|div|FacetCard|Card|ul|ol|table|h[1-6]|section)\b/.test(m[1] ?? "")
        )
        .map((m) => `${file}:${content.slice(0, m.index).split("\n").length}`)
    );
    expect(offenders).toEqual([]);
  });

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
    const drillSheets = sources.find(({ file }) =>
      file.endsWith("mycountry/shell/DrillSheets.tsx")
    );
    expect(drillSheets?.content.match(/backdrop-blur/g) ?? []).toHaveLength(1);
  });

  it("wraps the app in one reduced-motion FacetMotionConfig and no route blur wrapper", () => {
    const layout = sources.find(({ file }) => file === path.join("app", "layout.tsx"));
    // FacetMotionConfig follows the OS and the in-app Reduce Motion setting (data-motion).
    expect(layout?.content.match(/<FacetMotionConfig>/g) ?? []).toHaveLength(1);
    expect(layout?.content.match(/<MotionConfig\b/g) ?? []).toHaveLength(0);
    expect(hits(/RackFocusBlurWrapper/g)).toEqual([]);
  });

  it("imports icons only from iconoir-react (lucide-react is prohibited)", () => {
    expect(hits(/from ["']lucide-react["']/g)).toEqual([]);
  });

  it("keeps @radix-ui imports inside src/components/ui", () => {
    const uiDir = path.join("components", "ui") + path.sep;
    const leaks = hits(/from ["']@radix-ui\/[^"']+["']/g).filter((hit) => !hit.startsWith(uiDir));
    expect(leaks).toEqual([]);
  });

  it("draws dot grids with the Facet texture prop, not a hand-rolled radial-gradient", () => {
    expect(hits(/radial-gradient\(circle at 1px 1px/g)).toEqual([]);
  });

  describe("Facet 3 foundations (docs/specs/2026-09-30-facet-3-design-system.md)", () => {
    it("uses no legacy glass-*/facet-card-* classes (their CSS was deleted)", () => {
      expect(
        hits(
          /\b(?:glass-(?:hierarchy-interactive|hierarchy-modal|child|parent|none|physics|blended|contextual-popover)|facet-card-(?:parent|child))\b/g
        )
      ).toEqual([]);
    });

    it("references no *-hsl colour tokens (none exist)", () => {
      expect(hits(/var\(--[\w-]+-hsl\)/g)).toEqual([]);
    });

    it("layers src/components/ui with the --z-* tokens, not arbitrary z-[N] values", () => {
      const uiDir = path.join("components", "ui") + path.sep;
      expect(hits(/\bz-\[\d+\]/g).filter((hit) => hit.startsWith(uiDir))).toEqual([]);
    });
  });

  describe("surfaces converted to Facet", () => {
    it("use theme tokens instead of dark: overrides", () => {
      expect(convertedHits(/\bdark:[a-z][a-z0-9-]*/g, DARK_OVERRIDE_ALLOWED)).toEqual([]);
    });

    it("use the --z-depth scale instead of arbitrary high z-index values", () => {
      expect(convertedHits(/\bz-\[\d{4,}\]/g)).toEqual([]);
    });

    it("have no hex colour literals in class names", () => {
      expect(convertedHits(/\[#[0-9a-fA-F]{3,8}\]/g)).toEqual([]);
    });

    it(`keep decorative gradients at or below ${CONVERTED_GRADIENT_CEILING}`, () => {
      expect(convertedHits(/\bbg-gradient-to-[a-z]+/g).length).toBeLessThanOrEqual(
        CONVERTED_GRADIENT_CEILING
      );
    });

    it("do not bring back the retired MyCountry surface-kit", () => {
      expect(hits(/surface-kit/g)).toEqual([]);
    });
  });
});
