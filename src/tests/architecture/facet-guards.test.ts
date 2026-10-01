/** @jest-environment node */
/**
 * Plan 346: pins the Facet anti-slop gates (docs/reference/facet-design-system.md §8) so they
 * cannot regrow. (Onoma, `src/app/labs/onoma`, was excluded until its Facet 3 conversion.)
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");
const excludedDirs = [path.join(srcDir, "tests")];

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
  // Facet 3 navigation shell (spec §7.4, Phase 3).
  "components/shell/",
  "lib/navigation/",
  // Country profile: the Command profile, its deep-dive chrome and shared pieces.
  "app/countries/[slug]/",
  "components/country-profile/",
  // Phase 4 apps: dashboard, achievements, passport (+ its settings panel).
  "components/dashboard/",
  "app/dashboard/",
  "components/achievements/",
  "app/achievements/",
  "components/passport/",
  "app/settings/_components/panels/AccountIdentityPanel.tsx",
  // Phase 4 apps: ThinkPages (+ ThinkTanks, blurbs components), Messages, Halo views.
  "components/thinkpages/",
  "components/thinktanks/",
  "app/thinkpages/",
  "app/thinktanks/",
  "components/messages/",
  "app/messages/",
  "components/halo/",
  // Phase 4 apps: Labs (Onoma, its brand logo, Vexel, map pipeline) and Forum.
  "app/labs/",
  "components/onoma/",
  "app/(forum)/",
  "components/forum/",
  // Phase 4 apps: Admin console (+ the Facet materials lab) and its shared admin components.
  "app/admin/",
  "components/admin/",
  // Phase 4 apps: WikiOS (reader, editors, margin, stashes, repository, commons) and its media player.
  "components/wiki-os/",
  "app/(wiki-os)/",
  "components/media/",
  // Phase 4 apps: Vault (+ the trading-card UI) and Sports (MyLeague, MyClub).
  "app/vault/",
  "components/vault/",
  "components/cards/",
  "components/sports/",
  "app/myleague/",
  "app/myclub/",
  // Phase 4 apps: Builder (all of it, MyCountry tint) and the countries index + public pages.
  "app/builder/",
  "app/countries/_components/",
  "app/countries/page.tsx",
  "app/explore/",
  "app/leaderboards/",
  "app/id/",
  "app/r/",
  "app/realms/",
  "app/feed/",
  "app/hashtags/",
  "app/changelog/",
  "app/stashes/",
  "app/setup/",
  "app/privacy/",
  "app/terms/",
  "app/page.tsx",
  "app/_components/splash/",
  "app/_components/IxStatsSplashPage.tsx",
  "app/_components/HomeClient.tsx",
  "app/_components/GlobalStatsOverview.tsx",
  "app/_components/LeaderboardsSection.tsx",
  "app/_components/LiveGameBanner.tsx",
  "lib/splash/",
  "lib/tier-utils.ts",
  "app/settings/_components/SettingsSidebarNav.tsx",
  // Phase 4 primitives: the shared UI kit itself (status inks, no glass/v2 classes).
  "components/ui/",
  // Phase 4 re-check: MyCountry routes, executive panels, the atomic selector, maps routes.
  "app/mycountry/",
  "components/executive/",
  "components/shared/atomic/",
  "app/maps/",
].map((dir) => dir.split("/").join(path.sep));

const inConverted = (file: string) => FACET_CONVERTED.some((dir) => file.startsWith(dir));

function convertedHits(pattern: RegExp, allowed: ReadonlySet<string> = new Set()): string[] {
  return hits(pattern, allowed).filter((hit) => inConverted(hit.slice(0, hit.indexOf(": "))));
}

// A monochrome logo image (inverted in dark mode).
const DARK_OVERRIDE_ALLOWED = new Set([
  `${path.join("components", "maps", "core", "MapLoadingScreen.tsx")}: dark:invert`,
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

    it("keep the navigation shell on the z-* tokens (no arbitrary z-[…] at all)", () => {
      const shellDir = path.join("components", "shell") + path.sep;
      expect(hits(/\bz-\[[^\]]+\]/g).filter((hit) => hit.startsWith(shellDir))).toEqual([]);
    });

    it("read country lore in the wiki Reading face, not the unloaded serif (Baskerville)", () => {
      const profileDirs = [
        path.join("app", "countries", "[slug]") + path.sep,
        path.join("components", "country-profile") + path.sep,
      ];
      expect(
        hits(/\bfont-serif\b/g).filter((hit) => profileDirs.some((dir) => hit.startsWith(dir)))
      ).toEqual([]);
    });

    it("do not bring back the retired MyCountry surface-kit", () => {
      expect(hits(/surface-kit/g)).toEqual([]);
    });
  });
});
