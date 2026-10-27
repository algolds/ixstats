/** @jest-environment node */
/**
 * Every script and entrypoint target resolves, and only bun runs them. check-script-imports maps each script file to
 * the package scripts that run it; validate-script-targets (Plan 343) refuses npm/npx/yarn/pnpm, a missing script or
 * tsconfig, and a workflow step naming an unknown package script; and every local dynamic import in the process
 * entrypoints (Plan 326) is a real file.
 *
 * Folds validate-script-targets and entrypoint-dynamic-imports.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  checkBannedPackageManagers,
  checkCommandTargets,
  validateScriptTargets,
  validateWorkflowFiles,
} from "../../../scripts/audit/validate-script-targets";
import {
  collectTargets,
  extractScriptTargets,
} from "../../../scripts/verification/check-script-imports";

const rootDir = path.resolve(__dirname, "../../..");

describe("check-script-imports target extraction", () => {
  it("finds scripts run with bun, tsx and node, and ignores package and shell scripts", () => {
    expect(extractScriptTargets("bun scripts/set-admin-role.ts")).toEqual([
      "scripts/set-admin-role.ts",
    ]);
    expect(extractScriptTargets("bunx tsx ./scripts/a.ts && node scripts/b.mjs")).toEqual([
      "scripts/a.ts",
      "scripts/b.mjs",
    ]);
    expect(extractScriptTargets("bun run db:generate && ./scripts/deploy.sh")).toEqual([]);
  });

  it("maps each file to the package scripts that run it", () => {
    const targets = collectTargets({
      "wiki:sync:full": "bun scripts/sync-ixwiki-full.ts",
      "wiki:sync:full:force": "bun scripts/sync-ixwiki-full.ts --force",
    });
    expect(targets.get("scripts/sync-ixwiki-full.ts")).toEqual([
      "wiki:sync:full",
      "wiki:sync:full:force",
    ]);
  });
});

describe("validate-script-targets", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "validate-targets-"));
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it.each(["npx @typescript/analyze-trace traces", "npm run build", "yarn install", "pnpm test"])(
    "refuses %s",
    (command) => {
      expect(checkBannedPackageManagers(command, "test")).toHaveLength(1);
    }
  );

  it("lets bun and bunx through", () => {
    expect(checkBannedPackageManagers("bun run build && bunx playwright", "test")).toHaveLength(0);
  });

  it("flags a missing script target or tsconfig, and passes existing ones", () => {
    expect(
      checkCommandTargets("./scripts/does-not-exist.sh", "test", "test-script", tmpDir)
    ).toMatchObject([{ type: "missing_target" }]);
    expect(
      checkCommandTargets("tsc -p tsconfig.missing.json", "test", "test-script", tmpDir)
    ).toMatchObject([{ type: "missing_config" }]);

    fs.mkdirSync(path.join(tmpDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "scripts", "exists.sh"), "#!/bin/bash");
    fs.writeFileSync(path.join(tmpDir, "tsconfig.test.json"), "{}");
    expect(checkCommandTargets("./scripts/exists.sh", "test", "test-script", tmpDir)).toEqual([]);
    expect(checkCommandTargets("tsc -p tsconfig.test.json", "test", "test-script", tmpDir)).toEqual(
      []
    );
  });

  it("flags a workflow step that runs an unknown package script", () => {
    fs.writeFileSync(
      path.join(tmpDir, "ci.yml"),
      `name: CI\njobs:\n  build:\n    steps:\n      - run: bun run test\n      - run: bun run unknown-cmd\n`
    );
    const issues = validateWorkflowFiles(tmpDir, new Set(["test", "build"]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: "unknown_script" });
    expect(issues[0]?.message).toContain("unknown-cmd");
  });

  it("passes on the repository: every package.json script points at a file that exists", () => {
    const result = validateScriptTargets();
    expect(result.issues.filter((i) => i.type === "missing_target")).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("entrypoint dynamic imports", () => {
  function extractSpecifiers(source: string): string[] {
    return [...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)]
      .map((match) => match[1]!)
      .filter((specifier) => specifier.startsWith("./") || specifier.startsWith("~/"));
  }

  function resolveSpecifier(specifier: string): string | null {
    const relPath = specifier.startsWith("~/") ? `src/${specifier.slice(2)}` : specifier.slice(2);
    const candidates = relPath.endsWith(".js")
      ? [".ts", ".tsx", ".js", ".mjs"].map((ext) => `${relPath.slice(0, -".js".length)}${ext}`)
      : [relPath, `${relPath}.ts`, `${relPath}.tsx`, `${relPath}/index.ts`, `${relPath}/index.tsx`];
    return (
      candidates.find((candidate) => {
        const file = path.join(rootDir, candidate);
        return fs.existsSync(file) && fs.statSync(file).isFile();
      }) ?? null
    );
  }

  it.each(["server.mjs", "cron-runner.mjs", "ws-backend.mjs"])(
    "every local dynamic import in %s resolves",
    (entrypoint) => {
      const source = fs.readFileSync(path.join(rootDir, entrypoint), "utf-8");
      const unresolved = [...new Set(extractSpecifiers(source))].filter(
        (specifier) => resolveSpecifier(specifier) === null
      );
      expect(unresolved).toEqual([]);
    }
  );

  it("reads the multi-line import form and skips bare packages", () => {
    expect(extractSpecifiers('await import(\n  "./src/a.js"\n)')).toEqual(["./src/a.js"]);
    expect(extractSpecifiers('await import("@prisma/client"); await import("~/lib/x")')).toEqual([
      "~/lib/x",
    ]);
  });
});
