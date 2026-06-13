/**
 * AST parity check for the thinkpages posts reactions split.
 *
 * Verifies that the merged `thinkpagesPostsReactionsRouter` (produced by
 * mergeRouters in reactions/index.ts) exposes exactly the same procedure keys
 * as the original monolith (addReaction, removeReaction, getPostReactions).
 *
 * Strategy: load the index.ts, find the mergeRouters call, resolve each argument
 * to its source file, and collect every PropertyAssignment name across all
 * underlying createTRPCRouter objects.
 *
 * Run from the project root:  bun run scripts/verify-thinkpages-posts-reactions-split.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";

const project = new Project({ skipAddingFilesFromTsConfig: true });

const EXPECTED = ["addReaction", "removeReaction", "getPostReactions"].sort();
const EXPECTED_SET = new Set(EXPECTED);

const indexPath = "src/server/api/routers/thinkpages/posts/reactions/index.ts";
const indexDir = indexPath.replace(/\/index\.ts$/, "");

const indexSf = project.addSourceFileAtPath(indexPath);
const decl = indexSf.getVariableDeclarationOrThrow("thinkpagesPostsReactionsRouter");
const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);

if (call.getExpression().getText() !== "mergeRouters") {
  throw new Error(`Expected mergeRouters call, got: ${call.getExpression().getText()}`);
}

const argIdents = call.getArguments();
if (argIdents.length === 0) throw new Error("mergeRouters called with zero args");

const allNames = new Set<string>();
const groupFiles: string[] = [];

for (const arg of argIdents) {
  if (arg.getKind() !== SyntaxKind.Identifier) {
    throw new Error(`Expected identifier argument, got ${arg.getKindName()}`);
  }
  const routerVarName = arg.getText();

  const importDecl = indexSf.getImportDeclaration((d) =>
    d.getNamedImports().some((ni) => ni.getName() === routerVarName)
  );
  if (!importDecl) {
    throw new Error(
      `Could not find import for "${routerVarName}" in ${indexPath}`
    );
  }
  const moduleSpecifier = importDecl.getModuleSpecifierValue();
  const groupPath = `${indexDir}/${moduleSpecifier.replace(/^\.\//, "")}.ts`;
  groupFiles.push(groupPath);

  const groupSf = project.addSourceFileAtPath(groupPath);

  // Find the exported thinkpagesPostsReactions*Router variable.
  const groupExports = groupSf.getExportedDeclarations();
  let routerDecl = null;
  for (const [name, decls] of groupExports) {
    if (name === routerVarName && decls.length > 0) {
      const d = decls[0];
      if (d.getKind() === SyntaxKind.VariableDeclaration) {
        routerDecl = d.asKindOrThrow(SyntaxKind.VariableDeclaration);
        break;
      }
    }
  }
  if (!routerDecl) {
    throw new Error(`Could not find variable declaration for "${routerVarName}" in ${groupPath}`);
  }

  const init = routerDecl.getInitializer();
  if (!init || init.getKind() !== SyntaxKind.CallExpression) {
    throw new Error(`"${routerVarName}" is not initialized with a call expression`);
  }
  const groupCall = init.asKindOrThrow(SyntaxKind.CallExpression);
  if (groupCall.getExpression().getText() !== "createTRPCRouter") {
    throw new Error(
      `"${routerVarName}" is not a createTRPCRouter call (got: ${groupCall.getExpression().getText()})`
    );
  }

  const obj = groupCall.getArguments()[0];
  if (!obj || obj.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    throw new Error(`"${routerVarName}" createTRPCRouter arg is not an object literal`);
  }
  const objLit = obj.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  for (const prop of objLit.getProperties()) {
    if (prop.getKind() !== SyntaxKind.PropertyAssignment) {
      throw new Error(`Unexpected non-PropertyAssignment in "${routerVarName}"`);
    }
    const pa = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
    allNames.add(pa.getName());
  }
}

const sorted = Array.from(allNames).sort();
const sortedExpected = Array.from(EXPECTED_SET).sort();
const isExactMatch = JSON.stringify(sorted) === JSON.stringify(sortedExpected);
const isSuperset = EXPECTED_SET.size === allNames.size && [...EXPECTED_SET].every((n) => allNames.has(n));
const isSubset = [...allNames].every((n) => EXPECTED_SET.has(n));

console.log("=".repeat(72));
console.log("AST PARITY CHECK: thinkpages/posts/reactions split");
console.log("=".repeat(72));
console.log(`Group files (${groupFiles.length}):`);
for (const f of groupFiles) console.log(`  - ${f}`);
console.log("");
console.log(`Original monolith procedures (${sortedExpected.length}): ${sortedExpected.join(", ")}`);
console.log(`Merged router procedures     (${sorted.length}): ${sorted.join(", ")}`);
console.log("");
console.log(`Exact match: ${isExactMatch ? "YES" : "NO"}`);
console.log(`Original ⊆ Merged: ${isSuperset ? "YES" : "NO"}`);
console.log(`Merged ⊆ Original: ${isSubset ? "YES" : "NO"}`);
console.log("");

if (!isExactMatch) {
  const missing = sortedExpected.filter((n) => !allNames.has(n));
  const extra = sorted.filter((n) => !EXPECTED_SET.has(n));
  if (missing.length) console.error(`MISSING (dropped): ${missing.join(", ")}`);
  if (extra.length) console.error(`EXTRA (added):     ${extra.join(", ")}`);
  console.error("");
  console.error("AST PARITY FAILED");
  process.exit(1);
}

console.log("AST PARITY OK — merged router exposes the same procedure keys as the original.");
console.log(`Total procedures: ${sorted.length}/${sortedExpected.length} match.`);
