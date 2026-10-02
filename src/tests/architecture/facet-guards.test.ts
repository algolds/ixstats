/** @jest-environment node */
/**
 * Plan 346: pins the Facet anti-slop gates (docs/reference/facet-design-system.md §8) so they
 * cannot regrow. (Onoma, `src/app/labs/onoma`, was excluded until its Facet 3 conversion.)
 */
import fs from "fs";
import path from "path";

import { SANCTIONED_TEXTURES } from "~/components/ui/texture-overlay";

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

/**
 * Gradients come from sanctioned classes, not ad-hoc palette stops. The identity sheet
 * (styles/facet/identity.css) owns the glass wash, aurora/foil/radiance and jewel paints; card art
 * owns `card-art-linear-*` (styles/card-art.css); raw gradient utilities are only image scrims on
 * role/black/white/transparent stops.
 */
const SANCTIONED_GRADIENT_CLASSES = [
  "material-hero",
  "material-acrylic",
  "facet-primary",
  "facet-gold",
  "facet-aurora",
  "facet-radiance",
  "facet-foil",
  "facet-jewel",
] as const;

/** Tailwind palette stops (`from-amber-500`, `via-blue-400/20`…) — the "ad-hoc palette gradient". */
const PALETTE_STOP =
  /(?<![\w-])(?:from|via|to)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g;

/**
 * Artwork that keeps its own palette gradients: trading-card faces, backs, holographic covers,
 * pack art, reveal and crafting flourishes and cosmetic frames (content, spec §14 Vault), and the
 * MyCountry logo's gold artwork.
 */
const ART_GRADIENT_FILES = [
  "components/cards/",
  "components/vault/NeonFrameOverlay.tsx",
  "components/vault/VaultParticleExplosionModal.tsx",
  "components/mycountry/shared/primitives/mycountry-logo.tsx",
].map((dir) => dir.split("/").join(path.sep));

/**
 * Facet 3.1 (spec §16.1): blur comes from the glass/acrylic materials (`material-*`, FacetCard
 * `variant="glass"`, FacetMaterial). A raw `backdrop-blur-*`/`backdrop-saturate-*` utility or an
 * inline `backdropFilter` in converted feature code is a hand-rolled material. `backdrop-blur-none`
 * (turning a primitive's blur off) is fine.
 */
const RAW_BACKDROP = /(?<![\w-])backdrop-(?:blur|saturate)(?:-[\w[\]/.()%-]+)?(?![\w-])/g;
const INLINE_BACKDROP = /\b(?:Webkit)?[bB]ackdropFilter\s*:/g;
const RAW_BACKDROP_ALLOWED = new Set([
  // The drill sheet's own blur (pinned to exactly one by the drill-sheet test above).
  `${path.join("components", "mycountry", "shell", "DrillSheets.tsx")}: backdrop-blur-xl`,
]);
const INLINE_BACKDROP_FILES = [
  // The rare-card reveal moment (Vault flourish, spec §8) frosts the stage behind the card.
  "components/cards/pack-opening/Stage3_CardReveal.tsx",
  // The progressive blur primitive is a material itself (stepped backdrop blur).
  "components/ui/magicui/progressive-blur.tsx",
].map((dir) => dir.split("/").join(path.sep));

/**
 * Facet 3.1 (spec §16.8): textures in converted feature code are the sanctioned ones
 * (`SANCTIONED_TEXTURES`: dots, grid, paperGrain, chevron — clamped to 0.05 by TextureOverlay).
 * Card art (`components/cards/`) keeps its own textures. Allowlisted: legacy uses pending their app's
 * next pass.
 */
const TEXTURE_ATTR = /\btexture=(?:"(\w+)"|\{"(\w+)"\})/g;
const UNSANCTIONED_TEXTURE_ALLOWED = new Set<string>([]);

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

    it("defines every sanctioned gradient class in the identity sheet (Facet 3.1)", () => {
      const identity = fs.readFileSync(
        path.join(srcDir, "styles", "facet", "identity.css"),
        "utf-8"
      );
      for (const name of SANCTIONED_GRADIENT_CLASSES) {
        expect([name, new RegExp(`(@utility ${name} \\{|\\.${name}\\b)`).test(identity)]).toEqual([
          name,
          true,
        ]);
      }
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

    it("use the --z-index scale instead of arbitrary high z-index values", () => {
      expect(convertedHits(/\bz-\[\d{4,}\]/g)).toEqual([]);
    });

    it("have no hex colour literals in class names", () => {
      expect(convertedHits(/\[#[0-9a-fA-F]{3,8}\]/g)).toEqual([]);
    });

    it("draw gradients with sanctioned classes, never ad-hoc palette stops (Facet 3.1)", () => {
      const offenders = convertedHits(PALETTE_STOP).filter(
        (hit) => !ART_GRADIENT_FILES.some((dir) => hit.startsWith(dir))
      );
      expect(offenders).toEqual([]);
    });

    it("keep raw gradient utilities to image scrims (no palette stops on the same element)", () => {
      const gradient =
        /\bbg-(?:gradient-to-[a-z]+|linear-[\w-]+|radial(?:-[\w-]+)?|conic(?:-[\w-]+)?)\b/;
      const offenders = sources
        .filter(
          ({ file }) => inConverted(file) && !ART_GRADIENT_FILES.some((d) => file.startsWith(d))
        )
        .flatMap(({ file, content }) =>
          content
            .split("\n")
            .map((line, index) => ({ line, index }))
            .filter(({ line }) => gradient.test(line) && new RegExp(PALETTE_STOP.source).test(line))
            .map(({ index }) => `${file}:${index + 1}`)
        );
      expect(offenders).toEqual([]);
    });

    it("blur only through the glass/acrylic materials (no raw backdrop-blur utilities)", () => {
      const raw = convertedHits(RAW_BACKDROP, RAW_BACKDROP_ALLOWED).filter(
        (hit) => !hit.endsWith(": backdrop-blur-none")
      );
      expect(raw).toEqual([]);
      const inline = convertedHits(INLINE_BACKDROP).filter(
        (hit) => !INLINE_BACKDROP_FILES.some((file) => hit.startsWith(file))
      );
      expect(inline).toEqual([]);
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

    it("use only the sanctioned textures (Facet 3.1)", () => {
      const sanctioned = new Set<string>(SANCTIONED_TEXTURES);
      const offenders = sources
        .filter(
          ({ file }) => inConverted(file) && !file.startsWith(path.join("components", "cards"))
        )
        .flatMap(({ file, content }) =>
          [...content.matchAll(TEXTURE_ATTR)]
            .map((m) => m[1] ?? m[2]!)
            .filter((texture) => texture !== "none" && !sanctioned.has(texture))
            .map((texture) => `${file}: ${texture}`)
        )
        .filter((hit) => !UNSANCTIONED_TEXTURE_ALLOWED.has(hit));
      expect(offenders).toEqual([]);
    });

    it("do not bring back the retired MyCountry surface-kit", () => {
      expect(hits(/surface-kit/g)).toEqual([]);
    });
  });
});
