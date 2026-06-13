/**
 * One-time AST splitter for the diplomatic-cultural NPC sub-router (mirrors split-activities-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import is retained, rename the exported router, then delete the procedures that
 * don't belong to the group. The groups are recombined with mergeRouters in
 * npc/index.ts, so the public API path under this sub-router is unchanged.
 *
 * One adaptation: this source file contains ~330 lines of module-level helper
 * functions (lines ~21-58 and ~632-959) that are NOT referenced by any of the 3
 * procedures — verified by walking the procedure bodies via ts-morph. They are
 * dead code from earlier drafting cycles. We drop them after copying so each
 * group file is well under the 700-line soft cap. Procedure behaviour is
 * unaffected because the procedures never called these helpers in the first
 * place (and they weren't exported, so no external callers either).
 *
 * Run from the project root:  bun run scripts/split-cultural-npc-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/diplomacy/cultural/npc.ts";
const outDir = "src/server/api/routers/diplomacy/cultural/npc";
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  generation: ["generateCulturalScenario"],
  responses: ["getNPCCulturalResponse", "getNPCCulturalResponses"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the original router object once, so we can
// assert that every grouped name exists AND that every existing name is grouped (no drops).
const origSf = project.addSourceFileAtPath(routerFile);
const origDecl = origSf.getVariableDeclarationOrThrow("diplomaticCulturalNpcRouter");
const origCall = origDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const origObj = origCall.getArguments()[0] as ObjectLiteralExpression;
const allProps = (
  origObj
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

// Verify which module-level FunctionDeclarations are actually referenced by any
// procedure body. We collect identifiers from the router object literal's
// descendants (procedure bodies), then keep the names of module-level functions
// that appear in that set. Helpers not in the set are dead code.
const referencedFromProcedures = new Set<string>();
for (const id of origCall.getDescendantsOfKind(SyntaxKind.Identifier)) {
  referencedFromProcedures.add(id.getText());
}
const origFnNames = origSf.getFunctions().map((f) => f.getName()).filter((n): n is string => !!n);
const liveFnNames = new Set(origFnNames.filter((n) => referencedFromProcedures.has(n)));
console.log(
  `Module-level functions: ${origFnNames.length} total, ${liveFnNames.size} referenced by procedures, ${
    origFnNames.length - liveFnNames.size
  } dead`
);
if (liveFnNames.size > 0) {
  console.log(`Live helpers retained: ${[...liveFnNames].join(", ")}`);
}

// Drop the original source file from the project so the per-group copies are independent.
project.removeSourceFile(origSf);

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.copyFileSync(routerFile, outPath);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("diplomaticCulturalNpcRouter");
  decl.rename(`diplomaticCulturalNpc${cap(groupName)}Router`);

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

  // Remove dead module-level FunctionDeclarations. Helpers that procedures still
  // reference (liveFnNames) are kept. (For this file liveFnNames is empty — all
  // module-level helpers are dead code, but we apply the live-set check anyway
  // to keep the splitter robust against future edits.)
  let removedHelpers = 0;
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name && !liveFnNames.has(name)) {
      fn.remove();
      removedHelpers++;
    }
  }

  sf.saveSync();
  keptSum += kept;
  console.log(
    `${groupName}.ts: kept ${kept}/${names.length} procedures, removed ${removedHelpers} dead helper(s)`
  );
}

// ASSERT: sum of kept procedures across all groups equals the original property count.
if (keptSum !== allProps.length) {
  throw new Error(`Kept sum ${keptSum} !== original property count ${allProps.length}`);
}
console.log(`Total kept: ${keptSum}/${allProps.length} procedures`);
console.log("Done. Now create npc/index.ts (mergeRouters) and delete npc.ts.");
