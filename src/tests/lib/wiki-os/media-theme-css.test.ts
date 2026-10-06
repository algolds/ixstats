/** @jest-environment node */
/**
 * The hero's and the lightbox's pictures are themed by the stylesheet, from <html>, not by an inline
 * style computed while rendering (which the server could only guess): every rule that reads a
 * picture's `data-media-kind` applies in the dark theme only, so a light-theme reader's picture is
 * the file as it is from the first paint.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/styles/wiki-os/foundations.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ");

/** The rules (selector + declarations) whose selector mentions `data-media-kind`. */
const rules = [...css.matchAll(/([^{}]*data-media-kind[^{}]*)\{([^}]*)\}/g)].map((match) => ({
  selector: match[1]!.trim(),
  declarations: match[2]!.trim(),
}));

describe("the stylesheet's media theme", () => {
  it("has a rule for each of auto's two inversions and for plinth's plate and mat", () => {
    const declared = rules.map((rule) => rule.declarations);
    expect(declared).toContain(
      "filter: invert(0.92) hue-rotate(180deg) brightness(1.05) contrast(1.02);"
    );
    expect(declared).toContain("filter: brightness(0) invert(1);");
    expect(declared).toContain("background-color: rgba(255, 255, 255, 0.94);");
    expect(declared.some((d) => d.startsWith("box-shadow:") && d.includes("padding: 6px"))).toBe(
      true
    );
  });

  it("applies only under the dark root, in both ways Facet marks it", () => {
    expect(rules.length).toBeGreaterThan(0);
    for (const { selector } of rules) {
      expect(selector).not.toContain('data-theme="light"');
      // each branch of the selector that reads a picture's kind is rooted at the dark theme
      const roots = selector.match(/:is\(html\.dark, html\[data-theme="dark"\]\)/g) ?? [];
      const reads = selector.match(/\[data-media-kind\](?!=)/g) ?? [];
      expect(roots).toHaveLength(reads.length);
    }
  });
});
