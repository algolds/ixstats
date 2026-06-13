/**
 * One-off AST parity check: compare procedure keys exposed by the merged
 * npc router vs the original (deleted) npc.ts.
 *
 * The original file is not in git (the cultural/ dir is untracked), so the
 * reference key set is sourced from the conversation transcript where the
 * original file was read in full before deletion.
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";

const project = new Project({ skipAddingFilesFromTsConfig: true });

// Original procedure keys recovered from the file content read at the start of
// the task. The original file has 3 PropertyAssignments inside the
// `createTRPCRouter({...})` call of `diplomaticCulturalNpcRouter`.
const origKeys = [
  "generateCulturalScenario",
  "getNPCCulturalResponse",
  "getNPCCulturalResponses",
].sort();

const subFiles = ["generation", "responses"];
const perFile: Record<string, string[]> = {};
for (const name of subFiles) {
  const sf = project.addSourceFileAtPath(
    `src/server/api/routers/diplomacy/cultural/npc/${name}.ts`
  );
  const decl = sf.getVariableDeclarationOrThrow(
    `diplomaticCulturalNpc${name.charAt(0).toUpperCase() + name.slice(1)}Router`
  );
  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const obj = call.getArguments()[0] as ObjectLiteralExpression;
  perFile[name] = (
    obj
      .getProperties()
      .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
  ).map((p) => p.getName());
}

const unionKeys = [...new Set([...perFile.generation, ...perFile.responses])].sort();

const mergedSf = project.addSourceFileAtPath(
  "src/server/api/routers/diplomacy/cultural/npc/index.ts"
);
const mergedDecl = mergedSf.getVariableDeclarationOrThrow("diplomaticCulturalNpcRouter");
const mergedCall = mergedDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
// mergeRouters(a, b, ...) — the procedure keys aren't on a single object
// literal, so we confirm: (a) call is to mergeRouters, (b) every arg is one of
// the sub-router variables, and (c) every sub-router file is passed exactly
// once. The actual procedure keys come from the per-sub-file scan above.
const mergeExpr = mergedCall.getExpression().getText();
const argTexts = mergedCall.getArguments().map((a) => a.getText());

console.log("=== Original router procedure keys (recovered from in-task read) ===");
console.log(origKeys);
console.log(`Count: ${origKeys.length}`);
console.log();
console.log("=== Per sub-file ===");
for (const [name, keys] of Object.entries(perFile)) {
  console.log(`${name}.ts (${keys.length}): ${keys.join(", ")}`);
}
console.log(`Union count: ${unionKeys.length}`);
console.log();
console.log("=== Merged router signature ===");
console.log(`${mergeExpr}(${argTexts.join(", ")})`);
const isMergeRouters = mergeExpr === "mergeRouters";
const allArgsAreSubRouters =
  argTexts.length === subFiles.length &&
  argTexts.every((t) =>
    subFiles.some((n) => t === `diplomaticCulturalNpc${n.charAt(0).toUpperCase() + n.slice(1)}Router`)
  );
const uniqueArgs = new Set(argTexts);
const noDupes = uniqueArgs.size === argTexts.length;
console.log();
const sameAsOriginal = JSON.stringify(origKeys) === JSON.stringify(unionKeys);
const subFilesCoverAllOriginals = origKeys.every((k) => unionKeys.includes(k));
const indexIsWired = isMergeRouters && allArgsAreSubRouters && noDupes;
console.log("=== PARITY RESULT ===");
if (sameAsOriginal && subFilesCoverAllOriginals && indexIsWired) {
  console.log(
    `PASS: union of sub-file procedure keys (${unionKeys.length}) === original (${origKeys.length}); ` +
      `index.ts calls mergeRouters on every sub-router exactly once.`
  );
} else {
  console.log("FAIL");
  if (!sameAsOriginal) {
    const missing = origKeys.filter((k) => !unionKeys.includes(k));
    const added = unionKeys.filter((k) => !origKeys.includes(k));
    if (missing.length) console.log(`Missing from union: ${missing.join(", ")}`);
    if (added.length) console.log(`Added in union: ${added.join(", ")}`);
  }
  if (!isMergeRouters) console.log(`mergeRouters call missing or named wrong: ${mergeExpr}`);
  if (!allArgsAreSubRouters)
    console.log(`Sub-router args mismatch: ${argTexts.join(", ")}`);
  if (!noDupes) console.log("Duplicate sub-router args");
  process.exit(1);
}
