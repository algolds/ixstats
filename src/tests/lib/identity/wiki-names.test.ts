/** @jest-environment node */
/** The one resolver of "who is this wiki name" (design item 3): approved claims only, visibility for public reads. */
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  accountOfWikiName,
  checkClaimName,
  claimName,
  claimSpellings,
  handleOfWikiName,
  namesOfUser,
  ownerOfName,
  ownersOfNames,
  primaryNameOf,
} from "~/lib/identity/wiki-names";

let db: MemoryPrisma;
const claim = (userId: string, name: string, over: object = {}) =>
  db.wikiNameClaim.create({
    data: {
      userId,
      name,
      status: "APPROVED",
      origin: "PLAYER",
      requestedById: userId,
      decidedAt: new Date("2026-10-01T00:00:00Z"),
      ...over,
    },
  });

beforeEach(async () => {
  db = createMemoryPrisma();
  await db.user.create({ data: { id: "a", clerkUserId: "user_a", handle: "alpha" } });
  await db.user.create({ data: { id: "b", clerkUserId: "user_b", handle: "foo_bar" } });
});

describe("name rules", () => {
  it("normalises as MediaWiki does: underscores are spaces, only the first letter is case-free", () => {
    expect(claimName(" foo_bar ")).toBe("Foo bar");
    expect(claimName("fooBar")).toBe("FooBar");
    expect(claimSpellings("Foo bar")).toEqual(["Foo bar", "Foo_bar"]);
    expect(handleOfWikiName("Foo bar")).toBe("foo_bar");
  });

  it("refuses blank, overlong and impossible names, and every wikios> name", () => {
    expect(checkClaimName("  ")).toEqual({ ok: false, message: "Enter a wiki name." });
    expect(checkClaimName("x".repeat(86))).toEqual({
      ok: false,
      message: "A wiki name is at most 85 characters.",
    });
    expect(checkClaimName("wikios>alpha")).toEqual({
      ok: false,
      message: "A wiki name cannot contain # < > [ ] | { }.",
    });
    expect(checkClaimName("old_name")).toEqual({ ok: true, name: "Old name" });
  });
});

describe("ownerOfName and namesOfUser", () => {
  it("answer only for approved claims", async () => {
    await claim("a", "Old name");
    await claim("b", "Pending name", { status: "PENDING" });
    await claim("b", "Gone", { status: "REVOKED" });
    expect(await ownerOfName(db, "ixwiki", "old_name")).toBe("a");
    expect(await ownerOfName(db, "ixwiki", "Pending name")).toBeNull();
    expect(await ownerOfName(db, "ixwiki", "Gone")).toBeNull();
    expect((await namesOfUser(db, "b")).map((n) => n.name)).toEqual([]);
  });

  it("keep a hidden name out of public reads, never out of the owner's own", async () => {
    await claim("a", "Secret", { visible: false });
    expect(await ownerOfName(db, "ixwiki", "Secret")).toBe("a");
    expect(await ownerOfName(db, "ixwiki", "Secret", { shown: true })).toBeNull();
    expect(await primaryNameOf(db, "a", { shown: true })).toBeNull();
    expect((await namesOfUser(db, "a"))[0]).toMatchObject({ name: "Secret", visible: false });
  });

  it("list an account's names oldest approval first, and batch-resolve names", async () => {
    await claim("a", "Second", { decidedAt: new Date("2026-10-02T00:00:00Z") });
    await claim("a", "First", { decidedAt: new Date("2026-09-01T00:00:00Z") });
    expect((await namesOfUser(db, "a")).map((n) => n.name)).toEqual(["First", "Second"]);
    expect(await ownersOfNames(db, "ixwiki", ["first", "Nobody"])).toEqual(
      new Map([["First", "a"]])
    );
  });
});

describe("accountOfWikiName", () => {
  it("prefers the claim, then the handle the title spells", async () => {
    expect(await accountOfWikiName(db, "Foo bar")).toEqual({ userId: "b", handle: "foo_bar" });
    await claim("a", "Foo bar");
    expect(await accountOfWikiName(db, "Foo bar")).toEqual({ userId: "a", handle: "alpha" });
  });

  it("answers null for a hidden claim when shown, never the handle behind it", async () => {
    await claim("a", "Foo bar", { visible: false });
    expect(await accountOfWikiName(db, "Foo bar", { shown: true })).toBeNull();
  });

  it("matches no handle for a name with other capitals", async () => {
    expect(await accountOfWikiName(db, "FooBar")).toBeNull();
  });
});
