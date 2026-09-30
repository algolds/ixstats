/** @jest-environment node */
/**
 * Facet 3 navigation shell CSS hooks (src/styles/facet/shell.css): app-local sub-navigation is
 * hidden only under the new shell, in the utilities layer so it beats the element's own display
 * utilities, and the `facet-nav:` variant keys off the same attribute.
 */
import fs from "fs";
import path from "path";

const css = fs
  .readFileSync(path.resolve(__dirname, "../../../styles/facet/shell.css"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("shell.css hooks", () => {
  it("hides [data-app-subnav] only under html[data-nav=facet], in @layer utilities", () => {
    const utilities = css.slice(css.indexOf("@layer utilities"));
    expect(utilities).toMatch(
      /:root\[data-nav="facet"\] \[data-app-subnav\]\s*\{\s*display:\s*none;\s*\}/
    );
    expect(css.match(/\[data-app-subnav\]/g)).toHaveLength(1);
  });

  it("defines the facet-nav: variant on the same attribute", () => {
    expect(css).toContain('@custom-variant facet-nav (&:where([data-nav="facet"] *));');
  });

  it("keeps the legacy values of the offsets the pages migrated to", () => {
    const root = css.match(/@layer base \{\s*:root \{([^}]*)\}/)?.[1] ?? "";
    expect(root).toContain("--shell-sidebar-width: 0px;");
    expect(root).toContain("--shell-tabbar-height: 0px;");
    // = `top-20`, so `top-(--shell-top-offset)` is unchanged with the flag off.
    expect(root).toContain("--shell-top-offset: 5rem;");
  });
});
