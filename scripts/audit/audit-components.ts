/**
 * Component usage audit — import-graph reachability analysis.
 *
 * Builds the module graph for the whole `src/` tree (+ server.mjs), then does a
 * BFS from Next.js entry points. Any file under src/components NOT reached from
 * a production entry point is an "unused" candidate (dead code).
 *
 * Why reachability (not grep): barrels (`export * from`), alias paths (~/ @/),
 * and dynamic `import()` make symbol-grep both over- and under-count. Reachability
 * follows the same edges the bundler does, so a file is "used" iff the app can
 * actually reach it.
 *
 * Entry points (what Next.js auto-loads):
 *   - src/app/**​/{page,layout,template,loading,error,global-error,not-found,
 *     default,route,sitemap,robots,manifest,*-image,icon,apple-icon}.{ts,tsx,js,jsx}
 *   - src/proxy.ts (middleware), src/instrumentation.ts, server.mjs
 *
 * Test/story files are NOT entry points; a component reached ONLY through a test
 * is reported as unused-in-prod but tagged "(test-only)".
 *
 * Usage:
 *   bun run scripts/audit/audit-components.ts            # human report
 *   bun run scripts/audit/audit-components.ts --json     # machine list of unused files
 */
import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

const ENTRY_BASENAMES = new Set([
  "page",
  "layout",
  "template",
  "loading",
  "error",
  "global-error",
  "not-found",
  "default",
  "route",
  "sitemap",
  "robots",
  "manifest",
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
]);

const isTestFile = (p: string) =>
  /\.(test|spec|stories)\.[tj]sx?$/.test(p) || p.split(path.sep).includes("__tests__");

// ─── collect all source files ─────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walk(p, out);
    } else if (/\.[tj]sx?$/.test(e.name) || e.name.endsWith(".mjs")) {
      out.push(p);
    }
  }
  return out;
}

const allFiles = walk(SRC);
const serverMjs = path.join(ROOT, "server.mjs");
if (fs.existsSync(serverMjs)) allFiles.push(serverMjs);

const lc = (f: string) => fs.readFileSync(f, "utf8").split("\n").length;

// ─── module resolution (aliases + relative + index) ───────────────────────────
function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("~/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // bare module (node_modules) — external

  // TS-style imports written with a .js-family extension actually resolve to the
  // .ts-family source (e.g. server.mjs: import "./src/lib/foo.js" -> foo.ts).
  const jsExt = base.match(/\.(js|jsx|mjs|cjs)$/);
  if (jsExt) {
    const stem = base.slice(0, -jsExt[0].length);
    for (const ext of [".ts", ".tsx", ".mts", ".cts", jsExt[0]])
      if (fs.existsSync(stem + ext)) return stem + ext;
  }

  // already has a resolvable extension?
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTS) if (fs.existsSync(base + ext)) return base + ext;
  for (const ext of EXTS) {
    const idx = path.join(base, "index" + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return null; // css / image / json / unresolved — ignore as a graph edge
}

// ─── extract import edges from one file ───────────────────────────────────────
const project = new Project({ skipAddingFilesFromTsConfig: true });

function edgesOf(file: string): string[] {
  let sf: SourceFile;
  try {
    sf = project.addSourceFileAtPath(file);
  } catch {
    return [];
  }
  const specs = new Set<string>();
  for (const imp of sf.getImportDeclarations()) specs.add(imp.getModuleSpecifierValue());
  for (const exp of sf.getExportDeclarations()) {
    const v = exp.getModuleSpecifierValue();
    if (v) specs.add(v); // re-export: `export ... from "x"` (barrel edge)
  }
  // dynamic import("x") and CommonJS require("x")
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    const isDynamicImport = expr.getKind() === SyntaxKind.ImportKeyword;
    const isRequire = expr.isKind(SyntaxKind.Identifier) && expr.getText() === "require";
    if (isDynamicImport || isRequire) {
      const arg = call.getArguments()[0];
      if (arg?.isKind(SyntaxKind.StringLiteral)) specs.add(arg.getLiteralValue());
    }
  }
  project.removeSourceFile(sf);

  const out: string[] = [];
  for (const s of specs) {
    const r = resolveSpecifier(s, file);
    if (r) out.push(r);
  }
  return out;
}

// Pre-compute edges for every file once.
const graph = new Map<string, string[]>();
for (const f of allFiles) graph.set(f, edgesOf(f));

// ─── entry points ─────────────────────────────────────────────────────────────
const entries: string[] = [];
for (const f of allFiles) {
  const rel = path.relative(ROOT, f);
  const baseNoExt = path.basename(f).replace(/\.[tj]sx?$|\.mjs$/, "");
  if (rel.startsWith("src/app/") && ENTRY_BASENAMES.has(baseNoExt)) entries.push(f);
}
for (const p of ["src/proxy.ts", "src/instrumentation.ts", "server.mjs"]) {
  const abs = path.join(ROOT, p);
  if (fs.existsSync(abs)) entries.push(abs);
}

// ─── BFS reachability (production) and a separate test-reachability ───────────
function reach(seeds: string[]): Set<string> {
  const seen = new Set<string>(seeds);
  const q = [...seeds];
  while (q.length) {
    const cur = q.pop()!;
    for (const next of graph.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        q.push(next);
      }
    }
  }
  return seen;
}

const prodReachable = reach(entries);

// Files reachable from tests (to tag test-only components).
const testSeeds = allFiles.filter(isTestFile);
const testReachable = reach(testSeeds);

// ─── whole-src dead set (for consistent deletion incl. dead importers) ────────
// A dead set is only safe to delete WHOLE: any importer of a dead file is itself
// dead (else the file would be reachable). So unreachable files across the entire
// src tree — minus entries, .d.ts (ambient), and test/story files — form a closed
// subgraph with no dangling edges into live code.
if (process.argv.includes("--dead-all") || process.argv.includes("--dead-all-list")) {
  const entrySet = new Set(entries);
  const deadAll = allFiles.filter(
    (f) => !prodReachable.has(f) && !entrySet.has(f) && !isTestFile(f) && !f.endsWith(".d.ts")
  );
  if (process.argv.includes("--dead-all-list")) {
    for (const f of deadAll) console.log(path.relative(ROOT, f));
    process.exit(0);
  }
  const byTop = new Map<string, { n: number; lines: number }>();
  for (const f of deadAll) {
    const rel = path.relative(ROOT, f);
    const seg = rel.split("/").slice(0, 2).join("/"); // src/<top>
    const g = byTop.get(seg) ?? { n: 0, lines: 0 };
    g.n++;
    g.lines += lc(f);
    byTop.set(seg, g);
  }
  const totalLines = deadAll.reduce((s, f) => s + lc(f), 0);
  console.log(`\n=== FULL UNREACHABLE SET (whole src, safe-to-delete-as-unit) ===`);
  console.log(`files: ${deadAll.length}   lines: ${totalLines.toLocaleString()}\n`);
  for (const [seg, g] of [...byTop.entries()].sort((a, b) => b[1].lines - a[1].lines))
    console.log(`  ${seg.padEnd(26)} ${String(g.n).padStart(4)}  ${String(g.lines).padStart(7)}`);
  process.exit(0);
}

// ─── report ───────────────────────────────────────────────────────────────────
const componentFiles = allFiles.filter(
  (f) => f.startsWith(path.join(SRC, "components") + path.sep) && !isTestFile(f)
);
const unused = componentFiles
  .filter((f) => !prodReachable.has(f))
  .map((f) => ({ file: path.relative(ROOT, f), lines: lc(f), testOnly: testReachable.has(f) }))
  .sort((a, b) => b.lines - a.lines);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(unused, null, 2));
  process.exit(0);
}

// ─── triage: orphan vs dead-cluster ───────────────────────────────────────────
// Build reverse edges (who imports each file), then classify each dead file:
//   orphan  — no file in the repo imports it (deleting it cannot break anything)
//   cluster — imported only by other dead files (safe once the cluster goes too)
//   LEAK    — imported by a LIVE file (should be impossible by BFS; asserts no bug)
if (process.argv.includes("--triage")) {
  const deadSet = new Set(componentFiles.filter((f) => !prodReachable.has(f)));
  const inbound = new Map<string, string[]>();
  for (const [from, tos] of graph)
    for (const to of tos) {
      if (!inbound.has(to)) inbound.set(to, []);
      inbound.get(to)!.push(from);
    }
  const orphans: string[] = [];
  const cluster: string[] = [];
  const leaks: { file: string; liveImporters: string[] }[] = [];
  for (const f of deadSet) {
    const importers = (inbound.get(f) ?? []).filter((i) => i !== f);
    if (importers.length === 0) {
      orphans.push(f);
      continue;
    }
    const live = importers.filter((i) => prodReachable.has(i));
    if (live.length)
      leaks.push({
        file: path.relative(ROOT, f),
        liveImporters: live.map((p) => path.relative(ROOT, p)),
      });
    else cluster.push(f);
  }
  const relSort = (a: string, b: string) => lc(b) - lc(a);
  orphans.sort(relSort);
  cluster.sort(relSort);
  const sum = (arr: string[]) => arr.reduce((s, f) => s + lc(f), 0);

  if (process.argv.includes("--orphans-list")) {
    for (const f of orphans) console.log(path.relative(ROOT, f));
    process.exit(0);
  }
  console.log(`\n=== TRIAGE ===`);
  console.log(
    `orphans (0 importers, safest):  ${orphans.length}  (${sum(orphans).toLocaleString()} lines)`
  );
  console.log(
    `dead-cluster (dead→dead only):  ${cluster.length}  (${sum(cluster).toLocaleString()} lines)`
  );
  console.log(`LEAKS (live importer — investigate): ${leaks.length}`);
  for (const l of leaks.slice(0, 20))
    console.log(`  ⚠️ ${l.file}  ← ${l.liveImporters.join(", ")}`);
  console.log(`\n--- top 30 orphans by size ---`);
  for (const f of orphans.slice(0, 30))
    console.log(`  ${String(lc(f)).padStart(5)}  ${path.relative(ROOT, f)}`);
  process.exit(0);
}

const totalComp = componentFiles.length;
const usedComp = totalComp - unused.length;
const deadLines = unused.reduce((s, u) => s + u.lines, 0);
const testOnly = unused.filter((u) => u.testOnly);

// group unused by top-level component dir
const byDir = new Map<string, { n: number; lines: number }>();
for (const u of unused) {
  const parts = u.file.split("/"); // src/components/<seg>/...
  const seg = parts.length > 3 ? parts[2]! : "(root)"; // index 2 = top-level component dir
  const g = byDir.get(seg) ?? { n: 0, lines: 0 };
  g.n++;
  g.lines += u.lines;
  byDir.set(seg, g);
}

console.log(`\n=== COMPONENT USAGE AUDIT (import-graph reachability) ===\n`);
console.log(`Component files (excl. tests): ${totalComp}`);
console.log(`  reachable from app entry pts: ${usedComp}`);
console.log(
  `  UNUSED (dead candidates):     ${unused.length}  (${deadLines.toLocaleString()} lines)`
);
console.log(`  └─ of which test-only:        ${testOnly.length}`);
console.log(`Entry points scanned: ${entries.length}\n`);

console.log(`--- unused by top-level dir (count / lines) ---`);
for (const [dir, g] of [...byDir.entries()].sort((a, b) => b[1].lines - a[1].lines)) {
  console.log(`  ${dir.padEnd(22)} ${String(g.n).padStart(4)}  ${String(g.lines).padStart(7)}`);
}

console.log(`\n--- top 40 unused files by size ---`);
for (const u of unused.slice(0, 40)) {
  console.log(`  ${String(u.lines).padStart(5)}  ${u.file}${u.testOnly ? "  (test-only)" : ""}`);
}

console.log(`\nNote: a file is "unused" iff unreachable from a production entry point.`);
console.log(`Caveats: components referenced only via non-literal dynamic import, MDX,`);
console.log(`or string convention won't be detected as used — spot-check before deleting.`);
console.log(`Full machine-readable list: bun run scripts/audit/audit-components.ts --json\n`);
