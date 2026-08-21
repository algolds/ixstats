import * as fs from "fs";
import * as path from "path";
import { Project, SourceFile, SyntaxKind, type Node } from "ts-morph";
import { walk, DEFAULT_ROOT, ROUTERS_DIR } from "./audit-arch";

export const RESIDUE_BASELINE_PATH = "scripts/audit/router-residue-baseline.json";

export interface ResidueItem {
  file: string;
  name: string;
  kind: "function" | "variable" | "class";
  line: number;
}

export type ResidueBaseline = Record<string, string[]>; // file -> array of declaration names

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

export function findDeadDeclarationsInSourceFile(sourceFile: SourceFile, fileRel: string): ResidueItem[] {
  const dead: ResidueItem[] = [];

  // 1. Functions
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported() || fn.isDefaultExport()) continue;
    const name = fn.getName();
    if (!name) continue;

    const nameNode = fn.getNameNode();
    if (!nameNode) continue;

    // Check references
    const refs = nameNode.findReferencesAsNodes();
    // Exclude the declaration node itself
    const externalRefs = refs.filter((r) => {
      const parent = r.getParent();
      return r !== nameNode && parent !== fn;
    });

    if (externalRefs.length === 0) {
      dead.push({
        file: fileRel,
        name,
        kind: "function",
        line: fn.getStartLineNumber(),
      });
    }
  }

  // 2. Variables (const/let/var at top level)
  for (const stmt of sourceFile.getVariableStatements()) {
    if (stmt.isExported() || stmt.isDefaultExport()) continue;
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      const nameNode = decl.getNameNode();
      if (!nameNode.isKind(SyntaxKind.Identifier)) continue;
      const refs = nameNode.findReferencesAsNodes();
      const externalRefs = refs.filter((r: Node) => {
        const parent = r.getParent();
        return r !== nameNode && parent !== decl;
      });

      if (externalRefs.length === 0) {
        dead.push({
          file: fileRel,
          name,
          kind: "variable",
          line: decl.getStartLineNumber(),
        });
      }
    }
  }

  // 3. Classes
  for (const cls of sourceFile.getClasses()) {
    if (cls.isExported() || cls.isDefaultExport()) continue;
    const name = cls.getName();
    if (!name) continue;
    const nameNode = cls.getNameNode();
    if (!nameNode) continue;
    const refs = nameNode.findReferencesAsNodes();
    const externalRefs = refs.filter((r) => {
      const parent = r.getParent();
      return r !== nameNode && parent !== cls;
    });

    if (externalRefs.length === 0) {
      dead.push({
        file: fileRel,
        name,
        kind: "class",
        line: cls.getStartLineNumber(),
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

  const files = options?.targetFiles ?? walk(routersRelDir, rootDir);
  if (files.length === 0) return [];

  const project = new Project({ useInMemoryFileSystem: true });
  for (const rel of files) {
    const abs = path.resolve(rootDir, rel);
    const content = fs.readFileSync(abs, "utf8");
    project.createSourceFile(abs, content, { overwrite: true });
  }

  const allDead: ResidueItem[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const fileAbs = path.resolve(sourceFile.getFilePath());
    const fileRel = path.relative(rootDir, fileAbs).split(path.sep).join("/");
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
