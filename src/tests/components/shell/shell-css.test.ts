/** @jest-environment node */
/**
 * Navigation shell CSS hooks (src/styles/facet/shell.css): app-local sub-navigation is hidden at
 * every width, in the utilities layer so it beats the element's own display utilities.
 */
import fs from "fs";
import path from "path";

const css = fs
  .readFileSync(path.resolve(__dirname, "../../../styles/facet/shell.css"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("shell.css hooks", () => {
  it("hides [data-app-subnav] in @layer utilities", () => {
    const utilities = css.slice(css.indexOf("@layer utilities"));
    expect(utilities).toMatch(/\[data-app-subnav\]\s*\{\s*display:\s*none;\s*\}/);
    expect(css.match(/\[data-app-subnav\]/g)).toHaveLength(1);
  });

  it("has no flag-keyed selectors left", () => {
    expect(css).not.toContain("data-nav");
    expect(css).not.toContain("data-shell-variant");
  });

  it("reserves the tab bar below 1024px and the sidebar above", () => {
    const root = css.match(/@layer base \{\s*:root \{([^}]*)\}/)?.[1] ?? "";
    expect(root).toContain("--shell-sidebar-width: 0px;");
    expect(root).toContain("--shell-tabbar-height: calc(4rem + env(safe-area-inset-bottom));");
    expect(css).toMatch(/min-width: 1024px\) \{\s*:root \{[^}]*--shell-sidebar-width: 16rem;/);
  });
});
