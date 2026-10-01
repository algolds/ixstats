/** @jest-environment node */
/** Plan 403: the audit finds non-canonical rows and writes the SQL that fixes them. */
import { auditTitles, renderFixSql, type AuditRow } from "~/lib/wiki-os/core/title-audit";

let next = 0;
const row = (title: string, overrides: Partial<AuditRow> = {}): AuditRow => ({
  id: `id${++next}`,
  source: "ixwiki",
  title,
  slug: title.toLowerCase().replace(/ /g, "_"),
  namespace: 0,
  namespacePrefix: null,
  ...overrides,
});

describe("auditTitles", () => {
  it("leaves a canonical row alone", () => {
    const audit = auditTitles([row("Foo bar"), row("NATO"), row("Nato")]);

    expect(audit).toMatchObject({ scanned: 3, invalid: [], collisions: [], fixes: [] });
  });

  it("renames a non-canonical row whose canonical title is free", () => {
    const old = row("foo_bar");
    const audit = auditTitles([old]);

    expect(audit.fixes).toEqual([
      { row: old, title: "Foo bar", slug: "foo_bar", namespace: 0, namespacePrefix: null },
    ]);
    expect(audit.nonCanonical).toHaveLength(1);
  });

  it("fixes a canonical row's wrong namespace, prefix and slug without renaming it", () => {
    const talk = row("Talk:Foo", { slug: "Talk:Foo", namespace: 0, namespacePrefix: null });
    const audit = auditTitles([talk]);

    expect(audit.misplaced).toHaveLength(1);
    expect(audit.fixes).toEqual([
      { row: talk, title: "Talk:Foo", slug: "talk:foo", namespace: 1, namespacePrefix: "Talk" },
    ]);
  });

  it("keeps MediaWiki's namespace for a prefix the table does not know", () => {
    const portal = row("Portal:Eurth", { namespace: 100, namespacePrefix: "Portal" });

    expect(auditTitles([portal]).fixes).toEqual([]);
  });

  it("does not canonicalize another wiki's rows with IxWiki's namespaces", () => {
    const foreign = row("Project:Foo", { source: "iiwiki" });

    expect(auditTitles([foreign]).fixes).toEqual([]);
    expect(auditTitles([row("project:foo", { source: "iiwiki" })]).fixes[0]).toMatchObject({
      title: "Project:foo",
      namespace: 0,
    });
  });

  it("lists rows that collide instead of renaming them", () => {
    const lower = row("foo bar");
    const upper = row("Foo bar");
    const underscored = row("foo_bar");
    const audit = auditTitles([lower, upper, underscored]);

    expect(audit.collisions).toEqual([
      { source: "ixwiki", title: "Foo bar", rows: [lower, upper, underscored] },
    ]);
    expect(audit.fixes).toEqual([]);
  });

  it("still fixes a colliding group's canonical row when only its slug is wrong", () => {
    const canonical = row("Foo bar", { slug: "foo bar" });
    const lower = row("foo bar");
    const audit = auditTitles([canonical, lower]);

    expect(audit.collisions).toHaveLength(1);
    expect(audit.fixes.map((f) => f.row)).toEqual([canonical]);
  });

  it("keeps the same title in two wikis apart", () => {
    const audit = auditTitles([row("foo bar"), row("foo bar", { source: "iiwiki" })]);

    expect(audit.collisions).toEqual([]);
    expect(audit.fixes).toHaveLength(2);
  });

  it("reports a title MediaWiki would refuse as invalid, never as a fix", () => {
    const bad = row("a[b");
    const audit = auditTitles([bad]);

    expect(audit.invalid).toEqual([bad]);
    expect(audit.fixes).toEqual([]);
  });
});

describe("renderFixSql", () => {
  it("writes a guarded UPDATE for a rename and for a field-only fix", () => {
    const sql = renderFixSql(
      auditTitles([row("foo_bar", { id: "r1" }), row("Talk:Foo", { id: "r2", slug: "Talk:Foo" })]),
      "test"
    );

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("SET standard_conforming_strings = on;");
    expect(sql).toContain(
      `UPDATE wiki_articles SET title = 'Foo bar', slug = 'foo_bar', namespace = 0, "namespacePrefix" = NULL\n` +
        ` WHERE id = 'r1' AND title = 'foo_bar'\n` +
        `   AND NOT EXISTS (SELECT 1 FROM wiki_articles o WHERE o.source = 'ixwiki' AND o.title = 'Foo bar');`
    );
    expect(sql).toContain(
      `UPDATE wiki_articles SET title = 'Talk:Foo', slug = 'talk:foo', namespace = 1, "namespacePrefix" = 'Talk'\n` +
        ` WHERE id = 'r2' AND title = 'Talk:Foo';`
    );
  });

  it("doubles quotes in literals", () => {
    const sql = renderFixSql(auditTitles([row("d'arc_x", { id: "q'1" })]), "test");

    expect(sql).toContain("title = 'D''arc x'");
    expect(sql).toContain("WHERE id = 'q''1' AND title = 'd''arc_x'");
  });

  it("lists collisions and invalid titles as comments that cannot break out of the comment", () => {
    const sql = renderFixSql(
      auditTitles([
        row("foo bar", { id: "c1" }),
        row("Foo bar", { id: "c2" }),
        row("a[b\nDROP TABLE wiki_articles;--", { id: "bad" }),
      ]),
      "test"
    );

    expect(sql).toContain('-- [ixwiki] "Foo bar": "foo bar" (c1), "Foo bar" (c2)');
    expect(sql).toContain('-- [ixwiki] "a[b\\nDROP TABLE wiki_articles;--" (bad)');
    for (const line of sql.split("\n")) {
      expect(line === "" || /^(--|SET |BEGIN;|COMMIT;|UPDATE |\s)/.test(line)).toBe(true);
    }
    expect(sql).not.toMatch(/UPDATE wiki_articles SET title = 'Foo bar'/);
  });

  it("is an empty transaction when nothing needs fixing", () => {
    const sql = renderFixSql(auditTitles([row("Foo")]), "test");

    expect(sql).toContain("0 statement(s)");
    expect(sql).not.toContain("UPDATE");
  });
});
