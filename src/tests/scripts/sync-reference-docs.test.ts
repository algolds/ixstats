import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  collectDocCounts,
  findUnknownCountKeys,
  githubSlug,
  listLinkCheckedDocs,
  matchesLinkCheckScope,
  parseMarkdown,
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
      expect(md).toContain("IxStates (Lobster Crosby)");
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

  describe("3. Link & Anchor Validation", () => {
    let root: string;
    const write = (rel: string, content: string) => {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
    };

    beforeAll(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-links-"));
      write(
        "docs/a.md",
        [
          "# Title",
          "",
          "## 3. Doc-audit items (PF§1–PF§7)",
          "## Phase 4 — Consolidate the set",
          "### The `api.vault` router",
          "## Repeat",
          "## Repeat",
          '<a id="custom-anchor"></a>',
          "",
          "Setext heading",
          "--------------",
          "",
          "- [ok file](b.md)",
          "- [ok anchor](b.md#second-section)",
          "- [self](#3-doc-audit-items-pf1pf7)",
          "- [dash](#phase-4--consolidate-the-set)",
          "- [code](#the-apivault-router)",
          "- [dup](#repeat-1)",
          "- [explicit](#custom-anchor)",
          "- [setext](#setext-heading)",
          "- [root](/docs/b.md)",
          "- [web](https://example.com/missing.md)",
          "- [bad file](missing.md)",
          "- [bad anchor](b.md#no-such-heading)",
          "- [bad self](#nope)",
          "- [machine](file:///home/me/x.md)",
          "",
          "`[inline](inline-code.md)`",
          "<!-- [comment](comment.md) -->",
          "```md",
          "[fenced](fenced.md)",
          "```",
          "",
          "[ref]: ref-missing.md",
        ].join("\n")
      );
      write("docs/b.md", "# B\n\n## Second section\n");
      write(
        "src/content/help/x.md",
        "---\ntitle: X\n---\n\n[route](/help/anything) [bad](../nope.md)\n"
      );
      write("src/foo/README.md", "# Foo\n");
      write("src/foo/notes.md", "# Notes\n");
      write("CHANGELOG.md", "# Changelog\n");
    });

    afterAll(() => {
      fs.rmSync(root, { recursive: true, force: true });
    });

    test("githubSlug follows GitHub heading rules", () => {
      expect(githubSlug("3. Doc-audit items (PF§1–PF§7)")).toBe("3-doc-audit-items-pf1pf7");
      expect(githubSlug("Phase 4 — Consolidate the set")).toBe("phase-4--consolidate-the-set");
      expect(githubSlug("The `api.vault` router")).toBe("the-apivault-router");
      expect(githubSlug("**Bold** and [link](x.md)")).toBe("bold-and-link");
      expect(githubSlug("snake_case name")).toBe("snake_case-name");
      expect(githubSlug("Café & bar")).toBe("café--bar");
    });

    test("parseMarkdown skips code, comments and front matter; numbers duplicate headings", () => {
      const parsed = parseMarkdown(fs.readFileSync(path.join(root, "docs/a.md"), "utf-8"));
      const targets = parsed.links.map((l) => l.target);
      expect(targets).not.toContain("inline-code.md");
      expect(targets).not.toContain("comment.md");
      expect(targets).not.toContain("fenced.md");
      expect(targets).toContain("ref-missing.md");
      expect(parsed.anchors.has("repeat")).toBe(true);
      expect(parsed.anchors.has("repeat-1")).toBe(true);
      expect(parsed.anchors.has("custom-anchor")).toBe(true);
    });

    test("reports missing files, missing anchors and machine links only", () => {
      const issues = validateDocLinks(root, ["docs/a.md", "src/content/help/x.md"]);
      const found = issues.map((i) => `${i.file} ${i.target}`).sort();
      expect(found).toEqual(
        [
          "docs/a.md #nope",
          "docs/a.md b.md#no-such-heading",
          "docs/a.md file:///home/me/x.md",
          "docs/a.md missing.md",
          "docs/a.md ref-missing.md",
          "src/content/help/x.md ../nope.md",
        ].sort()
      );
    });

    test("lists in-scope markdown by walking the tree outside git", () => {
      const docs = listLinkCheckedDocs(root);
      expect(docs).toEqual(
        expect.arrayContaining([
          "CHANGELOG.md",
          "docs/a.md",
          "docs/b.md",
          "src/content/help/x.md",
          "src/foo/README.md",
        ])
      );
      expect(docs).not.toContain("src/foo/notes.md");
      expect(matchesLinkCheckScope("scripts/audit/README.md")).toBe(true);
      expect(matchesLinkCheckScope("scripts/audit/notes.md")).toBe(false);
    });

    test("the repository's tracked markdown has no broken links", () => {
      expect(validateDocLinks(process.cwd())).toEqual([]);
    });
  });

  describe("3b. Generated counts", () => {
    test("collectDocCounts reads schema files, models, enums and migrations", () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-counts-"));
      try {
        fs.mkdirSync(path.join(root, "prisma/schema"), { recursive: true });
        fs.mkdirSync(path.join(root, "prisma/migrations/20250101_init"), { recursive: true });
        fs.writeFileSync(path.join(root, "prisma/migrations/loose.sql"), "");
        fs.writeFileSync(path.join(root, "prisma/migrations/migration_lock.toml"), "");
        fs.writeFileSync(
          path.join(root, "prisma/schema/a.prisma"),
          "model A {\n  id Int @id\n}\nmodel B {\n  id Int @id\n}\nenum E {\n  X\n}\n"
        );
        fs.writeFileSync(path.join(root, "prisma/schema/base.prisma"), "generator client {}\n");
        expect(collectDocCounts(root, { totalRouters: 3, totalProcedures: 1200 })).toEqual({
          routers: 3,
          procedures: 1200,
          schemaFiles: 2,
          models: 2,
          enums: 1,
          migrations: 2,
        });
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test("syncDocumentContent rewrites inline count markers and flags unknown keys", () => {
      const doc =
        "We have <!-- BEGIN_DOCS:COUNT:routers -->70<!-- END_DOCS:COUNT:routers --> routers, " +
        "<!-- BEGIN_DOCS:COUNT:procedures -->900<!-- END_DOCS:COUNT:procedures --> procedures and " +
        "<!-- BEGIN_DOCS:COUNT:widgets -->5<!-- END_DOCS:COUNT:widgets --> widgets.";
      const counts = { routers: 77, procedures: 1234 };
      const res = syncDocumentContent(doc, { counts });
      expect(res.changed).toBe(true);
      expect(res.newContent).toContain(
        "<!-- BEGIN_DOCS:COUNT:routers -->77<!-- END_DOCS:COUNT:routers --> routers"
      );
      expect(res.newContent).toContain(
        "<!-- BEGIN_DOCS:COUNT:procedures -->1,234<!-- END_DOCS:COUNT:procedures -->"
      );
      expect(res.newContent).toContain("<!-- BEGIN_DOCS:COUNT:widgets -->5<");
      expect(syncDocumentContent(res.newContent, { counts }).changed).toBe(false);
      expect(findUnknownCountKeys(doc, counts)).toEqual(["widgets"]);
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
