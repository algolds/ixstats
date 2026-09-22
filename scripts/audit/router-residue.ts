import * as fs from "fs";
import * as path from "path";
import { ts } from "ts-morph";

export const DEFAULT_ROOT = process.cwd();
export const ROUTERS_DIR = "src/server/api/routers";
export const RESIDUE_BASELINE_PATH = "scripts/audit/router-residue-baseline.json";

export interface ResidueItem {
  file: string;
  name: string;
  kind: "function" | "variable" | "class";
  line: number;
}

export type ResidueBaseline = Record<string, string[]>; // file -> array of declaration names

export function walkRouters(dir: string, rootDir: string): string[] {
  const fullPath = path.resolve(rootDir, dir);
  if (!fs.existsSync(fullPath)) return [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const rel = path.join(dir, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      results.push(...walkRouters(rel, rootDir));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(rel);
    }
  }
  return results;
}

export function loadResidueBaseline(
  rootDir = DEFAULT_ROOT,
  baselinePath = RESIDUE_BASELINE_PATH
): ResidueBaseline {
  const abs = path.join(rootDir, baselinePath);
  if (!fs.existsSync(abs)) return {};
  return JSON.parse(fs.readFileSync(abs, "utf8")) as ResidueBaseline;
}

export function sortResidueBaseline(baseline: ResidueBaseline): ResidueBaseline {
  const sorted: ResidueBaseline = {};
  const keys = Object.keys(baseline).sort();
  for (const k of keys) {
    sorted[k] = [...baseline[k]!].sort();
  }
  return sorted;
}

export function findDeadDeclarationsInSourceFile(
  sourceFile: ts.SourceFile,
  fileRel: string
): ResidueItem[] {
  const dead: ResidueItem[] = [];

  const topLevelDecls: {
    name: string;
    node: ts.Node;
    nameNode: ts.Identifier;
    kind: "function" | "variable" | "class";
    line: number;
  }[] = [];

  for (const stmt of sourceFile.statements) {
    const isExported = !!(ts.getCombinedModifierFlags(stmt as any) & ts.ModifierFlags.Export);
    if (isExported) continue;

    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
      topLevelDecls.push({
        name: stmt.name.text,
        node: stmt,
        nameNode: stmt.name,
        kind: "function",
        line,
      });
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const line = sourceFile.getLineAndCharacterOfPosition(decl.getStart()).line + 1;
          topLevelDecls.push({
            name: decl.name.text,
            node: decl,
            nameNode: decl.name,
            kind: "variable",
            line,
          });
        }
      }
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
      topLevelDecls.push({
        name: stmt.name.text,
        node: stmt,
        nameNode: stmt.name,
        kind: "class",
        line,
      });
    }
  }

  if (topLevelDecls.length === 0) return [];

  // Count references to each top-level declaration in this sourceFile
  const counts = new Map<string, number>();
  for (const decl of topLevelDecls) {
    counts.set(decl.name, 0);
  }

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (counts.has(name)) {
        const isDeclarationName = topLevelDecls.some((d) => d.nameNode === node);
        if (!isDeclarationName) {
          counts.set(name, counts.get(name)! + 1);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  for (const decl of topLevelDecls) {
    if (counts.get(decl.name) === 0) {
      dead.push({
        file: fileRel,
        name: decl.name,
        kind: decl.kind,
        line: decl.line,
      });
    }
  }

  return dead;
}

export function analyzeRouterResidue(options?: {
  rootDir?: string;
  routersRelDir?: string;
  targetFiles?: string[];
}): ResidueItem[] {
  const rootDir = path.resolve(options?.rootDir ?? DEFAULT_ROOT);
  const routersRelDir = options?.routersRelDir ?? ROUTERS_DIR;

  const files = options?.targetFiles ?? walkRouters(routersRelDir, rootDir);
  if (files.length === 0) return [];

  const allDead: ResidueItem[] = [];

  for (const rel of files) {
    const abs = path.resolve(rootDir, rel);
    const code = fs.readFileSync(abs, "utf8");
    const sourceFile = ts.createSourceFile(abs, code, ts.ScriptTarget.Latest, true);
    const fileRel = path.relative(rootDir, abs).split(path.sep).join("/");
    const dead = findDeadDeclarationsInSourceFile(sourceFile, fileRel);
    allDead.push(...dead);
  }

  allDead.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.name.localeCompare(b.name);
  });

  return allDead;
}

export function checkResidue(
  rootDir = DEFAULT_ROOT,
  baselinePath = RESIDUE_BASELINE_PATH
): string[] {
  const current = analyzeRouterResidue({ rootDir });
  const baseline = loadResidueBaseline(rootDir, baselinePath);
  const errors: string[] = [];

  for (const item of current) {
    const allowed = baseline[item.file];
    if (!allowed || !allowed.includes(item.name)) {
      errors.push(
        `NEW unused residue in ${item.file}:${item.line}: ${item.kind} "${item.name}" has 0 local references.`
      );
    }
  }

  return errors;
}

export function updateResidueBaseline(
  rootDir = DEFAULT_ROOT,
  baselinePath = RESIDUE_BASELINE_PATH
): void {
  const current = analyzeRouterResidue({ rootDir });
  const baseline: ResidueBaseline = {};

  for (const item of current) {
    if (!baseline[item.file]) baseline[item.file] = [];
    if (!baseline[item.file]!.includes(item.name)) {
      baseline[item.file]!.push(item.name);
    }
  }

  const sorted = sortResidueBaseline(baseline);
  fs.writeFileSync(path.join(rootDir, baselinePath), JSON.stringify(sorted, null, 2) + "\n");
  console.log(
    `✓ Residue baseline updated: ${Object.keys(sorted).length} files with residue → ${baselinePath}`
  );
}

// ─── CLI Execution ────────────────────────────────────────────────────────────
const isMain =
  Boolean(import.meta.main) ||
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  Boolean(process.argv[1]?.endsWith("router-residue.ts"));

if (isMain) {
  if (process.argv.includes("--update")) {
    updateResidueBaseline();
  } else {
    const errors = checkResidue();
    if (errors.length === 0) {
      console.log("✓ No router residue detected (0 dead declarations across split routers).");
      process.exit(0);
    } else {
      console.error(`✗ Router residue audit found ${errors.length} dead declaration(s):\n`);
      for (const e of errors) console.error(`  • ${e}`);
      process.exit(1);
    }
  }
}
