/**
 * One-time AST splitter for the diplomacy/embassies/queries sub-router.
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in diplomacy/embassies/queries/index.ts, so the merged router exposes the same four
 * procedure keys as the former monolith.
 *
 * NOTE: the router file lives at diplomacy/embassies/queries.ts and the output dir is
 * the same-stem diplomacy/embassies/queries/. A file and a directory of the same stem
 * cannot coexist, so the original file is read into the project FIRST, then deleted from
 * disk, then the group files are written into the new directory.
 *
 * Run from the project root:  bun run scripts/split-embassies-queries-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/diplomacy/embassies/queries.ts";
const outDir = "src/server/api/routers/diplomacy/embassies/queries";

const groups: Record<string, string[]> = {
  embassyListings: ["getEmbassies", "getEmbassyDetails"],
  embassyCalculators: ["calculateEstablishmentCost", "getAvailableUpgrades"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

const origText = fs.readFileSync(routerFile, "utf8");
const origSf = project.createSourceFile(routerFile, origText, { overwrite: true });
const origDecl = origSf.getVariableDeclarationOrThrow("diplomaticEmbassiesQueriesRouter");
const origCall = origDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const origObj = origCall.getArguments()[0] as ObjectLiteralExpression;
const allProps = (
  origObj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
).map((p) => p.getName());
const allPropsSet = new Set(allProps);

for (const n of allNames) {
  if (!allPropsSet.has(n)) throw new Error(`Grouped procedure '${n}' not found in router`);
}

const groupedSet = new Set(allNames);
const uncovered = allProps.filter((n) => !groupedSet.has(n));
if (uncovered.length)
  throw new Error(`Ungrouped procedures (would be dropped): ${uncovered.join(", ")}`);

project.removeSourceFile(origSf);

fs.rmSync(routerFile);
fs.mkdirSync(outDir, { recursive: true });

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  const sf = project.createSourceFile(outPath, origText, { overwrite: true });

  const decl = sf.getVariableDeclarationOrThrow("diplomaticEmbassiesQueriesRouter");
  decl.rename(`diplomaticEmbassiesQueries${cap(groupName)}Router`);

  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const obj = call.getArguments()[0] as ObjectLiteralExpression;
  const props = obj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];

  const present = new Set(props.map((p) => p.getName()));
  for (const n of names) {
    if (!present.has(n))
      throw new Error(`${groupName}: procedure '${n}' not found in router`);
  }

  let kept = 0;
  for (const p of props) {
    if (names.includes(p.getName())) kept++;
    else p.remove();
  }
  sf.saveSync();
  keptSum += kept;
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

if (keptSum !== allProps.length) {
  throw new Error(`Kept sum ${keptSum} !== original property count ${allProps.length}`);
}
console.log(`Total kept: ${keptSum}/${allProps.length} procedures`);
console.log("Done. Now create diplomacy/embassies/queries/index.ts (mergeRouters) and delete queries.ts.");
