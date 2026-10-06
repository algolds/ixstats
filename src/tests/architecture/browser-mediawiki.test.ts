/** @jest-environment node */
/**
 * Plan 418: a browser never asks MediaWiki anything. The editor used to render a template preview in the
 * browser (`renderTemplateCached` -> `getTemplatePreview` -> `action=parse` POSTed to the public api.php); it
 * now asks `wikios.getTemplatePreview`, which renders on the server (sanitised, cached in Redis).
 *
 * Client code (everything under src/components and src/hooks, and any file that starts with "use client")
 * must not import the modules that call MediaWiki, and must not name the helpers that build its URLs.
 * It must not import the `~/lib/wiki-os` root barrel either: that one re-exports the MediaWiki adapter, the
 * repositories and the guardian, so a single `import { x } from "~/lib/wiki-os"` bundles the server into
 * the browser. A client imports the leaf module it needs (`~/lib/wiki-os/wiki-path`, `~/lib/wiki-os/core/title`, ...).
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

const WIKI_OS_ROOT = path.join(SRC, "lib", "wiki-os");

/** A module `file` imports (or re-exports, or loads with `import()`), and whether only its types are used. */
interface ImportedModule {
  specifier: string;
  typeOnly: boolean;
}

function importedModules(text: string): ImportedModule[] {
  const statements =
    /\b(?:import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  return [...text.matchAll(statements)].map((m) => ({
    specifier: (m[2] ?? m[3])!,
    typeOnly: m[1] !== undefined,
  }));
}

/** Whether `specifier`, imported by `file`, is the `~/lib/wiki-os` root barrel (`index.ts`) however it is spelled. */
function isWikiOsRootBarrel(file: string, specifier: string): boolean {
  const target = /^(?:~|@)\//.test(specifier)
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(file), specifier)
      : null;
  return target !== null && [WIKI_OS_ROOT, path.join(WIKI_OS_ROOT, "index")].includes(target);
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

  it("imports no value from the `~/lib/wiki-os` root barrel, which re-exports the server's modules", () => {
    const offenders = clientFiles.flatMap(({ file, text }) =>
      importedModules(text)
        .filter(({ specifier, typeOnly }) => !typeOnly && isWikiOsRootBarrel(file, specifier))
        .map(({ specifier }) => `${path.relative(ROOT, file)}: ${specifier}`)
    );

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

describe("the root-barrel check", () => {
  const client = path.join(SRC, "components", "wiki-os", "reader", "Thing.tsx");
  const flagged = (code: string, file = client) =>
    importedModules(code).filter((m) => !m.typeOnly && isWikiOsRootBarrel(file, m.specifier));

  it.each([
    'import { WikiOsThing } from "~/lib/wiki-os";',
    "import { a,\n  b,\n} from '~/lib/wiki-os/index';",
    'export * from "~/lib/wiki-os";',
    'const lazy = await import("~/lib/wiki-os");',
    'import "~/lib/wiki-os";',
    'import { x } from "@/lib/wiki-os";',
    'import { x } from "../../../lib/wiki-os";',
    'import { x } from "../../../lib/wiki-os/index";',
  ])("flags %s", (code) => {
    expect(flagged(code)).toHaveLength(1);
  });

  it.each([
    'import type { WikiOsThing } from "~/lib/wiki-os";',
    'import { wikiPath } from "~/lib/wiki-os/wiki-path";',
    'import { canonicalizeTitle } from "~/lib/wiki-os/core/title";',
    'import { x } from "~/lib/wiki-os-other";',
    'import { x } from "../wiki-os";',
    'import { x } from "wiki-os";',
  ])("lets %s through", (code) => {
    expect(flagged(code)).toHaveLength(0);
  });
});
