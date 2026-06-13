/**
 * One-time AST splitter for the diplomatic-embassies missions sub-router
 * (mirrors split-activities-ast.ts).
 *
 * Strategy (behaviour-preserving): read the original file content, delete the
 * monolith so the same-named directory can be created, then write a copy per
 * group so every import + module-level helper is retained. Each per-group
 * copy has its exported router renamed and the out-of-group procedures
 * removed. The groups are recombined with mergeRouters in missions/index.ts,
 * so `api.diplomatic.embassies.<procName>` paths are unchanged.
 *
 * Run from the project root:  bun run scripts/split-embassies-missions-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/diplomacy/embassies/missions.ts";
const outDir = "src/server/api/routers/diplomacy/embassies/missions";

// Read original content + delete the monolith so the same-named directory can be created.
const originalContent = fs.readFileSync(routerFile, "utf8");
fs.unlinkSync(routerFile);
fs.mkdirSync(outDir, { recursive: true });

// Group by concern. The natural query/mutation split puts both 195-line
// completeMission + 98-line startMission in one file (~784 lines), which
// exceeds the 700-line ceiling for an ESLint-clean file. Pairing each
// lifecycle endpoint with its neighbouring procedure balances the sizes:
//   - lifecycle: completeMission (195) + getAvailableMissions (13) = 208 procs (~699 lines)
//   - execution: startMission (98)   + getActiveMissions (27)       = 125 procs (~616 lines)
const groups: Record<string, string[]> = {
  lifecycle: ["completeMission", "getAvailableMissions"],
  execution: ["startMission", "getActiveMissions"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the original router object once, so we can
// assert that every grouped name exists AND that every existing name is grouped (no drops).
const origSf = project.createSourceFile(routerFile, originalContent);
const origDecl = origSf.getVariableDeclarationOrThrow("diplomaticEmbassiesMissionsRouter");
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

project.removeSourceFile(origSf);

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.writeFileSync(outPath, originalContent);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("diplomaticEmbassiesMissionsRouter");
  decl.rename(`diplomaticEmbassiesMissions${cap(groupName)}Router`);

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
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

if (keptSum !== allProps.length) {
  throw new Error(`Kept sum ${keptSum} !== original property count ${allProps.length}`);
}
console.log(`Total kept: ${keptSum}/${allProps.length} procedures`);
console.log(
  "Done. Original monolith deleted; per-group copies written. Now create missions/index.ts (mergeRouters)."
);
