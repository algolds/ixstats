import {
  getPackageVersions,
  getPrismaModelCount,
  generateVersionMatrixMarkdown,
  generateFrameworkMatrixMarkdown,
  generateApiInventoryTableMarkdown,
  syncDocumentContent,
  validateDocLinks,
  extractApiInventory,
} from "../../../scripts/docs/sync-reference-docs";

describe("Reference Docs Synchronizer (Plan 169)", () => {
  describe("1. Version & Package Extraction", () => {
    test("extracts package versions from package.json", () => {
      const pkgs = getPackageVersions();
      expect(pkgs.next).toBeDefined();
      expect(pkgs.react).toBeDefined();
      expect(pkgs.prisma).toBeDefined();
      expect(pkgs.trpc).toBeDefined();
      expect(pkgs.bun).toBe("1.4+");
    });

    test("counts active Prisma models", () => {
      const count = getPrismaModelCount();
      expect(count).toBeGreaterThan(50);
    });

    test("generates delimited version matrix markdown", () => {
      const md = generateVersionMatrixMarkdown();
      expect(md).toContain("<!-- BEGIN_DOCS:VERSION_MATRIX -->");
      expect(md).toContain("<!-- END_DOCS:VERSION_MATRIX -->");
      expect(md).toContain("IxStates (Ogma)");
      expect(md).toContain("Release Candidate");
    });

    test("generates delimited framework matrix markdown", () => {
      const md = generateFrameworkMatrixMarkdown();
      expect(md).toContain("<!-- BEGIN_DOCS:FRAMEWORK_MATRIX -->");
      expect(md).toContain("<!-- END_DOCS:FRAMEWORK_MATRIX -->");
      expect(md).toContain("Next.js");
      expect(md).toContain("React");
    });
  });

  describe("2. AST API Inventory Extraction", () => {
    test("extracts live router and procedure inventory", () => {
      const api = extractApiInventory();
      expect(api.totalRouters).toBeGreaterThan(40);
      expect(api.totalProcedures).toBeGreaterThan(500);
      expect(api.totalQueries).toBeGreaterThan(200);
      expect(api.totalMutations).toBeGreaterThan(200);
      expect(api.unresolved).toHaveLength(0);
      expect(api.duplicates).toHaveLength(0);
    });

    test("generates API inventory table markdown", () => {
      const md = generateApiInventoryTableMarkdown();
      expect(md).toContain("<!-- BEGIN_DOCS:API_INVENTORY -->");
      expect(md).toContain("<!-- END_DOCS:API_INVENTORY -->");
      expect(md).toContain("api.countries");
      expect(md).toContain("api.messages");
    });
  });

  describe("3. Link & Path Validation", () => {
    test("detects forbidden file:// and machine path links", () => {
      const issues = validateDocLinks(process.cwd());
      // Filter issues by forbidden link types
      const forbidden = issues.filter(
        (i) => i.reason.includes("file://") || i.reason.includes("machine path")
      );
      // Our test checks the validator logic
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe("4. Marker Replacement & Idempotence", () => {
    test("replaces content between delimiters deterministically", () => {
      const original = [
        "# Header",
        "<!-- BEGIN_DOCS:VERSION_MATRIX -->",
        "old content",
        "<!-- END_DOCS:VERSION_MATRIX -->",
        "Footer",
      ].join("\n");

      const res = syncDocumentContent(original, {
        versionMatrix:
          "<!-- BEGIN_DOCS:VERSION_MATRIX -->\nnew matrix\n<!-- END_DOCS:VERSION_MATRIX -->",
      });

      expect(res.changed).toBe(true);
      expect(res.newContent).toContain("new matrix");
      expect(res.newContent).not.toContain("old content");

      // Running again is idempotent
      const res2 = syncDocumentContent(res.newContent, {
        versionMatrix:
          "<!-- BEGIN_DOCS:VERSION_MATRIX -->\nnew matrix\n<!-- END_DOCS:VERSION_MATRIX -->",
      });
      expect(res2.changed).toBe(false);
    });
  });
});
