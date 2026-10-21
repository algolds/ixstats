/** @jest-environment node */
import { REALM_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { getRealmSection, listForumRealms } from "~/server/modules/thinkpages-forum";
import { banNotice } from "~/lib/thinkpages-forum/moderation-policy";
import { banRow, forumBanFake } from "~/tests/helpers/forum-ban-fake";

const role = (name: string, level: number) => ({ name, level });
const admin = { id: "u_admin", clerkUserId: "admin", countryId: null, role: role("admin", 10) };
const founder = {
  id: "u_founder",
  clerkUserId: "founder",
  countryId: null,
  role: role("user", 100),
};
const owner = {
  id: "u_owner",
  clerkUserId: "owner",
  countryId: "c_eurth",
  role: role("user", 100),
};
const plain = { id: "u_plain", clerkUserId: "plain", countryId: null, role: role("user", 100) };

const row = (id: string, slug: string, name: string, status = "active", ownerId = "founder") => ({
  id,
  slug,
  name,
  status,
  ownerId,
});
const IXNAY_ROW = row("default", "ixnay", "Ixnay", "active", "system");
const EURTH = row("r_eurth", "eurth", "Eurth");
const ALBA = row("r_alba", "alba", "Alba");
const DRAFT = row("r_draft", "draft-land", "Draft Land", "draft");

describe("listForumRealms", () => {
  function listDb(rows: Array<ReturnType<typeof row>>) {
    return { realm: { findMany: jest.fn(async (_args: { where: object }) => rows) } };
  }

  it("asks for Ixnay and public active realms only, for anonymous", async () => {
    const db = listDb([ALBA, EURTH, IXNAY_ROW]);
    await listForumRealms(db as never, null);
    expect(db.realm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isSystem: false,
          OR: [{ id: "default" }, { status: "active", visibility: "public" }],
        },
        orderBy: { name: "asc" },
      })
    );
  });
  it("never lists a system realm: the where carries isSystem false for anonymous, regular and admin viewers", async () => {
    for (const viewer of [null, plain, admin]) {
      const db = listDb([]);
      await listForumRealms(db as never, viewer);
      expect(db.realm.findMany.mock.calls[0][0].where).toMatchObject({ isSystem: false });
    }
  });

  it("puts Ixnay first, then by name, and drops realms hidden from the viewer", async () => {
    const out = await listForumRealms(listDb([ALBA, DRAFT, EURTH, IXNAY_ROW]) as never, plain);
    expect(out.realms).toEqual([
      { id: "default", slug: "ixnay", name: "Ixnay" },
      { id: "r_alba", slug: "alba", name: "Alba" },
      { id: "r_eurth", slug: "eurth", name: "Eurth" },
    ]);
    const forFounder = await listForumRealms(
      listDb([ALBA, DRAFT, EURTH, IXNAY_ROW]) as never,
      founder
    );
    expect(forFounder.realms.map((r) => r.slug)).toEqual(["ixnay", "alba", "draft-land", "eurth"]);
  });

  it("synthesizes Ixnay when it has no realm row, and gives a legacy row (slug default or ixworld) the ixnay slug", async () => {
    const out = await listForumRealms(listDb([EURTH]) as never, null);
    expect(out.realms).toEqual([
      { id: "default", slug: "ixnay", name: "Ixnay" },
      { id: "r_eurth", slug: "eurth", name: "Eurth" },
    ]);
    const legacy = await listForumRealms(
      listDb([row("default", "default", "Ixnay Prime", "active", "system")]) as never,
      null
    );
    expect(legacy.realms).toEqual([{ id: "default", slug: "ixnay", name: "Ixnay Prime" }]);
    const formerSlug = await listForumRealms(
      listDb([row("default", "ixworld", "Ixnay", "active", "system")]) as never,
      null
    );
    expect(formerSlug.realms).toEqual([{ id: "default", slug: "ixnay", name: "Ixnay" }]);
  });
});

describe("getRealmSection", () => {
  const seeded = REALM_CATEGORIES.map((c) => ({
    id: `cat_${c.key}`,
    scope: "realm",
    realmId: "r_eurth",
    key: c.key,
    name: c.name,
    description: c.description,
    order: c.order,
    visibility: "public",
    postRole: "any",
    icAllowed: c.icAllowed,
  }));

  function sectionDb(
    realm: ReturnType<typeof row> | null,
    categories: Array<Array<(typeof seeded)[number]>> = [seeded]
  ) {
    const findMany = jest.fn();
    for (const batch of categories) findMany.mockResolvedValueOnce(batch);
    return {
      realm: { findUnique: jest.fn(async () => realm) },
      forumCategory: {
        findMany,
        createMany: jest.fn(async () => ({ count: 4 })),
        findFirst: jest.fn(async () => ({ id: "cat_board" })),
      },
      forumThread: {
        createMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(async (_args: { where: object }) => [
          {
            id: "t_hub",
            title: "Harbour tax",
            categoryId: "cat_hub",
            lastPostAt: new Date("2026-10-05"),
          },
        ]),
        groupBy: jest.fn(async (_args: { where: object }) => [
          {
            categoryId: "cat_hub",
            _count: { _all: 2 },
            _max: { lastPostAt: new Date("2026-10-05") },
          },
        ]),
      },
      forumPost: {
        findMany: jest.fn(async () => [
          {
            threadId: "t_hub",
            authorUserId: "u_owner",
            authorPersonaId: null,
            importedAuthorName: null,
            createdAt: new Date("2026-10-06"),
          },
        ]),
      },
      country: { findMany: jest.fn(async () => [{ id: "c_eurth" }]) },
      realmOfficer: { findMany: jest.fn(async () => []) },
      forumBan: forumBanFake(),
    };
  }

  it("gives a realm-banned owner the ban and its notice", async () => {
    const db = sectionDb(EURTH);
    const ban = banRow({ userId: owner.id, scope: "realm", scopeId: "r_eurth", reason: "Spam" });
    db.forumBan = forumBanFake([ban]);
    await expect(getRealmSection(db as never, owner, "eurth")).resolves.toMatchObject({
      access: {
        canPost: false,
        notice: banNotice(ban as never),
        ban: { id: "b1", scope: "realm" },
      },
    });
  });
  it("gives NOT_FOUND for an unknown realm and a draft realm the viewer is not staff of", async () => {
    await expect(getRealmSection(sectionDb(null) as never, plain, "nowhere")).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
    const db = sectionDb(DRAFT);
    await expect(getRealmSection(db as never, plain, "draft-land")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      getRealmSection(sectionDb(DRAFT) as never, null, "draft-land")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.forumCategory.findMany).not.toHaveBeenCalled();
    await expect(
      getRealmSection(sectionDb(DRAFT) as never, founder, "draft-land")
    ).resolves.toBeDefined();
  });

  it("leaves the realm's board out of its categories and counts", async () => {
    const board = {
      ...seeded[0]!,
      id: "cat_board",
      key: "board",
      name: "Board",
      order: 0,
      icAllowed: true,
      style: "board",
    };
    const db = sectionDb(EURTH, [[board, ...seeded]]);
    const out = await getRealmSection(db as never, owner, "eurth");
    expect(out.categories.map((c) => c.key)).toEqual([
      "hub",
      "character-threads",
      "current-events",
    ]);
    const groupBy = db.forumThread.groupBy.mock.calls[0]![0];
    expect(JSON.stringify(groupBy)).not.toContain("cat_board");
    expect(JSON.stringify(db.forumThread.findMany.mock.calls[0]![0])).not.toContain("cat_board");
  });

  it("names each board's latest thread without its author, so a persona's player never leaks", async () => {
    const out = await getRealmSection(sectionDb(EURTH) as never, owner, "eurth");
    expect(Object.keys(out.categories[0]!.latest!).sort()).toEqual([
      "at",
      "threadId",
      "threadTitle",
    ]);
  });

  it("seeds a realm whose only category is its board, then reads the sections", async () => {
    const board = {
      ...seeded[0]!,
      id: "cat_board",
      key: "board",
      name: "Board",
      order: 0,
      icAllowed: true,
      style: "board",
    };
    const db = sectionDb(EURTH, [[board], [board, ...seeded]]);
    const out = await getRealmSection(db as never, owner, "eurth");
    expect(db.forumCategory.createMany).toHaveBeenCalledTimes(1);
    expect(out.categories.map((c) => c.key)).toEqual([
      "hub",
      "character-threads",
      "current-events",
    ]);
  });

  it("seeds a realm with no categories, then reads them again", async () => {
    const db = sectionDb(EURTH, [[], seeded]);
    const out = await getRealmSection(db as never, owner, "eurth");
    expect(db.forumCategory.createMany).toHaveBeenCalledTimes(1);
    expect(db.forumThread.createMany).toHaveBeenCalledTimes(1);
    expect(db.forumCategory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    expect(db.forumCategory.findMany).toHaveBeenCalledTimes(2);
    expect(out.categories).toHaveLength(3);
  });
});
