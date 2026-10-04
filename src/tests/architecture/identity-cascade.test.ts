/** @jest-environment node */
/**
 * Compiles the real token and identity sheets with Tailwind and checks the accent utilities: the
 * card accent falls back to the app tint, and secondary labels re-resolve at the element.
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

let rules: Rule[] = [];

beforeAll(async () => {
  const compiler = await compile(ENTRY, { base: STYLES, onDependency: () => undefined });
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
  const utilities = css.slice(css.indexOf("@layer utilities"));
  rules = flatten(utilities);
}, 30_000);

const rulesFor = (cls: string) =>
  rules.filter((rule) =>
    new RegExp(`\\.${cls.replace("/", "\\\\/")}(?![\\w-])`).test(rule.selector)
  );

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
});

describe("secondary labels re-resolve at the element", () => {
  it.each(["text-label-secondary", "text-muted-foreground"])(
    "%s reads the variable at the element, so a chrome scope re-resolves it",
    (cls) => {
      expect(
        rulesFor(cls).some((r) => /color:\s*var\(--color-label-secondary\)/.test(r.body))
      ).toBe(true);
    }
  );

  it('text-tint-ink is the tint pulled toward the label (Badge variant="tinted")', () => {
    expect(
      rulesFor("text-tint-ink").some((r) =>
        /color-mix\(in srgb, var\(--tint\) 80%, var\(--color-label\)\)/.test(r.body)
      )
    ).toBe(true);
  });
});

describe("press and lift drop their movement under Reduce Motion (OS and in-app)", () => {
  it.each([
    ["facet-press", /scale:\s*none/],
    ["facet-lift", /translate:\s*none/],
  ])("%s", (cls, drop) => {
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
