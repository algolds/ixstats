import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const STYLES = path.join(ROOT, "src/styles");
const LAYERS = path.join(STYLES, "facet/layers.css");

function walk(dir: string, ext: RegExp): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p, ext);
    return ext.test(e.name) ? [p] : [];
  });
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Facet layers", () => {
  const layers = stripComments(fs.readFileSync(LAYERS, "utf8"));

  it("defines the five layer utilities", () => {
    for (const name of [
      "facet-canvas",
      "facet-pane",
      "facet-well",
      "facet-chrome",
      "facet-overlay",
    ]) {
      expect(layers).toMatch(new RegExp(`@utility ${name} \\{`));
    }
  });

  it("blurs only chrome and overlay (the pane has no backdrop-filter)", () => {
    const pane = /@utility facet-pane \{([\s\S]*?)\n\}/.exec(layers)?.[1] ?? "";
    expect(pane).not.toMatch(/backdrop-filter/);
    for (const name of ["facet-chrome", "facet-overlay"]) {
      const body = new RegExp(`@utility ${name} \\{([\\s\\S]*?)\\n\\}`).exec(layers)?.[1] ?? "";
      expect(body).toMatch(/backdrop-filter/);
    }
  });

  it("chrome points secondary labels at the vibrant role; pane and well read the accent before the tint", () => {
    expect(
      /@utility facet-chrome \{[\s\S]*?--color-label-secondary: var\(--color-label-vibrant-secondary\)/.test(
        layers
      )
    ).toBe(true);
    expect(/@utility facet-pane \{[\s\S]*?var\(--facet-accent, var\(--tint\)\)/.test(layers)).toBe(
      true
    );
    expect(/@utility facet-well \{[\s\S]*?var\(--facet-accent, var\(--tint\)\)/.test(layers)).toBe(
      true
    );
  });

  // A blur that is switched off (`none`) and a scalar declaration are not glass; painting one is.
  it("is the only stylesheet in src/styles/facet that blurs or paints a glass fill", () => {
    const paintsGlass = /backdrop-filter:\s*(?!none)\S|var\(--(?:pane|chrome|overlay)-fill[,)]/;
    const offenders = walk(path.join(STYLES, "facet"), /\.css$/)
      .filter((f) => f !== LAYERS)
      .filter((f) => paintsGlass.test(stripComments(fs.readFileSync(f, "utf8"))));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("leaves no material-* class or material= prop in the source", () => {
    const offenders = walk(path.join(ROOT, "src"), /\.(tsx?|css)$/)
      .filter((f) => !f.includes(`${path.sep}tests${path.sep}`))
      .filter((f) =>
        /\bmaterial-(thin|regular|thick|hero|acrylic)\b|\bmaterial="(thin|regular|thick|hero|acrylic)"/.test(
          fs.readFileSync(f, "utf8")
        )
      );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});

describe("Facet stylesheet layout", () => {
  it("has exactly four Facet sheets", () => {
    const sheets = fs
      .readdirSync(path.join(STYLES, "facet"))
      .filter((f) => f.endsWith(".css"))
      .sort();
    expect(sheets).toEqual(["interaction.css", "layers.css", "shell.css", "tokens.css"]);
    expect(fs.existsSync(path.join(STYLES, "facet.css"))).toBe(false);
  });

  it("keeps the deleted identity decoration out of the source", () => {
    const offenders = walk(path.join(ROOT, "src"), /\.(tsx?|css)$/)
      .filter((f) => !f.includes(`${path.sep}tests${path.sep}`))
      .filter((f) =>
        /facet-radiance|facet-ghost-heraldry|facet-hierarchy-child|facet-modal\b|facet-layout-(grid-3|main-span-2|sidebar-span-1)/.test(
          fs.readFileSync(f, "utf8")
        )
      );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
