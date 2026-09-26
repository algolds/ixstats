/**
 * Facet anti-slop codemod (plan 346). Idempotent; run with:
 *   bun scripts/codemods/facet-anti-slop.ts <pass> [--dry]
 *
 * Passes:
 *   micro-type   text-[8px|9px|10px|10.5px|11px] → text-xs (Apple 11pt floor; Facet has no tier below text-xs)
 *   transition   transition-all → transition-[color,background-color,border-color,box-shadow,opacity,transform]
 *   scale-zero   initial={{ scale: 0 }} → initial={{ scale: 0.96, opacity: 0 }} (Facet §8: never from scale(0))
 *
 * `src/app/labs/onoma` is excluded (it already guards reduced motion and has its own type scale).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXCLUDE = [join(SRC, "app", "labs", "onoma")];

const PASSES: Record<string, Array<[RegExp, string]>> = {
  "micro-type": [[/\btext-\[(?:8|9|10|10\.5|11)px\]/g, "text-xs"]],
  transition: [
    [
      /\btransition-all\b/g,
      "transition-[color,background-color,border-color,box-shadow,opacity,transform]",
    ],
  ],
  "scale-zero": [[/initial=\{\{ scale: 0 \}\}/g, "initial={{ scale: 0.96, opacity: 0 }}"]],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (EXCLUDE.some((ex) => p.startsWith(ex))) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const pass = process.argv[2];
const dry = process.argv.includes("--dry");
const rules = pass ? PASSES[pass] : undefined;
if (!rules) {
  console.error(`usage: bun scripts/codemods/facet-anti-slop.ts <${Object.keys(PASSES).join("|")}> [--dry]`);
  process.exit(1);
}

let files = 0;
let hits = 0;
for (const file of walk(SRC)) {
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const [re, replacement] of rules) {
    after = after.replace(re, () => {
      hits++;
      return replacement;
    });
  }
  if (after !== before) {
    files++;
    if (!dry) writeFileSync(file, after);
  }
}
console.log(`${pass}: ${hits} replacements in ${files} files${dry ? " (dry run)" : ""}`);
