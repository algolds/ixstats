import { mapHex, transformSource } from "../../../scripts/codemods/hex-to-tokens";

const UI = "src/components/ui/example.tsx";
const CSS = "src/styles/example.css";

function tsx(src: string, file = UI) {
  return transformSource(file, src);
}

describe("hex-to-tokens mapHex", () => {
  it("maps an exact token value for the site's role and theme scope", () => {
    expect(mapHex("#16181d", "surface", "unscoped")?.utility).toBe("card");
    expect(mapHex("#E4E4E7", "text", "unscoped")?.utility).toBe("foreground");
    expect(mapHex("#ffffff", "surface", "light", { target: "css" })?.cssVar).toBe("--card");
  });

  it("keeps white white: #fff is never mapped to a theme-switching text token", () => {
    expect(mapHex("#fff", "text", "unscoped")?.utility).toBe("white");
    expect(mapHex("#ffffff", "surface", "unscoped")?.utility).toBe("white");
  });

  it("compares unscoped sites against the default (dark) theme only", () => {
    // #09090b is the LIGHT foreground; unscoped it must stay near-black → palette, not foreground.
    expect(mapHex("#09090b", "text", "unscoped")).toEqual({
      utility: "zinc-950",
      cssVar: "--color-zinc-950",
      source: "palette",
    });
    expect(mapHex("#09090b", "text", "light")?.utility).toBe("foreground");
    expect(mapHex("#09090b", "text", "unscoped", { palette: false })).toBeNull();
  });

  it("respects the role: a surface value is not reused as a text colour", () => {
    expect(mapHex("#16181d", "text", "unscoped")).toBeNull();
  });

  it("never maps alpha hexes or chromatic hexes Tailwind v4 re-tuned", () => {
    expect(mapHex("#ffffff80", "surface", "unscoped")).toBeNull();
    expect(mapHex("#fff8", "surface", "unscoped")).toBeNull();
    expect(mapHex("#a855f7", "text", "unscoped")).toBeNull();
  });

  it("uses CSS-only tokens for CSS but not for classes", () => {
    expect(mapHex("#f59e0b", "text", "unscoped")).toBeNull();
    expect(mapHex("#f59e0b", "text", "unscoped", { target: "css" })?.cssVar).toBe(
      "--color-warning"
    );
  });
});

describe("hex-to-tokens transformSource: classes and inline styles", () => {
  it("rewrites arbitrary colour classes and keeps variants and opacity suffixes", () => {
    const { output } = tsx(
      `<a className="text-[#5865F2] hover:bg-[#5865F2]/10 border-[#ef4444]/[0.35] dark:bg-[#16181d]" />`
    );
    expect(output).toBe(
      `<a className="text-discord hover:bg-discord/10 border-destructive/[0.35] dark:bg-card" />`
    );
  });

  it("is idempotent", () => {
    const once = tsx(`<a className="text-[#fff] bg-[#0f1114]/60" />`).output;
    expect(once).toBe(`<a className="text-white bg-background/60" />`);
    expect(tsx(once).output).toBe(once);
  });

  it("rewrites colour props inside style={{}} only", () => {
    const src = `<div style={{ color: "#ffffff", background: "#123456" }} />\nconst tone = { thumb: "#ffffff" };`;
    const { output, sites } = tsx(src);
    expect(output).toContain(`color: "var(--color-white)"`);
    expect(output).toContain(`background: "#123456"`);
    expect(output).toContain(`thumb: "#ffffff"`);
    expect(sites.find((s) => s.line === 2)?.kind).toBe("js-literal");
  });

  it("leaves comments alone", () => {
    const src = `// was bg-[#16181d]\n/* text-[#fff] */`;
    const { output, sites } = tsx(src);
    expect(output).toBe(src);
    expect(sites.every((s) => s.kind === "comment")).toBe(true);
  });
});

describe("hex-to-tokens transformSource: data colours stay literal", () => {
  it.each([
    [`<path fill="#ffffff" d="M0 0" />`, "data"],
    [`ctx.fillStyle = "#16181d";`, "data"],
    [`const SERIES = ["#ef4444", "#10b981", "#3b82f6"];`, "data"],
    [`const bg = "var(--background, #0f1114)";`, "fallback"],
    [`<i className="bg-[linear-gradient(90deg,#ffffff,#000000)]" />`, "class-complex"],
  ])("%s", (src, kind) => {
    const { output, sites } = tsx(src);
    expect(output).toBe(src);
    expect(sites[0]?.kind).toBe(kind);
  });

  it.each([
    "src/components/shared/charts/Series.tsx",
    "src/app/(widget)/layout.tsx", // no app stylesheet: var(--token) would resolve to nothing
  ])("does not edit anything under a data path: %s", (file) => {
    const src = `<div className="bg-[#16181d]" style={{ color: "#ffffff" }} />`;
    const { output, sites } = tsx(src, file);
    expect(output).toBe(src);
    expect(sites.every((s) => s.kind === "data")).toBe(true);
  });
});

describe("hex-to-tokens transformSource: CSS", () => {
  it("rewrites colour declarations per theme scope", () => {
    const src = [
      `.a { color: #ef4444; border: 1px solid #fff; }`,
      `.light .b { background: #ffffff; color: #09090b; }`,
      `.c { background: #ffffff; }`,
      `html:not([data-theme="dark"]) .d { background: #ffffff; }`,
    ].join("\n");
    expect(transformSource(CSS, src).output).toBe(
      [
        `.a { color: var(--color-error); border: 1px solid var(--color-white); }`,
        `.light .b { background: var(--card); color: var(--foreground); }`,
        `.c { background: var(--color-white); }`,
        `html:not([data-theme="dark"]) .d { background: var(--color-white); }`,
      ].join("\n")
    );
  });

  it("never touches token definitions, fallbacks, gradients, print, materials or comments", () => {
    const src = [
      `:root { --color-bg-primary: #0f1114; }`,
      `.a { color: var(--wikios-text, #ffffff); }`,
      `.b { background: linear-gradient(#ffffff, #000000); box-shadow: 0 0 4px #ef4444; }`,
      `@media print { .c { color: #000; } }`,
      `.facet-material-paper { background-color: #fafaf9; }`,
      `/* color: #fff */`,
    ].join("\n");
    const { output, sites } = transformSource(CSS, src);
    expect(output).toBe(src);
    expect(sites.map((s) => s.kind)).toEqual([
      "token-def",
      "fallback",
      "css-effect",
      "css-effect",
      "css-effect",
      "css-effect",
      "data",
      "comment",
    ]);
  });
});
