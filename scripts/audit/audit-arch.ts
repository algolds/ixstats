/**
 * Architecture guard (Phase 0) — enforces arch.md without boiling the ocean.
 *
 * Two checks, both designed to FREEZE regressions while the codebase is
 * incrementally split down toward the arch.md ideals:
 *
 *   1. File-size ceiling (the "no god files" rule)
 *      - DEFAULT_MAX (700): most router / type files must split before this.
 *      - RELAXED_MAX (900): files in RELAXED_FILES legitimately stay flat
 *        (data tables, core shared type defs) and get the higher ceiling.
 *      - Ratchet: every file already over its ceiling is recorded in
 *        arch-baseline.json at its current size and may NOT grow. New files
 *        must be under their ceiling. As files are split, re-run with --update
 *        to lower the baseline (it can only ratchet down, never up).
 *
 *   2. Cross-router imports (the "no cross-router imports" rule)
 *      - A router under routers/<A>/ may not import from routers/<B>/.
 *      - Shared primitives belong in src/server/shared/, not another router.
 *      - Current known violations are listed in CROSS_ROUTER_ALLOWLIST so the
 *        check is green today; remove entries as they are fixed.
 *
 * Usage:
 *   bun run scripts/audit/audit-arch.ts            # check (exit 1 on violation)
 *   bun run scripts/audit/audit-arch.ts --update   # rewrite the size baseline
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const ROUTERS_DIR = "src/server/api/routers";
const TYPES_DIR = "src/types";
const BASELINE_PATH = "scripts/audit/arch-baseline.json";

const DEFAULT_MAX = 700;
const RELAXED_MAX = 900;

/** Files that legitimately stay as a single large file (data tables / core type defs). */
const RELAXED_FILES = new Set<string>([
  "src/types/ixstats.ts",
  "src/types/economy-builder.ts",
  "src/server/api/routers/taxSystem/crud.ts",
]);

/**
 * Known cross-router imports that are not yet fixed. Each entry is the importing
 * file. Remove an entry once the import is moved to src/server/shared/.
 * (Phase 1 clears this list entirely.)
 */
const CROSS_ROUTER_ALLOWLIST = new Set<string>([]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...walk(rel));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

function lineCount(relPath: string): number {
  const text = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  // newline count == `wc -l` semantics
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}

function ceilingFor(relPath: string): number {
  return RELAXED_FILES.has(relPath) ? RELAXED_MAX : DEFAULT_MAX;
}

/** routers/<segment>/... → returns the router-group segment, or null for flat files. */
function routerGroup(relPath: string): string | null {
  const prefix = `${ROUTERS_DIR}/`;
  if (!relPath.startsWith(prefix)) return null;
  const rest = relPath.slice(prefix.length);
  const slash = rest.indexOf("/");
  return slash === -1 ? null : rest.slice(0, slash);
}

// ─── Check 1: file-size ratchet ───────────────────────────────────────────────

type Baseline = Record<string, number>;

function loadBaseline(): Baseline {
  const abs = path.join(ROOT, BASELINE_PATH);
  if (!fs.existsSync(abs)) return {};
  return JSON.parse(fs.readFileSync(abs, "utf8")) as Baseline;
}

function computeOffenders(): Baseline {
  const offenders: Baseline = {};
  for (const f of [...walk(ROUTERS_DIR), ...walk(TYPES_DIR)]) {
    const lines = lineCount(f);
    if (lines > ceilingFor(f)) offenders[f] = lines;
  }
  return offenders;
}

function updateBaseline(): void {
  const current = computeOffenders();
  const prev = loadBaseline();
  // Ratchet down only: keep the smaller of prev/current so the baseline never inflates.
  const merged: Baseline = {};
  for (const [f, lines] of Object.entries(current)) {
    merged[f] = f in prev ? Math.min(prev[f]!, lines) : lines;
  }
  const sorted = Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1]));
  fs.writeFileSync(path.join(ROOT, BASELINE_PATH), JSON.stringify(sorted, null, 2) + "\n");
  console.log(
    `✓ Baseline updated: ${Object.keys(merged).length} ratcheted files → ${BASELINE_PATH}`
  );
}

function checkSizes(): string[] {
  const baseline = loadBaseline();
  const errors: string[] = [];
  for (const f of [...walk(ROUTERS_DIR), ...walk(TYPES_DIR)]) {
    const lines = lineCount(f);
    const ceiling = ceilingFor(f);
    if (lines <= ceiling) continue;
    const allowed = baseline[f];
    if (allowed === undefined) {
      errors.push(
        `NEW god file: ${f} = ${lines} lines (ceiling ${ceiling}). Split it or add to RELAXED_FILES.`
      );
    } else if (lines > allowed) {
      errors.push(
        `GROWN past baseline: ${f} = ${lines} lines (baseline ${allowed}, ceiling ${ceiling}). Do not grow ratcheted files.`
      );
    }
  }
  return errors;
}

// ─── Check 2: cross-router imports ────────────────────────────────────────────

function checkCrossRouter(): string[] {
  const errors: string[] = [];
  const importRe = /from\s+["'](~\/server\/api\/routers\/[^"']+)["']/g;
  for (const f of walk(ROUTERS_DIR)) {
    const group = routerGroup(f);
    if (group === null) continue; // flat router; sibling imports handled at top level
    if (CROSS_ROUTER_ALLOWLIST.has(f)) continue;
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of text.matchAll(importRe)) {
      const target = m[1]!.replace("~/", "src/");
      const targetGroup = routerGroup(target.endsWith(".ts") ? target : `${target}.ts`);
      // importing another router GROUP (or a flat sibling router) is cross-router
      const importsOtherGroup = targetGroup !== null && targetGroup !== group;
      const importsFlatSibling = targetGroup === null;
      if (importsOtherGroup || importsFlatSibling) {
        errors.push(
          `Cross-router import in ${f}: ${m[1]} (move shared code to src/server/shared/).`
        );
      }
    }
  }
  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (process.argv.includes("--update")) {
  updateBaseline();
  process.exit(0);
}

const sizeErrors = checkSizes();
const crossErrors = checkCrossRouter();
const all = [...sizeErrors, ...crossErrors];

if (all.length === 0) {
  console.log(
    "✓ arch guard passed (no new god files, no growth past baseline, no new cross-router imports)."
  );
  process.exit(0);
}

console.error(`✗ arch guard found ${all.length} violation(s):\n`);
for (const e of all) console.error(`  • ${e}`);
console.error(
  `\nTip: if a file legitimately must stay flat, add it to RELAXED_FILES (ceiling ${RELAXED_MAX}).`
);
console.error(
  `After an approved split that shrinks files, run: bun run scripts/audit/audit-arch.ts --update`
);
process.exit(1);
