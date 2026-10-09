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
const IXWORLD_ROW = row("default", "ixworld", "IxWorld", "active", "system");
const EURTH = row("r_eurth", "eurth", "Eurth");
const ALBA = row("r_alba", "alba", "Alba");
const DRAFT = row("r_draft", "draft-land", "Draft Land", "draft");

describe("listForumRealms", () => {
  function listDb(rows: Array<ReturnType<typeof row>>) {
    return { realm: { findMany: jest.fn(async (_args: { where: object }) => rows) } };
  }

  it("asks for IxWorld and public active realms only, for anonymous", async () => {
    const db = listDb([ALBA, EURTH, IXWORLD_ROW]);
    await listForumRealms(db as never, null);
    expect(db.realm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ id: "default" }, { status: "active", visibility: "public" }] },
        orderBy: { name: "asc" },
      })
    );
  });

  it("adds realms where the viewer holds a nation, founded or serves as an officer", async () => {
    const db = listDb([]);
    await listForumRealms(db as never, plain);
    expect(db.realm.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { id: "default" },
        { status: "active", visibility: "public" },
        { countries: { some: { ownerUserId: "u_plain" } } },
        { ownerId: "plain" },
        { officers: { some: { userId: "plain" } } },
      ],
    });
  });

  it("asks for every realm for a site admin", async () => {
    const db = listDb([]);
    await listForumRealms(db as never, admin);
    expect(db.realm.findMany.mock.calls[0][0].where).toEqual({});
  });

  it("puts IxWorld first, then by name, and drops realms hidden from the viewer", async () => {
    const out = await listForumRealms(listDb([ALBA, DRAFT, EURTH, IXWORLD_ROW]) as never, plain);
    expect(out.realms).toEqual([
      { id: "default", slug: "ixworld", name: "IxWorld" },
      { id: "r_alba", slug: "alba", name: "Alba" },
      { id: "r_eurth", slug: "eurth", name: "Eurth" },
    ]);
    const forFounder = await listForumRealms(
      listDb([ALBA, DRAFT, EURTH, IXWORLD_ROW]) as never,
      founder
    );
    expect(forFounder.realms.map((r) => r.slug)).toEqual([
      "ixworld",
      "alba",
      "draft-land",
      "eurth",
    ]);
  });

  it("synthesizes IxWorld when it has no realm row, and gives a legacy row the ixworld slug", async () => {
    const out = await listForumRealms(listDb([EURTH]) as never, null);
    expect(out.realms).toEqual([
      { id: "default", slug: "ixworld", name: "IxWorld" },
      { id: "r_eurth", slug: "eurth", name: "Eurth" },
    ]);
    const legacy = await listForumRealms(
      listDb([row("default", "default", "IxWorld Prime", "active", "system")]) as never,
      null
    );
    expect(legacy.realms).toEqual([{ id: "default", slug: "ixworld", name: "IxWorld Prime" }]);
  });

  it("opens the realm of the viewer's active nation by default, else IxWorld", async () => {
    const rows = [EURTH, IXWORLD_ROW];
    await expect(
      listForumRealms(listDb(rows) as never, { ...owner, activeRealmId: "r_eurth" })
    ).resolves.toMatchObject({
      defaultSlug: "eurth",
    });
    await expect(
      listForumRealms(listDb(rows) as never, { ...owner, activeRealmId: "r_gone" })
    ).resolves.toMatchObject({
      defaultSlug: "ixworld",
    });
    await expect(listForumRealms(listDb(rows) as never, plain)).resolves.toMatchObject({
      defaultSlug: "ixworld",
    });
    await expect(listForumRealms(listDb(rows) as never, null)).resolves.toMatchObject({
      defaultSlug: "ixworld",
    });
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
      forumCategory: { findMany, createMany: jest.fn(async () => ({ count: 3 })) },
      forumThread: {
        groupBy: jest.fn(async (_args: { where: object }) => [
          {
            categoryId: "cat_hub",
            _count: { _all: 2 },
            _max: { lastPostAt: new Date("2026-10-05") },
          },
        ]),
      },
      country: { findMany: jest.fn(async () => [{ id: "c_eurth" }]) },
      realmOfficer: { findMany: jest.fn(async () => []) },
      forumBan: forumBanFake(),
    };
  }

  it("returns the realm, its categories in order with counts from one grouped query, and the posting access", async () => {
    const db = sectionDb(EURTH);
    const out = await getRealmSection(db as never, owner, "eurth");
    expect(out.realm).toEqual({ id: "r_eurth", slug: "eurth", name: "Eurth", status: "active" });
    expect(out.categories.map((c) => c.key)).toEqual([
      "hub",
      "character-threads",
      "current-events",
    ]);
    expect(out.categories[0]).toEqual({
      key: "hub",
      name: "Hub",
      description: "Out-of-character talk for the realm.",
      icAllowed: false,
      postRole: "any",
      threadCount: 2,
      lastPostAt: new Date("2026-10-05"),
    });
    expect(out.categories[1]).toMatchObject({ threadCount: 0, lastPostAt: null });
    expect(out.access).toMatchObject({ canPost: true, notice: null, ban: null });
    expect(out.access).not.toHaveProperty("restriction");
    expect(db.forumCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scope: "realm", realmId: "r_eurth" },
        orderBy: { order: "asc" },
      })
    );
    expect(db.forumThread.groupBy).toHaveBeenCalledTimes(1);
    expect(db.forumThread.groupBy.mock.calls[0][0]).toMatchObject({ where: { hidden: false } });
    expect(db.forumCategory.createMany).not.toHaveBeenCalled();
  });

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

  it("gives the reason a signed-in user without a nation cannot post", async () => {
    const db = sectionDb(EURTH);
    db.country.findMany.mockResolvedValue([]);
    await expect(getRealmSection(db as never, plain, "eurth")).resolves.toMatchObject({
      access: { canPost: false, notice: "Only owners of a nation in Eurth can post here." },
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

  it("seeds a realm with no categories, then reads them again", async () => {
    const db = sectionDb(EURTH, [[], seeded]);
    const out = await getRealmSection(db as never, owner, "eurth");
    expect(db.forumCategory.createMany).toHaveBeenCalledTimes(1);
    expect(db.forumCategory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    expect(db.forumCategory.findMany).toHaveBeenCalledTimes(2);
    expect(out.categories).toHaveLength(3);
  });

  it("opens IxWorld's section without a realm row", async () => {
    const db = sectionDb(null);
    const out = await getRealmSection(db as never, null, "ixworld");
    expect(out.realm).toEqual({
      id: "default",
      slug: "ixworld",
      name: "IxWorld",
      status: "active",
    });
    expect(db.forumCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scope: "realm", realmId: "default" } })
    );
  });
});
