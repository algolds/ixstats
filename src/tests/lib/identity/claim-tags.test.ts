/** @jest-environment node */
/** Reversible authorId tags (design decision 6, 7): only rows with no author are tagged, and a revoke undoes exactly those. */
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  tagClaimRevisionsTx,
  tagRevisionsOfName,
  untagClaimRevisionsTx,
  WIKI_NAME_LOCK_NAMESPACE,
} from "~/lib/identity/claim-tags";

let db: MemoryPrisma;
let articleId: string;
const rev = (id: string, author: string, authorId: string | null = null) =>
  db.wikiRevision.create({
    data: { id, articleId, author, authorId, wikitext: "", source: "ixwiki" },
  });
const authorIds = async () =>
  Object.fromEntries(
    (await db.wikiRevision.findMany({ orderBy: { id: "asc" } })).map((r) => [r.id, r.authorId])
  );

beforeEach(async () => {
  db = createMemoryPrisma();
  for (const id of ["a", "b", "native"]) {
    await db.user.create({ data: { id, clerkUserId: `user_${id}` } });
  }
  articleId = (await db.wikiArticle.create({ data: { title: "Page", wikitext: "" } })).id;
  await rev("r1", "Foo bar");
  await rev("r2", "Foo_bar");
  await rev("r3", "Foo bar", "native");
  await rev("r4", "Someone");
  await db.wikiNameClaim.create({
    data: {
      id: "c1",
      userId: "a",
      name: "Foo bar",
      status: "APPROVED",
      origin: "PLAYER",
      requestedById: "a",
    },
  });
  await db.wikiNameClaim.create({
    data: {
      id: "c2",
      userId: "b",
      name: "Foo bar",
      status: "PENDING",
      origin: "PLAYER",
      requestedById: "b",
    },
  });
});

it("tags only the name's rows that have no author, in both spellings", async () => {
  const n = await db.$transaction((tx) =>
    tagClaimRevisionsTx(tx, { id: "c1", userId: "a", source: "ixwiki", name: "Foo bar" })
  );
  expect(n).toBe(2);
  expect(await authorIds()).toEqual({ r1: "a", r2: "a", r3: "native", r4: null });
});

it("revoke, then approve for another account: the rows move, the native row never does", async () => {
  await db.$transaction((tx) =>
    tagClaimRevisionsTx(tx, { id: "c1", userId: "a", source: "ixwiki", name: "Foo bar" })
  );
  await db.$transaction((tx) => untagClaimRevisionsTx(tx, { id: "c1", userId: "a" }, new Date()));
  expect(await authorIds()).toEqual({ r1: null, r2: null, r3: "native", r4: null });
  await db.$transaction((tx) =>
    tagClaimRevisionsTx(tx, { id: "c2", userId: "b", source: "ixwiki", name: "Foo bar" })
  );
  expect(await authorIds()).toEqual({ r1: "b", r2: "b", r3: "native", r4: null });
  expect(await db.wikiRevisionClaimTag.count({ where: { claimId: "c1", undoneAt: null } })).toBe(0);
});

it("tags an inbound name's new rows under the name's lock, and nothing for an unclaimed or wikios> name", async () => {
  expect(await tagRevisionsOfName(db, "ixwiki", "wikios>alpha")).toBe(0);
  expect(await tagRevisionsOfName(db, "ixwiki", "Someone")).toBe(0);
  expect(await tagRevisionsOfName(db, "ixwiki", "Foo_bar")).toBe(2);
  expect(db.store.log).toContainEqual({
    kind: "advisory",
    ns: WIKI_NAME_LOCK_NAMESPACE,
    key: "ixwiki:Foo bar",
  });
});
