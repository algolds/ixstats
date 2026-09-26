/** @jest-environment node */
import fs from "fs";
import path from "path";

// Plan 326: every local dynamic import in the process entrypoints must resolve to a real file.
// Quarantined (scripts/verification/test-quarantine.json) until plan 330 repairs the entrypoints.
const rootDir = path.resolve(__dirname, "../../..");

function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
    const specifier = match[1];
    if (specifier.startsWith("./") || specifier.startsWith("~/")) specifiers.push(specifier);
  }
  return specifiers;
}

function candidatePaths(specifier: string): string[] {
  const relPath = specifier.startsWith("~/") ? `src/${specifier.slice(2)}` : specifier.slice(2);
  if (relPath.endsWith(".js")) {
    const stem = relPath.slice(0, -".js".length);
    return [".ts", ".tsx", ".js", ".mjs"].map((ext) => `${stem}${ext}`);
  }
  return [
    relPath,
    `${relPath}.ts`,
    `${relPath}.tsx`,
    `${relPath}/index.ts`,
    `${relPath}/index.tsx`,
  ];
}

function isFile(file: string): boolean {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function resolveSpecifier(specifier: string): string | null {
  return (
    candidatePaths(specifier).find((candidate) => isFile(path.join(rootDir, candidate))) ?? null
  );
}

describe("entrypoint dynamic imports", () => {
  test.each(["server.mjs", "cron-runner.mjs", "ws-backend.mjs"])(
    "every local dynamic import in %s resolves",
    (entrypoint) => {
      const source = fs.readFileSync(path.join(rootDir, entrypoint), "utf-8");
      const unresolved = [...new Set(extractSpecifiers(source))].filter(
        (specifier) => resolveSpecifier(specifier) === null
      );
      expect(unresolved).toEqual([]);
    }
  );

  test("extractSpecifiers finds the multi-line import form and skips bare packages", () => {
    expect(extractSpecifiers('await import(\n  "./src/a.js"\n)')).toEqual(["./src/a.js"]);
    expect(extractSpecifiers('await import("@prisma/client"); await import("~/lib/x")')).toEqual([
      "~/lib/x",
    ]);
  });
});
