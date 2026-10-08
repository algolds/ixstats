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

  it("sizes the sidebar and the Inspector gutter as 1 : 4 : 1.25 from 1280px, with clamps", () => {
    const wide = css.match(/min-width: 1280px\) \{([\s\S]*?)\n  \}\n/)?.[1] ?? "";
    expect(wide).toContain("--shell-unit: calc(100vw / 6.25);");
    expect(wide).toContain("--shell-sidebar-width: clamp(14rem, var(--shell-unit), 18rem);");
    expect(wide).toContain(
      "--shell-inspector-width: clamp(18rem, calc(var(--shell-unit) * 1.25), 22rem);"
    );
  });

  it("has no Inspector gutter below 1280px and keeps the collapsed sidebar at 4rem", () => {
    const root = css.match(/@layer base \{\s*:root \{([^}]*)\}/)?.[1] ?? "";
    expect(root).toContain("--shell-inspector-width: 0px;");
    expect(css).toMatch(/:root\[data-sidebar="collapsed"\] \{\s*--shell-sidebar-width: 4rem;/);
    // Collapsed must still win at 1280px: it is declared after the wide :root rule.
    expect(css.lastIndexOf("--shell-sidebar-width: 4rem")).toBeGreaterThan(
      css.indexOf("clamp(14rem")
    );
  });

  it("reserves the Inspector column on every page's main, and zeroes it on chromeless routes", () => {
    expect(css).toMatch(
      /\[data-shell-main\] \{[^}]*padding-right: var\(--shell-inspector-width\);/
    );
    expect(css).toMatch(
      /\[data-app-shell\]\[data-chromeless\] \{[^}]*--shell-inspector-width: 0px;/
    );
  });

  it("releases the Inspector gutter on any page without an Inspector, in CSS alone", () => {
    // :has() reads the Inspector's server-rendered aside on first paint: <main>, Halo and the fixed
    // bars all read --shell-inspector-width, so zeroing it frees every one of them.
    expect(css).toMatch(
      /\[data-app-shell\]:not\(:has\(\[data-slot="inspector"\]\)\) \{[^}]*--shell-inspector-width: 0px;/
    );
  });

  it("centres Halo over the Inspector too when the page has one, in CSS on first paint", () => {
    expect(css).toMatch(
      /\[data-app-shell\]:has\(\[data-slot="inspector"\]\) \[data-slot="shell-halo"\] \{[^}]*right: 0;/
    );
  });
});
