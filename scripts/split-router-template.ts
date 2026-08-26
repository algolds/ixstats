/**
 * Split a tRPC router into a domain sub-directory (the proven IxStats recipe).
 *
 * ─── PURPOSE ───────────────────────────────────────────────────────────────
 * One-off AST splitter for a single tRPC router file. The goal: split a single
 * flat `createTRPCRouter({...})` (or a `export const X = { ... }` procedure-bag)
 * into 2–4 domain-grouped sub-files, recombined via `mergeRouters` (or object
 * spread) so every `api.<router>.<key>` path is preserved byte-identical.
 * Zero call-site changes required.
 *
 * ─── STRATEGY ──────────────────────────────────────────────────────────────
 * 1. Pre-flight: scan the source for relative imports (static + dynamic) that
 *    WILL break when the file moves one level deeper. Rewrite as needed.
 * 2. Partition the procedures into 2–N domain groups (every proc in EXACTLY
 *    one group; none dropped/duplicated).
 * 3. Copy the whole file once per group (retains ALL imports + module-level
 *    helpers), rename the exported var, strip out-of-group procedures. The
 *    copy-whole-file strategy intentionally propagates module-level helpers
 *    so each group is self-contained — oxlint --fix (or eslint --fix fallback) then trims the unused
 *    ones (or they get the `_` prefix convention).
 * 4. Write a thin `index.ts` that re-exports the same router var via
 *    `mergeRouters(...)` (or object spread for procedure-bag).
 * 5. Delete the monolith.
 * 6. AST parity check (mandatory): compare union of procedure keys across the
 *    new sub-files vs. the original.
 *
 * ─── USAGE ─────────────────────────────────────────────────────────────────
 *   bun run scripts/split-router-template.ts \
 *     --routerFile="src/server/api/routers/myRouter.ts" \
 *     --outDir="src/server/api/routers/myRouter" \
 *     --varName="myRouterRouter" \
 *     --groups='{read:["getFoo","getBar"],mutate:["createX","updateY"]}' \
 *     --pattern="mergeRouters"
 *
 *   # For procedure-bag (object spread, NOT a router):
 *   --pattern="spread" \
 *   --varName="myRouterProcedures"
 *
 * ─── REQUIRES ──────────────────────────────────────────────────────────────
 * - `bun` (not npm/yarn/pnpm)
 * - `ts-morph` already installed (`bun add -D ts-morph`)
 * - The router file must be a `createTRPCRouter({...})` call (or for spread
 *   pattern: an `export const X = { ... }` object)
 *
 * ─── LESSONS LEARNED (June 2026 refactor) ──────────────────────────────────
 * 1. RELATIVE IMPORTS BREAK: copy-whole-file preserves relative paths but the
 *    file moved one level deeper. `from "./foo"` becomes `from "../foo"`,
 *    `from "../foo"` becomes `from "../../foo"`. ALWAYS pre-flight scan and
 *    bake the rewrite into the splitter (regex: `from ['"]\./<word>['"]`).
 * 2. DYNAMIC IMPORTS TOO: `await import("./foo")` and `await import("../foo")`
 *    have the same problem. Pre-flight scan must check BOTH static and
 *    dynamic patterns. Use `perl -i -pe` for the dynamic case (parens
 *    confuse `sed`).
 * 3. HELPER RE-EXPORTS: when a helper like `evaluateThresholds` is used by
 *    ANOTHER router (e.g. `intelligence/core/dashboard.ts`), the new
 *    `<router>/index.ts` MUST re-export it. Otherwise external importers
 *    break. Always run a pre-flight external-importer scan.
 * 4. CROSS-ROUTER IMPORTS BANNED: by the arch.md rule, no router imports
 *    another router. The one exception is the helper re-export pattern (item
 *    3 above), which is a one-way sharing of a helper through the
 *    destination router's `index.ts`.
 * 5. PARITY VERIFICATION MUST BE AST-BASED, not line-grep. The
 *    `verify-router-splits.ts` script uses ts-morph to walk
 *    `createTRPCRouter({...})` properties and compare sets. Always run it
 *    after a split.
 * 6. MEMORY SAFETY: agents running this script should NOT run a full
 *    `tsc --noEmit` (8GB servers OOM). The agent does the split + parity
 *    check; the orchestrator runs one consolidated `bun run typecheck:trpc`
 *    after all parallel splits land.
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

// ─── CLI argument parsing ───────────────────────────────────────────────────
function arg(name: string, fallback?: string): string {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  if (found) return found.slice(flag.length);
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required flag: --${name}`);
}

const ROUTER_FILE = arg("routerFile");
const OUT_DIR = arg("outDir");
const VAR_NAME = arg("varName");
const PATTERN = arg("pattern", "mergeRouters") as "mergeRouters" | "spread";
const GROUPS_JSON = arg("groups", "{}");
const groups = JSON.parse(GROUPS_JSON) as Record<string, string[]>;

if (PATTERN !== "mergeRouters" && PATTERN !== "spread") {
  throw new Error(`--pattern must be "mergeRouters" or "spread", got "${PATTERN}"`);
}

// ─── Validate groups: every proc in EXACTLY one group, none dropped/duplicated
const allGrouped = Object.values(groups).flat();
const dupes = allGrouped.filter((n, i) => allGrouped.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// ─── ts-morph: collect ALL PropertyAssignment names from the original router
const project = new Project({ skipAddingFilesFromTsConfig: true });
const origSf = project.addSourceFileAtPath(ROUTER_FILE);

const findOriginalProps = (): string[] => {
  for (const decl of origSf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    if (PATTERN === "mergeRouters") {
      if (!init.isKind(SyntaxKind.CallExpression)) continue;
      if (init.getExpression().getText() !== "createTRPCRouter") continue;
    } else {
      if (!init.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    }
    const obj = init.asKindOrThrow(
      PATTERN === "mergeRouters" ? SyntaxKind.CallExpression : SyntaxKind.ObjectLiteralExpression
    );
    const argOrObj = PATTERN === "mergeRouters" ? (obj as any).getArguments()[0] : obj;
    if (!argOrObj || !argOrObj.isKind(SyntaxKind.ObjectLiteralExpression)) {
      throw new Error("Could not locate the procedure object literal");
    }
    return (argOrObj as ObjectLiteralExpression)
      .getProperties()
      .filter((p): p is PropertyAssignment => p.isKind(SyntaxKind.PropertyAssignment))
      .map((p) => p.getName());
  }
  throw new Error(`No createTRPCRouter({...}) or object literal found in ${ROUTER_FILE}`);
};

const origProps = findOriginalProps();
const origSet = new Set(origProps);

const missing = allGrouped.filter((p) => !origSet.has(p));
const uncovered = origProps.filter((p) => !allGrouped.includes(p));
if (missing.length) {
  throw new Error(`Grouped procs not in original: ${missing.join(", ")}`);
}
if (uncovered.length) {
  throw new Error(`Original procs not in any group: ${uncovered.join(", ")}`);
}
console.log(
  `✓ Pre-check: ${origProps.length} procedures, ${Object.keys(groups).length} groups, all assigned exactly once.`
);

// ─── RELATIVE-IMPORT PRE-FLIGHT (THE LESSON) ─────────────────────────────────
// When the source file moves into a subdir, relative imports break:
//   from "./foo"  → from "../foo"   (one level deeper)
//   from "../foo" → from "../../foo" (one level deeper)
// BOTH static AND dynamic imports affected.
//
// Strategy: detect static + dynamic relative imports in the source, then
// rewrite each to have ONE MORE "../" prefix.

const originalText = fs.readFileSync(ROUTER_FILE, "utf8");

const STATIC_RE = /from\s+(['"])(\.\.?\/[^'"]+)\1/g;
const DYNAMIC_RE = /(await\s+import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"])/g;

const staticRel = [...originalText.matchAll(STATIC_RE)].map((m) => m[2]);
const dynamicRel = [...originalText.matchAll(DYNAMIC_RE)].map((m) => m[2]);

function rewriteRel(p: string): string {
  // p is like "./foo", "../foo", "../../foo"
  if (p.startsWith("./")) return "../" + p.slice(2);
  if (p.startsWith("../")) return "../../" + p.slice(3);
  return p;
}

const staticRewrites = new Map<string, string>();
for (const p of new Set(staticRel)) {
  const rewritten = rewriteRel(p);
  if (rewritten !== p) staticRewrites.set(p, rewritten);
}
const dynamicRewrites = new Map<string, string>();
for (const p of new Set(dynamicRel)) {
  const rewritten = rewriteRel(p);
  if (rewritten !== p) dynamicRewrites.set(p, rewritten);
}

if (staticRewrites.size || dynamicRewrites.size) {
  console.log("→ Relative-import rewrites needed:");
  for (const [from, to] of staticRewrites) console.log(`    static  ${from}  →  ${to}`);
  for (const [from, to] of dynamicRewrites) console.log(`    dynamic ${from}  →  ${to}`);
}

// ─── Write the sub-files ─────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

for (const [groupName, procs] of Object.entries(groups)) {
  const subVarName = `${VAR_NAME.replace(/Router$/, "")}${cap(groupName)}${
    PATTERN === "mergeRouters" ? "Router" : "Procedures"
  }`;
  const outPath = path.join(OUT_DIR, `${groupName}.ts`);

  // Copy whole file, rewrite router var, strip out-of-group procedures.
  // Strategy: rename the router var first, then for each top-level
  // PropertyAssignment in the createTRPCRouter({...}) (or object literal)
  // whose name is NOT in this group, remove it.
  const sf = project.createSourceFile(`__split_${groupName}.ts`, originalText, { overwrite: true });

  // Rename the router var
  for (const decl of sf.getVariableDeclarations()) {
    if (decl.getName() === VAR_NAME) {
      decl.rename(subVarName);
    }
  }

  // Apply relative-import rewrites
  for (const [from, to] of staticRewrites) {
    sf.replaceWithText(
      sf
        .getFullText()
        .replace(new RegExp(`from\\s+(['"])${escapeRe(from)}\\1`, "g"), `from $1${to}$1`)
    );
  }
  for (const [from, to] of dynamicRewrites) {
    sf.replaceWithText(
      sf
        .getFullText()
        .replace(
          new RegExp(`(await\\s+import\\s*\\(\\s*['"])${escapeRe(from)}(['"])`, "g"),
          `$1${to}$2`
        )
    );
  }

  // Strip out-of-group procedures
  const updatedText = sf.getFullText();
  const updatedSf = project.createSourceFile(`__strip_${groupName}.ts`, updatedText, {
    overwrite: true,
  });
  for (const decl of updatedSf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    const obj = (() => {
      if (PATTERN === "mergeRouters") {
        if (!init.isKind(SyntaxKind.CallExpression)) return null;
        if (init.getExpression().getText() !== "createTRPCRouter") return null;
        const arg = (init as any).getArguments()[0];
        if (!arg || !arg.isKind(SyntaxKind.ObjectLiteralExpression)) return null;
        return arg as ObjectLiteralExpression;
      } else {
        if (!init.isKind(SyntaxKind.ObjectLiteralExpression)) return null;
        return init as ObjectLiteralExpression;
      }
    })();
    if (!obj) continue;

    const procsToKeep = new Set(procs);
    for (const prop of obj.getProperties()) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const name = prop.getName();
        if (!procsToKeep.has(name)) prop.remove();
      }
    }
  }

  fs.writeFileSync(outPath, updatedSf.getFullText());
  const keptCount = updatedSf
    .getFullText()
    .match(new RegExp(`^\\s+${procs[0]?.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}:`, "m"));
  console.log(
    `  ${groupName}.ts: wrote ${outPath} (sub-var: ${subVarName}, kept ${procs.length}/${procs.length} procs)` +
      (keptCount ? "" : "")
  );
  project.removeSourceFile(updatedSf);
  project.removeSourceFile(sf);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Write the index.ts ──────────────────────────────────────────────────────
const importLines: string[] = [];
const mergeLines: string[] = [];
for (const groupName of Object.keys(groups)) {
  const subVarName = `${VAR_NAME.replace(/Router$/, "")}${cap(groupName)}${
    PATTERN === "mergeRouters" ? "Router" : "Procedures"
  }`;
  importLines.push(`import { ${subVarName} } from "./${groupName}";`);
  mergeLines.push(`  ${subVarName},`);
}

const indexContent =
  PATTERN === "mergeRouters"
    ? `/**
 * Auto-recombined router for ${path.basename(ROUTER_FILE, ".ts")}.
 * ${origProps.length} procedures preserved byte-identical via mergeRouters.
 *
 * If you need to re-export a helper for cross-router use, add it here:
 *   export { someHelper } from "./<group-that-owns-it>";
 */
import { mergeRouters } from "~/server/api/trpc";
${importLines.join("\n")}

export const ${VAR_NAME} = mergeRouters(
${mergeLines.join("\n")}
);
`
    : `/**
 * Auto-recombined procedure-bag for ${path.basename(ROUTER_FILE, ".ts")}.
 * ${origProps.length} procedures preserved byte-identical via object spread.
 *
 * Consumed by the parent router's \`...<this>Procedures\` spread.
 */
${importLines.join("\n")}

export const ${VAR_NAME} = {
${mergeLines.map((l) => l.trim().replace(/,$/, ",")).join("\n")}
};
`;

fs.writeFileSync(path.join(OUT_DIR, "index.ts"), indexContent);
console.log(`  index.ts: wrote mergeRouters/spread combiner`);

// ─── Delete the monolith ────────────────────────────────────────────────────
fs.unlinkSync(ROUTER_FILE);
console.log(`✓ Deleted monolith: ${ROUTER_FILE}`);

// ─── AST PARITY CHECK (mandatory) ───────────────────────────────────────────
const verifyProject = new Project({ skipAddingFilesFromTsConfig: true });
const newKeys: string[] = [];
for (const f of fs.readdirSync(OUT_DIR)) {
  if (!f.endsWith(".ts") || f === "index.ts") continue;
  const sf = verifyProject.addSourceFileAtPath(path.join(OUT_DIR, f));
  for (const decl of sf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    let obj: ObjectLiteralExpression | null = null;
    if (PATTERN === "mergeRouters") {
      if (!init.isKind(SyntaxKind.CallExpression)) continue;
      if (init.getExpression().getText() !== "createTRPCRouter") continue;
      const arg = (init as any).getArguments()[0];
      if (arg?.isKind(SyntaxKind.ObjectLiteralExpression)) obj = arg as ObjectLiteralExpression;
    } else {
      if (!init.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
      obj = init as ObjectLiteralExpression;
    }
    if (obj) {
      for (const p of obj.getProperties()) {
        if (p.isKind(SyntaxKind.PropertyAssignment)) newKeys.push(p.getName());
      }
    }
  }
}
const newSet = new Set(newKeys);
const dups = newKeys.filter((k, i) => newKeys.indexOf(k) !== i);
const missingFinal = origProps.filter((k) => !newSet.has(k));
const extras = [...newSet].filter((k) => !origSet.has(k));

const ok = missingFinal.length === 0 && extras.length === 0 && dups.length === 0;
console.log("");
console.log(
  `AST PARITY: orig=${origProps.length} new=${newSet.size} (${Object.keys(groups).length} files) ${ok ? "✓" : "✗"}` +
    (missingFinal.length ? ` MISSING:[${missingFinal.join(",")}]` : "") +
    (extras.length ? ` EXTRA:[${extras.join(",")}]` : "") +
    (dups.length ? ` DUP:[${dups.join(",")}]` : "")
);

if (!ok) {
  console.error("\n✗ PARITY FAILURE — investigate above");
  process.exit(1);
}

console.log(`\n✓ Split complete: ${ROUTER_FILE} → ${OUT_DIR}/`);
console.log(
  `Next steps: (1) verify ${path.basename(OUT_DIR)}/index.ts mounts correctly,` +
    ` (2) run consolidated \`bun run typecheck:trpc\`,` +
    ` (3) run \`bun run audit:arch --update\` to ratchet the baseline.`
);
