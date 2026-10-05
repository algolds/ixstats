/** @jest-environment node */
/**
 * Navigation shell CSS hooks (src/styles/facet/shell.css): the shell variables and the page-title
 * hook. No app hides navigation of its own here; apps render none.
 */
import fs from "fs";
import path from "path";

const css = fs
  .readFileSync(path.resolve(__dirname, "../../../styles/facet/shell.css"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("shell.css hooks", () => {
  it("carries no sub-navigation hiding rule", () => {
    expect(css).not.toContain("data-app-subnav");
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
