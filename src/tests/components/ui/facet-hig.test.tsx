/**
 * Facet accessibility guards over the live stylesheets: Reduce Transparency and Increase Contrast remove the
 * blurred layers and make glass opaque, and every text style scales with Dynamic Type from a 12px floor.
 * Touch targets and focus rings: card.test.tsx; contrast: token-contrast.test.ts.
 */
import fs from "fs";
import path from "path";
import { TEXT_STYLES } from "~/lib/design/tokens";
const ROOT = path.resolve(__dirname, "../../../..");
const cardArtCss = fs.readFileSync(path.join(ROOT, "src/styles/card-art.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/tokens.css"), "utf8");
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
