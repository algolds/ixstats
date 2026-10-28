/** @jest-environment node */
/**
 * Plan 346: pins the Facet anti-slop gates (docs/reference/facet-design-system.md §8) so they
 * cannot regrow, and the live Facet rules of the stylesheets: the five layers (only chrome and
 * overlay blur), the content-type scopes, facet-on-dark, the one rarity palette, and the accent
 * utilities as Tailwind compiles them.
 *
 * Folds facet-layers, facet-on-dark-tokens, card-rarity-tokens, identity-cascade,
 * no-framer-motion-imports and no-jsx-text-lint-comments (MC-9).
 */
import fs from "fs";
import path from "path";

import { compile } from "@tailwindcss/node";
import { SANCTIONED_TEXTURES } from "~/components/ui/texture-overlay";
import { CARD_RARITY_HEX, SYSTEM_COLORS } from "~/lib/design/tokens";

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
  "components/cards/pack-opening/PackHolographicCover.tsx: text-[7px]", // size="sm" pack art
  "components/thinkpages/composer/ComposerActionBar.tsx: text-[7px]", // 14px count badge
  "components/thinkpages/post/PostComposers.tsx: text-[7px]", // 14px count badge
]);

// Plan 346 gate, lowered after the 2026-09-30 Facet conversion (was 173). Keep only skeletons
// (prefer <Skeleton>) and genuine live/unread indicators.
const ANIMATE_PULSE_CEILING = 15;

/** Surfaces converted to Facet primitives (2026-09-30); their stricter gates live below. */
const FACET_CONVERTED = [
  "components/mycountry/",
  "components/maps/",
  "app/help/",
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
  // Phase 4 apps: Labs (Onoma, its brand logo, Vexel). The XenForo bridge (Forum) is gone (4b).
  "app/labs/",
  "components/onoma/",
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
  "app/_components/front-page/",
  "app/_components/HomeClient.tsx",
  "lib/tier-utils.ts",
  // Phase 4 primitives: the shared UI kit itself (status inks, no glass/v2 classes).
  "components/ui/",
  // Phase 4 re-check: MyCountry routes, executive panels, maps routes.
  "app/mycountry/",
  "components/executive/",
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
 * Gradients come from sanctioned classes, not ad-hoc palette stops. The interaction sheet
 * (styles/facet/interaction.css) owns the primary and gold paints, the layer sheet
 * (styles/facet/layers.css) owns the pane wash, and the content-art sheet (styles/card-art.css)
 * owns the aurora and foil paints and `card-art-linear-*`; raw gradient utilities are only
 * image scrims on role/black/white/transparent stops.
 */
const SANCTIONED_GRADIENT_CLASSES = [
  "facet-primary",
  "facet-gold",
  "facet-aurora",
  "facet-foil",
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
 * Blur comes from the floating layers (`facet-chrome`, `facet-overlay`, FacetMaterial). A raw `backdrop-blur-*`/`backdrop-saturate-*` utility or an
 * inline `backdropFilter` in converted feature code is a hand-rolled material. `backdrop-blur-none`
 * (turning a primitive's blur off) is fine.
 */
const RAW_BACKDROP = /(?<![\w-])backdrop-(?:blur|saturate)(?:-[\w[\]/.()%-]+)?(?![\w-])/g;
const INLINE_BACKDROP = /\b(?:Webkit)?[bB]ackdropFilter\s*:/g;
const RAW_BACKDROP_ALLOWED = new Set([
  // The drill sheet's own blur (pinned to exactly one by the drill-sheet test above).
  `${path.join("components", "mycountry", "shell", "DrillSheets.tsx")}: backdrop-blur-xl`,
]);

/**
 * Textures in converted feature code are the sanctioned ones
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

  // Plan 339: framer-motion is only a transitive dependency of `motion`.
  it("imports motion from motion/react, never framer-motion directly", () => {
    expect(hits(/from\s+["']framer-motion[^"']*["']/g)).toEqual([]);
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
    it("defines every sanctioned gradient class in its sheet", () => {
      const identity = ["facet/interaction.css", "card-art.css"]
        .map((sheet) => fs.readFileSync(path.join(srcDir, "styles", sheet), "utf-8"))
        .join("\n");
      for (const name of SANCTIONED_GRADIENT_CLASSES) {
        expect([name, new RegExp(`(@utility ${name} \\{|\\.${name}\\b)`).test(identity)]).toEqual([
          name,
          true,
        ]);
      }
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

    it("blur only through the chrome and overlay layers (no raw backdrop-blur utilities)", () => {
      const raw = convertedHits(RAW_BACKDROP, RAW_BACKDROP_ALLOWED).filter(
        (hit) => !hit.endsWith(": backdrop-blur-none")
      );
      expect(raw).toEqual([]);
      expect(convertedHits(INLINE_BACKDROP)).toEqual([]);
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
  });
});

/**
 * MC-9: a `// oxlint-disable-next-line` written between JSX tags is JSX text, not a comment, so it
 * rendered as literal text in the notification tray. Inside JSX a directive has to be a
 * `{/* ... *\/}` expression comment. A `//` lint directive whose previous line closes a JSX tag
 * (ends in `>` but not `=>`) is where it becomes visible text.
 */
function jsxTextDirectives(source: string): number[] {
  const lines = source.split("\n");
  const found: number[] = [];
  lines.forEach((line, i) => {
    if (!/^\/\/\s*(oxlint|eslint)-disable/.test(line.trim())) return;
    const prev = (lines[i - 1] ?? "").trimEnd();
    if (prev.endsWith(">") && !prev.endsWith("=>")) found.push(i + 1);
  });
  return found;
}

describe("lint directives inside JSX (MC-9)", () => {
  it("detects a directive written as JSX text, and not one after an arrow", () => {
    const sample = [
      '<span className="x">',
      "  // oxlint-disable-next-line",
      "  {value}",
      "</span>",
    ];
    expect(jsxTextDirectives(sample.join("\n"))).toEqual([2]);
    expect(jsxTextDirectives("const f = () =>\n  // oxlint-disable-next-line\n  g();")).toEqual([]);
  });

  it("no .tsx file renders a lint directive as text", () => {
    const offenders = sources
      .filter(({ file }) => file.endsWith(".tsx"))
      .flatMap(({ file, content }) => jsxTextDirectives(content).map((line) => `${file}:${line}`));
    expect(offenders).toEqual([]);
  });
});

const STYLES = path.join(srcDir, "styles");
const LAYERS = path.join(STYLES, "facet/layers.css");
const GLOBALS = path.join(STYLES, "globals.css");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function filesUnder(dir: string, extensions: RegExp): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "node_modules" ? [] : filesUnder(full, extensions);
    return extensions.test(entry.name) ? [full] : [];
  });
}

describe("Facet layers", () => {
  const layers = stripComments(fs.readFileSync(LAYERS, "utf8"));
  const utility = (name: string) =>
    new RegExp(`@utility ${name} \\{([\\s\\S]*?)\\n\\}`).exec(layers)?.[1] ?? "";

  it.each(["facet-canvas", "facet-pane", "facet-well", "facet-chrome", "facet-overlay"])(
    "defines the %s layer utility",
    (name) => {
      expect(layers).toMatch(new RegExp(`@utility ${name} \\{`));
    }
  );

  it("blurs only chrome and overlay (the pane has no backdrop-filter)", () => {
    expect(utility("facet-pane")).not.toMatch(/backdrop-filter/);
    expect(utility("facet-chrome")).toMatch(/backdrop-filter/);
    expect(utility("facet-overlay")).toMatch(/backdrop-filter/);
  });

  it("chrome points secondary labels at the vibrant role; pane and well read the accent before the tint", () => {
    expect(utility("facet-chrome")).toMatch(
      /--color-label-secondary: var\(--color-label-vibrant-secondary\)/
    );
    expect(utility("facet-pane")).toMatch(/var\(--facet-accent, var\(--tint\)\)/);
    expect(utility("facet-well")).toMatch(/var\(--facet-accent, var\(--tint\)\)/);
  });

  // A blur that is switched off (`none`) and a scalar declaration are not glass; painting one is.
  it("is the only stylesheet of the four Facet sheets that blurs or paints a glass fill", () => {
    const sheets = filesUnder(path.join(STYLES, "facet"), /\.css$/);
    expect(sheets.map((f) => path.basename(f)).sort()).toEqual([
      "interaction.css",
      "layers.css",
      "shell.css",
      "tokens.css",
    ]);
    const paintsGlass = /backdrop-filter:\s*(?!none)\S|var\(--(?:pane|chrome|overlay)-fill[,)]/;
    const offenders = sheets
      .filter((f) => f !== LAYERS)
      .filter((f) => paintsGlass.test(stripComments(fs.readFileSync(f, "utf8"))));
    expect(offenders.map((f) => path.relative(srcDir, f))).toEqual([]);
  });

  // A stylesheet imported from TypeScript is compiled on its own, without tokens.css, so it cannot
  // use Tailwind directives or the custom variants. globals.css is the one entry that carries them.
  it("stylesheets imported from components use no @variant, @utility, @apply or @theme", () => {
    const importRe = /^\s*import\s+["']([^"']+\.css)["']/gm;
    const offenders: string[] = [];
    for (const { file, content } of sources) {
      for (const [, spec] of content.matchAll(importRe)) {
        const resolved = spec!.startsWith("~/")
          ? path.join(srcDir, spec!.slice(2))
          : path.resolve(path.dirname(path.join(srcDir, file)), spec!);
        if (
          !resolved.startsWith(STYLES + path.sep) ||
          resolved === GLOBALS ||
          !fs.existsSync(resolved)
        ) {
          continue;
        }
        if (
          /@(variant|utility|apply|theme)\b/.test(stripComments(fs.readFileSync(resolved, "utf8")))
        ) {
          offenders.push(`${file} -> ${path.relative(srcDir, resolved)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each([
    ["prose", /max-width:\s*70ch/],
    ["data", /font-variant-numeric:\s*tabular-nums/],
    ["visualization", /padding:\s*0/],
    ["feed", /border-top:\s*1px solid var\(--color-separator\)/],
  ])("[data-content=%s] carries its standard", (type, rule) => {
    const body =
      new RegExp(`\\[data-content="${type}"\\][^{]*\\{([^}]*)\\}`).exec(layers)?.[1] ?? "";
    expect(body).toMatch(rule);
  });
});

describe("facet-on-dark", () => {
  const ROLES = ["red", "yellow", "green", "blue", "indigo"] as const;
  const block =
    /@utility facet-on-dark \{([^}]*)\}/.exec(
      fs.readFileSync(path.join(STYLES, "utilities.css"), "utf8")
    )?.[1] ?? "";

  it.each(ROLES)("binds %s to its dark-theme value in tokens.ts", (role) => {
    const match = new RegExp(`--color-${role}:\\s*(#[0-9a-fA-F]{6});`).exec(block);
    expect(match?.[1]?.toLowerCase()).toBe(SYSTEM_COLORS[role].dark.toLowerCase());
  });

  it("rebinds only those five roles", () => {
    expect((block.match(/--color-[a-z]+:/g) ?? []).sort()).toEqual(
      ROLES.map((r) => `--color-${r}:`).sort()
    );
  });
});

/**
 * One rarity palette: six Facet tokens declared once and the same in both themes, mirrored in CARD_RARITY_HEX, and the
 * card face reading them through `data-card-rarity` only (no rarity utility classes).
 */
describe("card rarity tokens", () => {
  /** Every sheet, so a per-theme override in any of them counts as a second declaration. */
  const allSheets = filesUnder(STYLES, /\.css$/)
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const ATTRIBUTE: Record<keyof typeof CARD_RARITY_HEX, string> = {
    common: "COMMON",
    uncommon: "UNCOMMON",
    rare: "RARE",
    "ultra-rare": "ULTRA_RARE",
    epic: "EPIC",
    legendary: "LEGENDARY",
  };

  it("declares each rarity once, with its CARD_RARITY_HEX value, and no other rarity token", () => {
    for (const [name, hex] of Object.entries(CARD_RARITY_HEX)) {
      const declarations = [
        ...allSheets.matchAll(new RegExp(`--color-rarity-${name}:\\s*([^;]+);`, "g")),
      ];
      expect({ name, values: declarations.map((m) => m[1]!.trim()) }).toEqual({
        name,
        values: [hex],
      });
    }
    const names = [...allSheets.matchAll(/--color-rarity-([a-z-]+):/g)].map((m) => m[1]);
    expect(names.sort()).toEqual(Object.keys(CARD_RARITY_HEX).sort());
  });

  it("maps every data-card-rarity value to its token in the card art sheet", () => {
    const cardArt = fs.readFileSync(path.join(STYLES, "card-art.css"), "utf8");
    expect(cardArt).toMatch(
      /\[data-card-rarity\]\s*\{\s*--card-rarity:\s*var\(--color-rarity-common\);/
    );
    for (const [name, attribute] of Object.entries(ATTRIBUTE)) {
      if (name === "common") continue;
      expect(cardArt).toMatch(
        new RegExp(
          `\\[data-card-rarity="${attribute}"\\]\\s*\\{\\s*--card-rarity:\\s*var\\(--color-rarity-${name}\\);`
        )
      );
    }
  });

  it("is read only through data-card-rarity, never as a rarity utility class", () => {
    // The light-theme edge and gem are darkened at the element (--card-rarity-paint); a utility would paint the raw hue.
    const rarityUtility = /(?<![\w-])(?:text|bg|border|fill|stroke)-rarity-/;
    const offenders = filesUnder(srcDir, /\.(?:tsx?|css|mdx?)$/).filter(
      (file) => file !== __filename && rarityUtility.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders.map((file) => path.relative(srcDir, file))).toEqual([]);
  });
});

interface CompiledRule {
  selector: string;
  body: string;
  /** Enclosing at-rules, outermost first. */
  conditions: string[];
}

/** Flatten nested CSS (Tailwind's output keeps `&` nesting) into rules with full selectors. */
function flattenCss(css: string): CompiledRule[] {
  const rules: CompiledRule[] = [];
  const walk = (source: string, parents: string[], conditions: string[]) => {
    let i = 0;
    let start = 0;
    let decls = "";
    while (i < source.length) {
      const ch = source[i]!;
      if (ch === "{") {
        const prelude = source.slice(start, i).trim();
        let depth = 1;
        let j = i + 1;
        while (j < source.length && depth > 0) {
          if (source[j] === "{") depth++;
          else if (source[j] === "}") depth--;
          j++;
        }
        const body = source.slice(i + 1, j - 1);
        if (prelude.startsWith("@")) {
          walk(body, parents, [...conditions, prelude.replace(/\s+/g, " ")]);
        } else {
          const selectors = prelude.split(",").map((part) => part.trim());
          const full =
            parents.length === 0
              ? selectors
              : parents.flatMap((parent) =>
                  selectors.map((sel) =>
                    sel.includes("&") ? sel.replace(/&/g, parent) : `${parent} ${sel}`
                  )
                );
          walk(body, full, conditions);
        }
        i = j;
        start = i;
        continue;
      }
      if (ch === ";") {
        decls += source.slice(start, i + 1);
        start = i + 1;
      }
      i++;
    }
    if (parents.length > 0 && decls.trim()) {
      for (const selector of parents) rules.push({ selector, body: decls, conditions });
    }
  };
  walk(css, [], []);
  return rules;
}

/** The real token and identity sheets, compiled with Tailwind. */
describe("accent utilities as Tailwind compiles them", () => {
  let rules: CompiledRule[] = [];

  beforeAll(async () => {
    const entry = [
      '@import "tailwindcss/theme.css" layer(theme);',
      '@import "tailwindcss/utilities.css" layer(utilities);',
      '@import "./facet/tokens.css";',
      '@import "./facet/interaction.css";',
    ].join("\n");
    const compiler = await compile(entry, { base: STYLES, onDependency: () => undefined });
    const css = compiler.build([
      "facet-press",
      "facet-lift",
      "bg-facet-accent-fill",
      "text-facet-accent",
      "text-facet-accent-ink",
      "text-label-secondary",
      "text-muted-foreground",
      "text-tint-ink",
    ]);
    rules = flattenCss(css.slice(css.indexOf("@layer utilities")));
  }, 30_000);

  const rulesFor = (cls: string) =>
    rules.filter((rule) =>
      new RegExp(`\\.${cls.replace("/", "\\\\/")}(?![\\w-])`).test(rule.selector)
    );
  const declares = (cls: string, pattern: RegExp) =>
    rulesFor(cls).some((r) => pattern.test(r.body));

  it.each([
    ["bg-facet-accent-fill", /var\(--facet-accent, var\(--tint\)\) var\(--accent-fill-mix\)/],
    ["text-facet-accent", /color:\s*var\(--facet-accent, var\(--tint\)\)/],
    ["text-facet-accent-ink", /80%, var\(--color-label\)/],
    // Secondary labels read the variable at the element, so a chrome scope re-resolves them.
    ["text-label-secondary", /color:\s*var\(--color-label-secondary\)/],
    ["text-muted-foreground", /color:\s*var\(--color-label-secondary\)/],
    // Badge variant="tinted": the tint pulled toward the label.
    ["text-tint-ink", /color-mix\(in srgb, var\(--tint\) 80%, var\(--color-label\)\)/],
  ])("%s falls back to the app tint or re-resolves at the element", (cls, pattern) => {
    expect(declares(cls, pattern)).toBe(true);
  });

  it.each([
    ["facet-press", /scale:\s*none/],
    ["facet-lift", /translate:\s*none/],
  ])("%s drops its movement under Reduce Motion (OS and in-app)", (cls, drop) => {
    const rulesOf = rulesFor(cls);
    expect(
      rulesOf.some(
        (r) => r.conditions.includes("@media (prefers-reduced-motion: reduce)") && drop.test(r.body)
      )
    ).toBe(true);
    expect(
      rulesOf.some((r) => r.selector.includes('[data-motion="reduced"]') && drop.test(r.body))
    ).toBe(true);
  });
});

/** tw-animate utilities: the package is not installed and nothing defines them, so they animate nothing. */
export const TW_ANIMATE =
  /(?<![\w-])(?:data-\[[^\]]+\]:)*(?:animate-in|animate-out|fade-(?:in|out)(?:-\d+)?|zoom-(?:in|out)(?:-\d+)?|slide-(?:in-from|out-to)-(?:top|bottom|left|right)(?:-\d+)?|spin-(?:in|out)(?:-\d+)?)(?![\w-])/g;

describe("Facet kit guards", () => {
  it("has no empty className attributes", () => {
    expect(hits(/className=""/g)).toEqual([]);
  });

  it("uses no tw-animate classes (not installed)", () => {
    expect(hits(TW_ANIMATE)).toEqual([]);
  });

  // Tailwind v4 scale-*/translate-* write the `scale`/`translate` properties, which a
  // `transform` entry never animates.
  it("arbitrary transition lists name scale/translate, not transform", () => {
    expect(hits(/transition-\[[^\]]*\btransform\b[^\]]*\]/g)).toEqual([]);
  });

  // Controls change colour on press; facet-press (scale) is for pressable cards and tiles.
  it("controls do not scale on press", () => {
    const controls = [
      "button",
      "switch",
      "segmented-control",
      "toggle",
      "toggle-group",
      "action-pill",
      "facet-list",
      "tabs",
      "select",
      "dropdown-menu",
    ].map((name) => path.join("components", "ui", `${name}.tsx`));
    const offenders = sources
      .filter(({ file, content }) => controls.includes(file) && /\bfacet-press/.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  // Decorative or duplicate kit pieces replaced by Facet primitives; they must not come back.
  it.each([
    "components/ui/backlight",
    "components/ui/tooltip-card",
    "components/ui/magicui/interactive-grid-pattern",
    "components/ui/magicui/progressive-blur",
    "components/ui/magicui/animated-theme-toggler",
    "components/ui/text-reveal",
    "components/ui/bg-image-texture",
    "components/ui/status-indicator",
    "components/shared/charts",
  ])("%s stays removed", (mod) => {
    expect(
      fs.existsSync(path.join(srcDir, `${mod}.tsx`)) || fs.existsSync(path.join(srcDir, mod))
    ).toBe(false);
    expect(hits(new RegExp(`~/${mod}["/]`, "g"))).toEqual([]);
  });
});
