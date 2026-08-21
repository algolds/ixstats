import * as path from "path";
import {
  analyzeRouterImports,
  routerGroup,
  resolveModuleTarget,
} from "../../../scripts/audit/audit-arch";

describe("Plan 153: AST-Backed Router Import Boundary Guard", () => {
  const fixturesRoot = path.resolve(__dirname, "../fixtures/audit-arch/imports");

  describe("routerGroup", () => {
    it("extracts group name from nested router paths", () => {
      expect(routerGroup("src/server/api/routers/intelligence/alerts/thresholds.ts")).toBe(
        "intelligence"
      );
      expect(routerGroup("src/server/api/routers/economics/fiscal.ts")).toBe("economics");
    });

    it("extracts file stem from flat router paths", () => {
      expect(routerGroup("src/server/api/routers/intent.ts")).toBe("intent");
      expect(routerGroup("src/server/api/routers/atomicGovernment.ts")).toBe("atomicGovernment");
    });

    it("returns null for paths outside the routers directory", () => {
      expect(routerGroup("src/server/shared/country-authorization.ts")).toBeNull();
      expect(routerGroup("src/server/db.ts")).toBeNull();
    });
  });

  describe("resolveModuleTarget", () => {
    const importerAbs = path.join(
      fixturesRoot,
      "src/server/api/routers/groupB/index.ts"
    );

    it("resolves ~/ and @/ path aliases to src directory", () => {
      const resolvedTilde = resolveModuleTarget(
        importerAbs,
        "~/server/api/routers/groupA",
        fixturesRoot
      );
      expect(resolvedTilde).toBe(
        path.join(fixturesRoot, "src/server/api/routers/groupA/index.ts")
      );

      const resolvedAt = resolveModuleTarget(
        importerAbs,
        "@/server/api/routers/groupA",
        fixturesRoot
      );
      expect(resolvedAt).toBe(
        path.join(fixturesRoot, "src/server/api/routers/groupA/index.ts")
      );
    });

    it("resolves relative paths with extension or index", () => {
      const resolvedRel = resolveModuleTarget(
        importerAbs,
        "../groupA/helper",
        fixturesRoot
      );
      expect(resolvedRel).toBe(
        path.join(fixturesRoot, "src/server/api/routers/groupA/helper.ts")
      );
    });

    it("returns null for bare package imports", () => {
      expect(resolveModuleTarget(importerAbs, "node:fs", fixturesRoot)).toBeNull();
      expect(resolveModuleTarget(importerAbs, "zod", fixturesRoot)).toBeNull();
    });
  });

  describe("analyzeRouterImports on fixture tree", () => {
    it("detects all cross-router forms (alias, relative, dynamic, export, flat/grouped)", () => {
      const violations = analyzeRouterImports({
        rootDir: fixturesRoot,
        routersRelDir: "src/server/api/routers",
      });

      // Expected violations breakdown:
      // groupB/index.ts:
      //  1. ~/server/api/routers/groupA (import)
      //  2. @/server/api/routers/groupA (import)
      //  3. ../groupA (import)
      //  4. ../flatB (export)
      //  5. ../groupA/helper (dynamic-import)
      // flatA.ts:
      //  6. ~/server/api/routers/groupA (import)
      //  7. ./flatB (import)
      //  8. ~/server/api/routers/groupB (import)

      expect(violations).toHaveLength(8);

      const groupBViolations = violations.filter((v) =>
        v.importer.endsWith("groupB/index.ts")
      );
      expect(groupBViolations).toHaveLength(5);
      expect(groupBViolations.map((v) => v.kind)).toEqual([
        "import",
        "import",
        "import",
        "export",
        "dynamic-import",
      ]);

      const flatAViolations = violations.filter((v) =>
        v.importer.endsWith("flatA.ts")
      );
      expect(flatAViolations).toHaveLength(3);
      expect(flatAViolations.map((v) => v.kind)).toEqual([
        "import",
        "import",
        "import",
      ]);

      // groupA and flatB should have 0 violations
      const groupAViolations = violations.filter((v) =>
        v.importer.includes("groupA")
      );
      expect(groupAViolations).toHaveLength(0);

      const flatBViolations = violations.filter((v) =>
        v.importer.endsWith("flatB.ts")
      );
      expect(flatBViolations).toHaveLength(0);
    });

    it("ignores comments and arbitrary strings containing import-like text", () => {
      const violations = analyzeRouterImports({
        rootDir: fixturesRoot,
        routersRelDir: "src/server/api/routers",
      });

      const groupAViolations = violations.filter((v) =>
        v.importer.includes("groupA/index.ts")
      );
      expect(groupAViolations).toHaveLength(0);
    });
  });
});
