/**
 * One-time AST splitter for the economics mega-router (mirrors split-activities-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in economics/index.ts, so api.economics.* paths are unchanged.
 *
 * Run from the project root:  bun run scripts/split-economics-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/economics.ts";
const outDir = "src/server/api/routers/economics";
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  // Core entity get/update: economic profile, labor market, demographics
  profile: [
    "getEconomicProfile",
    "updateEconomicProfile",
    "getLaborMarket",
    "updateLaborMarket",
    "getDemographics",
    "updateDemographics",
  ],
  // Fiscal domain: fiscal system, income distribution, government budget
  fiscal: [
    "getFiscalSystem",
    "updateFiscalSystem",
    "getIncomeDistribution",
    "updateIncomeDistribution",
    "getGovernmentBudget",
    "updateGovernmentBudget",
  ],
  // Economy configuration save/get (comprehensive transaction endpoints)
  config: ["saveEconomyConfiguration", "getEconomyConfiguration"],
  // Economy builder live wiring: state save/get + autosave
  builder: ["saveEconomyBuilderState", "getEconomyBuilderState", "autoSaveEconomyBuilder"],
  // Cross-system sync
  sync: ["syncEconomyWithGovernment", "syncEconomyWithTax"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the original router object once, so we can
// assert that every grouped name exists AND that every existing name is grouped (no drops).
const origSf = project.addSourceFileAtPath(routerFile);
const origDecl = origSf.getVariableDeclarationOrThrow("economicsRouter");
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

// Drop the original source file from the project so the per-group copies are independent.
project.removeSourceFile(origSf);

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.copyFileSync(routerFile, outPath);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("economicsRouter");
  decl.rename(`economics${cap(groupName)}Router`);

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
console.log("Done. Now create economics/index.ts (mergeRouters) and delete economics.ts.");
