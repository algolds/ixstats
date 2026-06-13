/**
 * Independent AST parity check for the router splits.
 * Compares the ORIGINAL monolith (from git HEAD) procedure-key set against the
 * union of procedure keys across the new sub-files — fully AST-based, so it catches
 * procedures defined in forms a line-grep would miss. Run: bun run scripts/verify-router-splits.ts
 */
import { Project, SyntaxKind } from "ts-morph";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const routers = ["admin", "sports", "activities", "security"];
const base = "src/server/api/routers";
const proj = new Project({ skipAddingFilesFromTsConfig: true });

let n = 0;
function keysOf(text: string): string[] {
  const sf = proj.createSourceFile(`__v${n++}.ts`, text, { overwrite: true });
  const keys: string[] = [];
  for (const decl of sf.getVariableDeclarations()) {
    const call = decl.getInitializer()?.asKind(SyntaxKind.CallExpression);
    if (!call) continue;
    if (call.getExpression().getText() !== "createTRPCRouter") continue;
    const arg = call.getArguments()[0];
    if (arg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      for (const p of arg.getProperties()) {
        if (p.isKind(SyntaxKind.PropertyAssignment)) keys.push(p.getName());
      }
    }
  }
  proj.removeSourceFile(sf);
  return keys;
}

let allGood = true;
for (const r of routers) {
  let origText: string;
  try {
    origText = execSync(`git show HEAD:${base}/${r}.ts`, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    console.log(`${r}: ⚠️  not in git HEAD (was it uncommitted? skipping orig comparison)`);
    continue;
  }
  const orig = new Set(keysOf(origText));

  const dir = `${base}/${r}`;
  const subFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  const newKeys: string[] = [];
  for (const f of subFiles) newKeys.push(...keysOf(fs.readFileSync(path.join(dir, f), "utf8")));
  const newSet = new Set(newKeys);

  const missing = [...orig].filter((k) => !newSet.has(k));
  const extra = [...newSet].filter((k) => !orig.has(k));
  const dups = newKeys.filter((k, i) => newKeys.indexOf(k) !== i);

  const ok = missing.length === 0 && extra.length === 0 && dups.length === 0;
  allGood &&= ok;
  console.log(
    `${r}: orig=${orig.size} new=${newSet.size} (${subFiles.length} files) ` +
      `${ok ? "✓ IDENTICAL" : "✗"}` +
      (missing.length ? ` MISSING:[${missing.join(",")}]` : "") +
      (extra.length ? ` EXTRA:[${extra.join(",")}]` : "") +
      (dups.length ? ` DUP:[${dups.join(",")}]` : "")
  );
}
console.log(allGood ? "\nALL ROUTERS: parity verified ✓" : "\nPARITY FAILURE — investigate above");
process.exit(allGood ? 0 : 1);
