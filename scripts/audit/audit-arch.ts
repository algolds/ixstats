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
import { Project, SyntaxKind, type StringLiteral } from "ts-morph";

export const DEFAULT_ROOT = process.cwd();
export const ROUTERS_DIR = "src/server/api/routers";
export const TYPES_DIR = "src/types";
export const BASELINE_PATH = "scripts/audit/arch-baseline.json";

export const DEFAULT_MAX = 700;
export const RELAXED_MAX = 900;

/** Files that legitimately stay as a single large file (data tables / core type defs). */
export const RELAXED_FILES = new Set<string>([
  "src/types/ixstats.ts",
  "src/types/economy-builder.ts",
  "src/server/api/routers/taxSystem/crud.ts",
]);

/**
 * Known cross-router imports that are not yet fixed. Each entry is the importing
 * file. Remove an entry once the import is moved to src/server/shared/.
 */
export const CROSS_ROUTER_ALLOWLIST = new Set<string>([]);

export type ImportViolationKind = "import" | "export" | "dynamic-import" | "unresolved-dynamic";

export interface ImportViolation {
  importer: string;
  specifier: string;
  resolvedTarget?: string;
  kind: ImportViolationKind;
  message: string;
  line?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function walk(dir: string, rootDir = DEFAULT_ROOT): string[] {
  const out: string[] = [];
  const abs = path.join(rootDir, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules" || entry.name === "fixtures")
        continue;
      out.push(...walk(rel, rootDir));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

export function lineCount(relPath: string, rootDir = DEFAULT_ROOT): number {
  const text = fs.readFileSync(path.join(rootDir, relPath), "utf8");
  // newline count == `wc -l` semantics
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}

export function ceilingFor(relPath: string): number {
  return RELAXED_FILES.has(relPath) ? RELAXED_MAX : DEFAULT_MAX;
}

/** routers/<segment>/... → returns the router-group segment, or file stem for flat files. */
export function routerGroup(relPath: string, routersDir = ROUTERS_DIR): string | null {
  const prefix = `${routersDir}/`;
  if (!relPath.startsWith(prefix)) return null;
  const rest = relPath.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash !== -1) {
    return rest.slice(0, slash);
  }
  // Flat file: return file stem without extension
  const ext = path.extname(rest);
  return rest.slice(0, rest.length - ext.length);
}

// ─── Check 1: file-size ratchet ───────────────────────────────────────────────

export type Baseline = Record<string, number>;

export function loadBaseline(rootDir = DEFAULT_ROOT): Baseline {
  const abs = path.join(rootDir, BASELINE_PATH);
  if (!fs.existsSync(abs)) return {};
  return JSON.parse(fs.readFileSync(abs, "utf8")) as Baseline;
}

export function computeOffenders(rootDir = DEFAULT_ROOT): Baseline {
  const offenders: Baseline = {};
  for (const f of [...walk(ROUTERS_DIR, rootDir), ...walk(TYPES_DIR, rootDir)]) {
    const lines = lineCount(f, rootDir);
    if (lines > ceilingFor(f)) offenders[f] = lines;
  }
  return offenders;
}

export function updateBaseline(rootDir = DEFAULT_ROOT): void {
  const current = computeOffenders(rootDir);
  const prev = loadBaseline(rootDir);
  // Ratchet down only: keep the smaller of prev/current so the baseline never inflates.
  const merged: Baseline = {};
  for (const [f, lines] of Object.entries(current)) {
    merged[f] = f in prev ? Math.min(prev[f]!, lines) : lines;
  }
  const sorted = Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1]));
  fs.writeFileSync(path.join(rootDir, BASELINE_PATH), JSON.stringify(sorted, null, 2) + "\n");
  console.log(
    `✓ Baseline updated: ${Object.keys(merged).length} ratcheted files → ${BASELINE_PATH}`
  );
}

export function checkSizes(rootDir = DEFAULT_ROOT): string[] {
  const baseline = loadBaseline(rootDir);
  const errors: string[] = [];
  for (const f of [...walk(ROUTERS_DIR, rootDir), ...walk(TYPES_DIR, rootDir)]) {
    const lines = lineCount(f, rootDir);
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

// ─── Check 2: AST-backed cross-router imports ────────────────────────────────

export function resolveModuleTarget(
  importerAbs: string,
  specifier: string,
  rootDir: string
): string | null {
  let base: string;
  if (specifier.startsWith("~/") || specifier.startsWith("@/")) {
    base = path.join(rootDir, "src", specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(importerAbs), specifier);
  } else {
    // Bare package / node builtin
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.resolve(c);
    }
  }

  return null;
}

export function analyzeRouterImports(options?: {
  rootDir?: string;
  routersRelDir?: string;
  allowlist?: Set<string>;
}): ImportViolation[] {
  const rootDir = path.resolve(options?.rootDir ?? DEFAULT_ROOT);
  const routersRelDir = options?.routersRelDir ?? ROUTERS_DIR;
  const allowlist = options?.allowlist ?? CROSS_ROUTER_ALLOWLIST;

  const files = walk(routersRelDir, rootDir);
  if (files.length === 0) return [];

  const project = new Project({
    useInMemoryFileSystem: true,
  });

  const absRoutersDir = path.resolve(rootDir, routersRelDir);
  for (const rel of files) {
    const abs = path.resolve(rootDir, rel);
    const content = fs.readFileSync(abs, "utf8");
    project.createSourceFile(abs, content, { overwrite: true });
  }

  const violations: ImportViolation[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const fileAbs = path.resolve(sourceFile.getFilePath());
    const fileRel = path.relative(rootDir, fileAbs).split(path.sep).join("/");
    if (allowlist.has(fileRel)) continue;

    const importerGroup = routerGroup(fileRel, routersRelDir);
    if (!importerGroup) continue;

    // 1. Static Import Declarations
    for (const decl of sourceFile.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue();
      const line = decl.getStartLineNumber();
      const resolved = resolveModuleTarget(fileAbs, specifier, rootDir);

      if (resolved && resolved.startsWith(absRoutersDir)) {
        const targetRel = path.relative(rootDir, resolved).split(path.sep).join("/");
        const targetGroup = routerGroup(targetRel, routersRelDir);
        if (targetGroup && targetGroup !== importerGroup) {
          violations.push({
            importer: fileRel,
            specifier,
            resolvedTarget: targetRel,
            kind: "import",
            line,
            message: `Cross-router import in ${fileRel}:${line}: "${specifier}" (import) -> ${targetRel} (move shared code to src/server/shared/).`,
          });
        }
      }
    }

    // 2. Export Declarations (e.g. export { x } from "...")
    for (const decl of sourceFile.getExportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue();
      if (!specifier) continue;
      const line = decl.getStartLineNumber();
      const resolved = resolveModuleTarget(fileAbs, specifier, rootDir);

      if (resolved && resolved.startsWith(absRoutersDir)) {
        const targetRel = path.relative(rootDir, resolved).split(path.sep).join("/");
        const targetGroup = routerGroup(targetRel, routersRelDir);
        if (targetGroup && targetGroup !== importerGroup) {
          violations.push({
            importer: fileRel,
            specifier,
            resolvedTarget: targetRel,
            kind: "export",
            line,
            message: `Cross-router import in ${fileRel}:${line}: "${specifier}" (export) -> ${targetRel} (move shared code to src/server/shared/).`,
          });
        }
      }
    }

    // 3. Dynamic Import Calls
    const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExprs) {
      if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
        const args = call.getArguments();
        if (args.length > 0) {
          const arg = args[0]!;
          const line = call.getStartLineNumber();
          if (arg.getKind() === SyntaxKind.StringLiteral) {
            const specifier = (arg as StringLiteral).getLiteralValue();
            const resolved = resolveModuleTarget(fileAbs, specifier, rootDir);

            if (resolved && resolved.startsWith(absRoutersDir)) {
              const targetRel = path.relative(rootDir, resolved).split(path.sep).join("/");
              const targetGroup = routerGroup(targetRel, routersRelDir);
              if (targetGroup && targetGroup !== importerGroup) {
                violations.push({
                  importer: fileRel,
                  specifier,
                  resolvedTarget: targetRel,
                  kind: "dynamic-import",
                  line,
                  message: `Cross-router import in ${fileRel}:${line}: "${specifier}" (dynamic-import) -> ${targetRel} (move shared code to src/server/shared/).`,
                });
              }
            }
          } else {
            // Non-literal dynamic import
            const argText = arg.getText();
            if (argText.includes("routers") || argText.startsWith("./") || argText.startsWith("../")) {
              violations.push({
                importer: fileRel,
                specifier: argText,
                kind: "unresolved-dynamic",
                line,
                message: `Unresolved dynamic router import in ${fileRel}:${line}: ${argText}`,
              });
            }
          }
        }
      }
    }
  }

  // Deterministic sort: importer asc, line asc, specifier asc
  violations.sort((a, b) => {
    if (a.importer !== b.importer) return a.importer.localeCompare(b.importer);
    if ((a.line ?? 0) !== (b.line ?? 0)) return (a.line ?? 0) - (b.line ?? 0);
    return a.specifier.localeCompare(b.specifier);
  });

  return violations;
}

export function checkCrossRouter(rootDir = DEFAULT_ROOT): string[] {
  const violations = analyzeRouterImports({ rootDir });
  return violations.map((v) => v.message);
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────────

export function runCLI(): void {
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
}

const isMain =
  Boolean(import.meta.main) ||
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  Boolean(process.argv[1]?.endsWith("audit-arch.ts"));

if (isMain) {
  runCLI();
}
