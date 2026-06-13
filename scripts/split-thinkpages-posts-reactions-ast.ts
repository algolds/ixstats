/**
 * One-time AST splitter for the thinkpages posts reactions sub-router (3rd-level split).
 *
 * Mirrors split-activities-ast.ts. Splits the 3-procedure reactions sub-router
 * (1057 lines) into a `mutations` group (writes) and a `queries` group (read),
 * recombined with mergeRouters in thinkpages/posts/reactions/index.ts so the
 * public path `api.thinkpages.posts.reactions.*` is byte-identical to the former
 * monolith — no call sites change.
 *
 * Run from the project root:  bun run scripts/split-thinkpages-posts-reactions-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/thinkpages/posts/reactions.ts";
const outDir = "src/server/api/routers/thinkpages/posts/reactions";

// Read the original into memory FIRST so we can rm it before the dir exists
// (the recipe requires the old file gone before `./reactions` can resolve to
// the new subdir).
const origContent = fs.readFileSync(routerFile, "utf-8");

// IMPORTANT: rm the old file before creating the dir (so import path `./reactions`
// in the parent index resolves to the new subdir, not the stale monolith).
fs.unlinkSync(routerFile);
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  mutations: ["addReaction", "removeReaction"],
  queries: ["getPostReactions"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the original router object once, so we
// can assert that every grouped name exists AND that every existing name is grouped
// (no drops).
const tempSf = project.createSourceFile("temp.ts", origContent);
const tempDecl = tempSf.getVariableDeclarationOrThrow("thinkpagesPostsReactionsRouter");
const tempCall = tempDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const tempObj = tempCall.getArguments()[0] as ObjectLiteralExpression;
const allProps = (
  tempObj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
).map((p) => p.getName());
const allPropsSet = new Set(allProps);

// NOT-FOUND guard: throw if a grouped name is not in allProps.
for (const n of allNames) {
  if (!allPropsSet.has(n)) throw new Error(`Grouped procedure '${n}' not found in router`);
}

// ALL-COVERED guard: throw if any allProps name is NOT in some group (prevents silent drops).
const groupedSet = new Set(allNames);
const uncovered = allProps.filter((n) => !groupedSet.has(n));
if (uncovered.length)
  throw new Error(`Ungrouped procedures (would be dropped): ${uncovered.join(", ")}`);

console.log(`Original router exposes ${allProps.length} procedures: ${allProps.join(", ")}`);

// Drop the temp source file from the project so the per-group copies are independent.
project.removeSourceFile(tempSf);

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  // Write the original content to the new file (the original is now gone, so
  // we use the in-memory copy).
  fs.writeFileSync(outPath, origContent);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("thinkpagesPostsReactionsRouter");
  decl.rename(`thinkpagesPostsReactions${cap(groupName)}Router`);

  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const obj = call.getArguments()[0] as ObjectLiteralExpression;
  const props = obj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];

  const present = new Set(props.map((p) => p.getName()));
  for (const n of names) {
    if (!present.has(n)) throw new Error(`${groupName}: procedure '${n}' not found in router`);
  }

  let kept = 0;
  for (const p of props) {
    if (names.includes(p.getName())) kept++;
    else p.remove();
  }
  sf.saveSync();
  keptSum += kept;
  const lc = fs.readFileSync(outPath, "utf-8").split("\n").length;
  console.log(
    `${groupName}.ts: kept ${kept}/${names.length} procedures (${lc} lines)`
  );
}

// ASSERT: sum of kept procedures across all groups equals the original property count.
if (keptSum !== allProps.length) {
  throw new Error(`Kept sum ${keptSum} !== original property count ${allProps.length}`);
}
console.log(`Total kept: ${keptSum}/${allProps.length} procedures`);
console.log(
  "Done. Now create reactions/index.ts (mergeRouters) — the script does NOT create it."
);
