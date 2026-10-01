/** @jest-environment node */
/**
 * Facet 3.1 HIG pass (spec §16.8): the rims win the cascade.
 *
 * `facet-gold-rim` / `facet-tint-rim` used to lose to `material-hero` (emitted after it) and to
 * `border-separator` / `border-<hue>` on the same element, because Tailwind sorts utilities by
 * property order, not by intent. This compiles the real identity sheet with Tailwind and checks that
 * every rim declaration out-specifies the surface borders it competes with, so the rim shows on the
 * glass hero and the opaque card in any emit order, in both themes and under Increase Contrast.
 */
import path from "path";

import { compile } from "@tailwindcss/node";

const STYLES = path.resolve(__dirname, "../../styles");
const ENTRY = [
  '@import "tailwindcss/theme.css" layer(theme);',
  '@import "tailwindcss/utilities.css" layer(utilities);',
  '@import "./facet/tokens.css";',
  '@import "./facet/identity.css";',
].join("\n");

interface Rule {
  selector: string;
  body: string;
  /** Enclosing at-rules, outermost first. */
  conditions: string[];
}

/** Flatten nested CSS (Tailwind's output keeps `&` nesting) into rules with full selectors. */
function flatten(css: string): Rule[] {
  const rules: Rule[] = [];
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

/** (ids, classes + attributes + pseudo-classes, types) — `:where()` counts zero. */
function specificity(selector: string): [number, number, number] {
  const stripped = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "");
  const ids = (stripped.match(/#[\w-]+/g) ?? []).length;
  const classes =
    (stripped.match(/\.(?:\\.|[\w-])+/g) ?? []).length +
    (stripped.match(/\[[^\]]+\]/g) ?? []).length +
    (stripped.match(/:(?!:)[\w-]+/g) ?? []).length;
  return [ids, classes, 0];
}

const beats = (a: [number, number, number], b: [number, number, number]) =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1];

let rules: Rule[] = [];

beforeAll(async () => {
  const compiler = await compile(ENTRY, { base: STYLES, onDependency: () => undefined });
  const css = compiler.build([
    "facet-gold-rim",
    "facet-tint-rim",
    "material-hero",
    "material-acrylic",
    "border-separator",
    "border-tint/30",
    "border-green/40",
    "facet-retint",
    "bg-facet-accent-fill",
    "text-facet-accent",
    "text-facet-accent-ink",
  ]);
  const utilities = css.slice(css.indexOf("@layer utilities"));
  rules = flatten(utilities);
}, 30_000);

const setsBorderColor = (body: string) => /(?:^|[;\s])border(?:-color)?\s*:/.test(body);
const rulesFor = (cls: string) =>
  rules.filter((rule) =>
    new RegExp(`\\.${cls.replace("/", "\\\\/")}(?![\\w-])`).test(rule.selector)
  );

describe("rims out-specify the surface borders (any emit order)", () => {
  it.each(["facet-gold-rim", "facet-tint-rim"])("%s", (rim) => {
    const rimRules = rulesFor(rim).filter((rule) => setsBorderColor(rule.body));
    expect(rimRules.length).toBeGreaterThan(0);
    const competitors = [
      "material-hero",
      "material-acrylic",
      "border-separator",
      "border-tint\\/30",
      "border-green\\/40",
    ]
      .flatMap((cls) => rulesFor(cls))
      .filter((rule) => setsBorderColor(rule.body));
    expect(competitors.length).toBeGreaterThan(0);
    // The weakest rim rule (its base) must beat every competitor that applies at rest (the material
    // Increase Contrast borders included).
    const weakestRim = rimRules
      .map((rule) => specificity(rule.selector))
      .reduce((a, b) => (beats(a, b) ? b : a));
    const losses = competitors
      // Pointer states and the expanded Halo sheet are chrome states, not card borders.
      .filter((rule) => !/:hover|:focus|:active|\[data-expanded/.test(rule.selector))
      .filter((rule) => !beats(weakestRim, specificity(rule.selector)))
      .map((rule) => `${rule.selector} ${JSON.stringify(specificity(rule.selector))}`);
    expect({ rim, weakestRim, losses }).toEqual({ rim, weakestRim, losses: [] });
  });

  it("Increase Contrast turns the rims into ≥ 3:1 edges (OS and in-app)", () => {
    const gold = rulesFor("facet-gold-rim");
    expect(
      gold.some(
        (r) =>
          r.conditions.includes("@media (prefers-contrast: more)") && /--gold-rim-edge/.test(r.body)
      )
    ).toBe(true);
    expect(
      gold.some(
        (r) => r.selector.includes('[data-contrast="more"]') && /--gold-rim-edge/.test(r.body)
      )
    ).toBe(true);
    const tint = rulesFor("facet-tint-rim");
    expect(
      tint.some(
        (r) =>
          r.conditions.includes("@media (prefers-contrast: more)") &&
          /border-color:\s*var\(--facet-accent, var\(--tint\)\)/.test(r.body)
      )
    ).toBe(true);
  });

  it("the rim keeps the shared shadow stack (glow and lift slots compose with it)", () => {
    for (const rim of ["facet-gold-rim", "facet-tint-rim"]) {
      const base = rulesFor(rim).find((r) => /box-shadow/.test(r.body))!;
      expect(base.body).toContain("var(--facet-glow-shadow, 0 0 #0000)");
      expect(base.body).toContain("var(--tw-inset-shadow, 0 0 #0000)");
    }
  });
});

describe("accent utilities", () => {
  it("bg-facet-accent-fill / text-facet-accent fall back to the app tint", () => {
    expect(
      rulesFor("bg-facet-accent-fill").some((r) =>
        /var\(--facet-accent, var\(--tint\)\) var\(--accent-fill-mix\)/.test(r.body)
      )
    ).toBe(true);
    expect(
      rulesFor("text-facet-accent").some((r) =>
        /color:\s*var\(--facet-accent, var\(--tint\)\)/.test(r.body)
      )
    ).toBe(true);
    expect(
      rulesFor("text-facet-accent-ink").some((r) => /80%, var\(--color-label\)/.test(r.body))
    ).toBe(true);
  });

  it("facet-retint points the subtree's tint at the accent (and never at itself)", () => {
    const body = rulesFor("facet-retint")
      .map((r) => r.body)
      .join("");
    // The accent's ink (≥ 4.5:1 as text on its own fill), not the raw accent.
    expect(body).toMatch(
      /--tint:\s*color-mix\(in srgb, var\(--facet-accent\) 80%, var\(--color-label\)\);/
    );
    expect(body).toMatch(/--tint-fill:/);
    expect(body).toMatch(/--on-tint:\s*var\(--color-on-system\)/);
    // `--tint: var(--facet-accent, var(--tint))` would be a cycle on the same element.
    expect(body).not.toMatch(/--tint:[^;]*var\(--tint\)/);
  });

  it("material-hero reads the accent before the tint for its wash, border and shadows", () => {
    const body = rulesFor("material-hero")
      .map((r) => r.body)
      .join("");
    expect(body).not.toMatch(/color-mix\(in srgb, var\(--tint\)/);
    expect(body.match(/var\(--facet-accent, var\(--tint\)\)/g)!.length).toBeGreaterThanOrEqual(5);
  });
});
