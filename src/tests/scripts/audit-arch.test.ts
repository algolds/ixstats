import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  walk,
  lineCount,
  ceilingFor,
  computeOffenders,
  updateBaseline,
  bootstrapBaseline,
  checkSizes,
  sortBaseline,
  isScannedFile,
  SCANNED_ROOTS,
} from "../../../scripts/audit/audit-arch";

describe("Plan 154: Architecture Size Ratchet & Active-Source Discovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-arch-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("File discovery and exclusions", () => {
    it("identifies valid .ts and .tsx files and filters tests and declarations", () => {
      expect(isScannedFile("component.tsx")).toBe(true);
      expect(isScannedFile("service.ts")).toBe(true);
      expect(isScannedFile("service.test.ts")).toBe(false);
      expect(isScannedFile("component.test.tsx")).toBe(false);
      expect(isScannedFile("types.d.ts")).toBe(false);
      expect(isScannedFile("service.spec.ts")).toBe(false);
    });

    it("walks directories correctly and ignores test directories", () => {
      const appDir = path.join(tempDir, "src/app");
      const testDir = path.join(appDir, "__tests__");
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(appDir, "page.tsx"), "line1\nline2\n");
      fs.writeFileSync(path.join(testDir, "page.test.tsx"), "line1\nline2\n");

      const files = walk("src/app", tempDir);
      expect(files).toEqual(["src/app/page.tsx"]);
    });
  });

  describe("Ceilings and line counting", () => {
    it("applies correct ceiling per directory category", () => {
      expect(ceilingFor("src/server/api/routers/user.ts")).toBe(700);
      expect(ceilingFor("src/app/dashboard/page.tsx")).toBe(700);
      expect(ceilingFor("src/components/Button.tsx")).toBe(700);
      expect(ceilingFor("src/hooks/useData.ts")).toBe(500);
      expect(ceilingFor("src/types/ixstats.ts")).toBe(900);
    });

    it("counts lines accurately with newline semantics", () => {
      const filePath = path.join(tempDir, "test.ts");
      fs.writeFileSync(filePath, "a\nb\nc\n");
      expect(lineCount("test.ts", tempDir)).toBe(3);
    });
  });

  describe("Deterministic baseline sorting", () => {
    it("sorts by descending lines, then alphabetically by path", () => {
      const input = {
        "src/app/b.tsx": 800,
        "src/app/a.tsx": 800,
        "src/app/c.tsx": 900,
      };
      const sorted = sortBaseline(input);
      expect(Object.keys(sorted)).toEqual([
        "src/app/c.tsx",
        "src/app/a.tsx",
        "src/app/b.tsx",
      ]);
    });
  });

  describe("Baseline ratchet & update lifecycle", () => {
    it("detects new and grown god files in checkSizes", () => {
      const routerDir = path.join(tempDir, "src/server/api/routers");
      fs.mkdirSync(routerDir, { recursive: true });

      // Create a file with 750 lines (over 700 ceiling)
      const content750 = "line\n".repeat(750);
      fs.writeFileSync(path.join(routerDir, "routerA.ts"), content750);

      const baselinePath = "baseline.json";
      fs.writeFileSync(
        path.join(tempDir, baselinePath),
        JSON.stringify({ "src/server/api/routers/routerA.ts": 720 }, null, 2)
      );

      const errors = checkSizes(tempDir, baselinePath);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GROWN past baseline");
    });

    it("ratchets down when a file shrinks and removes entries when compliant", () => {
      const routerDir = path.join(tempDir, "src/server/api/routers");
      fs.mkdirSync(routerDir, { recursive: true });

      // File A shrank from 780 to 740
      fs.writeFileSync(path.join(routerDir, "fileA.ts"), "line\n".repeat(740));
      // File B shrank below 700 ceiling (650 lines)
      fs.writeFileSync(path.join(routerDir, "fileB.ts"), "line\n".repeat(650));

      const baselinePath = "baseline.json";
      fs.writeFileSync(
        path.join(tempDir, baselinePath),
        JSON.stringify(
          {
            "src/server/api/routers/fileA.ts": 780,
            "src/server/api/routers/fileB.ts": 750,
          },
          null,
          2
        )
      );

      updateBaseline(tempDir, baselinePath);

      const updated = JSON.parse(
        fs.readFileSync(path.join(tempDir, baselinePath), "utf8")
      );
      expect(updated["src/server/api/routers/fileA.ts"]).toBe(740);
      expect(updated["src/server/api/routers/fileB.ts"]).toBeUndefined();
    });

    it("bootstraps newly covered roots deterministically", () => {
      const appDir = path.join(tempDir, "src/app");
      const hooksDir = path.join(tempDir, "src/hooks");
      fs.mkdirSync(appDir, { recursive: true });
      fs.mkdirSync(hooksDir, { recursive: true });

      fs.writeFileSync(path.join(appDir, "AppMonolith.tsx"), "line\n".repeat(750));
      fs.writeFileSync(path.join(hooksDir, "useHugeHook.ts"), "line\n".repeat(550));

      const baselinePath = "baseline.json";
      bootstrapBaseline(tempDir, baselinePath, { force: true });

      const bootstrapped = JSON.parse(
        fs.readFileSync(path.join(tempDir, baselinePath), "utf8")
      );
      expect(bootstrapped["src/app/AppMonolith.tsx"]).toBe(750);
      expect(bootstrapped["src/hooks/useHugeHook.ts"]).toBe(550);
    });
  });
});
