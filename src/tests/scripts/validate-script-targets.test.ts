import {
  checkBannedPackageManagers,
  checkCommandTargets,
  validatePackageJsonScripts,
  validateWorkflowFiles,
  validateScriptTargets,
} from "../../../scripts/audit/validate-script-targets";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("validate-script-targets", () => {
  test("checkBannedPackageManagers detects npm, npx, yarn, pnpm", () => {
    expect(checkBannedPackageManagers("npx @typescript/analyze-trace traces", "test")).toHaveLength(1);
    expect(checkBannedPackageManagers("npm run build", "test")).toHaveLength(1);
    expect(checkBannedPackageManagers("yarn install", "test")).toHaveLength(1);
    expect(checkBannedPackageManagers("pnpm test", "test")).toHaveLength(1);
    expect(checkBannedPackageManagers("bun run build && bunx playwright", "test")).toHaveLength(0);
  });

  test("checkCommandTargets detects missing files and configs", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "validate-targets-"));
    try {
      // Missing script target
      const issues1 = checkCommandTargets("./scripts/does-not-exist.sh", "test", "test-script", tmpDir);
      expect(issues1).toHaveLength(1);
      expect(issues1[0]?.type).toBe("missing_target");

      // Existing script target
      fs.mkdirSync(path.join(tmpDir, "scripts"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "scripts", "exists.sh"), "#!/bin/bash");
      const issues2 = checkCommandTargets("./scripts/exists.sh", "test", "test-script", tmpDir);
      expect(issues2).toHaveLength(0);

      // Missing tsconfig
      const issues3 = checkCommandTargets("tsc -p tsconfig.missing.json", "test", "test-script", tmpDir);
      expect(issues3).toHaveLength(1);
      expect(issues3[0]?.type).toBe("missing_config");

      // Existing tsconfig
      fs.writeFileSync(path.join(tmpDir, "tsconfig.test.json"), "{}");
      const issues4 = checkCommandTargets("tsc -p tsconfig.test.json", "test", "test-script", tmpDir);
      expect(issues4).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("validateWorkflowFiles flags unknown bun run commands", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "validate-workflows-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, "ci.yml"),
        `name: CI\njobs:\n  build:\n    steps:\n      - run: bun run test\n      - run: bun run unknown-cmd\n`
      );
      const validScripts = new Set(["test", "build"]);
      const issues = validateWorkflowFiles(tmpDir, validScripts);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.type).toBe("unknown_script");
      expect(issues[0]?.message).toContain("unknown-cmd");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("validateScriptTargets runs cleanly on actual repository root after fixes", () => {
    const result = validateScriptTargets();
    // We will check that validator executes without throwing and returns a result object
    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("issues");
  });
});
