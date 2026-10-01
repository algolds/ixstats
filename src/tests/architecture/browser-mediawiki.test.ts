/** @jest-environment node */
/**
 * Plan 418: a browser never asks MediaWiki anything. The editor used to render a template preview in the
 * browser (`renderTemplateCached` -> `getTemplatePreview` -> `action=parse` POSTed to the public api.php); it
 * now asks `wikios.getTemplatePreview`, which renders on the server (sanitised, cached in Redis).
 *
 * Client code (everything under src/components and src/hooks, and any file that starts with "use client")
 * must not import the modules that call MediaWiki, and must not name the helpers that build its URLs.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

/** Modules that make a request to MediaWiki: server-side only. */
const MEDIAWIKI_MODULES =
  /wiki-os\/(?:adapters\/mediawiki\/(?:parsoid|write-service|csrf-cache|attempt-scope)|templates\/(?:template-engine\.server|preview-service|template-data-reader)|services\/(?:render-service|inbound-mediawiki|auto-sync-service|mirror-[a-z-]+))/;
const MEDIAWIKI_HELPERS = /\b(?:getMediaWikiApiUrl|renderArticleViaMediaWiki|wikitextToHtml)\b/;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "__tests__" && entry.name !== "node_modules") {
        sourceFiles(full, found);
      }
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const isClient = (file: string, text: string): boolean =>
  /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*["']use client["']/.test(text) ||
  file.startsWith(path.join(SRC, "components") + path.sep) ||
  file.startsWith(path.join(SRC, "hooks") + path.sep);

describe("client code and MediaWiki", () => {
  const clientFiles = sourceFiles(SRC)
    .map((file) => ({ file, text: fs.readFileSync(file, "utf8") }))
    .filter(({ file, text }) => isClient(file, text));

  it("looks at the client code (a guard against the filter going wrong)", () => {
    expect(clientFiles.length).toBeGreaterThan(300);
  });

  it("imports no module that calls MediaWiki, and names none of its URL helpers", () => {
    const offenders = clientFiles.flatMap(({ file, text }) => {
      const imports = [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
      const bad = imports.filter((specifier) => MEDIAWIKI_MODULES.test(specifier));
      if (MEDIAWIKI_HELPERS.test(text)) bad.push("(a MediaWiki URL helper)");
      return bad.map((what) => `${path.relative(ROOT, file)}: ${what}`);
    });

    expect(offenders).toEqual([]);
  });

  it("the editor's template insert asks the server for its preview", () => {
    const hook = fs.readFileSync(
      path.join(SRC, "components/wiki-os/editor/hooks/useWikiVisualFormatting.ts"),
      "utf8"
    );

    expect(hook).toContain("wikios.getTemplatePreview.fetch");
    expect(hook).not.toContain("renderTemplateCached");
  });
});

describe("the template modules", () => {
  const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), "utf8");

  it("the module that calls MediaWiki is server-only, and the client-safe registry cannot reach it", () => {
    expect(read("lib/wiki-os/templates/template-engine.server.ts")).toMatch(/^import "server-only";$/m);

    const registry = read("lib/wiki-os/templates/template-registry.ts");
    expect(registry).not.toMatch(/^import /m);
    expect(registry).not.toMatch(MEDIAWIKI_HELPERS);
  });

  it("has no client-side preview service left", () => {
    expect(fs.existsSync(path.join(SRC, "lib/wiki-os/templates/preview-service.ts"))).toBe(false);
  });
});
