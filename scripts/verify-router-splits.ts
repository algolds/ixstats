#!/usr/bin/env bun

/**
 * scripts/verify-router-splits.ts — AST parity check for a tRPC router split into a `mergeRouters` directory.
 *
 * Reads the monolith router as it was before the split (a git ref and path, or a file on disk) and the split files,
 * collects every procedure in each `createTRPCRouter({ … })` call (ts-morph), formats each procedure's body with
 * Prettier so layout alone never counts, and compares the two sides key by key. It fails on a procedure missing from
 * the split, an extra one, one defined twice across the split files, or a body that changed.
 *
 * Usage:
 *   bun scripts/verify-router-splits.ts <before> <after> [<after> …]
 *
 *   <before>  `<git ref>:<path>` of the monolith (`e55f9254c^:src/server/api/routers/intent.ts`), or a file path.
 *   <after>   the split directory (every `.ts` under it, tests left out), its `index.ts` (read as its directory),
 *             or the split files one by one.
 *
 *   bun scripts/verify-router-splits.ts e55f9254c^:src/server/api/routers/intent.ts src/server/api/routers/intent
 *   bun scripts/verify-router-splits.ts e55f9254c^:src/server/api/routers/security/conflicts.ts \
 *     src/server/api/routers/security/conflicts/index.ts
 *
 * Exit codes: 0 when every key and body matches, 1 on any difference, 2 on bad arguments or a side with no
 * `createTRPCRouter` procedures. Module-level helpers the procedures call are not compared; review those in the diff.
 * Reads only: it never writes a file.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as estreePlugin from "prettier/plugins/estree";
import * as typescriptPlugin from "prettier/plugins/typescript";
import { format } from "prettier/standalone";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

/** A procedure's key and its body as written. */
export interface Procedure {
  key: string;
  body: string;
}

export interface SplitComparison {
  missing: string[];
  extra: string[];
  duplicated: string[];
  changed: string[];
  matched: number;
  total: number;
}

const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });

function keyOf(property: Node): string {
  if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
    const name = property.getNameNode();
    return Node.isStringLiteral(name) ? name.getLiteralText() : name.getText();
  }
  throw new Error(`unsupported router member: ${property.getText().slice(0, 60)}`);
}

/** A shorthand member (`{ getFoo }`) reads its body from the file's `const getFoo = …`. */
function bodyOf(property: Node, sf: SourceFile): string {
  if (Node.isPropertyAssignment(property)) return property.getInitializerOrThrow().getText();
  const name = keyOf(property);
  const declaration = sf.getVariableDeclaration(name);
  if (!declaration) throw new Error(`shorthand member ${name} has no const in ${sf.getFilePath()}`);
  return declaration.getInitializerOrThrow().getText();
}

/** Every procedure in the `createTRPCRouter({ … })` calls of `text`, in source order. */
export function proceduresIn(fileName: string, text: string): Procedure[] {
  const sf = project.createSourceFile(`/${fileName}`, text, { overwrite: true });
  const found: Procedure[] = [];
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== "createTRPCRouter") continue;
    const routes = call.getArguments()[0];
    if (!routes || !Node.isObjectLiteralExpression(routes)) continue;
    for (const property of routes.getProperties()) {
      found.push({ key: keyOf(property), body: bodyOf(property, sf) });
    }
  }
  return found;
}

/** The body as Prettier writes it, so whitespace, quotes and trailing commas never count as a change. */
export async function normalise(body: string): Promise<string> {
  const formatted = await format(`const procedure = ${body};\n`, {
    parser: "typescript",
    plugins: [estreePlugin, typescriptPlugin],
  });
  return formatted.trim();
}

async function normalisedMap(
  procedures: Procedure[],
  duplicated: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const { key, body } of procedures) {
    if (map.has(key)) duplicated.push(key);
    map.set(key, await normalise(body));
  }
  return map;
}

/** Compares the monolith's procedures with the split's, key by key and body by body. */
export async function compareSplit(
  before: Procedure[],
  after: Procedure[]
): Promise<SplitComparison> {
  const duplicated: string[] = [];
  const original = await normalisedMap(before, duplicated);
  const split = await normalisedMap(after, duplicated);
  const missing = [...original.keys()].filter((key) => !split.has(key));
  const extra = [...split.keys()].filter((key) => !original.has(key));
  const changed = [...original.keys()].filter(
    (key) => split.has(key) && split.get(key) !== original.get(key)
  );
  const matched = original.size - missing.length - changed.length;
  return { missing, extra, duplicated, changed, matched, total: original.size };
}

export function isClean(result: SplitComparison): boolean {
  return [result.missing, result.extra, result.duplicated, result.changed].every(
    (list) => list.length === 0
  );
}

/** `<ref>:<path>` reads the file at that git ref; anything else is a path on disk. */
function readBefore(spec: string): { name: string; text: string } {
  if (fs.existsSync(spec)) return { name: spec, text: fs.readFileSync(spec, "utf8") };
  const colon = spec.indexOf(":");
  if (colon <= 0) throw new Error(`${spec} is neither a file nor <git ref>:<path>`);
  const text = execFileSync("git", ["show", spec], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { name: spec.slice(colon + 1), text };
}

function tsFilesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return tsFilesUnder(full);
      const isSource = entry.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(entry.name);
      return isSource ? [full] : [];
    })
    .sort();
}

/** The split files: a directory's `.ts` files, an `index.ts`'s directory, or the files as given. */
export function splitFiles(specs: string[]): string[] {
  return specs.flatMap((spec) => {
    if (fs.statSync(spec).isDirectory()) return tsFilesUnder(spec);
    return path.basename(spec) === "index.ts" ? tsFilesUnder(path.dirname(spec)) : [spec];
  });
}

function report(label: string, keys: string[]): void {
  if (keys.length > 0) console.log(`  ${label}: ${keys.join(", ")}`);
}

export async function runCLI(args: string[]): Promise<number> {
  const [beforeSpec, ...afterSpecs] = args;
  if (!beforeSpec || afterSpecs.length === 0) {
    console.error(
      "usage: bun scripts/verify-router-splits.ts <ref>:<monolith.ts> <split dir | index.ts | files…>"
    );
    return 2;
  }
  const before = readBefore(beforeSpec);
  const files = splitFiles(afterSpecs);
  const original = proceduresIn(before.name, before.text);
  const split = files.flatMap((file) => proceduresIn(file, fs.readFileSync(file, "utf8")));
  if (original.length === 0 || split.length === 0) {
    console.error(
      `no createTRPCRouter procedures in ${original.length === 0 ? beforeSpec : afterSpecs.join(" ")}`
    );
    return 2;
  }
  const result = await compareSplit(original, split);
  console.log(
    `${before.name} → ${files.length} files: ${result.matched}/${result.total} procedures match`
  );
  report("missing from the split", result.missing);
  report("extra in the split", result.extra);
  report("defined twice", result.duplicated);
  report("body changed", result.changed);
  return isClean(result) ? 0 : 1;
}

if (import.meta.main) {
  runCLI(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: Error) => {
      console.error(`[verify-router-splits] failed: ${error.message}`);
      process.exitCode = 2;
    });
}
