/**
 * Reference Documentation Synchronizer (Plan 169)
 *
 * Single source of truth extractor & validator for:
 * 1. Platform, App, Engine, and System capability versions from src/lib/buildVersion.ts (VERSIONS)
 * 2. Framework and runtime versions from package.json
 * 3. Exact AST-derived tRPC router and procedure inventory from src/server/api/root.ts
 * 4. Prisma database model inventory from prisma/schema/*.prisma
 * 5. Relative link and anchor validation across all tracked markdown (see LINK_CHECK_PATHSPECS)
 *
 * Usage:
 *   bun scripts/docs/sync-reference-docs.ts          # Sync/write generated blocks
 *   bun scripts/docs/sync-reference-docs.ts --write  # Sync/write generated blocks
 *   bun scripts/docs/sync-reference-docs.ts --check  # Validate blocks and links without writing (exit 1 on drift/broken links)
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
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
  oxlint: string;
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
  "scripts/README.md",
];

/** Git-ignored agent guides: synced and link-checked when present locally, never required. */
const LOCAL_ONLY_DOCS = new Set(["AGENTS.md", "CLAUDE.md"]);

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
    oxlint: clean(deps["oxlint"]),
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

/** Counts `.prisma` schema files, models and enums under prisma/schema. */
export function getPrismaSchemaCounts(rootDir = DEFAULT_ROOT): {
  schemaFiles: number;
  models: number;
  enums: number;
} {
  const schemaDir = path.join(rootDir, "prisma/schema");
  if (!fs.existsSync(schemaDir)) return { schemaFiles: 0, models: 0, enums: 0 };

  const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".prisma"));
  let enums = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(schemaDir, file), "utf-8");
    enums += content.match(/^enum\s+\w+/gm)?.length ?? 0;
  }
  return { schemaFiles: files.length, models: getPrismaModelCount(rootDir), enums };
}

/** Counts migrations in prisma/migrations (migration folders and loose `.sql` files). */
export function getMigrationCount(rootDir = DEFAULT_ROOT): number {
  const dir = path.join(rootDir, "prisma/migrations");
  if (!fs.existsSync(dir)) return 0;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.name.endsWith(".sql")).length;
}

/**
 * Values for inline generated counts. A doc embeds one as
 * `<!-- BEGIN_DOCS:COUNT:routers -->77<!-- END_DOCS:COUNT:routers -->`;
 * `docs:sync` rewrites the number and `docs:check` fails when it drifts.
 */
export type DocCountKey =
  "routers" | "procedures" | "schemaFiles" | "models" | "enums" | "migrations";

export function collectDocCounts(
  rootDir = DEFAULT_ROOT,
  api: Pick<ApiInventoryResult, "totalRouters" | "totalProcedures"> = extractApiInventory(rootDir)
): Record<DocCountKey, number> {
  const schema = getPrismaSchemaCounts(rootDir);
  return {
    routers: api.totalRouters,
    procedures: api.totalProcedures,
    schemaFiles: schema.schemaFiles,
    models: schema.models,
    enums: schema.enums,
    migrations: getMigrationCount(rootDir),
  };
}

const COUNT_MARKER_REGEX =
  /<!-- BEGIN_DOCS:COUNT:([\w-]+) -->([\s\S]*?)<!-- END_DOCS:COUNT:\1 -->/g;

/** Count keys used in `content` that collectDocCounts does not provide. */
export function findUnknownCountKeys(content: string, counts: Record<string, number>): string[] {
  const unknown = new Set<string>();
  for (const m of content.matchAll(COUNT_MARKER_REGEX)) {
    if (!(m[1]! in counts)) unknown.add(m[1]!);
  }
  return [...unknown];
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

  const routerMap = new Map<
    string,
    { sourceFiles: Set<string>; procedures: Map<string, ProcedureInfo> }
  >();
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
            const routerInfo: { sourceFiles: Set<string>; procedures: Map<string, ProcedureInfo> } =
              {
                sourceFiles: new Set<string>(),
                procedures: new Map<string, ProcedureInfo>(),
              };

            // The initializer is a bare router identifier or `mergeRouters(a, b)`.
            // (The legacy `safeRouter("name", () => expr)` wrapper is still unwrapped
            // for older checkouts.)
            let bodyText: string | null = null;
            if (
              propInit &&
              propInit.isKind(SyntaxKind.CallExpression) &&
              propInit.getExpression().getText() === "safeRouter"
            ) {
              const fnArg = propInit.getArguments()[1];
              if (
                fnArg &&
                (fnArg.isKind(SyntaxKind.ArrowFunction) ||
                  fnArg.isKind(SyntaxKind.FunctionExpression))
              ) {
                const body = fnArg.getBody();
                if (body) {
                  bodyText = body
                    .getText()
                    .replace(/^{?\s*return\s+|\s*}?$/g, "")
                    .trim();
                }
              }
            } else if (propInit) {
              bodyText = propInit.getText().trim();
            }

            if (bodyText) {
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
    `| **Platform** | **IxStates (${p.release})** | **${p.major}.${p.minor}.${p.patch} "${p.release}"** | **${p.channel}** |`,
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
    `| **Oxlint** | ${pkgs.oxlint} | Flat config, TS 7 native (50-100× faster) |`,
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
 *
 * Covers every tracked markdown file named by LINK_CHECK_PATHSPECS (plus the
 * synced IN_SCOPE_DOCS). Checks relative file links and `#anchors` into
 * markdown files using GitHub's heading-slug rules. Links that start with `/`
 * in src/content/help and src/content/legal are in-app routes and are skipped,
 * as are their in-page `#anchors` (app heading ids, checked by help-center.test.ts).
 */

/** Git pathspecs for the markdown the link validator covers. */
export const LINK_CHECK_PATHSPECS = [
  "README.md",
  "CHANGELOG.md",
  ":(glob)docs/**/*.md",
  ":(glob)scripts/**/README.md",
  ":(glob)src/**/README.md",
  ":(glob)src/content/**/*.md",
];

/** Markdown whose `/`-rooted links are in-app routes, not repository paths. */
const IN_APP_ROUTE_DIRS = ["src/content/help/", "src/content/legal/"];

function walkMarkdown(rootDir: string, relDir: string, out: string[]): void {
  const absDir = path.join(rootDir, relDir);
  if (!fs.existsSync(absDir)) return;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkMarkdown(rootDir, rel, out);
    else if (entry.name.endsWith(".md")) out.push(rel);
  }
}

/** Mirrors LINK_CHECK_PATHSPECS for the directory-walk fallback. */
export function matchesLinkCheckScope(rel: string): boolean {
  if (!rel.endsWith(".md")) return false;
  if (rel === "README.md" || rel === "CHANGELOG.md") return true;
  if (rel.startsWith("docs/") || rel.startsWith("src/content/")) return true;
  return (rel.startsWith("scripts/") || rel.startsWith("src/")) && rel.endsWith("/README.md");
}

/**
 * Lists the markdown files the link validator covers: tracked files from git
 * (falling back to a directory walk outside a git checkout) plus the synced
 * IN_SCOPE_DOCS.
 */
export function listLinkCheckedDocs(rootDir = DEFAULT_ROOT): string[] {
  const files = new Set<string>();
  let fromGit: string[] = [];
  try {
    const res = spawnSync("git", ["ls-files", "-z", "--", ...LINK_CHECK_PATHSPECS], {
      cwd: rootDir,
      encoding: "utf-8",
    });
    if (res.status === 0 && typeof res.stdout === "string") {
      fromGit = res.stdout.split("\0").filter(Boolean);
    }
  } catch {
    fromGit = [];
  }

  if (fromGit.length > 0) {
    // Tracked files deleted in the working tree are not checked.
    for (const f of fromGit) if (fs.existsSync(path.join(rootDir, f))) files.add(f);
  } else {
    const walked: string[] = [];
    walkMarkdown(rootDir, "", walked);
    for (const f of walked) if (matchesLinkCheckScope(f)) files.add(f);
  }

  for (const f of IN_SCOPE_DOCS) files.add(f);
  return [...files].sort();
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * GitHub heading slug (github-slugger rules) for one heading's source text.
 * Inline markdown is reduced to its rendered text first; duplicate suffixes
 * (`-1`, `-2`) are added by the caller.
 */
export function githubSlug(headingText: string): string {
  const text = headingText
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => HTML_ENTITIES[e] ?? e)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(`+)(.*?)\1/g, "$2")
    .replace(/(\*{1,3}|~~)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/(^|[^\p{L}\p{N}_])(_{1,3})(\S(?:.*?\S)?)\2(?=$|[^\p{L}\p{N}_])/gu, "$1$3")
    .trim();
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** Blanks inline code spans so links shown as code are not checked. */
function stripInlineCode(line: string): string {
  return line.replace(/(`+)(?:(?!\1).)+?\1/g, (m) => " ".repeat(m.length));
}

export interface ParsedMarkdown {
  anchors: Set<string>;
  links: Array<{ line: number; text: string; target: string }>;
}

const LINK_REGEX =
  /!?\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*(<[^>]*>|(?:[^\s()]|\([^\s()]*\))+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const REF_DEF_REGEX = /^ {0,3}\[([^\]]+)\]:\s*(<[^>]*>|\S+)/;
const HTML_ID_REGEX = /<[a-z][^>]*?\s(?:id|name)\s*=\s*["']([^"']+)["']/gi;
const SETEXT_REGEX = /^ {0,3}(=+|-+)\s*$/;

/**
 * Parses markdown into its anchor set (GitHub heading slugs plus explicit
 * `id`/`name` attributes) and outgoing links. Code fences, HTML comments,
 * inline code and front matter are skipped.
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  const lines = content.split(/\r?\n/);
  const anchors = new Set<string>();
  const links: ParsedMarkdown["links"] = [];
  const slugCounts = new Map<string, number>();

  const addHeading = (raw: string) => {
    const base = githubSlug(raw);
    const seen = slugCounts.get(base) ?? 0;
    slugCounts.set(base, seen + 1);
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
  };

  let start = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, idx) => idx > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end > 0) start = end + 1;
  }

  let fence: string | null = null;
  let inComment = false;
  for (let i = start; i < lines.length; i++) {
    let line = lines[i]!;

    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1]![0] === fence[0] &&
        fenceMatch[1]!.length >= fence.length &&
        fenceMatch[2]!.trim() === ""
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1]!;
      continue;
    }

    if (inComment) {
      const close = line.indexOf("-->");
      if (close === -1) continue;
      inComment = false;
      line = line.slice(close + 3);
    }
    line = line.replace(/<!--.*?-->/g, "");
    const open = line.indexOf("<!--");
    if (open !== -1) {
      inComment = true;
      line = line.slice(0, open);
    }

    HTML_ID_REGEX.lastIndex = 0;
    let idMatch: RegExpExecArray | null;
    while ((idMatch = HTML_ID_REGEX.exec(line)) !== null) anchors.add(idMatch[1]!.toLowerCase());

    const atx = line.match(/^ {0,3}#{1,6}(?:\s+(.*?))?(?:\s+#+)?\s*$/);
    if (atx) {
      addHeading(atx[1] ?? "");
    } else if (i > start && SETEXT_REGEX.test(line)) {
      const prev = lines[i - 1] ?? "";
      if (
        prev.trim() !== "" &&
        !/^ {0,3}(#|>|[-*+]\s|\d+[.)]\s|\||```|~~~)/.test(prev) &&
        !SETEXT_REGEX.test(prev)
      ) {
        addHeading(prev.trim());
      }
    }

    const scan = stripInlineCode(line);
    const refDef = scan.match(REF_DEF_REGEX);
    if (refDef) {
      links.push({ line: i + 1, text: refDef[1]!, target: refDef[2]! });
      continue;
    }
    LINK_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_REGEX.exec(scan)) !== null) {
      links.push({ line: i + 1, text: m[1]!, target: m[2]! });
    }
  }

  return { anchors, links };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function validateDocLinks(
  rootDir = DEFAULT_ROOT,
  docFiles: string[] = listLinkCheckedDocs(rootDir)
): LinkValidationIssue[] {
  const issues: LinkValidationIssue[] = [];
  const parsedCache = new Map<string, ParsedMarkdown>();
  const readParsed = (absFile: string): ParsedMarkdown => {
    let parsed = parsedCache.get(absFile);
    if (!parsed) {
      parsed = parseMarkdown(fs.readFileSync(absFile, "utf-8"));
      parsedCache.set(absFile, parsed);
    }
    return parsed;
  };

  for (const relFile of docFiles) {
    const absFile = path.join(rootDir, relFile);
    if (!fs.existsSync(absFile)) {
      if (LOCAL_ONLY_DOCS.has(relFile)) continue;
      issues.push({
        file: relFile,
        line: 1,
        linkText: relFile,
        target: relFile,
        reason: `In-scope document does not exist on disk`,
      });
      continue;
    }

    const isRouteDoc = IN_APP_ROUTE_DIRS.some((d) => relFile.startsWith(d));

    for (const { line, text, target: rawTarget } of readParsed(absFile).links) {
      const target = rawTarget.replace(/^<|>$/g, "").trim();
      const report = (reason: string) =>
        issues.push({ file: relFile, line, linkText: text, target, reason });

      if (target.startsWith("file://")) {
        report(`Forbidden local machine link (file:// protocol is not allowed in canonical docs)`);
        continue;
      }
      if (target.startsWith("/home/") || target.startsWith("/Users/")) {
        report(`Forbidden absolute machine path in link`);
        continue;
      }
      // Web URLs and other schemes (http, https, mailto, …)
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      // In-app routes in player-facing content. Their in-page anchors use the app's own
      // heading ids (src/lib/markdown-document.ts), which help-center.test.ts checks.
      if ((target.startsWith("/") || target.startsWith("#")) && isRouteDoc) continue;
      if (target === "" || target === "#") continue;

      const hashIdx = target.indexOf("#");
      const pathPart = (hashIdx === -1 ? target : target.slice(0, hashIdx)).replace(/\?.*$/, "");
      const anchor = hashIdx === -1 ? "" : safeDecode(target.slice(hashIdx + 1));

      let resolved = absFile;
      if (pathPart) {
        const decoded = safeDecode(pathPart);
        resolved = decoded.startsWith("/")
          ? path.join(rootDir, decoded)
          : path.resolve(path.dirname(absFile), decoded);
        if (!fs.existsSync(resolved)) {
          report(`Target file or directory not found: "${pathPart}"`);
          continue;
        }
      }

      if (anchor && resolved.endsWith(".md") && fs.statSync(resolved).isFile()) {
        if (!readParsed(resolved).anchors.has(anchor.toLowerCase())) {
          report(`Anchor "#${anchor}" not found in ${path.relative(rootDir, resolved)}`);
        }
      }
    }
  }

  return issues;
}

/**
 * 5. Document Synchronization and Verification Engine
 */
export function syncDocumentContent(
  content: string,
  options: {
    versionMatrix?: string;
    frameworkMatrix?: string;
    apiInventory?: string;
    counts?: Record<string, number>;
  }
): { newContent: string; changed: boolean } {
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

  const counts = options.counts;
  if (counts) {
    updated = updated.replace(COUNT_MARKER_REGEX, (whole, key: string) =>
      key in counts
        ? `<!-- BEGIN_DOCS:COUNT:${key} -->${counts[key]!.toLocaleString("en-US")}<!-- END_DOCS:COUNT:${key} -->`
        : whole
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
  const api = extractApiInventory(rootDir);
  const apiInventory = generateApiInventoryTableMarkdown(api);
  const counts = collectDocCounts(rootDir, api);

  const docFiles = listLinkCheckedDocs(rootDir);
  const linkIssues = validateDocLinks(rootDir, docFiles);
  const staleFiles: string[] = [];

  // Generated blocks may live in any checked doc, not only IN_SCOPE_DOCS.
  for (const relFile of docFiles) {
    const absFile = path.join(rootDir, relFile);
    if (!fs.existsSync(absFile)) continue;

    const original = fs.readFileSync(absFile, "utf-8");
    for (const key of findUnknownCountKeys(original, counts)) {
      linkIssues.push({
        file: relFile,
        line: original.slice(0, original.indexOf(`BEGIN_DOCS:COUNT:${key} `)).split("\n").length,
        linkText: `COUNT:${key}`,
        target: key,
        reason: `Unknown generated count "${key}" (known: ${Object.keys(counts).join(", ")})`,
      });
    }
    const { newContent, changed } = syncDocumentContent(original, {
      versionMatrix,
      frameworkMatrix,
      apiInventory,
      counts,
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
      console.error(
        `  • ${issue.file}:${issue.line} [${issue.linkText}](${issue.target}) -> ${issue.reason}`
      );
    }
  }

  if (isCheck && result.staleFiles.length > 0) {
    console.error(
      `✗ Stale generated reference blocks found in ${result.staleFiles.length} file(s):`
    );
    for (const f of result.staleFiles) {
      console.error(`  • ${f} (run 'bun run docs:sync' to regenerate)`);
    }
  }

  if (result.valid) {
    if (isCheck) {
      console.log("✓ All canonical reference documents and links are up to date.");
    } else {
      console.log(
        `✓ Reference documentation synchronized successfully across ${listLinkCheckedDocs().length} files.`
      );
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
