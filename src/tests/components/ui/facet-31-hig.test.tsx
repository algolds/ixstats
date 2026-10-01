/**
 * Facet 3.1 — HIG pass over the restored identity (docs/specs/2026-09-30-facet-3-design-system.md
 * §16.8). The primitive APIs that replace the app workarounds (`accent`, `retint`, `rim`,
 * `CutoutCardHeader as`), glass nesting, touch targets and focus, the sanctioned textures, and the
 * accessibility-preference rules in the identity sheet. Cascade: identity-cascade.test.ts;
 * contrast: token-contrast.test.ts.
 */
import fs from "fs";
import path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { Badge } from "~/components/ui/badge";
import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import { FacetCard, MotionFacetCard } from "~/components/ui/facet-container";
import { FacetMaterial, TintGlow } from "~/components/ui/facet";
import {
  SANCTIONED_TEXTURES,
  TEXTURE_MAX_OPACITY,
  TextureOverlay,
} from "~/components/ui/texture-overlay";
import {
  FACET_ACCENTS,
  RIM_CLASS,
  accentColor,
  facetAccentStyle,
  isFacetAccent,
} from "~/lib/design/identity";
import { DURATION_FAST } from "~/lib/design/motion";
import { SYSTEM_COLORS, TEXT_STYLES } from "~/lib/design/tokens";

const classOf = (el: Element) => el.getAttribute("class") ?? "";
const styleVar = (el: Element, name: string) => (el as HTMLElement).style.getPropertyValue(name);
const ROOT = path.resolve(__dirname, "../../../..");
const identityCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/identity.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/tokens.css"), "utf8");
const typographyCss = fs.readFileSync(path.join(ROOT, "src/styles/typography.css"), "utf8");

/** The body of a top-level `@utility name { … }` block. */
function utility(name: string): string {
  const start = identityCss.indexOf(`@utility ${name} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = identityCss.slice(start);
  return body.slice(0, body.indexOf("\n}\n"));
}

describe("accent vocabulary", () => {
  it("accepts the system colour roles, the tint and gold — nothing else", () => {
    expect([...FACET_ACCENTS].sort()).toEqual(
      [...Object.keys(SYSTEM_COLORS), "tint", "gold"].sort()
    );
    expect(isFacetAccent("green")).toBe(true);
    expect(isFacetAccent("#ff0000")).toBe(false);
    expect(isFacetAccent("var(--color-green)")).toBe(false);
  });

  it("resolves to theme-following roles", () => {
    expect(accentColor("cyan")).toBe("var(--color-cyan)");
    expect(accentColor("tint")).toBe("var(--tint)");
    expect(accentColor("gold")).toBe("var(--gold-accent)");
    expect(facetAccentStyle("indigo")).toEqual({ "--facet-accent": "var(--color-indigo)" });
    expect(facetAccentStyle(undefined)).toBeUndefined();
  });
});

describe("FacetCard accent / retint / rim", () => {
  it("accent scopes --facet-accent on the card (not --tint) and keeps the caller's style", () => {
    render(
      <FacetCard data-testid="c" variant="glass" glow accent="green" style={{ minHeight: 10 }}>
        x
      </FacetCard>
    );
    const card = screen.getByTestId("c");
    expect(card).toHaveAttribute("data-accent", "green");
    expect(styleVar(card, "--facet-accent")).toBe("var(--color-green)");
    expect(styleVar(card, "--tint")).toBe("");
    expect((card as HTMLElement).style.minHeight).toBe("10px");
    expect(classOf(card)).not.toMatch(/\bfacet-retint\b/);
    // The glow blob reads the accent through CSS (no inline colour).
    expect(styleVar(card.querySelector('[data-slot="tint-glow"]')!, "--glow-color")).toBe("");
  });

  it("retint re-tints the subtree only with a real accent", () => {
    const { rerender } = render(
      <FacetCard data-testid="c" accent="orange" retint>
        x
      </FacetCard>
    );
    expect(classOf(screen.getByTestId("c"))).toMatch(/\bfacet-retint\b/);
    rerender(
      <FacetCard data-testid="c" accent="tint" retint>
        x
      </FacetCard>
    );
    // `--tint: var(--facet-accent)` with `--facet-accent: var(--tint)` would be a cycle.
    expect(classOf(screen.getByTestId("c"))).not.toMatch(/\bfacet-retint\b/);
    rerender(
      <FacetCard data-testid="c" retint>
        x
      </FacetCard>
    );
    expect(classOf(screen.getByTestId("c"))).not.toMatch(/\bfacet-retint\b/);
  });

  it.each([
    ["gold", "facet-gold-rim"],
    ["tint", "facet-tint-rim"],
  ] as const)("rim=%s paints %s over the card's own border", (rim, cls) => {
    const { rerender } = render(
      <FacetCard data-testid="c" rim={rim}>
        x
      </FacetCard>
    );
    expect(classOf(screen.getByTestId("c"))).toMatch(new RegExp(`\\b${cls}\\b`));
    expect(classOf(screen.getByTestId("c"))).toMatch(/\bborder-separator\b/);
    expect(screen.getByTestId("c")).toHaveAttribute("data-rim", rim);
    rerender(
      <FacetCard data-testid="c" variant="glass" rim={rim}>
        x
      </FacetCard>
    );
    expect(classOf(screen.getByTestId("c"))).toMatch(/\bmaterial-hero\b/);
    expect(classOf(screen.getByTestId("c"))).toMatch(new RegExp(`\\b${cls}\\b`));
    // An inset panel gets a border for the rim to recolour.
    rerender(
      <FacetCard data-testid="c" variant="inset" rim={rim}>
        x
      </FacetCard>
    );
    expect(classOf(screen.getByTestId("c"))).toMatch(/(^|\s)border(\s|$)/);
    expect(RIM_CLASS[rim]).toBe(cls);
  });

  it("MotionFacetCard takes accent and rim", () => {
    render(
      <MotionFacetCard data-testid="m" accent="pink" rim="tint" initial={false}>
        x
      </MotionFacetCard>
    );
    expect(styleVar(screen.getByTestId("m"), "--facet-accent")).toBe("var(--color-pink)");
    expect(classOf(screen.getByTestId("m"))).toMatch(/\bfacet-tint-rim\b/);
  });
});

describe("CutoutCard accent and header", () => {
  it("accent re-tints the card and its header strip/icon through --facet-accent", () => {
    const { container } = render(
      <CutoutCard data-testid="cut" variant="card" accent="orange" glow rim="tint">
        <CutoutCardHeader icon={<svg data-testid="icon" />}>Trending</CutoutCardHeader>
      </CutoutCard>
    );
    const card = screen.getByTestId("cut");
    expect(styleVar(card, "--facet-accent")).toBe("var(--color-orange)");
    expect(card).toHaveAttribute("data-accent", "orange");
    expect(classOf(card)).toMatch(/\bfacet-tint-rim\b/);
    const header = container.querySelector('[data-slot="cutout-card-header"]')!;
    expect(classOf(header)).toContain("bg-facet-accent-fill");
    expect(classOf(header)).not.toContain("bg-tint-fill");
    expect(classOf(screen.getByTestId("icon").parentElement!)).toContain("text-facet-accent");
  });

  it("retint is the widgetAccent replacement (subtree --tint follows the accent)", () => {
    render(
      <CutoutCard data-testid="cut" variant="card" accent="indigo" retint>
        <Badge variant="tinted">3</Badge>
      </CutoutCard>
    );
    expect(classOf(screen.getByTestId("cut"))).toMatch(/\bfacet-retint\b/);
  });

  it("the header accent overrides the card's for the strip only", () => {
    const { container } = render(
      <CutoutCard variant="card" accent="blue">
        <CutoutCardHeader accent="gold">Gold tab</CutoutCardHeader>
      </CutoutCard>
    );
    const header = container.querySelector('[data-slot="cutout-card-header"]')!;
    expect(header).toHaveAttribute("data-accent", "gold");
    expect(styleVar(header, "--facet-accent")).toBe("var(--gold-accent)");
  });

  it.each(["h2", "h3", "h4"] as const)(
    'as="%s" makes the title a real heading, with the icon and trailing outside it',
    (as) => {
      render(
        <CutoutCard variant="card">
          <CutoutCardHeader as={as} icon={<svg />} trailing={<Badge>12</Badge>}>
            Countries to explore
          </CutoutCardHeader>
        </CutoutCard>
      );
      const heading = screen.getByRole("heading", {
        level: Number(as[1]),
        name: "Countries to explore",
      });
      expect(heading.tagName).toBe(as.toUpperCase());
      expect(heading).toHaveAttribute("data-slot", "cutout-card-title");
      expect(heading.textContent).toBe("Countries to explore");
    }
  );

  it("defaults to a span title (no heading role)", () => {
    render(
      <CutoutCard variant="card">
        <CutoutCardHeader>Vault</CutoutCardHeader>
      </CutoutCard>
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Vault").tagName).toBe("SPAN");
  });
});

describe("FacetMaterial accent", () => {
  it("scopes the accent for the hero wash and the glow", () => {
    render(
      <FacetMaterial data-testid="m" material="acrylic" glow accent="cyan">
        x
      </FacetMaterial>
    );
    const m = screen.getByTestId("m");
    expect(styleVar(m, "--facet-accent")).toBe("var(--color-cyan)");
    expect(classOf(m)).toMatch(/\bmaterial-acrylic\b/);
  });

  it("TintGlow still takes an explicit colour over the accent", () => {
    const { container } = render(<TintGlow color="var(--color-red)" />);
    expect(styleVar(container.querySelector('[data-slot="tint-glow"]')!, "--glow-color")).toBe(
      "var(--color-red)"
    );
  });
});

describe("glass never nests (HIG materials)", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it("a glass FacetCard inside a glass FacetCard renders the opaque card", () => {
    render(
      <FacetCard data-testid="outer" variant="glass">
        <FacetCard variant="inset">
          <FacetCard data-testid="inner" variant="glass">
            x
          </FacetCard>
        </FacetCard>
      </FacetCard>
    );
    const outer = screen.getByTestId("outer");
    const inner = screen.getByTestId("inner");
    expect(classOf(outer)).toMatch(/\bmaterial-hero\b/);
    expect(classOf(inner)).not.toMatch(/\bmaterial-hero\b/);
    expect(classOf(inner)).toMatch(/\bbg-surface\b/);
    expect(inner).toHaveAttribute("data-nested-glass", "true");
    expect(inner.querySelector('[data-slot="refraction"]')).toBeNull();
  });

  it("CutoutCard and FacetMaterial hero/acrylic also refuse to nest", () => {
    render(
      <FacetMaterial data-testid="hero" material="hero">
        <CutoutCard data-testid="cut" variant="glass" />
        <FacetMaterial data-testid="inner" material="acrylic" />
      </FacetMaterial>
    );
    expect(classOf(screen.getByTestId("cut"))).not.toMatch(/\bmaterial-hero\b/);
    expect(classOf(screen.getByTestId("cut"))).toMatch(/\bbg-surface\b/);
    expect(screen.getByTestId("cut")).toHaveAttribute("data-variant", "card");
    const inner = screen.getByTestId("inner");
    expect(classOf(inner)).not.toMatch(/\bmaterial-acrylic\b/);
    expect(classOf(inner)).toMatch(/\bbg-surface-elevated\b/);
    expect(inner).toHaveAttribute("data-nested-glass", "true");
  });

  it("siblings and chrome glass are not nesting", () => {
    render(
      <>
        <FacetCard data-testid="a" variant="glass" />
        <FacetCard data-testid="b" variant="glass" />
        <FacetMaterial material="thick">
          <FacetCard data-testid="in-chrome" variant="glass" />
        </FacetMaterial>
      </>
    );
    for (const id of ["a", "b", "in-chrome"]) {
      expect(classOf(screen.getByTestId(id))).toMatch(/\bmaterial-hero\b/);
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("touch targets, focus and keyboard (HIG)", () => {
  it("pressable FacetCard and CutoutCard: 44pt on touch, a focus ring outside the clip, Enter/Space", () => {
    const onCard = jest.fn();
    const onCutout = jest.fn();
    render(
      <>
        <FacetCard variant="glass" glow onClick={onCard}>
          Open nation
        </FacetCard>
        <CutoutCard variant="card" glow onClick={onCutout} aria-label="Open vault" />
      </>
    );
    for (const [name, handler] of [
      ["Open nation", onCard],
      ["Open vault", onCutout],
    ] as const) {
      const el = screen.getByRole("button", { name });
      const cls = classOf(el);
      expect(el).toHaveAttribute("tabindex", "0");
      expect(cls).toContain("pointer-coarse:min-h-11");
      expect(cls).toContain("focus-visible:outline-2");
      expect(cls).toContain("focus-visible:outline-offset-2");
      expect(cls).toContain("focus-visible:outline-tint");
      // A ring drawn by `ring-*` (box-shadow) or an inset outline would be painted under the
      // clip/glow layers; the outline sits outside the border box.
      expect(cls).not.toMatch(/focus-visible:ring-|outline-offset-\[-/);
      fireEvent.keyDown(el, { key: "Enter" });
      fireEvent.keyDown(el, { key: " " });
      expect(handler).toHaveBeenCalledTimes(2);
    }
  });

  it("static cards are not focusable and have no min height", () => {
    render(<FacetCard data-testid="s">x</FacetCard>);
    expect(screen.getByTestId("s")).not.toHaveAttribute("tabindex");
    expect(classOf(screen.getByTestId("s"))).not.toContain("min-h-11");
  });
});

describe("textures", () => {
  it("chevron is sanctioned (the v2 Builder texture) with the 0.05 cap", () => {
    expect(SANCTIONED_TEXTURES).toEqual(["dots", "grid", "paperGrain", "chevron"]);
    expect(TEXTURE_MAX_OPACITY).toBe(0.05);
  });

  it("TextureOverlay clamps sanctioned textures to the cap; card-art textures pass through", () => {
    const { container, rerender } = render(<TextureOverlay texture="chevron" opacity={0.2} />);
    const overlay = () => container.firstElementChild as HTMLElement;
    expect(overlay().style.opacity).toBe("0.05");
    expect(overlay()).toHaveAttribute("aria-hidden");
    rerender(<TextureOverlay texture="dots" />);
    expect(overlay().style.opacity).toBe("0.05");
    rerender(<TextureOverlay texture="paperGrain" opacity={0.03} />);
    expect(overlay().style.opacity).toBe("0.03");
    rerender(<TextureOverlay texture="shimmer" opacity={0.4} />);
    expect(overlay().style.opacity).toBe("0.4");
  });
});

describe("accessibility preferences in the identity sheet", () => {
  it("Reduce Transparency and Increase Contrast remove the blurred / translucent layers", () => {
    const block = identityCss.slice(
      identityCss.indexOf(
        "@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {\n    .facet-tint-glow"
      )
    );
    for (const cls of [
      ".facet-tint-glow",
      ".facet-acrylic-glow",
      ".facet-aurora",
      ".facet-radiance",
      ".facet-foil",
    ]) {
      expect(block.slice(0, 400)).toContain(cls);
    }
    expect(block.slice(0, 400)).toContain("display: none;");
    // The in-app switches too.
    expect(identityCss).toMatch(
      /:where\(\[data-transparency="reduced"\], \[data-contrast="more"\]\)\s*:is\(\.facet-tint-glow, \.facet-acrylic-glow, \.facet-aurora, \.facet-radiance, \.facet-foil\) \{\s*display: none;/
    );
  });

  it("Increase Contrast: the hero border and the rims become full-strength edges, no watermark brighten", () => {
    const hero = utility("material-hero");
    expect(hero).toMatch(
      /@media \(prefers-contrast: more\) \{[^}]*border-color: var\(--facet-accent, var\(--tint\)\);/
    );
    expect(hero).toMatch(
      /&:where\(\[data-contrast="more"\] \*\) \{[^}]*border-color: var\(--facet-accent, var\(--tint\)\);/
    );
    expect(utility("material-acrylic")).toContain("border-color: var(--color-separator-opaque);");
    expect(utility("facet-gold-rim")).toContain("border-color: var(--gold-rim-edge);");
    expect(utility("facet-tint-rim")).toContain("border-color: var(--facet-accent, var(--tint));");
    expect(identityCss).toMatch(
      /@media \(prefers-contrast: more\) \{\s*:is\(\.group, \[data-slot="facet-card"\], \[data-slot="cutout-card"\]\):hover\s*\.facet-flag-watermark\[data-interactive="true"\] \{\s*opacity: var\(--flag-watermark-opacity\);/
    );
  });

  it("Reduce Transparency / Increase Contrast make both identity materials opaque", () => {
    for (const name of ["material-hero", "material-acrylic"]) {
      const rule = utility(name);
      expect(rule).toContain("prefers-reduced-transparency: reduce");
      expect(rule).toContain('[data-transparency="reduced"]');
      expect(rule).toContain("prefers-contrast: more");
      expect(rule).toContain("backdrop-filter: none;");
    }
  });

  it("the flag watermark carries the HIG tone filter", () => {
    expect(identityCss).toContain("filter: blur(1px) var(--flag-watermark-tone);");
    expect(tokensCss).toContain("--flag-watermark-tone: contrast(0.7);");
    expect(tokensCss).toContain("--flag-watermark-tone: brightness(0.6);");
  });
});

describe("motion uses the named durations (spec §8)", () => {
  it("press and lift transition over --duration-fast (150ms)", () => {
    expect(DURATION_FAST).toBe(0.15);
    for (const name of ["facet-press", "facet-lift"]) {
      expect(utility(name)).toContain(
        "transition-duration: var(--tw-duration, var(--duration-fast));"
      );
    }
    expect(identityCss).not.toMatch(/transition-duration: var\(--tw-duration, 200ms\)/);
  });
});

describe("typography (HIG Dynamic Type)", () => {
  it("every text style scales with --text-scale and none is below 12px", () => {
    for (const [name, style] of Object.entries(TEXT_STYLES)) {
      expect([name, style.size >= 12]).toEqual([name, true]);
      const start = tokensCss.indexOf(`@utility text-${name} {`);
      const rule = tokensCss.slice(start, tokensCss.indexOf("}", start));
      expect(rule).toContain("var(--text-scale, 1)");
    }
  });

  it("the heavy headings have a declared 800 face (fallback: the nearest declared weight, 700)", () => {
    expect(typographyCss).toMatch(
      /font-family: "Schibsted Grotesk";\s*src: url\("\/fonts\/Schibsted Grotesk-800\.ttf"\)[^}]*font-weight: 800;/
    );
    expect(typographyCss).toMatch(
      /font-family: "Schibsted Grotesk";\s*src: url\("\/fonts\/Schibsted Grotesk-700\.ttf"\)[^}]*font-weight: 700;/
    );
  });
});
