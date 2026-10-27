/** @jest-environment node */
/**
 * What client code may import. Plan 162: nothing imports the deleted `~/lib/{system,vault,cards}` barrels. Plan 418: a
 * browser never asks MediaWiki anything, so client code (src/components, src/hooks and any "use client" file) imports
 * no module that calls MediaWiki, names none of its URL helpers, and takes no value from the `~/lib/wiki-os` root
 * barrel (it re-exports the adapter, the repositories and the guardian). The Lorewards view ships in the standalone
 * WikiOS bundle, so it pulls in nothing Vault-only. Plan 415 (F19): the wiki route's static import graph does not reach
 * the overlays loaded on demand.
 *
 * Folds browser-mediawiki, lorewards-view-standalone and wiki-route-chunks.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["tests", "__tests__", "node_modules", ".next"].includes(entry.name)) {
        sourceFiles(full, found);
      }
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const sources = sourceFiles(SRC).map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
const rel = (file: string) => path.relative(ROOT, file);

describe("deleted barrel roots", () => {
  it("no source file imports ~/lib/system, ~/lib/vault or ~/lib/cards", () => {
    const barrel = /from\s+["']~\/lib\/(?:system|vault|cards)["']/;
    expect(sources.filter(({ text }) => barrel.test(text)).map(({ file }) => rel(file))).toEqual(
      []
    );
  });
});

/** Modules that make a request to MediaWiki (or parse its HTML with jsdom): server-side only. */
const MEDIAWIKI_MODULES =
  /wiki-os\/(?:upstream-guard|adapters\/mediawiki\/(?:parsoid|write-service|csrf-cache|attempt-scope)|templates\/(?:template-engine\.server|preview-service|template-data-reader|template-data-cache)|services\/(?:render-service|sister-render-service|sister-embed-service|inbound-mediawiki|auto-sync-service|mirror-[a-z-]+)|sister-embed-parts)/;
const MEDIAWIKI_HELPERS = /\b(?:getMediaWikiApiUrl|renderArticleViaMediaWiki|wikitextToHtml)\b/;
const WIKI_OS_ROOT = path.join(SRC, "lib", "wiki-os");

/** A module a file imports (or re-exports, or loads with `import()`), and whether only its types are used. */
function importedModules(text: string): Array<{ specifier: string; typeOnly: boolean }> {
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
  const clientFiles = sources.filter(({ file, text }) => isClient(file, text));

  it("looks at the client code (a guard against the filter going wrong)", () => {
    expect(clientFiles.length).toBeGreaterThan(300);
  });

  it("imports no module that calls MediaWiki, and names none of its URL helpers", () => {
    const offenders = clientFiles.flatMap(({ file, text }) => {
      const imports = [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
        (m) => m[1]!
      );
      const bad = imports.filter((specifier) => MEDIAWIKI_MODULES.test(specifier));
      if (MEDIAWIKI_HELPERS.test(text)) bad.push("(a MediaWiki URL helper)");
      return bad.map((what) => `${rel(file)}: ${what}`);
    });
    expect(offenders).toEqual([]);
  });

  it("imports no value from the `~/lib/wiki-os` root barrel", () => {
    const offenders = clientFiles.flatMap(({ file, text }) =>
      importedModules(text)
        .filter(({ specifier, typeOnly }) => !typeOnly && isWikiOsRootBarrel(file, specifier))
        .map(({ specifier }) => `${rel(file)}: ${specifier}`)
    );
    expect(offenders).toEqual([]);
  });

  it("the module that calls MediaWiki is server-only, and the client-safe registry cannot reach it", () => {
    const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), "utf8");
    expect(read("lib/wiki-os/templates/template-engine.server.ts")).toMatch(
      /^import "server-only";$/m
    );
    const registry = read("lib/wiki-os/templates/template-registry.ts");
    expect(registry).not.toMatch(/^import /m);
    expect(registry).not.toMatch(MEDIAWIKI_HELPERS);
  });

  const client = path.join(SRC, "components", "wiki-os", "reader", "Thing.tsx");
  const flagged = (code: string) =>
    importedModules(code).filter((m) => !m.typeOnly && isWikiOsRootBarrel(client, m.specifier));

  it.each([
    'import { WikiOsThing } from "~/lib/wiki-os";',
    "import { a,\n  b,\n} from '~/lib/wiki-os/index';",
    'export * from "~/lib/wiki-os";',
    'const lazy = await import("~/lib/wiki-os");',
    'import { x } from "../../../lib/wiki-os";',
  ])("the root-barrel check flags %s", (code) => {
    expect(flagged(code)).toHaveLength(1);
  });

  it.each([
    'import type { WikiOsThing } from "~/lib/wiki-os";',
    'import { wikiPath } from "~/lib/wiki-os/wiki-path";',
    'import { x } from "~/lib/wiki-os-other";',
  ])("the root-barrel check lets %s through", (code) => {
    expect(flagged(code)).toHaveLength(0);
  });
});

describe("the standalone Lorewards view", () => {
  const dir = path.join(SRC, "components", "lorewards");
  const files = sources.filter(({ file }) => file.startsWith(dir + path.sep));
  const IMPORT = /^import\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gms;

  it("is scanned (the view and its sections are there)", () => {
    expect(files.map(({ file }) => path.basename(file))).toEqual(
      expect.arrayContaining(["LorewardsView.tsx", "YourLorewards.tsx"])
    );
  });

  it("imports nothing Vault-only: no Vault components or hooks, no server modules, from ~/lib/vault only types", () => {
    const offenders = files.flatMap(({ file, text }) =>
      [...text.matchAll(IMPORT)]
        .filter(
          ([, typeOnly, from]) =>
            /^~\/(components\/vault|server|hooks\/vault)/.test(from!) ||
            (from!.startsWith("~/lib/vault") && !typeOnly)
        )
        .map(([, , from]) => `${rel(file)}: ${from}`)
    );
    expect(offenders).toEqual([]);
  });
});

describe("the wiki route's static imports", () => {
  const ENTRIES = [
    "src/app/layout.tsx",
    "src/app/(wiki-os)/layout.tsx",
    "src/app/(wiki-os)/wiki/layout.tsx",
    "src/app/(wiki-os)/wiki/[...slug]/page.tsx",
  ];
  /** Not on the route's critical path: each is loaded on demand (a `next/dynamic(() => import())` is not followed). */
  const LAZY = [
    "src/components/executive/actions/MeetingScheduler.tsx",
    "src/components/vault/DailyBonusWidget.tsx",
    "src/components/halo/plugins/wiki/views/WikiView.tsx",
    "src/components/halo/plugins/wiki/views/WikiProfileView.tsx",
    "src/components/halo/plugins/wiki/views/WikiNarratorView.tsx",
    "src/components/halo/plugins/wiki/components/WikiNarratorPlayer.tsx",
  ];
  const STATIC_IMPORT =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;

  function resolve(from: string, specifier: string): string | null {
    let base: string;
    if (specifier.startsWith("~/")) base = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
    else return null;
    const candidates = [
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
      base,
    ];
    return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
  }

  /** Every file the entries import statically, directly or not, and the first importer that reached it. */
  const graph = new Map<string, string | null>(ENTRIES.map((e) => [path.join(ROOT, e), null]));
  const queue = [...graph.keys()];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const match of fs.readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const target = resolve(file, match[1]!);
      if (target && !graph.has(target)) {
        graph.set(target, file);
        queue.push(target);
      }
    }
  }
  const chain = (file: string) => {
    const steps: string[] = [];
    for (let at: string | null | undefined = file; at; at = graph.get(at)) steps.push(rel(at));
    return steps.reverse().join(" -> ");
  };

  it("cover the route (the walk is not vacuous)", () => {
    expect(graph.size).toBeGreaterThan(500);
    for (const required of [
      "src/components/wiki-os/shared/WikiOSLayout.tsx",
      "src/components/halo/plugins/wiki/WikiHalo.tsx",
      "src/components/mycountry/dossier/CountryActionsMenu.tsx",
      "src/components/wiki-os/shared/WikiPageTools.tsx",
    ]) {
      expect(graph.has(path.join(ROOT, required))).toBe(true);
    }
  });

  it.each(LAZY)("do not reach %s", (lazy) => {
    const file = path.join(ROOT, lazy);
    expect(graph.has(file) ? chain(file) : null).toBeNull();
  });
});
