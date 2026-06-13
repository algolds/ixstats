/**
 * One-time AST splitter for the diplomacy/cultural router (mirrors split-activities-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in diplomacy/cultural/index.ts, so api.diplomaticCultural.* paths are unchanged.
 *
 * NOTE: the router file lives at diplomacy/cultural.ts and the output dir is the
 * same-stem diplomacy/cultural/. A file and a directory of the same stem cannot coexist,
 * so the original file is read into the project FIRST, then deleted from disk, then the
 * group files are written into the new directory.
 *
 * Run from the project root:  bun run scripts/split-diplomacy-cultural-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/diplomacy/cultural.ts";
const outDir = "src/server/api/routers/diplomacy/cultural";

const groups: Record<string, string[]> = {
  exchanges: [
    "getCulturalExchanges",
    "createCulturalExchange",
    "joinCulturalExchange",
    "linkExchangeToMission",
  ],
  lifecycle: [
    "voteOnExchange",
    "uploadCulturalArtifact",
    "updateCulturalExchange",
    "cancelCulturalExchange",
  ],
  npc: ["generateCulturalScenario", "getNPCCulturalResponse", "getNPCCulturalResponses"],
  compatibility: [
    "calculateExchangeImpact",
    "getCulturalCompatibility",
    "getRecommendedPartners",
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Read the ENTIRE original source text into the project before we touch the filesystem.
// ts-morph keeps the in-memory copy, so deleting the file on disk afterwards is safe.
const origText = fs.readFileSync(routerFile, "utf8");
const origSf = project.createSourceFile(routerFile, origText, { overwrite: true });
const origDecl = origSf.getVariableDeclarationOrThrow("diplomaticCulturalRouter");
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

// Drop the original in-memory source file so the per-group copies are independent.
project.removeSourceFile(origSf);

// Delete the original file from disk (a file + dir of the same stem cannot coexist),
// then create the output directory.
fs.rmSync(routerFile);
fs.mkdirSync(outDir, { recursive: true });

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  // Each group starts from a fresh copy of the original text (all imports + helpers retained).
  const sf = project.createSourceFile(outPath, origText, { overwrite: true });

  const decl = sf.getVariableDeclarationOrThrow("diplomaticCulturalRouter");
  decl.rename(`diplomaticCultural${cap(groupName)}Router`);

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

// ASSERT: sum of kept procedures across all groups equals the original property count.
if (keptSum !== allProps.length) {
  throw new Error(`Kept sum ${keptSum} !== original property count ${allProps.length}`);
}
console.log(`Total kept: ${keptSum}/${allProps.length} procedures`);
console.log("Done. Now create diplomacy/cultural/index.ts (mergeRouters).");
