/**
 * Facet 3 token guard (spec §2.3).
 *
 * Parses src/styles/facet/tokens.css, checks it matches the TS source of truth
 * (src/lib/design/tokens.ts), and computes WCAG contrast for every required pair from the CSS
 * values: labels on every background role, app tints as links and as filled buttons, system
 * colours, in light, dark and Increase Contrast.
 */
import fs from "fs";
import path from "path";

import {
  ACCENT_FILL,
  ACRYLIC,
  APP_IDS,
  APP_TINTS,
  BACKGROUND_ROLES,
  COLOR_ROLES,
  COLOR_ROLES_MORE_CONTRAST,
  CUTOUT_RADIUS,
  FLAG_WATERMARK,
  GLASS_HERO,
  GLOW,
  GOLD,
  ON_SYSTEM_COLOR,
  PHYSICS,
  PRIMARY_MONO,
  RADII,
  STATUS_ALIASES,
  SYSTEM_COLORS,
  TEXT_STYLES,
  TINTED_FILL,
  Z_INDEX,
  type Appearance,
} from "~/lib/design/tokens";

const ROOT = path.resolve(__dirname, "../../..");
const TOKENS_CSS = path.join(ROOT, "src/styles/facet/tokens.css");
const css = fs.readFileSync(TOKENS_CSS, "utf8");

// ─── Minimal CSS block parser ──────────────────────────────────────────────

interface Block {
  /** Normalised preludes from outermost to innermost, e.g. ["@layer base", ":root[data-theme=\"dark\"]"]. */
  stack: string[];
  decls: Map<string, string>;
}

const normalise = (s: string) => s.replace(/\s+/g, " ").trim();

function parseBlocks(source: string): Block[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Block[] = [];
  const stack: { prelude: string; block: Block }[] = [];
  let buffer = "";
  for (const ch of text) {
    if (ch === "{") {
      const block: Block = {
        stack: [...stack.map((s) => s.prelude), normalise(buffer)],
        decls: new Map(),
      };
      stack.push({ prelude: normalise(buffer), block });
      blocks.push(block);
      buffer = "";
    } else if (ch === "}" || ch === ";") {
      const decl = buffer.trim();
      const current = stack[stack.length - 1];
      const colon = decl.indexOf(":");
      if (current && decl.startsWith("--") && colon > 0) {
        current.block.decls.set(decl.slice(0, colon).trim(), normalise(decl.slice(colon + 1)));
      }
      buffer = "";
      if (ch === "}") stack.pop();
    } else {
      buffer += ch;
    }
  }
  return blocks;
}

const blocks = parseBlocks(css);

function block(...stack: string[]): Block {
  const found = blocks.find(
    (b) => b.stack.length === stack.length && b.stack.every((p, i) => p === stack[i])
  );
  if (!found) throw new Error(`tokens.css has no block ${stack.join(" › ")}`);
  return found;
}

function decl(b: Block, name: string): string {
  const value = b.decls.get(name);
  if (value === undefined) throw new Error(`${b.stack.join(" › ")} is missing ${name}`);
  return value;
}

/** The first `@theme static` block holds the light colour roles and system colours. */
const lightRoles = blocks.find(
  (b) => b.stack.length === 1 && b.stack[0] === "@theme static" && b.decls.has("--color-label")
)!;
const darkRoles = block("@layer base", ':root[data-theme="dark"]');
const moreLight = block("@layer base", ':root[data-contrast="more"]');
const moreDark = block("@layer base", ':root[data-theme="dark"][data-contrast="more"]');

const roleBlock = { light: lightRoles, dark: darkRoles } as const;
const moreBlock = { light: moreLight, dark: moreDark } as const;
const APPEARANCES: Appearance[] = ["light", "dark"];

function role(appearance: Appearance, name: string, more = false): string {
  if (more) {
    const override = moreBlock[appearance].decls.get(`--color-${name}`);
    if (override) return override;
  }
  return decl(roleBlock[appearance], `--color-${name}`);
}

function tintBlock(app: string): Block {
  return app === "default"
    ? block("@layer base", ':root, [data-app="admin"]')
    : block("@layer base", `[data-app="${app}"]`);
}

// ─── WCAG contrast ─────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected an opaque #rrggbb colour, got "${hex}"`);
  const channels = [0, 2, 4].map((i) => parseInt(match[1]!.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** `color-mix(in srgb, a weight, b)` / `a` at `weight` alpha over opaque `b`, as #rrggbb. */
function mix(a: string, b: string, weight: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ca, cb] = [channels(a), channels(b)];
  return `#${ca
    .map((c, i) =>
      Math.round(c * weight + cb[i]! * (1 - weight))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

const AA_TEXT = 4.5;
const AA_UI = 3;

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Facet 3 tokens: CSS matches src/lib/design/tokens.ts", () => {
  it.each(APPEARANCES)("colour roles (%s)", (appearance) => {
    for (const [name, value] of Object.entries(COLOR_ROLES[appearance])) {
      expect([name, role(appearance, name)]).toEqual([name, value]);
    }
  });

  it.each(APPEARANCES)("Increase Contrast overrides (%s)", (appearance) => {
    for (const [name, value] of Object.entries(COLOR_ROLES_MORE_CONTRAST[appearance])) {
      expect([name, decl(moreBlock[appearance], `--color-${name}`)]).toEqual([name, value]);
    }
  });

  it.each(APPEARANCES)("system colours (%s)", (appearance) => {
    for (const [name, values] of Object.entries(SYSTEM_COLORS)) {
      expect([name, role(appearance, name)]).toEqual([name, values[appearance]]);
    }
    expect(role(appearance, "on-system")).toBe(ON_SYSTEM_COLOR[appearance]);
  });

  it("tinted-fill inks pull each system colour toward the label", () => {
    const aliases = blocks.find(
      (b) =>
        b.stack.length === 1 && b.stack[0] === "@theme inline static" && b.decls.has("--color-tint")
    )!;
    for (const name of Object.keys(SYSTEM_COLORS)) {
      expect([name, decl(aliases, `--color-${name}-ink`)]).toEqual([
        name,
        `color-mix(in srgb, var(--color-${name}) ${TINTED_FILL.inkMix * 100}%, var(--color-label))`,
      ]);
      expect([name, decl(aliases, `--color-on-${name}`)]).toEqual([name, "var(--color-on-system)"]);
    }
  });

  it("status roles alias their system colour and its ink", () => {
    const aliases = blocks.find(
      (b) =>
        b.stack.length === 1 && b.stack[0] === "@theme inline static" && b.decls.has("--color-tint")
    )!;
    for (const [status, color] of Object.entries(STATUS_ALIASES)) {
      expect([status, decl(aliases, `--color-${status}`)]).toEqual([
        status,
        `var(--color-${color})`,
      ]);
      expect([status, decl(aliases, `--color-${status}-ink`)]).toEqual([
        status,
        `var(--color-${color}-ink)`,
      ]);
    }
  });

  it("status Badge and Alert variants use the status ink, never the bare colour, on a tinted fill", () => {
    const sources = ["src/components/ui/badge.tsx", "src/components/ui/alert.tsx"].map((file) =>
      fs.readFileSync(path.join(ROOT, file), "utf8")
    );
    for (const source of sources) {
      for (const status of Object.keys(STATUS_ALIASES)) {
        // `text-success` next to `bg-success/15` (and not `text-success-ink`) falls below AA.
        expect([status, new RegExp(`text-${status}(?![\\w-])`).test(source)]).toEqual([
          status,
          false,
        ]);
      }
    }
    const badge = sources[0]!;
    for (const status of ["success", "warning", "destructive", "info"]) {
      expect(badge).toContain(`${status}: "bg-${status}/15 text-${status}-ink`);
    }
  });

  it("app tints", () => {
    for (const [app, sets] of Object.entries(APP_TINTS)) {
      const b = tintBlock(app);
      for (const appearance of APPEARANCES) {
        const set = sets[appearance];
        expect([app, decl(b, `--tint-${appearance}`)]).toEqual([app, set.tint]);
        expect([app, decl(b, `--tint-${appearance}-strong`)]).toEqual([app, set.strong]);
        expect([app, decl(b, `--on-tint-${appearance}`)]).toEqual([app, set.onTint]);
      }
    }
  });

  it("every data-app id has a tint scope", () => {
    for (const app of APP_IDS) {
      expect(css).toContain(`[data-app="${app}"]`);
    }
  });

  it("radius scale", () => {
    const theme = blocks.find((b) => b.decls.has("--radius-card"))!;
    for (const [name, px] of Object.entries(RADII)) {
      expect([name, decl(theme, `--radius-${name}`)]).toEqual([name, `${px / 16}rem`]);
    }
  });

  it("z-index scale", () => {
    const theme = blocks.find((b) => b.decls.has("--z-index-base"))!;
    for (const [name, value] of Object.entries(Z_INDEX)) {
      expect([name, decl(theme, `--z-index-${name}`)]).toEqual([name, String(value)]);
    }
  });

  it("text styles", () => {
    for (const [name, style] of Object.entries(TEXT_STYLES)) {
      const b = blocks.find((x) => x.stack[0] === `@utility text-${name}`);
      expect(b).toBeDefined();
      const body = css.slice(css.indexOf(`@utility text-${name} {`));
      const rule = body.slice(0, body.indexOf("}"));
      expect(rule).toContain(`font-size: calc(${style.size / 16}rem * var(--text-scale, 1));`);
      expect(rule).toContain(`calc(${style.lineHeight / 16}rem * var(--text-scale, 1))`);
      expect(rule).toContain(`var(--tw-font-weight, ${style.weight})`);
      expect(rule).toContain(`var(--tw-tracking, ${style.tracking})`);
    }
  });

  it("has no self-referential @theme entries", () => {
    const globals = fs.readFileSync(path.join(ROOT, "src/styles/globals.css"), "utf8");
    for (const source of [css, globals]) {
      expect(source.match(/(--[\w-]+)\s*:\s*var\(\1\)/g) ?? []).toEqual([]);
    }
  });
});

describe("Facet 3 tokens: contrast (spec §2.3)", () => {
  describe.each(APPEARANCES)("%s", (appearance) => {
    describe.each([false, true])("increase contrast: %s", (more) => {
      it.each(["label", "label-secondary"])("%s ≥ 4.5:1 on every background role", (label) => {
        const fg = role(appearance, label, more);
        for (const bg of BACKGROUND_ROLES) {
          const ratio = contrast(fg, role(appearance, bg, more));
          expect({ label, bg, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
        }
      });

      it.each(Object.keys(APP_TINTS))("%s tint", (app) => {
        const b = tintBlock(app);
        const tint = decl(b, more ? `--tint-${appearance}-strong` : `--tint-${appearance}`);
        const onTint = decl(b, `--on-tint-${appearance}`);
        const checks: [string, number, number][] = [
          // Links on plain and grouped pages
          ["tint on background", contrast(tint, role(appearance, "background")), AA_TEXT],
          [
            "tint on background-grouped",
            contrast(tint, role(appearance, "background-grouped")),
            AA_TEXT,
          ],
          // Filled buttons / selection
          ["on-tint on tint", contrast(onTint, tint), AA_TEXT],
          // UI boundaries (controls, focus ring) on every surface
          ...BACKGROUND_ROLES.map(
            (bg) =>
              [`tint on ${bg}`, contrast(tint, role(appearance, bg)), AA_UI] as [
                string,
                number,
                number,
              ]
          ),
        ];
        for (const [pair, ratio, min] of checks) {
          expect({ app, pair, ok: ratio >= min, ratio }).toMatchObject({ ok: true });
        }
      });
    });

    describe.each([false, true])("increase contrast: %s", (more) => {
      // Badge colour variants and ActionPill pressed tones: 12px ink text on a 15% fill.
      it.each(Object.keys(SYSTEM_COLORS))("%s ink on its tinted fill ≥ 4.5:1", (name) => {
        const color = role(appearance, name);
        const ink = mix(color, role(appearance, "label", more), TINTED_FILL.inkMix);
        for (const bg of BACKGROUND_ROLES) {
          const fill = mix(color, role(appearance, bg, more), TINTED_FILL.alpha);
          const ratio = contrast(ink, fill);
          expect({ name, bg, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
        }
      });
    });

    describe.each([false, true])("increase contrast: %s", (more) => {
      // Status Badge variants (success, warning, caution, destructive, info) and tinted Alerts.
      it.each(Object.entries(STATUS_ALIASES))(
        "%s badge (%s-ink on its 15%% fill) ≥ 4.5:1 on every background role",
        (status, name) => {
          const color = role(appearance, name);
          const ink = mix(color, role(appearance, "label", more), TINTED_FILL.inkMix);
          for (const bg of BACKGROUND_ROLES) {
            const fill = mix(color, role(appearance, bg, more), TINTED_FILL.alpha);
            const ratio = contrast(ink, fill);
            expect({ status, bg, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
            // Alert descriptions in a status variant are `label` on the same fill.
            const body = contrast(role(appearance, "label", more), fill);
            expect({ status, bg, label: true, ok: body >= AA_TEXT, body }).toMatchObject({
              ok: true,
            });
          }
        }
      );
    });

    it.each(Object.keys(SYSTEM_COLORS))("system %s", (name) => {
      const color = role(appearance, name);
      const onColor = role(appearance, "on-system");
      const checks: [string, number, number][] = [
        ["on background", contrast(color, role(appearance, "background")), AA_TEXT],
        [`on-${name} on ${name}`, contrast(onColor, color), AA_TEXT],
        ...BACKGROUND_ROLES.map(
          (bg) =>
            [`on ${bg}`, contrast(color, role(appearance, bg)), AA_UI] as [string, number, number]
        ),
      ];
      for (const [pair, ratio, min] of checks) {
        expect({ name, pair, ok: ratio >= min, ratio }).toMatchObject({ ok: true });
      }
    });
  });
});

// ─── Facet 3.1 — identity (spec §16) ─────────────────────────────────────────

/** The identity scalars: the `@layer base › :root` / dark blocks that declare `--primary-fill-mono`. */
const identity = {
  light: blocks.find(
    (b) =>
      b.stack.length === 2 &&
      b.stack[0] === "@layer base" &&
      b.stack[1] === ":root" &&
      b.decls.has("--primary-fill-mono")
  )!,
  dark: blocks.find(
    (b) =>
      b.stack.length === 2 &&
      b.stack[0] === "@layer base" &&
      b.stack[1] === ':root[data-theme="dark"]' &&
      b.decls.has("--primary-fill-mono")
  )!,
} as const;
const pct = (value: number) => `${+(value * 100).toFixed(1)}%`;

describe("Facet 3.1 identity tokens: CSS matches src/lib/design/tokens.ts", () => {
  it("declares the identity blocks for both appearances", () => {
    expect(identity.light).toBeDefined();
    expect(identity.dark).toBeDefined();
  });

  it.each(APPEARANCES)("monochrome primary (%s)", (appearance) => {
    const b = identity[appearance];
    expect(decl(b, "--primary-fill-mono")).toBe(PRIMARY_MONO[appearance].fill);
    expect(decl(b, "--primary-fill-mono-hover")).toBe(PRIMARY_MONO[appearance].hover);
    expect(decl(b, "--on-primary-mono")).toBe(PRIMARY_MONO[appearance].on);
  });

  it("gold primary (MyCountry / Builder)", () => {
    const b = identity.light;
    expect(decl(b, "--gold-from")).toBe(GOLD.from);
    expect(decl(b, "--gold-to")).toBe(GOLD.to);
    expect(decl(b, "--gold-from-hover")).toBe(GOLD.fromHover);
    expect(decl(b, "--gold-to-hover")).toBe(GOLD.toHover);
    expect(decl(b, "--on-gold")).toBe(GOLD.on);
    expect(decl(b, "--gold-rim-edge")).toBe(GOLD.rimEdgeLight);
    const scope = block("@layer base", '[data-app="mycountry"]');
    // The scope that sets the tint palette is the first match; the primary lives in the second.
    const primary = blocks.find(
      (x) =>
        x.stack.length === 2 &&
        x.stack[1] === '[data-app="mycountry"]' &&
        x.decls.has("--primary-fill-image")
    )!;
    expect(scope).toBeDefined();
    expect(decl(primary, "--primary-fill-image")).toBe(
      "linear-gradient(to right, var(--gold-from), var(--gold-to))"
    );
    expect(decl(primary, "--on-primary")).toBe("var(--on-gold)");
    expect(decl(primary, "--primary-rim")).toBe("var(--gold-rim)");
    // Every other scope resets to monochrome (a nested `intel` inside MyCountry is not gold).
    const reset = blocks.find(
      (x) => x.stack[1] === ":root, [data-app]" && x.decls.has("--primary-fill")
    )!;
    expect(decl(reset, "--primary-fill")).toBe("var(--primary-fill-mono)");
    expect(decl(reset, "--primary-fill-image")).toBe("none");
    expect(decl(reset, "--on-primary")).toBe("var(--on-primary-mono)");
  });

  it.each(APPEARANCES)("glass hero tier (%s)", (appearance) => {
    const b = identity[appearance];
    const g = GLASS_HERO[appearance];
    expect(decl(b, "--glass-hero-fill-from")).toBe(pct(g.fillFrom));
    expect(decl(b, "--glass-hero-fill-to")).toBe(pct(g.fillTo));
    expect(decl(b, "--glass-hero-blur")).toBe(`${g.blur}px`);
    expect(decl(b, "--glass-hero-saturate")).toBe(`${g.saturate}%`);
    expect(decl(b, "--glass-hero-wash-from")).toBe(pct(g.washFrom));
    expect(decl(b, "--glass-hero-wash-mid")).toBe(pct(g.washMid));
    // v2 glass: 16–24px blur, 150–180% saturation (spec §16.2).
    expect(g.blur).toBeGreaterThanOrEqual(16);
    expect(g.blur).toBeLessThanOrEqual(24);
    expect(g.saturate).toBeGreaterThanOrEqual(150);
    expect(g.saturate).toBeLessThanOrEqual(180);
  });

  it("glow, flag watermark and physics", () => {
    expect(decl(identity.light, "--glow-opacity")).toBe(String(GLOW.opacity));
    expect(decl(identity.light, "--glow-blur")).toBe(`${GLOW.blur}px`);
    for (const appearance of APPEARANCES) {
      const wm = FLAG_WATERMARK[appearance];
      const b = identity[appearance];
      expect(
        b.decls.get("--flag-watermark-opacity") ?? decl(identity.light, "--flag-watermark-opacity")
      ).toBe(String(wm.opacity));
      expect(
        b.decls.get("--flag-watermark-blend") ?? decl(identity.light, "--flag-watermark-blend")
      ).toBe(wm.blend);
    }
    expect(decl(identity.light, "--flag-watermark-opacity-hover")).toBe(
      String(FLAG_WATERMARK.light.hover)
    );
    expect(decl(identity.light, "--facet-press-scale")).toBe(String(PHYSICS.pressScale));
    expect(decl(identity.light, "--facet-lift-y")).toBe(`${PHYSICS.liftY}px`);
    expect(css).toContain(`--radius-cutout: ${CUTOUT_RADIUS / 16}rem;`);
  });
});

describe("Facet 3.1 identity: contrast", () => {
  describe.each(APPEARANCES)("%s", (appearance) => {
    it("on-primary on the monochrome primary (rest and hover) ≥ 4.5:1", () => {
      const { fill, hover, on } = PRIMARY_MONO[appearance];
      for (const [state, bg] of [
        ["rest", fill],
        ["hover", hover],
      ] as const) {
        const ratio = contrast(on, bg);
        expect({ state, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
      }
    });

    it("the monochrome primary is a ≥ 3:1 boundary on every background role", () => {
      for (const more of [false, true]) {
        for (const bg of BACKGROUND_ROLES) {
          const ratio = contrast(PRIMARY_MONO[appearance].fill, role(appearance, bg, more));
          expect({ bg, more, ok: ratio >= AA_UI, ratio }).toMatchObject({ ok: true });
        }
      }
    });

    it("glass hero: labels stay ≥ 4.5:1 over the thinnest fill, the full tint wash and the glow core", () => {
      const g = GLASS_HERO[appearance];
      const surface = role(appearance, "surface");
      const page = role(appearance, "background-grouped");
      // Worst case: the most transparent fill stop over the grouped page, then the wash at its
      // strongest stop, then a glow blob's centre (opacity × the post-blur peak).
      const glass = mix(surface, page, Math.min(g.fillFrom, g.fillTo));
      for (const [app, sets] of Object.entries(APP_TINTS)) {
        const tint = sets[appearance].tint;
        const washed = mix(tint, glass, g.washFrom);
        const glowed = mix(tint, washed, GLOW.opacity * GLOW.blurPeak);
        for (const label of ["label", "label-secondary"]) {
          for (const bg of [glass, washed, glowed]) {
            const ratio = contrast(role(appearance, label), bg);
            expect({ app, label, bg, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
          }
        }
      }
    });
  });

  it("dark label on every gold stop (rest and hover) ≥ 4.5:1", () => {
    for (const stop of [GOLD.from, GOLD.to, GOLD.fromHover, GOLD.toHover]) {
      const ratio = contrast(GOLD.on, stop);
      expect({ stop, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
    }
  });

  it("the gold rim edge is a ≥ 3:1 boundary on light backgrounds", () => {
    for (const more of [false, true]) {
      for (const bg of BACKGROUND_ROLES) {
        const ratio = contrast(GOLD.rimEdgeLight, role("light", bg, more));
        expect({ bg, more, ok: ratio >= AA_UI, ratio }).toMatchObject({ ok: true });
      }
    }
  });

  it("gold stops are a ≥ 3:1 boundary on every dark background role", () => {
    for (const stop of [GOLD.from, GOLD.to]) {
      for (const bg of BACKGROUND_ROLES) {
        const ratio = contrast(stop, role("dark", bg));
        expect({ stop, bg, ok: ratio >= AA_UI, ratio }).toMatchObject({ ok: true });
      }
    }
  });
});

// ─── Facet 3.1 HIG pass (spec §16.8) ─────────────────────────────────────────

/** Every accent a primitive takes, as the colour it resolves to per appearance. */
const ACCENTS: [string, Record<Appearance, string>][] = [
  ...Object.entries(SYSTEM_COLORS).map(
    ([name, value]) => [name, value] as [string, Record<Appearance, string>]
  ),
  ["gold", GOLD.accent],
];

/** A CSS `contrast(k)` / `brightness(b)` filter on an opaque #rrggbb colour. */
function filterColor(hex: string, tone: { contrast?: number; brightness?: number }): string {
  return `#${[1, 3, 5]
    .map((i) => {
      let c = parseInt(hex.slice(i, i + 2), 16) / 255;
      if (tone.contrast !== undefined) c = (c - 0.5) * tone.contrast + 0.5;
      if (tone.brightness !== undefined) c = c * tone.brightness;
      return Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

describe("Facet 3.1 HIG pass: tokens match src/lib/design/tokens.ts", () => {
  it.each(APPEARANCES)("accent gold, accent fill and the watermark tone (%s)", (appearance) => {
    const b = identity[appearance];
    expect(decl(b, "--gold-accent")).toBe(GOLD.accent[appearance]);
    expect(decl(b, "--accent-fill-mix")).toBe(pct(ACCENT_FILL[appearance]));
    expect(decl(b, "--flag-watermark-tone")).toBe(FLAG_WATERMARK[appearance].tone);
  });

  it("gold rim border and highlight (v2 .facet-mycountry)", () => {
    expect(decl(identity.light, "--gold-rim-border")).toBe(GOLD.rimBorder);
    expect(decl(identity.light, "--gold-rim-highlight")).toBe(GOLD.rimHighlight);
  });

  it("the accent fill matches the tint-fill strength", () => {
    expect(css).toContain(
      `--tint-fill: color-mix(in srgb, var(--tint) ${pct(ACCENT_FILL.light)}, transparent);`
    );
    expect(css).toContain(
      `--tint-fill: color-mix(in srgb, var(--tint) ${pct(ACCENT_FILL.dark)}, transparent);`
    );
  });
});

describe("Facet 3.1 HIG pass: accent contrast", () => {
  describe.each(APPEARANCES)("%s", (appearance) => {
    it.each(ACCENTS.map(([name]) => name))(
      "glass hero accented %s: labels ≥ 4.5:1 over the thinnest fill, the full wash and the glow core",
      (name) => {
        const color = ACCENTS.find(([n]) => n === name)![1][appearance];
        const g = GLASS_HERO[appearance];
        const glass = mix(
          role(appearance, "surface"),
          role(appearance, "background-grouped"),
          Math.min(g.fillFrom, g.fillTo)
        );
        const washed = mix(color, glass, g.washFrom);
        const glowed = mix(color, washed, GLOW.opacity * GLOW.blurPeak);
        for (const label of ["label", "label-secondary"]) {
          for (const bg of [washed, glowed]) {
            const ratio = contrast(role(appearance, label), bg);
            expect({ name, label, bg, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
          }
        }
      }
    );

    describe.each([false, true])("increase contrast: %s", (more) => {
      it.each([
        ...ACCENTS.map(([name, value]) => [name, value[appearance]] as const),
        ...Object.entries(APP_TINTS).map(
          ([app, sets]) =>
            [`${app} tint`, more ? sets[appearance].strong : sets[appearance].tint] as const
        ),
      ])("%s header strip: labels ≥ 4.5:1 on the fill, icon ≥ 3:1, ink ≥ 4.5:1", (name, color) => {
        for (const bg of ["surface", "surface-secondary", "surface-elevated"] as const) {
          const fill = mix(color, role(appearance, bg, more), ACCENT_FILL[appearance]);
          const ink = mix(color, role(appearance, "label", more), 0.8);
          const checks: [string, number, number][] = [
            ["label", contrast(role(appearance, "label", more), fill), AA_TEXT],
            // Secondary copy in the strip (a trailing count, a subtitle) sits on the card's
            // `surface` (CutoutCard variant="card", whose notches are `text-surface`).
            ...(bg === "surface"
              ? ([
                  [
                    "label-secondary",
                    contrast(role(appearance, "label-secondary", more), fill),
                    AA_TEXT,
                  ],
                ] as [string, number, number][])
              : []),
            ["accent icon", contrast(color, fill), AA_UI],
            ["accent ink", contrast(ink, fill), AA_TEXT],
          ];
          for (const [pair, ratio, min] of checks) {
            expect({ name, bg, pair, ok: ratio >= min, ratio }).toMatchObject({ ok: true });
          }
        }
      });
    });

    it("accent gold: ≥ 4.5:1 as text on the page and ≥ 3:1 as an edge on every background role", () => {
      for (const more of [false, true]) {
        const color = GOLD.accent[appearance];
        expect(contrast(color, role(appearance, "background", more))).toBeGreaterThanOrEqual(
          AA_TEXT
        );
        for (const bg of BACKGROUND_ROLES) {
          const ratio = contrast(color, role(appearance, bg, more));
          expect({ bg, more, ok: ratio >= AA_UI, ratio }).toMatchObject({ ok: true });
        }
        // `retint` puts `on-system` text on an accent-filled control.
        const on = contrast(ON_SYSTEM_COLOR[appearance], color);
        expect({ on, ok: on >= AA_TEXT }).toMatchObject({ ok: true });
      }
    });

    it("the flag watermark never drops labels below 4.5:1 (any flag, rest and hover)", () => {
      const wm = FLAG_WATERMARK[appearance];
      // Worst-case flag colour for dark text on a light card is black, for light text on a dark
      // card white; the HIG tone filter caps it first (luminosity/normal blend of a grey = grey).
      const worst =
        appearance === "light"
          ? filterColor("#000000", { contrast: FLAG_WATERMARK.light.toneContrast })
          : filterColor("#ffffff", { brightness: FLAG_WATERMARK.dark.toneBrightness });
      const g = GLASS_HERO[appearance];
      for (const more of [false, true]) {
        const surfaces = {
          "glass hero": mix(
            role(appearance, "surface", more),
            role(appearance, "background-grouped", more),
            Math.min(g.fillFrom, g.fillTo)
          ),
          surface: role(appearance, "surface", more),
        };
        for (const [surfaceName, surface] of Object.entries(surfaces)) {
          for (const [state, opacity] of [
            ["rest", wm.opacity],
            ["hover", wm.hover],
          ] as const) {
            const bg = mix(worst, surface, opacity);
            for (const label of ["label", "label-secondary"]) {
              const ratio = contrast(role(appearance, label, more), bg);
              expect({
                surfaceName,
                state,
                more,
                label,
                ok: ratio >= AA_TEXT,
                ratio,
              }).toMatchObject({ ok: true });
            }
          }
        }
      }
    });
  });

  describe.each(APPEARANCES)("retint (%s)", (appearance) => {
    // `facet-retint`: --tint = the accent's ink (80% toward the label), --tint-fill = the accent
    // at the fill strength, --on-tint = on-system. Tinted badges / `text-tint` / links / filled
    // tint controls / focus rings in an accented subtree.
    it.each(ACCENTS.map(([name]) => name))("%s", (name) => {
      const color = ACCENTS.find(([n]) => n === name)![1][appearance];
      for (const more of [false, true]) {
        const ink = mix(color, role(appearance, "label", more), 0.8);
        const checks: [string, number, number][] = [
          ["ink on background", contrast(ink, role(appearance, "background", more)), AA_TEXT],
          [
            "ink on background-grouped",
            contrast(ink, role(appearance, "background-grouped", more)),
            AA_TEXT,
          ],
          ["on-tint on ink", contrast(ON_SYSTEM_COLOR[appearance], ink), AA_TEXT],
          ...BACKGROUND_ROLES.flatMap((bg) => {
            const fill = mix(color, role(appearance, bg, more), ACCENT_FILL[appearance]);
            return [
              [`ink edge on ${bg}`, contrast(ink, role(appearance, bg, more)), AA_UI],
              [`tinted badge on ${bg}`, contrast(ink, fill), AA_TEXT],
            ] as [string, number, number][];
          }),
        ];
        for (const [pair, ratio, min] of checks) {
          expect({ name, more, pair, ok: ratio >= min, ratio }).toMatchObject({ ok: true });
        }
      }
    });
  });

  it("the v2 opacities are kept (the tone, not a dimmer watermark, makes it AA)", () => {
    expect(FLAG_WATERMARK.light.opacity).toBe(0.14);
    expect(FLAG_WATERMARK.dark.opacity).toBe(0.18);
    expect(FLAG_WATERMARK.light.hover).toBe(0.25);
  });
});

// ─── Facet 3.1 HIG: vibrant labels on acrylic, tinted badges (spec §16.8) ────

/** `rgb(r g b / a)` → [#rrggbb, a]. */
function parseRgba(value: string): [string, number] {
  const match = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(value);
  if (!match) throw new Error(`Expected rgb(r g b / a), got "${value}"`);
  const hex = `#${[match[1], match[2], match[3]]
    .map((c) => Number(c).toString(16).padStart(2, "0"))
    .join("")}`;
  return [hex, Number(match[4])];
}

describe("Facet 3.1 HIG: acrylic tokens match src/lib/design/tokens.ts", () => {
  it.each(APPEARANCES)("acrylic fills (%s)", (appearance) => {
    const b = blocks.find(
      (x) =>
        x.stack.length === 2 &&
        x.stack[0] === "@layer base" &&
        x.stack[1] === (appearance === "light" ? ":root" : ':root[data-theme="dark"]') &&
        x.decls.has("--acrylic-fill")
    )!;
    expect(b).toBeDefined();
    for (const [name, value] of Object.entries(ACRYLIC[appearance].fills)) {
      expect([name, decl(b, name)]).toEqual([name, value]);
    }
  });

  it("material-acrylic resolves secondary labels to the vibrant role", () => {
    const identityCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/identity.css"), "utf8");
    const body = identityCss.slice(identityCss.indexOf("@utility material-acrylic {"));
    expect(body.slice(0, body.indexOf("background-color"))).toContain(
      "--color-label-secondary: var(--color-label-vibrant-secondary);"
    );
  });
});

describe("Facet 3.1 HIG: vibrant labels on acrylic over any content", () => {
  describe.each(APPEARANCES)("%s", (appearance) => {
    // Chrome floats over arbitrary content: the worst backdrop for dark text is black, for light
    // text white (saturate() leaves both unchanged). The glow is composited at full strength in
    // the most damaging hue — the v2 brand blue / indigo / cyan stops (Halo, AppSidebar, TabBar,
    // map island) and, for `FacetMaterial material="acrylic" glow` without the brand, every
    // accent and app tint — at each gradient stop.
    const backdrop = appearance === "light" ? "#000000" : "#ffffff";
    const { opacity, layers, layer3TowardWhite } = ACRYLIC.glow;
    const brand = ["blue", "indigo", "cyan"].map((n) => role(appearance, n)) as [
      string,
      string,
      string,
    ];

    function glowed(base: string, [a, b, c]: [string, string, string]): string[] {
      const l1 = [a, b, a];
      const l2 = [c, b, a];
      const l3 = [a, b, c].map((h) => mix(h, "#ffffff", 1 - layer3TowardWhite));
      return [0, 1, 2].map((i) => {
        let bg = mix(l1[i]!, base, layers[0]! * opacity);
        bg = mix(l2[i]!, bg, layers[1]! * opacity);
        return mix(l3[i]!, bg, layers[2]! * opacity);
      });
    }

    it.each([false, true])("increase contrast: %s", (more) => {
      const hues: [string, [string, string, string]][] = [
        ["brand", brand],
        ...ACCENTS.map(
          ([name, v]) =>
            [name, [v[appearance], v[appearance], v[appearance]]] as [
              string,
              [string, string, string],
            ]
        ),
        ...Object.entries(APP_TINTS).map(([app, sets]) => {
          const t = more ? sets[appearance].strong : sets[appearance].tint;
          return [`${app} tint`, [t, t, t]] as [string, [string, string, string]];
        }),
      ];
      const results: { fill: string; hue: string; label: string; ratio: number }[] = [];
      for (const [fillName, value] of Object.entries(ACRYLIC[appearance].fills)) {
        const [rgb, alpha] = parseRgba(value);
        const base = mix(rgb, backdrop, alpha);
        for (const [hue, stops] of hues) {
          for (const bg of [base, ...glowed(base, stops)]) {
            for (const label of ["label", "label-vibrant-secondary"]) {
              results.push({
                fill: fillName,
                hue,
                label,
                ratio: contrast(role(appearance, label, more), bg),
              });
            }
          }
        }
      }
      // Reduce Transparency / Increase Contrast: the opaque `surface-elevated`.
      for (const label of ["label", "label-vibrant-secondary"]) {
        results.push({
          fill: "surface-elevated (opaque)",
          hue: "none",
          label,
          ratio: contrast(
            role(appearance, label, more),
            role(appearance, "surface-elevated", more)
          ),
        });
      }
      const failures = results.filter((r) => r.ratio < AA_TEXT);
      expect(failures).toEqual([]);
      // The vibrant role is never weaker than the plain secondary label on the opaque surfaces.
      for (const bg of BACKGROUND_ROLES) {
        expect(
          contrast(role(appearance, "label-vibrant-secondary", more), role(appearance, bg, more))
        ).toBeGreaterThanOrEqual(
          contrast(role(appearance, "label-secondary", more), role(appearance, bg, more))
        );
      }
    });
  });
});

describe('Facet 3.1 HIG: Badge variant="secondary" (tint-ink on tint-fill)', () => {
  it("the secondary Badge uses the tint's ink, never the bare tint, on its fill", () => {
    const badge = fs.readFileSync(path.join(ROOT, "src/components/ui/badge.tsx"), "utf8");
    expect(badge).toContain('secondary: "bg-tint-fill text-tint-ink');
    expect(badge).not.toMatch(/secondary: "[^"]*text-tint(?![\w-])/);
    const aliases = blocks.find(
      (b) =>
        b.stack.length === 1 && b.stack[0] === "@theme inline static" && b.decls.has("--color-tint")
    )!;
    expect(decl(aliases, "--color-tint-ink")).toBe(
      `color-mix(in srgb, var(--tint) ${TINTED_FILL.inkMix * 100}%, var(--color-label))`
    );
  });

  describe.each(APPEARANCES)("%s", (appearance) => {
    describe.each([false, true])("increase contrast: %s", (more) => {
      it.each(Object.keys(APP_TINTS))(
        "%s: ink ≥ 4.5:1 on the tint fill (rest and link hover) over every background role",
        (app) => {
          const sets = APP_TINTS[app as keyof typeof APP_TINTS][appearance];
          const tint = more ? sets.strong : sets.tint;
          const ink = mix(tint, role(appearance, "label", more), TINTED_FILL.inkMix);
          for (const bg of BACKGROUND_ROLES) {
            for (const [state, alpha] of [
              ["rest", ACCENT_FILL[appearance]],
              ["hover", 0.2],
            ] as const) {
              const fill = mix(tint, role(appearance, bg, more), alpha);
              const ratio = contrast(ink, fill);
              expect({ app, bg, state, ok: ratio >= AA_TEXT, ratio }).toMatchObject({ ok: true });
            }
          }
        }
      );
    });
  });
});
