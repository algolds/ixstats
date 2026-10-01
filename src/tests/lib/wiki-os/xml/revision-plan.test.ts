/** @jest-environment node */
import {
  planRevisionImport,
  type ExistingRevisionRow,
  type ImportedRevision,
} from "~/lib/wiki-os/xml/revision-plan";

const at = (iso: string) => new Date(iso);

const dump = (overrides: Partial<ImportedRevision> = {}): ImportedRevision => ({
  mwRevId: 10,
  createdAt: at("2026-01-01T00:00:00Z"),
  author: "Jane",
  authorId: null,
  summary: null,
  minor: false,
  byteSize: 5,
  byteDelta: 5,
  sha1: "hash-a",
  wikitext: "hello",
  ...overrides,
});

const row = (overrides: Partial<ExistingRevisionRow> = {}): ExistingRevisionRow => ({
  id: "row-1",
  articleId: "a1",
  mwRevId: 10,
  sha1: "hash-a",
  createdAt: at("2026-01-01T00:00:00Z"),
  isPlaceholder: false,
  ...overrides,
});

describe("planRevisionImport", () => {
  it("inserts every revision of a page that does not exist yet", () => {
    const plan = planRevisionImport(null, [], [dump({ mwRevId: 1 }), dump({ mwRevId: 2 })]);

    expect(plan.inserts.map((r) => r.mwRevId)).toEqual([1, 2]);
    expect(plan).toMatchObject({ fills: [], stamps: [], skipped: 0, conflicts: 0 });
  });

  it("skips a revision the page already holds", () => {
    const plan = planRevisionImport("a1", [row()], [dump()]);

    expect(plan).toMatchObject({ inserts: [], fills: [], stamps: [], skipped: 1, conflicts: 0 });
  });

  it("fills an empty placeholder when the dump carries the text", () => {
    const revision = dump();
    const plan = planRevisionImport("a1", [row({ isPlaceholder: true })], [revision]);

    expect(plan.fills).toEqual([{ rowId: "row-1", revision }]);
    expect(plan.skipped).toBe(0);
  });

  it("leaves a placeholder alone when the dump has no text or an empty one", () => {
    const placeholder = row({ isPlaceholder: true });

    expect(planRevisionImport("a1", [placeholder], [dump({ wikitext: null })]).skipped).toBe(1);
    expect(planRevisionImport("a1", [placeholder], [dump({ wikitext: "" })]).skipped).toBe(1);
  });

  it("counts a rev id that belongs to another page as a conflict, inserting nothing", () => {
    const plan = planRevisionImport("a1", [row({ articleId: "other" })], [dump()]);

    expect(plan).toMatchObject({ inserts: [], skipped: 0, conflicts: 1 });
  });

  it("stamps the rev id on a WikiOS revision with the same hash in the same second", () => {
    const native = row({ id: "native", mwRevId: null, createdAt: at("2026-01-01T00:00:00.750Z") });

    const plan = planRevisionImport("a1", [native], [dump({ mwRevId: 77 })]);

    expect(plan.stamps).toEqual([{ rowId: "native", mwRevId: 77 }]);
    expect(plan).toMatchObject({ inserts: [], skipped: 1 });
  });

  it("does not match revisions of the same text a second apart, or with another hash", () => {
    const native = row({ mwRevId: null, createdAt: at("2026-01-01T00:00:01Z") });
    const other = row({ id: "other", mwRevId: null, sha1: "hash-b" });

    const plan = planRevisionImport("a1", [native, other], [dump({ mwRevId: 77 })]);

    expect(plan.inserts).toHaveLength(1);
    expect(plan.stamps).toEqual([]);
  });

  it("never treats two different MediaWiki revisions as twins", () => {
    const plan = planRevisionImport("a1", [row({ mwRevId: 11 })], [dump({ mwRevId: 12 })]);

    expect(plan.inserts).toHaveLength(1);
  });

  it("claims a twin once: two identical dump revisions do not both match one row", () => {
    const native = row({ id: "native", mwRevId: null });

    const plan = planRevisionImport("a1", [native], [dump({ mwRevId: 1 }), dump({ mwRevId: 2 })]);

    expect(plan.stamps).toEqual([{ rowId: "native", mwRevId: 1 }]);
    expect(plan.inserts.map((r) => r.mwRevId)).toEqual([2]);
  });

  it("skips a dump revision without an id that matches a stored row by hash and second", () => {
    const plan = planRevisionImport("a1", [row()], [dump({ mwRevId: null })]);

    expect(plan).toMatchObject({ inserts: [], stamps: [], skipped: 1 });
  });

  it("inserts a revision without id or hash, every time (nothing can identify it)", () => {
    const plan = planRevisionImport("a1", [row()], [dump({ mwRevId: null, sha1: null })]);

    expect(plan.inserts).toHaveLength(1);
  });

  it("skips a rev id repeated inside the dump instead of inserting it twice", () => {
    const plan = planRevisionImport("a1", [], [dump({ mwRevId: 5 }), dump({ mwRevId: 5 })]);

    expect(plan).toMatchObject({ skipped: 1 });
    expect(plan.inserts).toHaveLength(1);
  });
});
