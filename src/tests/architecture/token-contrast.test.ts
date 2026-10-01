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
  ON_SYSTEM_COLOR,
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
