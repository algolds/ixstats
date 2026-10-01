/** @jest-environment node */
/**
 * Plan 413 (item 4): editors.css travels with the editor chunk, no reader selector lives in it, and
 * the fonts the wiki asks for are ones that exist.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

/** The selector parts (comma-separated) of every style rule in a stylesheet. */
function selectorParts(css: string): string[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const parts = new Set<string>();
  let buffer = "";
  for (const char of stripped) {
    if (char === "{") {
      const prelude = buffer.trim();
      if (!prelude.startsWith("@")) for (const part of prelude.split(",")) parts.add(part.trim());
      buffer = "";
    } else if (char === "}" || char === ";") {
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return [...parts];
}

const classesOf = (selector: string) =>
  [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]!);

function filesUnder(dir: string, skip: (path: string) => boolean, found: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (skip(path)) continue;
    if (statSync(join(root, path)).isDirectory()) filesUnder(path, skip, found);
    else if (/\.(tsx?|css)$/.test(name)) found.push(path);
  }
  return found;
}

describe("editors.css leaves the reader's stylesheet", () => {
  it("is not imported by wiki-os.css, but by both dynamically loaded editors", () => {
    expect(read("src/styles/wiki-os.css")).not.toMatch(/@import[^;]*editors\.css/);
    for (const editor of ["WikiVisualEditor", "WikiSourceEditor"]) {
      expect(read(`src/components/wiki-os/editor/${editor}.tsx`)).toContain(
        'import "~/styles/wiki-os/editors.css";'
      );
    }
    // and those two are the dynamic chunks of the edit bridge, not imported statically by the reader
    const bridge = read("src/components/wiki-os/editor/WikiEditBridge.tsx");
    expect(bridge).toMatch(
      /dynamic\(\s*\(\) => import\("~\/components\/wiki-os\/editor\/WikiVisualEditor"\)/
    );
    expect(bridge).toMatch(
      /dynamic\(\s*\(\) => import\("~\/components\/wiki-os\/editor\/WikiSourceEditor"\)/
    );
  });

  it("holds no selector a reader page can match, but one Parsoid-only rule", () => {
    const readerFiles = [
      ...filesUnder(
        "src/components/wiki-os",
        (path) => path.startsWith("src/components/wiki-os/editor") || path.endsWith("editors.css")
      ),
      ...filesUnder("src/app/(wiki-os)", () => false),
      ...filesUnder("src/styles", (path) => path.endsWith("wiki-os/editors.css")),
      ...filesUnder("src/lib/wiki-os", () => false),
    ];
    const readerText = readerFiles.map((file) => read(file)).join("\n");
    const usedByReader = (name: string) =>
      new RegExp(`(?<![\\w-])${name.replace(/[-]/g, "\\-")}(?![\\w-])`).test(readerText);

    const reachable = selectorParts(read("src/styles/wiki-os/editors.css")).filter((selector) =>
      classesOf(selector).every(usedByReader)
    );

    // `typeof="mw:Transclusion"` is Parsoid's RDFa: the reader's HTML comes from action=parse (the
    // legacy parser), which never writes it, so the rule only ever matches inside the editor.
    expect(reachable).toEqual(['div[typeof*="mw:Transclusion"]:has(.infobox)']);
  });
});

describe("fonts", () => {
  it("loads the brand font through next/font/local, without preloading it", () => {
    const layout = read("src/app/(wiki-os)/layout.tsx");
    expect(layout).toContain('from "next/font/local"');
    expect(layout).toContain('variable: "--font-host-grotesk"');
    expect(layout).toContain("preload: false");
    expect(layout).toContain("HostGrotesk[wght].ttf");
    expect(layout).toContain("hostGrotesk.variable");
  });

  it("does not ask for the Azeret Mono 400 file that does not exist", () => {
    const typography = read("src/styles/typography.css");
    expect(typography).not.toContain("Azeret Mono-400.ttf");
    expect(typography).toContain("Azeret Mono-500.ttf");
  });

  const fontsPresent = existsSync(join(root, "public/fonts"));
  (fontsPresent ? it : it.skip)(
    "every /fonts file typography.css requests is in public/fonts",
    () => {
      const urls = [
        ...read("src/styles/typography.css").matchAll(/url\("\/fonts\/([^"]+)"\)/g),
      ].map((match) => match[1]!);
      const missing = urls.filter((url) => !existsSync(join(root, "public/fonts", url)));
      expect(missing).toEqual([]);
    }
  );
});
