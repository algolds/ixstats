/**
 * AST parity check for the missions router split.
 *
 * Verifies that the merged `diplomaticEmbassiesMissionsRouter` (composed via
 * mergeRouters in missions/index.ts from the per-group sub-routers) exposes
 * exactly the 4 procedure keys that the original monolith declared.
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

const project = new Project({ skipAddingFilesFromTsConfig: true });

const EXPECTED = ["getAvailableMissions", "startMission", "completeMission", "getActiveMissions"];

const dir = "src/server/api/routers/diplomacy/embassies/missions";

const indexPath = path.join(dir, "index.ts");
const indexSf = project.addSourceFileAtPath(indexPath);

const mergedDecl = indexSf.getVariableDeclarationOrThrow("diplomaticEmbassiesMissionsRouter");
const mergedInit = mergedDecl.getInitializerOrThrow();
if (!mergedInit.isKind(SyntaxKind.CallExpression)) {
  throw new Error("diplomaticEmbassiesMissionsRouter initializer is not a CallExpression");
}
const mergeArgs = mergedInit.asKindOrThrow(SyntaxKind.CallExpression).getArguments();
if (mergeArgs.length === 0) {
  throw new Error("mergeRouters call has no arguments");
}

const actual = new Set<string>();
const subFiles: string[] = [];
for (const arg of mergeArgs) {
  const text = arg.getText();
  const importDecl = indexSf.getImportDeclarationOrThrow((d) =>
    d.getNamedImports().some((n) => n.getName() === text)
  );
  const spec = importDecl.getModuleSpecifierValue();
  const subPath = path.join(dir, `${spec.replace(/^\.\//, "")}.ts`);
  subFiles.push(subPath);
  const subSf = project.addSourceFileAtPath(subPath);
  const subDecl = subSf.getVariableDeclarationOrThrow(text);
  const subInit = subDecl.getInitializerOrThrow();
  if (!subInit.isKind(SyntaxKind.CallExpression)) {
    throw new Error(`${subPath}: initializer is not a CallExpression`);
  }
  const subCall = subInit.asKindOrThrow(SyntaxKind.CallExpression);
  if (subCall.getExpression().getText() !== "createTRPCRouter") {
    throw new Error(`${subPath}: not a createTRPCRouter call`);
  }
  const subArg = subCall.getArguments()[0];
  if (!subArg || !subArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    throw new Error(`${subPath}: first arg is not an object literal`);
  }
  const subObj = subArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const procs = (
    subObj.getProperties().filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
  ).map((p) => p.getName());
  for (const p of procs) actual.add(p);
}

const expectedSet = new Set(EXPECTED);
const missing = EXPECTED.filter((p) => !actual.has(p));
const extra = [...actual].filter((p) => !expectedSet.has(p));
const dupes = EXPECTED.filter((p, i) => EXPECTED.indexOf(p) !== i);

console.log("=== AST Parity Check: diplomaticEmbassiesMissionsRouter ===");
console.log(`Sub-routers merged: ${mergeArgs.length} (${subFiles.join(", ")})`);
console.log(`Expected procedures: ${EXPECTED.length}`);
console.log(
  `  ${EXPECTED.map((p) => `${p} (${expectedSet.has(p) ? "ok" : "MISSING"})`).join("\n  ")}`
);
console.log(`Actual procedure union: ${actual.size}`);
console.log(`  ${[...actual].sort().join(", ")}`);
console.log(`Missing: ${missing.length} ${missing.join(", ") || "(none)"}`);
console.log(`Extra:   ${extra.length} ${extra.join(", ") || "(none)"}`);
console.log(`Dupes:   ${dupes.length} ${dupes.join(", ") || "(none)"}`);

if (missing.length) throw new Error(`AST parity FAILED — missing: ${missing.join(", ")}`);
if (extra.length) throw new Error(`AST parity FAILED — extra: ${extra.join(", ")}`);
if (dupes.length) throw new Error(`AST parity FAILED — duplicates: ${dupes.join(", ")}`);

console.log(`\nAST parity OK: ${actual.size}/${expectedSet.size} procedures match.`);
