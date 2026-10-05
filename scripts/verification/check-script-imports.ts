/**
 * Resolves the imports of every script that package.json runs. `validate:script-targets`
 * only checks that the entry file exists, so a script whose `src/` import moved still
 * passed CI and failed at run time. This bundles each entry with `Bun.build` (packages
 * external, nothing written, nothing executed) and fails on any unresolved import.
 *
 *   bun scripts/verification/check-script-imports.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const SCRIPT_TARGET =
  /(?:^|[\s;&|(])(?:bun|bunx tsx|tsx|node)\s+(?:run\s+)?(\.?\/?scripts\/[^\s;&|)]+\.(?:ts|mts|mjs|js))/g;

/** The `scripts/**` source files a package.json script command runs directly. */
export function extractScriptTargets(command: string): string[] {
  const targets: string[] = [];
  for (const match of command.matchAll(SCRIPT_TARGET)) {
    targets.push(match[1]!.replace(/^\.\//, ""));
  }
  return targets;
}

export function collectTargets(scripts: Record<string, string>): Map<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const [name, command] of Object.entries(scripts)) {
    for (const file of extractScriptTargets(command)) {
      byFile.set(file, [...(byFile.get(file) ?? []), name]);
    }
  }
  return byFile;
}

async function resolves(file: string, rootDir: string): Promise<string | null> {
  try {
    const result = await Bun.build({
      entrypoints: [path.join(rootDir, file)],
      target: "bun",
      packages: "external",
      throw: false,
    });
    if (result.success) return null;
    return result.logs.map((log) => String(log.message ?? log)).join("\n");
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function main(rootDir: string = process.cwd()): Promise<number> {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const targets = collectTargets(pkg.scripts ?? {});
  const failures: string[] = [];
  for (const [file, names] of targets) {
    if (!fs.existsSync(path.join(rootDir, file))) continue; // validate:script-targets reports these
    const error = await resolves(file, rootDir);
    if (error) failures.push(`${file} (used by ${names.join(", ")}):\n  ${error}`);
  }
  if (failures.length > 0) {
    console.error(`✗ ${failures.length} package script(s) have imports that do not resolve:\n`);
    for (const failure of failures) console.error(`• ${failure}\n`);
    return 1;
  }
  console.log(`✓ Imports resolve for all ${targets.size} package script entry files.`);
  return 0;
}

if (import.meta.main || process.argv[1]?.endsWith("check-script-imports.ts")) {
  void main().then((code) => process.exit(code));
}
