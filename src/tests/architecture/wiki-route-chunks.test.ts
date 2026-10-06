/** @jest-environment node */
/**
 * Plan 415 (F19): what a reader does not need at first paint is not statically imported by the wiki route.
 * The route's static import graph (a `next/dynamic(() => import())` is a separate chunk and is not followed)
 * must not reach the heavy overlays: the Halo's expanded wiki views and the narrator player (fetched when the
 * Halo opens), the meeting scheduler (when its dialog is first opened) and the daily-claim dialog (after the
 * page is interactive). They used to ship with every article page.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENTRIES = [
  "src/app/layout.tsx",
  "src/app/(wiki-os)/layout.tsx",
  "src/app/(wiki-os)/wiki/layout.tsx",
  "src/app/(wiki-os)/wiki/[...slug]/page.tsx",
];
/** Not on the route's critical path: each is loaded on demand. */
const LAZY = [
  "src/components/executive/actions/MeetingScheduler.tsx",
  "src/components/vault/DailyBonusWidget.tsx",
  "src/components/halo/plugins/wiki/views/WikiView.tsx",
  "src/components/halo/plugins/wiki/views/WikiProfileView.tsx",
  "src/components/halo/plugins/wiki/views/WikiNarratorView.tsx",
  "src/components/halo/plugins/wiki/components/WikiNarratorPlayer.tsx",
];

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;

function resolve(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("~/")) base = path.join(ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx"), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file the entries import statically, directly or not, and the first importer that reached it. */
function staticGraph(entries: string[]): Map<string, string | null> {
  const parent = new Map<string, string | null>(entries.map((entry) => [entry, null]));
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const match of fs.readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const target = resolve(file, match[1]!);
      if (target && !parent.has(target)) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return parent;
}

function chain(graph: Map<string, string | null>, file: string): string {
  const steps: string[] = [];
  for (let current: string | null | undefined = file; current; current = graph.get(current)) {
    steps.push(path.relative(ROOT, current));
  }
  return steps.reverse().join(" -> ");
}

describe("the wiki route's static imports", () => {
  const graph = staticGraph(ENTRIES.map((entry) => path.join(ROOT, entry)));

  it("cover the route (the walk is not vacuous)", () => {
    expect(graph.size).toBeGreaterThan(500);
    for (const required of [
      "src/components/wiki-os/shared/WikiOSLayout.tsx",
      "src/components/halo/plugins/wiki/WikiHalo.tsx",
      "src/components/mycountry/dossier/CountryActionsMenu.tsx",
      "src/components/mycountry/shell/VaultWidget.tsx",
    ]) {
      expect(graph.has(path.join(ROOT, required))).toBe(true);
    }
  });

  it.each(LAZY)("do not reach %s", (lazy) => {
    const file = path.join(ROOT, lazy);

    expect(graph.has(file) ? chain(graph, file) : null).toBeNull();
  });
});
