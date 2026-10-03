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

import { AchievementCardBackdrop } from "~/components/achievements/AchievementDecorations";
import { getCategoryTheme } from "~/components/achievements/constants";
import { Badge } from "~/components/ui/badge";
import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import {
  SANCTIONED_TEXTURES,
  TEXTURE_MAX_OPACITY,
  TextureOverlay,
} from "~/components/ui/texture-overlay";
import { FACET_ACCENTS, accentColor, facetAccentStyle, isFacetAccent } from "~/lib/design/identity";
import { DURATION_FAST } from "~/lib/design/motion";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { SYSTEM_COLORS, TEXT_STYLES } from "~/lib/design/tokens";
import { Card } from "~/components/ui/card";

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

describe("CutoutCardHeader", () => {
  it.each(["h2", "h3", "h4"] as const)(
    'as="%s" makes the title a real heading, with the icon and trailing outside it',
    (as) => {
      render(
        <CutoutCard variant="card">
          <CutoutCardHeader as={as} icon={<svg />} trailing={<Badge variant="secondary">12</Badge>}>
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

describe("touch targets, focus and keyboard (HIG)", () => {
  it("pressable Card and CutoutCard: 44pt on touch, a focus ring outside the clip, Enter/Space", () => {
    const onCard = jest.fn();
    const onCutout = jest.fn();
    render(
      <>
        <Card onClick={onCard} interactive>
          Open nation
        </Card>
        <CutoutCard variant="card" onClick={onCutout} aria-label="Open vault" />
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
    render(<Card data-testid="s">x</Card>);
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
      identityCss.indexOf(".facet-aurora,\n  .facet-radiance,\n  .facet-foil {")
    );
    expect(block.slice(0, 300)).toContain("@variant transparency-reduced {\n      display: none;");
    expect(block.slice(0, 300)).toContain("@variant contrast-more {\n      display: none;");
  });

  it("Increase Contrast turns the hairline into the opaque separator and stops the watermark brightening", () => {
    expect(tokensCss).toContain("--glass-hairline: var(--color-separator-opaque);");
    expect(identityCss).toMatch(/@variant contrast-more \{\s*opacity: var\(--watermark-opacity\);/);
  });

  it("Reduce Transparency / Increase Contrast make both identity materials opaque", () => {
    for (const variant of ["transparency-reduced", "contrast-more"]) {
      const start = tokensCss.indexOf(`@variant ${variant} {\n      --glass-fill: 100%;`);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(tokensCss.slice(start, start + 260)).toContain(
        "--acrylic-fill: var(--color-surface-elevated);"
      );
    }
  });

  it("the flag watermark carries the HIG tone filter", () => {
    expect(identityCss).toContain("filter: blur(1px) contrast(0.7);");
    expect(identityCss).toContain("filter: blur(1px) brightness(0.6);");
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

// ─── HIG follow-ups (spec §16.8: vibrant labels, achievement accents, tour, IxCredits, badge) ──

describe("achievement aurora / radiance follow the card's accent", () => {
  it("the layers read --facet-accent (and --facet-accent-2), never shadcn's --accent", () => {
    for (const cls of [".facet-aurora {", ".facet-radiance {"]) {
      const body = identityCss.slice(identityCss.indexOf(cls));
      const rule = body.slice(0, body.indexOf("}"));
      expect(rule).toContain("var(--facet-accent, var(--tint))");
      expect(rule).not.toMatch(/var\(--accent[,)-]/);
    }
    expect(identityCss).toContain("var(--facet-accent-2, var(--color-yellow))");
  });

  it("AchievementCardBackdrop sets only the aurora's second hue", () => {
    const theme = getCategoryTheme("Economic");
    const { container } = render(
      <Card data-testid="card">
        <AchievementCardBackdrop iconPath="/x.svg" categoryTheme={theme} isUnlocked />
      </Card>
    );
    const aurora = container.querySelector(".facet-aurora")!;
    const radiance = container.querySelector(".facet-radiance")!;
    expect(styleVar(aurora, "--facet-accent-2")).toBe(accentColor(theme.accent2));
    for (const layer of [aurora, radiance]) {
      expect(styleVar(layer, "--accent")).toBe("");
      expect(styleVar(layer, "--accent-2")).toBe("");
    }
    expect(radiance.getAttribute("style")).toBeNull();
  });

  it("no consumer bridges --accent onto the layers any more", () => {
    for (const file of [
      "src/components/achievements/AchievementDecorations.tsx",
      "src/components/country-profile/ConditionMatrix.tsx",
    ]) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect([file, /["']--accent(-2)?["']/.test(source)]).toEqual([file, false]);
    }
  });
});

describe("Halo walkthrough highlight", () => {
  it("is a static ring, not a looping pulse (spec §8: no ambient loops)", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/components/halo/index.tsx"), "utf8");
    expect(source).not.toMatch(/repeat:\s*Infinity/);
    expect(source).toContain('isTourActive && "ring-tint/50 ring-2"');
  });
});

describe("IxCreditsSymbol accessible name", () => {
  it("names the unit by default", () => {
    render(<IxCreditsSymbol data-testid="ixc" />);
    const svg = screen.getByTestId("ixc");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "IxCredits");
    expect(screen.getByRole("img", { name: "IxCredits" })).toBe(svg);
  });

  it("is hidden when decorative or aria-hidden (a visible unit label already names it)", () => {
    const expectHidden = () => {
      const svg = screen.getByTestId("ixc");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).not.toHaveAttribute("role");
      expect(svg).not.toHaveAttribute("aria-label");
    };
    const { rerender } = render(<IxCreditsSymbol decorative data-testid="ixc" />);
    expectHidden();
    rerender(<IxCreditsSymbol aria-hidden data-testid="ixc" />);
    expectHidden();
  });
});

describe('Badge variant="secondary"', () => {
  it("sets the tint's ink on the tint fill (AA; token-contrast.test.ts)", () => {
    render(<Badge variant="secondary">New</Badge>);
    const cls = classOf(screen.getByText("New"));
    expect(cls).toMatch(/\btext-tint-ink\b/);
    expect(cls).not.toMatch(/\btext-tint(?![\w-])/);
    expect(cls).toMatch(/\bbg-tint-fill\b/);
  });
});
