/**
 * One-time AST splitter for the security mega-router (mirrors split-thinkpages-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in security/index.ts, so api.security.* paths are unchanged.
 *
 * Run from the project root:  bun run scripts/split-security-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/security.ts";
const outDir = "src/server/api/routers/security";
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  // Security assessment + threat catalog (threats, intelligence, incidents).
  assessment: [
    "getSecurityAssessment",
    "updateSecurityAssessment",
    "getSecurityThreats",
    "createSecurityThreat",
    "updateSecurityThreat",
    "deleteSecurityThreat",
    "createThreatIncident",
    "createThreatIntelligence",
  ],
  // Military force structure: branches, units, assets.
  military: [
    "getMilitaryBranches",
    "createMilitaryBranch",
    "updateMilitaryBranch",
    "deleteMilitaryBranch",
    "createMilitaryUnit",
    "updateMilitaryUnit",
    "deleteMilitaryUnit",
    "createMilitaryAsset",
    "updateMilitaryAsset",
    "deleteMilitaryAsset",
    "notifyBranchUpdate",
  ],
  // Defense budget, overview, and intelligence metrics.
  defense: [
    "getDefenseBudget",
    "updateDefenseBudget",
    "syncDefenseBudget",
    "getDefenseOverview",
    "getDefenseIntelligenceMetrics",
  ],
  // Internal stability and security events.
  stability: [
    "getInternalStability",
    "updateInternalStability",
    "generateStabilityEvent",
    "getSecurityEvents",
    "resolveSecurityEvent",
  ],
  // Border security and neighbor threats.
  borders: [
    "getBorderSecurity",
    "updateBorderSecurity",
    "createNeighborThreat",
    "updateNeighborThreat",
    "deleteNeighborThreat",
  ],
  // Active operations and PvP/PvNPC conflicts.
  operations: [
    "getOperations",
    "createOperation",
    "endOperation",
    "proposePvPConflict",
    "respondToConflict",
    "getConflicts",
    "resolvePvNPCConflict",
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the original router object once, so we can
// assert that every procedure is covered by exactly one group (no silent drops).
const origSf = project.addSourceFileAtPath(routerFile);
const origDecl = origSf.getVariableDeclarationOrThrow("securityRouter");
const origCall = origDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const origObj = origCall.getArguments()[0] as ObjectLiteralExpression;
const allProps = (
  origObj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
).map((p) => p.getName());
const allPropsSet = new Set(allProps);

// NOT-FOUND guard: every grouped name must exist in the router.
for (const n of allNames) {
  if (!allPropsSet.has(n)) throw new Error(`Grouped procedure '${n}' not found in router`);
}
// ALL-COVERED guard: every router procedure must be in some group.
const groupedSet = new Set(allNames);
for (const n of allProps) {
  if (!groupedSet.has(n)) throw new Error(`Router procedure '${n}' is not assigned to any group`);
}
// Remove the read-only original from the project so it isn't accidentally saved.
project.removeSourceFile(origSf);

let totalKept = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.copyFileSync(routerFile, outPath);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("securityRouter");
  decl.rename(`security${cap(groupName)}Router`);

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
  totalKept += kept;
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

// ALL-COVERED count assertion: kept total must equal the full procedure count.
if (totalKept !== allProps.length) {
  throw new Error(`Kept ${totalKept} procedures but router has ${allProps.length}`);
}
console.log(`Total kept: ${totalKept}/${allProps.length}`);

console.log("Done. Now create security/index.ts (mergeRouters) and delete security.ts.");
