import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runStrictStages, type VerificationStage } from "../../../scripts/verification/verify-strict";

describe("verification-gates", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const fixturesDir = path.resolve(rootDir, "scripts/verification/fixtures");
  const runTypecheckScript = path.resolve(rootDir, "scripts/verification/run-typecheck.ts");

  describe("run-typecheck.ts", () => {
    it("exits 0 on a passing TypeScript project fixture", () => {
      const tsconfigPass = path.resolve(fixturesDir, "tsconfig-pass.json");
      const result = spawnSync("bun", [runTypecheckScript, tsconfigPass], {
        cwd: rootDir,
        encoding: "utf-8",
      });

      expect(result.status).toBe(0);
    });

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

    it("mirrors output to an optional log file without changing child status", () => {
      const tempLogPath = path.join(
        os.tmpdir(),
        `test-typecheck-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`
      );

      try {
        const tsconfigPass = path.resolve(fixturesDir, "tsconfig-pass.json");
        const result = spawnSync(
          "bun",
          [runTypecheckScript, tsconfigPass, "--log", tempLogPath],
          {
            cwd: rootDir,
            encoding: "utf-8",
          }
        );

        expect(result.status).toBe(0);
        expect(fs.existsSync(tempLogPath)).toBe(true);
      } finally {
        if (fs.existsSync(tempLogPath)) {
          fs.unlinkSync(tempLogPath);
        }
      }
    });
  });

  describe("verify-strict orchestrator", () => {
    it("short-circuits on the first failing stage and preserves exit code", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const testStages: VerificationStage[] = [
        { name: "Stage 1 (Pass)", command: "bun", args: ["-e", "process.exit(0)"] },
        { name: "Stage 2 (Fail)", command: "bun", args: ["-e", "process.exit(42)"] },
        { name: "Stage 3 (Should Not Run)", command: "bun", args: ["-e", "process.exit(0)"] },
      ];

      const result = runStrictStages(testStages);

      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(42);
      expect(result.failedStage).toBe("Stage 2 (Fail)");
      expect(result.completedStages).toEqual(["Stage 1 (Pass)"]);

      logSpy.mockRestore();
      errSpy.mockRestore();
    });

    it("passes all stages and returns exit code 0 when all succeed", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const testStages: VerificationStage[] = [
        { name: "Stage 1 (Pass)", command: "bun", args: ["-e", "process.exit(0)"] },
        { name: "Stage 2 (Pass)", command: "bun", args: ["-e", "process.exit(0)"] },
      ];

      const result = runStrictStages(testStages);

      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.completedStages).toEqual(["Stage 1 (Pass)", "Stage 2 (Pass)"]);

      logSpy.mockRestore();
    });
  });

  describe("package.json verification scripts", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(rootDir, "package.json"), "utf-8")
    );

    it("does not pipe typecheck scripts to tee or mask errors", () => {
      const scripts = pkg.scripts || {};
      for (const [name, cmd] of Object.entries(scripts)) {
        if (name.startsWith("typecheck")) {
          expect(cmd).not.toMatch(/\|\s*tee/);
        }
      }
    });

    it("exposes verify:strict script", () => {
      expect(pkg.scripts["verify:strict"]).toBe("bun scripts/verification/verify-strict.ts");
    });
  });

  describe("CI configuration (.github/workflows/ci.yml)", () => {
    const ciContent = fs.readFileSync(
      path.resolve(rootDir, ".github/workflows/ci.yml"),
      "utf-8"
    );

    it("includes v2 branch in push triggers and retains pull_request", () => {
      expect(ciContent).toMatch(/pull_request:/);
      expect(ciContent).toMatch(/branches:.*v2/);
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

  describe("Next.js build configuration (next.config.js)", () => {
    const nextConfigContent = fs.readFileSync(
      path.resolve(rootDir, "next.config.js"),
      "utf-8"
    );

    it("does not ignore TypeScript build errors (ignoreBuildErrors: false)", () => {
      expect(nextConfigContent).toMatch(/ignoreBuildErrors:\s*false/);
      expect(nextConfigContent).not.toMatch(/ignoreBuildErrors:\s*true/);
    });
  });
});
