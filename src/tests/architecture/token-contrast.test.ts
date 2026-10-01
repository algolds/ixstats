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
    for (const status of Object.keys(STATUS_ALIASES)) {
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
