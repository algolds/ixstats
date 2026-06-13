/**
 * AST parity check for the diplomacy/cultural/exchanges/core split.
 *
 * Verifies the merged `diplomaticCulturalExchangesCoreRouter` re-exposed via
 * `core/index.ts` exposes the SAME 3 procedure keys as the original monolith:
 *   - getCulturalExchanges
 *   - createCulturalExchange
 *   - joinCulturalExchange
 *
 * Also asserts:
 *   - The original 3 keys are partitioned across queries.ts / mutations.ts with no
 *     drops, no duplicates, and no extras.
 *   - The merged `diplomaticCulturalExchangesCoreRouter` constant is exported from
 *     core/index.ts (callers in `exchanges/index.ts` depend on this name).
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

const project = new Project({ skipAddingFilesFromTsConfig: true });

// Original (pre-split) procedure keys — these are the 3 PropertyAssignment names that
// were on the `createTRPCRouter({...})` call in the former core.ts monolith.
const ORIGINAL_KEYS = ["getCulturalExchanges", "createCulturalExchange", "joinCulturalExchange"];
const ORIGINAL_KEYS_SET = new Set(ORIGINAL_KEYS);

const dir = "src/server/api/routers/diplomacy/cultural/exchanges/core";

function routerKeys(file: string): string[] {
  const sf = project.addSourceFileAtPath(file);
  const keys: string[] = [];
  for (const decl of sf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init || !init.isKind(SyntaxKind.CallExpression)) continue;
    if (init.getExpression().getText() !== "createTRPCRouter") continue;
    const arg = init.getArguments()[0];
    if (!arg || !arg.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const p of (arg as ObjectLiteralExpression).getProperties()) {
      if (p.isKind(SyntaxKind.PropertyAssignment)) {
        keys.push((p as PropertyAssignment).getName());
      }
    }
  }
  project.removeSourceFile(sf);
  return keys;
}

// 1. Each sub-file exposes its grouped procedures at the AST level.
const queriesKeys = routerKeys(`${dir}/queries.ts`);
const mutationsKeys = routerKeys(`${dir}/mutations.ts`);
const allNewKeys = [...queriesKeys, ...mutationsKeys];
const allNewSet = new Set(allNewKeys);

console.log(`queries.ts router keys:   [${queriesKeys.join(", ")}]  (${queriesKeys.length})`);
console.log(`mutations.ts router keys: [${mutationsKeys.join(", ")}]  (${mutationsKeys.length})`);

// 2. Union must equal the original set exactly (no drops, no extras, no dupes).
const missing = ORIGINAL_KEYS.filter((k) => !allNewSet.has(k));
const extra = [...allNewSet].filter((k) => !ORIGINAL_KEYS_SET.has(k));
const dupes = allNewKeys.filter((k, i) => allNewKeys.indexOf(k) !== i);

const unionOk = missing.length === 0 && extra.length === 0 && dupes.length === 0;
console.log(
  `union keys: {${[...allNewSet].sort().join(", ")}}  (${allNewSet.size})  ${
    unionOk ? "✓ matches original" : "✗"
  }`
);
if (missing.length) console.log(`  MISSING: [${missing.join(", ")}]`);
if (extra.length) console.log(`  EXTRA:   [${extra.join(", ")}]`);
if (dupes.length) console.log(`  DUPES:   [${dupes.join(", ")}]`);

// 3. The merged router is exported from core/index.ts under the expected name.
const indexSf = project.addSourceFileAtPath(`${dir}/index.ts`);
const exportedNames = new Set(indexSf.getExportedDeclarations().keys());
const hasMerged = exportedNames.has("diplomaticCulturalExchangesCoreRouter");
console.log(
  `index.ts exports include 'diplomaticCulturalExchangesCoreRouter': ${
    hasMerged ? "✓" : "✗"
  }  (exports: [${[...exportedNames].join(", ")}])`
);
project.removeSourceFile(indexSf);

const allOk = unionOk && hasMerged;
console.log(
  `\n${allOk ? "AST PARITY: PASS ✓" : "AST PARITY: FAIL ✗"} — original=3 procedures, merged=${allNewSet.size} procedures`
);
process.exit(allOk ? 0 : 1);
