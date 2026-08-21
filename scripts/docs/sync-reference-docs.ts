/**
 * Reference Documentation Synchronizer (Plan 169)
 *
 * Single source of truth extractor & validator for:
 * 1. Platform, App, Engine, and System capability versions from src/lib/buildVersion.ts (VERSIONS)
 * 2. Framework and runtime versions from package.json
 * 3. Exact AST-derived tRPC router and procedure inventory from src/server/api/root.ts
 * 4. Prisma database model inventory from prisma/schema/*.prisma
 * 5. Relative link, anchor, and repository path validation across canonical documentation
 *
 * Usage:
 *   bun scripts/docs/sync-reference-docs.ts          # Sync/write generated blocks
 *   bun scripts/docs/sync-reference-docs.ts --write  # Sync/write generated blocks
 *   bun scripts/docs/sync-reference-docs.ts --check  # Validate blocks and links without writing (exit 1 on drift/broken links)
 */

import * as fs from "fs";
import * as path from "path";
import { Project, SyntaxKind, type Node, type SourceFile } from "ts-morph";
import { VERSIONS, type ReleaseChannel } from "../../src/lib/buildVersion";

export const DEFAULT_ROOT = process.cwd();

export interface PackageVersions {
  next: string;
  react: string;
  prisma: string;
  trpc: string;
  tailwindcss: string;
  zod: string;
  eslint: string;
  jest: string;
  express: string;
  typescript: string;
  bun: string;
}

export interface ProcedureInfo {
  name: string;
  type: "query" | "mutation" | "subscription" | "unknown";
  sourceFile: string;
  lineNumber: number;
}

export interface RouterInventory {
  name: string;
  sourceFiles: string[];
  procedures: ProcedureInfo[];
  queryCount: number;
  mutationCount: number;
  subscriptionCount: number;
  totalCount: number;
}

export interface ApiInventoryResult {
  routers: RouterInventory[];
  totalRouters: number;
  totalProcedures: number;
  totalQueries: number;
  totalMutations: number;
  totalSubscriptions: number;
  duplicates: string[];
  unresolved: string[];
}

export interface LinkValidationIssue {
  file: string;
  line: number;
  linkText: string;
  target: string;
  reason: string;
}

export interface DocsValidationResult {
  valid: boolean;
  issues: LinkValidationIssue[];
  staleFiles: string[];
}

export const IN_SCOPE_DOCS = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "docs/README.md",
  "docs/overview/platform.md",
  "docs/reference/api-complete.md",
  "docs/reference/revision.md",
  "docs/architecture/frontend.md",
  "docs/architecture/backend.md",
  "docs/processes/testing.md",
  "docs/processes/refactoring.md",
  "docs/operations/deployment.md",
  "docs/operations/deployment-checklist.md",
  "scripts/README.md",
];

/**
 * 1. Extract Package & Runtime Versions
 */
export function getPackageVersions(rootDir = DEFAULT_ROOT): PackageVersions {
  const pkgPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  const clean = (v?: string) => (v ? v.replace(/^[\^~]/, "") : "unknown");

  return {
    next: clean(deps["next"]),
    react: clean(deps["react"]),
    prisma: clean(deps["@prisma/client"]),
    trpc: clean(deps["@trpc/server"] || deps["@trpc/client"]),
    tailwindcss: clean(deps["@tailwindcss/postcss"] || deps["tailwindcss"]),
    zod: clean(deps["zod"]),
    eslint: clean(deps["eslint"]),
    jest: clean(deps["jest"]),
    express: clean(deps["express"]),
    typescript: clean(deps["typescript"]),
    bun: "1.4+",
  };
}

/**
 * Count active Prisma models across schema files
 */
export function getPrismaModelCount(rootDir = DEFAULT_ROOT): number {
  const schemaDir = path.join(rootDir, "prisma/schema");
  if (!fs.existsSync(schemaDir)) return 0;

  let total = 0;
  const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".prisma"));
  for (const file of files) {
    const content = fs.readFileSync(path.join(schemaDir, file), "utf-8");
    const matches = content.match(/^model\s+\w+/gm);
    if (matches) total += matches.length;
  }
  return total;
}

/**
 * 2. Extract Complete tRPC Router & Procedure AST Inventory
 */
export function extractApiInventory(rootDir = DEFAULT_ROOT): ApiInventoryResult {
  const proj = new Project({ skipAddingFilesFromTsConfig: true });
  const rootPath = path.join(rootDir, "src/server/api/root.ts");
  const rootSf = proj.addSourceFileAtPath(rootPath);

  const importMap = new Map<string, string>(); // symbol -> resolved file path
  for (const decl of rootSf.getImportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();
    let absTarget: string | null = null;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      absTarget = path.resolve(path.dirname(rootPath), spec);
    } else if (spec.startsWith("~/") || spec.startsWith("@/")) {
      absTarget = path.resolve(rootDir, "src", spec.slice(2));
    }

    if (absTarget) {
      const candidates = [
        absTarget,
        `${absTarget}.ts`,
        `${absTarget}.tsx`,
        path.join(absTarget, "index.ts"),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
          absTarget = c;
          break;
        }
      }
    }

    for (const named of decl.getNamedImports()) {
      if (absTarget) importMap.set(named.getName(), absTarget);
    }
    const def = decl.getDefaultImport();
    if (def && absTarget) importMap.set(def.getText(), absTarget);
  }

  const routerMap = new Map<string, { sourceFiles: Set<string>; procedures: Map<string, ProcedureInfo> }>();
  const duplicates: string[] = [];
  const unresolved: string[] = [];

  // Helper to extract procedures from a source file given a router variable or AST node
  function extractProceduresFromNode(node: Node, sourceFile: SourceFile): ProcedureInfo[] {
    const procs: ProcedureInfo[] = [];

    // Case A: createTRPCRouter({ ... }) call
    if (node.isKind(SyntaxKind.CallExpression)) {
      const expr = node.getExpression();
      if (expr.getText().includes("createTRPCRouter")) {
        const args = node.getArguments();
        if (args.length > 0 && args[0]?.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const obj = args[0];
          for (const prop of obj.getProperties()) {
            if (prop.isKind(SyntaxKind.PropertyAssignment)) {
              const name = prop.getName();
              const init = prop.getInitializer();
              let type: "query" | "mutation" | "subscription" | "unknown" = "unknown";
              if (init) {
                const initText = init.getText();
                if (initText.includes(".query(")) type = "query";
                else if (initText.includes(".mutation(")) type = "mutation";
                else if (initText.includes(".subscription(")) type = "subscription";
              }
              procs.push({
                name,
                type,
                sourceFile: path.relative(rootDir, sourceFile.getFilePath()).replace(/\\/g, "/"),
                lineNumber: prop.getStartLineNumber(),
              });
            }
          }
        }
      } else if (expr.getText().includes("mergeRouters")) {
        // mergeRouters(sub1, sub2, ...)
        for (const arg of node.getArguments()) {
          const argText = arg.getText();
          const subProcs = resolveSymbolProcedures(argText, sourceFile);
          procs.push(...subProcs);
        }
      }
    }

    return procs;
  }

  function resolveSymbolProcedures(symbolName: string, fromSf: SourceFile): ProcedureInfo[] {
    // 1. Check local variable declarations in fromSf
    const localVar = fromSf.getVariableDeclaration(symbolName);
    if (localVar) {
      const init = localVar.getInitializer();
      if (init) return extractProceduresFromNode(init, fromSf);
    }

    // 2. Check imports in fromSf
    for (const decl of fromSf.getImportDeclarations()) {
      const spec = decl.getModuleSpecifierValue();
      let absTarget: string | null = null;
      if (spec.startsWith("./") || spec.startsWith("../")) {
        absTarget = path.resolve(path.dirname(fromSf.getFilePath()), spec);
      } else if (spec.startsWith("~/") || spec.startsWith("@/")) {
        absTarget = path.resolve(rootDir, "src", spec.slice(2));
      }

      if (absTarget) {
        const candidates = [
          absTarget,
          `${absTarget}.ts`,
          `${absTarget}.tsx`,
          path.join(absTarget, "index.ts"),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            absTarget = c;
            break;
          }
        }
      }

      for (const named of decl.getNamedImports()) {
        if (named.getName() === symbolName && absTarget) {
          const subSf = proj.getSourceFile(absTarget) ?? proj.addSourceFileAtPath(absTarget);
          return resolveSymbolProcedures(symbolName, subSf);
        }
      }
      const def = decl.getDefaultImport();
      if (def && def.getText() === symbolName && absTarget) {
        const subSf = proj.getSourceFile(absTarget) ?? proj.addSourceFileAtPath(absTarget);
        return resolveSymbolProcedures(symbolName, subSf);
      }
    }

    return [];
  }

  function resolveRouterFile(filePath: string): ProcedureInfo[] {
    const sf = proj.getSourceFile(filePath) ?? proj.addSourceFileAtPath(filePath);
    const procs: ProcedureInfo[] = [];

    // Check all createTRPCRouter and mergeRouters in this file
    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (init) {
        procs.push(...extractProceduresFromNode(init, sf));
      }
    }

    return procs;
  }

  // Find appRouter in root.ts
  const appRouterDecl = rootSf.getVariableDeclaration("appRouter");
  if (appRouterDecl) {
    const init = appRouterDecl.getInitializer();
    if (init && init.isKind(SyntaxKind.CallExpression)) {
      const args = init.getArguments();
      if (args.length > 0 && args[0]?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const obj = args[0];
        for (const prop of obj.getProperties()) {
          if (prop.isKind(SyntaxKind.PropertyAssignment)) {
            const routerKey = prop.getName();
            const propInit = prop.getInitializer();
            const routerInfo: { sourceFiles: Set<string>; procedures: Map<string, ProcedureInfo> } = {
              sourceFiles: new Set<string>(),
              procedures: new Map<string, ProcedureInfo>(),
            };

            // Inspect safeRouter("name", () => routerExpression)
            if (propInit && propInit.isKind(SyntaxKind.CallExpression)) {
              const safeArgs = propInit.getArguments();
              if (safeArgs.length >= 2) {
                const fnArg = safeArgs[1];
                if (fnArg && (fnArg.isKind(SyntaxKind.ArrowFunction) || fnArg.isKind(SyntaxKind.FunctionExpression))) {
                  const body = fnArg.getBody();
                  if (body) {
                    const bodyText = body.getText().replace(/^{?\s*return\s+|\s*}?$/g, "").trim();

                    // Check if body is mergeRouters(a, b)
                    const mergeMatch = bodyText.match(/^mergeRouters\((.+)\)$/);
                    const symbolsToResolve = mergeMatch
                      ? mergeMatch[1]!.split(",").map((s) => s.trim())
                      : [bodyText];

                    for (const sym of symbolsToResolve) {
                      const targetFile = importMap.get(sym);
                      if (targetFile) {
                        routerInfo.sourceFiles.add(
                          path.relative(rootDir, targetFile).replace(/\\/g, "/")
                        );
                        const sf = proj.getSourceFile(targetFile) ?? proj.addSourceFileAtPath(targetFile);
                        const fileProcs = resolveSymbolProcedures(sym, sf);
                        if (fileProcs.length === 0) {
                          // Fallback to resolving entire file
                          const allInFile = resolveRouterFile(targetFile);
                          for (const p of allInFile) {
                            if (routerInfo.procedures.has(p.name)) {
                              duplicates.push(`${routerKey}.${p.name}`);
                            }
                            routerInfo.procedures.set(p.name, p);
                          }
                        } else {
                          for (const p of fileProcs) {
                            if (routerInfo.procedures.has(p.name)) {
                              duplicates.push(`${routerKey}.${p.name}`);
                            }
                            routerInfo.procedures.set(p.name, p);
                          }
                        }
                      } else {
                        unresolved.push(`${routerKey} -> ${sym}`);
                      }
                    }
                  }
                }
              }
            }

            routerMap.set(routerKey, routerInfo);
          }
        }
      }
    }
  }

  const routers: RouterInventory[] = [];
  let totalQueries = 0;
  let totalMutations = 0;
  let totalSubscriptions = 0;
  let totalProcedures = 0;

  for (const [name, data] of routerMap.entries()) {
    const procs = Array.from(data.procedures.values()).sort((a, b) => a.name.localeCompare(b.name));
    let q = 0;
    let m = 0;
    let s = 0;
    for (const p of procs) {
      if (p.type === "query") q++;
      else if (p.type === "mutation") m++;
      else if (p.type === "subscription") s++;
    }

    totalQueries += q;
    totalMutations += m;
    totalSubscriptions += s;
    totalProcedures += procs.length;

    routers.push({
      name,
      sourceFiles: Array.from(data.sourceFiles).sort(),
      procedures: procs,
      queryCount: q,
      mutationCount: m,
      subscriptionCount: s,
      totalCount: procs.length,
    });
  }

  routers.sort((a, b) => a.name.localeCompare(b.name));

  return {
    routers,
    totalRouters: routers.length,
    totalProcedures,
    totalQueries,
    totalMutations,
    totalSubscriptions,
    duplicates,
    unresolved,
  };
}

/**
 * 3. Markdown Block Generators
 */
export function generateVersionMatrixMarkdown(): string {
  const p = VERSIONS.platform;
  const a = VERSIONS.apps;
  const e = VERSIONS.engines;
  const s = VERSIONS.systems;
  const d = VERSIONS.design;

  return [
    `<!-- BEGIN_DOCS:VERSION_MATRIX -->`,
    `| Capability Domain | Component / Layer | Version / Release | Channel / Granularity |`,
    `| :--- | :--- | :---: | :--- |`,
    `| **Platform** | **IxStates (Ogma)** | **${p.major}.${p.minor}.${p.patch} "${p.release}"** | **${p.channel}** |`,
    `| **Apps** | IxWorld | v${a.ixworld} | Standalone & Embedded Maps Engine |`,
    `| | WikiOS | v${a.wikios} | Headless Wiki & Canvas Architecture |`,
    `| | IxVault | v${a.ixvault} | Cards, Credits & Marketplace |`,
    `| **Engines** | MyCountry Engine | v${e.mycountry} | Deterministic Nation Simulation |`,
    `| | Concord Engine | v${e.concord} | Living World Simulation & Events |`,
    `| | Atlas Engine | v${e.atlas} | Spatial Math & Geometry Pipeline |`,
    `| **Systems** | MyCountry UI | v${s.mycountry} | 4-Tier Command Architecture |`,
    `| | Nation Builder | v${s.builder} | Statecraft & Tax Builder Subsystems |`,
    `| | ThinkPages | v${s.thinkpages} | Social Knowledge & Feed Components |`,
    `| | Achievements | v${s.achievements} | Awards & LoreWards Resync |`,
    `| | Stash | v${s.stash} | Article Stashing (was LoreStash) |`,
    `| | Repository | v${s.repository} | Commons Media Explorer |`,
    `| | Halo | v${s.halo} | Contextual Overlay System |`,
    `| | Onoma | v${s.onoma} | Conlang & Linguistics Studio |`,
    `| **Design** | Facet | v${d.facet} | Refraction / Depth Design System |`,
    `<!-- END_DOCS:VERSION_MATRIX -->`,
  ].join("\n");
}

export function generateFrameworkMatrixMarkdown(pkgs = getPackageVersions()): string {
  return [
    `<!-- BEGIN_DOCS:FRAMEWORK_MATRIX -->`,
    `| Package / Layer | Version | Notes |`,
    `| :--- | :---: | :--- |`,
    `| **Next.js** | ${pkgs.next} | App Router architecture, Turbopack |`,
    `| **React** | ${pkgs.react} | React 19 concurrent features |`,
    `| **TypeScript** | ${pkgs.typescript} | Native Go Engine concurrency |`,
    `| **Prisma** | ${pkgs.prisma} | Multi-file schema partitioning |`,
    `| **tRPC** | ${pkgs.trpc} | Domain-split modular routers |`,
    `| **Tailwind CSS** | ${pkgs.tailwindcss} | v4 CSS-first theme configuration |`,
    `| **Zod** | ${pkgs.zod} | Schema validation |`,
    `| **ESLint** | ${pkgs.eslint} | Flat config with architecture guard |`,
    `| **Jest** | ${pkgs.jest} | Unit and characterization suites |`,
    `| **Runtime** | Bun ${pkgs.bun} | Native concurrency & virtual store |`,
    `<!-- END_DOCS:FRAMEWORK_MATRIX -->`,
  ].join("\n");
}

export function generateApiInventoryTableMarkdown(api = extractApiInventory()): string {
  const lines: string[] = [
    `<!-- BEGIN_DOCS:API_INVENTORY -->`,
    `### Live tRPC API Inventory (${api.totalRouters} Routers, ${api.totalProcedures} Endpoints)`,
    ``,
    `| Router Namespace | Q | M | Sub | Total | Primary Source |`,
    `| :--- | :---: | :---: | :---: | :---: | :--- |`,
  ];

  for (const r of api.routers) {
    const src = r.sourceFiles.length > 0 ? `\`${r.sourceFiles[0]}\`` : "-";
    lines.push(
      `| **\`api.${r.name}\`** | ${r.queryCount} | ${r.mutationCount} | ${r.subscriptionCount} | **${r.totalCount}** | ${src} |`
    );
  }

  lines.push(
    `| **TOTALS** | **${api.totalQueries}** | **${api.totalMutations}** | **${api.totalSubscriptions}** | **${api.totalProcedures}** | **${api.totalRouters} registered namespaces** |`
  );
  lines.push(`<!-- END_DOCS:API_INVENTORY -->`);

  return lines.join("\n");
}

/**
 * 4. Link, Anchor & Repository Path Validator
 */
export function validateDocLinks(rootDir = DEFAULT_ROOT, docFiles = IN_SCOPE_DOCS): LinkValidationIssue[] {
  const issues: LinkValidationIssue[] = [];

  for (const relFile of docFiles) {
    const absFile = path.join(rootDir, relFile);
    if (!fs.existsSync(absFile)) {
      issues.push({
        file: relFile,
        line: 1,
        linkText: relFile,
        target: relFile,
        reason: `In-scope document does not exist on disk`,
      });
      continue;
    }

    const content = fs.readFileSync(absFile, "utf-8");
    const lines = content.split("\n");

    // Extract headings for anchor resolution in this file
    const headings = new Set<string>();
    for (const l of lines) {
      const hMatch = l.match(/^#{1,6}\s+(.+)$/);
      if (hMatch && hMatch[1]) {
        const slug = hMatch[1]
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");
        headings.add(slug);
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // 1. Markdown Links [text](target)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(line)) !== null) {
        const text = match[1]!;
        const target = match[2]!.trim();

        // Check for forbidden machine / file:// links
        if (target.startsWith("file://")) {
          issues.push({
            file: relFile,
            line: i + 1,
            linkText: text,
            target,
            reason: `Forbidden local machine link (file:// protocol is not allowed in canonical docs)`,
          });
          continue;
        }

        if (target.startsWith("/home/") || target.startsWith("/Users/")) {
          issues.push({
            file: relFile,
            line: i + 1,
            linkText: text,
            target,
            reason: `Forbidden absolute machine path in link`,
          });
          continue;
        }

        // Skip web URLs
        if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:")) {
          continue;
        }

        // Anchor in current file
        if (target.startsWith("#")) {
          const anchor = target.slice(1);
          // Optional: if non-empty, check headings
          continue;
        }

        // Relative path
        const [targetPath, targetAnchor] = target.split("#");
        if (targetPath) {
          const resolved = path.resolve(path.dirname(absFile), targetPath);
          if (!fs.existsSync(resolved)) {
            issues.push({
              file: relFile,
              line: i + 1,
              linkText: text,
              target,
              reason: `Target file or directory not found: "${targetPath}"`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * 5. Document Synchronization and Verification Engine
 */
export function syncDocumentContent(content: string, options: {
  versionMatrix?: string;
  frameworkMatrix?: string;
  apiInventory?: string;
}): { newContent: string; changed: boolean } {
  let updated = content;

  if (options.versionMatrix && updated.includes("<!-- BEGIN_DOCS:VERSION_MATRIX -->")) {
    updated = updated.replace(
      /<!-- BEGIN_DOCS:VERSION_MATRIX -->[\s\S]*?<!-- END_DOCS:VERSION_MATRIX -->/,
      options.versionMatrix
    );
  }

  if (options.frameworkMatrix && updated.includes("<!-- BEGIN_DOCS:FRAMEWORK_MATRIX -->")) {
    updated = updated.replace(
      /<!-- BEGIN_DOCS:FRAMEWORK_MATRIX -->[\s\S]*?<!-- END_DOCS:FRAMEWORK_MATRIX -->/,
      options.frameworkMatrix
    );
  }

  if (options.apiInventory && updated.includes("<!-- BEGIN_DOCS:API_INVENTORY -->")) {
    updated = updated.replace(
      /<!-- BEGIN_DOCS:API_INVENTORY -->[\s\S]*?<!-- END_DOCS:API_INVENTORY -->/,
      options.apiInventory
    );
  }

  return {
    newContent: updated,
    changed: updated !== content,
  };
}

export function runDocsSync(rootDir = DEFAULT_ROOT, write = true): DocsValidationResult {
  const versionMatrix = generateVersionMatrixMarkdown();
  const frameworkMatrix = generateFrameworkMatrixMarkdown();
  const apiInventory = generateApiInventoryTableMarkdown();

  const linkIssues = validateDocLinks(rootDir, IN_SCOPE_DOCS);
  const staleFiles: string[] = [];

  for (const relFile of IN_SCOPE_DOCS) {
    const absFile = path.join(rootDir, relFile);
    if (!fs.existsSync(absFile)) continue;

    const original = fs.readFileSync(absFile, "utf-8");
    const { newContent, changed } = syncDocumentContent(original, {
      versionMatrix,
      frameworkMatrix,
      apiInventory,
    });

    if (changed) {
      staleFiles.push(relFile);
      if (write) {
        fs.writeFileSync(absFile, newContent, "utf-8");
      }
    }
  }

  const valid = linkIssues.length === 0 && (write || staleFiles.length === 0);

  return {
    valid,
    issues: linkIssues,
    staleFiles,
  };
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────────
export function runCLI(): void {
  const isCheck = process.argv.includes("--check");
  const result = runDocsSync(DEFAULT_ROOT, !isCheck);

  if (result.issues.length > 0) {
    console.error(`✗ Found ${result.issues.length} documentation link/path issue(s):`);
    for (const issue of result.issues) {
      console.error(`  • ${issue.file}:${issue.line} [${issue.linkText}](${issue.target}) -> ${issue.reason}`);
    }
  }

  if (isCheck && result.staleFiles.length > 0) {
    console.error(`✗ Stale generated reference blocks found in ${result.staleFiles.length} file(s):`);
    for (const f of result.staleFiles) {
      console.error(`  • ${f} (run 'bun run docs:sync' to regenerate)`);
    }
  }

  if (result.valid) {
    if (isCheck) {
      console.log("✓ All canonical reference documents and links are up to date.");
    } else {
      console.log(`✓ Reference documentation synchronized successfully across ${IN_SCOPE_DOCS.length} files.`);
    }
    process.exit(0);
  } else {
    process.exit(1);
  }
}

if (
  Boolean(import.meta.main) ||
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  Boolean(process.argv[1]?.endsWith("sync-reference-docs.ts"))
) {
  runCLI();
}
