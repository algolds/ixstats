/** @jest-environment node */
/**
 * The verification runners never mask a failure: a failing typecheck exits nonzero, nothing pipes to tee, CI runs
 * lint:strict and each typecheck stage, the build does not ignore type errors, the Jest quarantine only shrinks and
 * matches exactly the files it names, an entrypoint that parses again leaves the quarantine, and the perf:atlas
 * verdict never passes a measurement it did not take.
 *
 * Folds test-quarantine and the verdict cases of atlas-bench-report and atlas-bench-worldgen.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { atMost, exitCode, info } from "../../../scripts/perf/atlas-bench-report";
import { evaluate } from "../../../scripts/verification/check-entrypoints";
import {
  findGrowth,
  loadQuarantine,
  QUARANTINE_PATH,
  toIgnorePattern,
  validateQuarantine,
  type QuarantineEntry,
  type QuarantineFile,
} from "../../../scripts/verification/run-jest-with-quarantine";

describe("verification-gates", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const fixturesDir = path.resolve(rootDir, "scripts/verification/fixtures");
  const runTypecheckScript = path.resolve(rootDir, "scripts/verification/run-typecheck.ts");

  describe("run-typecheck.ts", () => {
    it("exits nonzero and reports diagnostic on a failing TypeScript project fixture", () => {
      const tsconfigFail = path.resolve(fixturesDir, "tsconfig-fail.json");
      const result = spawnSync("bun", [runTypecheckScript, tsconfigFail], {
        cwd: rootDir,
        encoding: "utf-8",
      });

      expect(result.status).not.toBe(0);
      const combinedOutput = `${result.stdout || ""} ${result.stderr || ""}`;
      expect(combinedOutput).toMatch(/fail\.ts/);
      expect(combinedOutput).toMatch(/TS2322|Type 'string' is not assignable to type 'number'/);
    });

    it("exits nonzero with an actionable error when tsconfig is missing or invalid", () => {
      const result = spawnSync("bun", [runTypecheckScript, "nonexistent-config.json"], {
        cwd: rootDir,
        encoding: "utf-8",
      });

      expect(result.status).not.toBe(0);
      const combinedOutput = `${result.stdout || ""} ${result.stderr || ""}`;
      expect(combinedOutput).toMatch(/Project tsconfig not found/);
    });
  });
  describe("package.json verification scripts", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, "package.json"), "utf-8"));

    it("does not pipe typecheck scripts to tee or mask errors", () => {
      const scripts = pkg.scripts || {};
      for (const [name, cmd] of Object.entries(scripts)) {
        if (name.startsWith("typecheck")) {
          expect(cmd).not.toMatch(/\|\s*tee/);
        }
      }
    });
  });

  describe("CI configuration (.github/workflows/ci.yml)", () => {
    const ciContent = fs.readFileSync(path.resolve(rootDir, ".github/workflows/ci.yml"), "utf-8");

    it("runs on the three promotion branches and retains pull_request", () => {
      expect(ciContent).toMatch(/pull_request:/);
      const branches = /branches:\s*\[([^\]]*)\]/.exec(ciContent)?.[1] ?? "";
      for (const branch of ["master", "development", "rose-garden"]) {
        expect(branches).toContain(branch);
      }
    });

    it("uses bun run lint:strict and not masking bun run lint", () => {
      expect(ciContent).toMatch(/bun run lint:strict/);
      expect(ciContent).not.toMatch(/run:\s*bun run lint(?:\s|$)/);
    });

    it("includes separate typecheck stages for UI, server, and tRPC", () => {
      expect(ciContent).toMatch(/typecheck:ui/i);
      expect(ciContent).toMatch(/typecheck:server/i);
      expect(ciContent).toMatch(/typecheck:trpc/i);
    });
  });

  // next.config.js is git-ignored (each environment keeps its own copy), so this gate checks
  // the local copy where one exists and the committed template (next.config.example.js) in CI.
  const localNextConfig = path.resolve(rootDir, "next.config.js");
  const nextConfigPath = fs.existsSync(localNextConfig)
    ? localNextConfig
    : path.resolve(rootDir, "next.config.example.js");
  const describeWithNextConfig = fs.existsSync(nextConfigPath) ? describe : describe.skip;

  describeWithNextConfig("Next.js build configuration (next.config.js)", () => {
    const nextConfigContent = fs.existsSync(nextConfigPath)
      ? fs.readFileSync(nextConfigPath, "utf-8")
      : "";

    it("does not ignore TypeScript build errors (ignoreBuildErrors: false)", () => {
      expect(nextConfigContent).toMatch(/ignoreBuildErrors:\s*false/);
      expect(nextConfigContent).not.toMatch(/ignoreBuildErrors:\s*true/);
    });
  });
});

const rootDir = path.resolve(__dirname, "../../..");
const thisFile = path.relative(rootDir, __filename);

function entry(entryPath: string, owner = "plan 326"): QuarantineEntry {
  return { path: entryPath, reason: "pre-existing failure", owner };
}

function quarantine(tests: QuarantineEntry[], entrypoints: QuarantineEntry[] = []): QuarantineFile {
  return { ceiling: tests.length, tests, entrypoints };
}

describe("run-jest-with-quarantine", () => {
  it("flags a ceiling that does not match the number of tests", () => {
    const q = { ...quarantine([entry(thisFile)]), ceiling: 2 };
    expect(validateQuarantine(q, rootDir)).toEqual([
      "ceiling is 2 but tests has 1 entries; they must match",
    ]);
  });

  it("flags a path that does not exist on disk", () => {
    const q = quarantine([entry("src/tests/does-not-exist.test.ts")]);
    expect(validateQuarantine(q, rootDir)).toEqual([
      "path does not exist: src/tests/does-not-exist.test.ts",
    ]);
  });

  it("accepts the checked-in test-quarantine.json", () => {
    const q = loadQuarantine(path.join(rootDir, QUARANTINE_PATH));
    expect(validateQuarantine(q, rootDir)).toEqual([]);
  });

  it("refuses a path added relative to the base: the quarantine may only shrink", () => {
    const base = quarantine([entry("a.test.ts")]);
    const current = quarantine([entry("a.test.ts"), entry("b.test.ts")]);
    expect(findGrowth(current, base)).toEqual([
      "b.test.ts is not quarantined on the base branch; the quarantine may only shrink",
    ]);
  });

  it("ignores only the quarantined file, not a sibling with a longer name", () => {
    const pattern = new RegExp(toIgnorePattern("src/a.test.ts").replace("<rootDir>", "/repo"));
    expect(pattern.test("/repo/src/a.test.ts")).toBe(true);
    expect(pattern.test("/repo/src/a.test.tsx")).toBe(false);
    expect(pattern.test("/repo/src/aXtest.ts")).toBe(false);
  });
});

describe("check-entrypoints", () => {
  const knownBroken = new Map([["server.mjs", "plan 330"]]);

  it("errors when an unlisted entrypoint fails to parse", () => {
    const result = evaluate(
      [{ file: "cron-runner.mjs", ok: false, output: "SyntaxError" }],
      knownBroken
    );
    expect(result.errors).toEqual(["cron-runner.mjs fails node --check:\nSyntaxError"]);
    expect(result.warnings).toEqual([]);
  });

  it("errors when a quarantined entrypoint parses again", () => {
    const result = evaluate([{ file: "server.mjs", ok: true, output: "" }], knownBroken);
    expect(result).toEqual({
      errors: ["server.mjs now parses — remove it from test-quarantine.json entrypoints"],
      warnings: [],
    });
  });

  it("the real check passes against the checked-in quarantine", () => {
    const script = path.join(rootDir, "scripts/verification/check-entrypoints.ts");
    const result = spawnSync("bun", [script], { cwd: rootDir, encoding: "utf-8" });
    expect(result.status).toBe(0);
  });
});

describe("the perf:atlas verdict", () => {
  it("never passes a value that was not measured", () => {
    expect(atMost("a", 50, 50, "ms").pass).toBe(true);
    expect(atMost("a", 50.01, 50, "ms").pass).toBe(false);
    expect(atMost("a", Number.NaN, 50, "ms").pass).toBe(false);
    expect(atMost("a", Number.POSITIVE_INFINITY, 50, "ms").pass).toBe(false);
  });

  it("exits 1 when any target fails or nothing was measured, and an informational line never decides it", () => {
    const pass = atMost("p", 1, 2, "ms");
    expect(exitCode([pass, atMost("f", 3, 2, "ms"), pass])).toBe(1);
    expect(exitCode([])).toBe(1);
    expect(exitCode([pass, info("slowest frame", 900, "ms")])).toBe(0);
    expect(exitCode([info("slowest frame", 1, "ms")])).toBe(1);
  });
});
