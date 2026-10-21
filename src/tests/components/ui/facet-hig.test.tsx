/**
 * HIG rules for the identity layer: the accent vocabulary, `CutoutCardHeader as`, glass nesting,
 * touch targets and focus, the sanctioned textures, and the accessibility-preference rules in the
 * identity sheet. Cascade: identity-cascade.test.ts; contrast: token-contrast.test.ts.
 */
import fs from "fs";
import path from "path";
import "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Badge } from "~/components/ui/badge";
import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import {
  TextureOverlay,
} from "~/components/ui/texture-overlay";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { TEXT_STYLES } from "~/lib/design/tokens";
import { Card } from "~/components/ui/card";

const classOf = (el: Element) => el.getAttribute("class") ?? "";
const ROOT = path.resolve(__dirname, "../../../..");
const cardArtCss = fs.readFileSync(path.join(ROOT, "src/styles/card-art.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/tokens.css"), "utf8");
describe("CutoutCardHeader", () => {
  it.each(["h2", "h3", "h4"] as const)(
    'as="%s" makes the title a real heading, with the icon and trailing outside it',
    (as) => {
      render(
        <CutoutCard>
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
        <CutoutCard onClick={onCutout} aria-label="Open vault" />
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

describe("accessibility preferences in the content-art sheet", () => {
  it("Reduce Transparency and Increase Contrast remove the blurred / translucent layers", () => {
    const block = cardArtCss.slice(cardArtCss.indexOf(".facet-aurora,\n  .facet-foil {"));
    expect(block.slice(0, 300)).toContain("@variant transparency-reduced {\n      display: none;");
    expect(block.slice(0, 300)).toContain("@variant contrast-more {\n      display: none;");
  });
  it("Reduce Transparency / Increase Contrast make every glass layer opaque", () => {
    for (const variant of ["transparency-reduced", "contrast-more"]) {
      const start = tokensCss.indexOf(`@variant ${variant} {\n      --pane-fill: 100%;`);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(tokensCss.slice(start, start + 260)).toContain("--overlay-fill: 100%;");
    }
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
});

// ─── HIG follow-ups (spec §16.8: vibrant labels, achievement accents, tour, IxCredits, badge) ──
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
