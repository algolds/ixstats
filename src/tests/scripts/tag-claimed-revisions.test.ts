/** @jest-environment node */
/**
 * The reversible claimed-revision backfill (design decision 6): every APPROVED claim tags its name's unauthored
 * revisions once, under the name's lock (41103), and --undo takes back exactly what a claim tagged, never a native row.
 */
import { WIKI_NAME_LOCK_NAMESPACE } from "~/lib/identity/claim-tags";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  applyTags,
  parseTagArgs,
  planTagRun,
  undoTags,
} from "../../../scripts/identity/tag-claimed-revisions";

let db: MemoryPrisma;
let articleId: string;
const rev = (id: string, author: string, authorId: string | null = null) =>
  db.wikiRevision.create({
    data: { id, articleId, author, authorId, wikitext: "", source: "ixwiki" },
  });
const claim = (id: string, userId: string, name: string, status: "APPROVED" | "PENDING") =>
  db.wikiNameClaim.create({
    data: { id, userId, name, status, origin: "PLAYER", requestedById: userId },
  });
const authorIds = async () =>
  Object.fromEntries(
    (await db.wikiRevision.findMany({ orderBy: { id: "asc" } })).map((r) => [r.id, r.authorId])
  );

beforeEach(async () => {
  db = createMemoryPrisma();
  for (const id of ["a", "b", "c", "native"]) {
    await db.user.create({ data: { id, clerkUserId: `user_${id}` } });
  }
  articleId = (await db.wikiArticle.create({ data: { title: "Page", wikitext: "" } })).id;
  await rev("r1", "Foo bar");
  await rev("r2", "Foo_bar");
  await rev("r3", "Foo bar", "native");
  await rev("r4", "Baz");
  await rev("r5", "Pending one");
  await claim("c1", "a", "Foo bar", "APPROVED");
  await claim("c2", "b", "Baz", "APPROVED");
  await claim("c3", "c", "Pending one", "PENDING");
});

describe("parseTagArgs", () => {
  it("reads the mode, and refuses both flags", () => {
    expect(parseTagArgs([])).toEqual({ mode: "dry-run" });
    expect(parseTagArgs(["--apply"])).toEqual({ mode: "apply" });
    expect(parseTagArgs(["--undo"])).toEqual({ mode: "undo" });
    expect(() => parseTagArgs(["--apply", "--undo"])).toThrow("Pass --apply or --undo, not both");
  });
});

describe("planTagRun", () => {
  it("lists every approved claim with the unauthored revisions its spellings would tag, and writes nothing", async () => {
    const rows = await planTagRun(db);
    expect(rows).toEqual(
      expect.arrayContaining([
        { claimId: "c1", name: "Foo bar", userId: "a", untagged: 2 },
        { claimId: "c2", name: "Baz", userId: "b", untagged: 1 },
      ])
    );
    expect(rows).toHaveLength(2);
    expect(await authorIds()).toEqual({ r1: null, r2: null, r3: "native", r4: null, r5: null });
  });
});

describe("applyTags and undoTags", () => {
  it("tags each approved claim once under its name's lock, however often it runs", async () => {
    expect(await applyTags(db)).toBe(3);
    expect(await applyTags(db)).toBe(0);
    expect(await authorIds()).toEqual({ r1: "a", r2: "a", r3: "native", r4: "b", r5: null });
    expect(await db.wikiRevisionClaimTag.count()).toBe(3);
    expect(db.store.log).toContainEqual({
      kind: "advisory",
      ns: WIKI_NAME_LOCK_NAMESPACE,
      key: "ixwiki:Foo bar",
    });
    expect(db.store.log).toContainEqual({
      kind: "advisory",
      ns: WIKI_NAME_LOCK_NAMESPACE,
      key: "ixwiki:Baz",
    });
  });

  it("puts every tagged row back to null and leaves the native row alone", async () => {
    await applyTags(db);
    expect(await undoTags(db)).toBe(3);
    expect(await authorIds()).toEqual({ r1: null, r2: null, r3: "native", r4: null, r5: null });
    expect(await db.wikiRevisionClaimTag.count({ where: { undoneAt: null } })).toBe(0);
    expect(await undoTags(db)).toBe(0);
    expect((await planTagRun(db)).map((r) => r.untagged).sort()).toEqual([1, 2]);
  });
});
