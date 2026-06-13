/**
 * One-time AST splitter for the geo/editor mega-router (mirrors split-activities-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in geo/editor/index.ts, so api.geoEditor.* paths are unchanged.
 *
 * NOTE: editor.ts -> editor/ subdirectory moves the files one level deeper, so sibling
 * imports that referenced geo siblings (`from "./core"`) must become `from "../core"`.
 * This script rewrites those relative imports after pruning procedures.
 *
 * Run from the project root:  bun run scripts/split-geo-editor-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/geo/editor.ts";
const outDir = "src/server/api/routers/geo/editor";

const groups: Record<string, string[]> = {
  // Feature ↔ Country linkage management + linkage validation/repair
  linkage: [
    "assignCountryGeometry",
    "unlinkCountryGeometry",
    "getFeatureDetails",
    "updateFeatureProperties",
    "autoLinkAllCountries",
    "validateLinkage",
    "repairLinkage",
  ],
  // Edit-request review queue + per-country edit history
  queue: ["getEditQueue", "approveEdit", "rejectEdit", "getMyEditHistory"],
  // Border editor sessions, drafts, submit, split/merge
  borders: [
    "startBorderEditSession",
    "saveBorderEditDraft",
    "submitBorderEdit",
    "splitCountry",
    "mergeCountries",
  ],
  // Procedural world generation + map conversion/import pipeline
  procedural: [
    "generateProceduralWorld",
    "getProceduralWorldPreview",
    "commitProceduralWorld",
    "regenerateLayer",
    "listProceduralWorlds",
    "runPipeline",
    "importPipelineResult",
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the original router object once, so we can
// assert that every grouped name exists AND that every existing name is grouped (no drops).
const origSf = project.addSourceFileAtPath(routerFile);
const origDecl = origSf.getVariableDeclarationOrThrow("geoEditorRouter");
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

// Read original contents once (used as the per-group seed) so we can delete the file before
// writing into a same-stem directory (a file and dir of identical stem cannot coexist).
const origContents = fs.readFileSync(routerFile, "utf8");
fs.rmSync(routerFile);
fs.mkdirSync(outDir, { recursive: true });

// Rewrite geo-sibling relative imports for the new depth: `./X` -> `../X`.
// editor.ts (geo/editor.ts) referenced siblings as `./core`; from geo/editor/<group>.ts
// the sibling is one level up: `../core`.
const fixSiblingImports = (src: string) =>
  src
    .replace(/from "\.\/core"/g, 'from "../core"')
    .replace(/from "\.\/shared"/g, 'from "../shared"');

let keptSum = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.writeFileSync(outPath, origContents);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("geoEditorRouter");
  decl.rename(`geoEditor${cap(groupName)}Router`);

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

  // Fix relative geo-sibling imports now that files live one level deeper.
  sf.replaceWithText(fixSiblingImports(sf.getFullText()));

  sf.saveSync();
  keptSum += kept;
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

// ASSERT: sum of kept procedures across all groups equals the original property count.
if (keptSum !== allProps.length) {
  throw new Error(`Kept sum ${keptSum} !== original property count ${allProps.length}`);
}
console.log(`Total kept: ${keptSum}/${allProps.length} procedures`);
console.log("Done. Now create geo/editor/index.ts (mergeRouters).");
