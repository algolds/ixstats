/** @jest-environment node */
import { banNotice, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import {
  canSeeRealm,
  postingAccessFor,
  realmPostingAccess,
  type ForumRealm,
} from "~/server/modules/thinkpages-forum";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";
import { REALM_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { getRealmSection, listForumRealms } from "~/server/modules/thinkpages-forum";

const role = (name: string, level: number) => ({ name, level });
const admin = { id: "u_admin", clerkUserId: "admin", countryId: null, role: role("admin", 10) };
const founder = {
  id: "u_founder",
  clerkUserId: "founder",
  countryId: null,
  role: role("user", 100),
};
const officer = {
  id: "u_officer",
  clerkUserId: "officer",
  countryId: null,
  role: role("user", 100),
};
const claimsOfficer = {
  id: "u_claims",
  clerkUserId: "claims",
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

const EURTH: ForumRealm = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
};
const IXNAY: ForumRealm = {
  id: "default",
  slug: "ixnay",
  name: "Ixnay",
  status: "active",
  ownerId: "system",
};
interface Where {
  realmId?: string;
  ownerUserId?: string;
  userId?: string;
}

function accessDb(opts: { owned?: Record<string, string[]>; bans?: BanRow[] } = {}) {
  const owned = opts.owned ?? { u_owner: ["c_eurth"] };
  const officers = [
    { userId: "officer", powers: ["board"] },
    { userId: "claims", powers: ["claims"] },
  ];
  return {
    country: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        (owned[where.ownerUserId ?? ""] ?? []).map((id) => ({ id }))
      ),
    },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        officers.filter((o) => o.userId === where.userId)
      ),
    },
    forumBan: forumBanFake(opts.bans),
    realm: { findUnique: jest.fn(async () => null) },
  };
}

describe("canSeeRealm", () => {
  it("hides draft and generating realms from plain users and anonymous, not from the founder or an admin", () => {
    for (const status of ["draft", "generating"]) {
      const realm = { ...EURTH, status };
      expect(canSeeRealm(plain, realm)).toBe(false);
      expect(canSeeRealm(null, realm)).toBe(false);
      expect(canSeeRealm(officer, realm)).toBe(false);
      expect(canSeeRealm(founder, realm)).toBe(true);
      expect(canSeeRealm(admin, realm)).toBe(true);
    }
  });
  it("always shows Ixnay, whatever its row's status, as the switcher always lists it (U7)", () => {
    for (const status of ["draft", "generating", "archived", null]) {
      expect(canSeeRealm(null, { ...IXNAY, status })).toBe(true);
      expect(canSeeRealm(plain, { ...IXNAY, status })).toBe(true);
    }
  });
});

describe("realmPostingAccess", () => {
  const later = new Date(Date.now() + 7 * DAY_MS);
  const realmBan = (userId: string, extra: Partial<BanRow> = {}) =>
    banRow({
      userId,
      scope: "realm",
      scopeId: "r_eurth",
      reason: "Spam",
      expiresAt: later,
      ...extra,
    });
  it("2. lets a site admin post without nations, without a ban lookup, even in an archived realm or with a ban row", async () => {
    for (const realm of [EURTH, { ...EURTH, status: "archived" }]) {
      const db = accessDb({
        owned: {},
        bans: [realmBan("u_admin"), banRow({ userId: "u_admin" })],
      });
      const access = await realmPostingAccess(db as never, admin, realm);
      expect(access).toMatchObject({
        isModerator: true,
        canPost: true,
        ban: null,
        notice: null,
      });
      expect(db.forumBan.findMany).not.toHaveBeenCalled();
    }
  });

  it("3. makes the founder and a board officer moderators, who are still refused by a realm ban (M5)", async () => {
    for (const viewer of [founder, officer]) {
      const free = accessDb({ owned: {} });
      await expect(realmPostingAccess(free as never, viewer, EURTH)).resolves.toMatchObject({
        isModerator: true,
        canPost: true,
        ban: null,
        notice: null,
      });
      const ban = realmBan(viewer.id);
      const db = accessDb({ owned: {}, bans: [ban] });
      await expect(realmPostingAccess(db as never, viewer, EURTH)).resolves.toMatchObject({
        isModerator: true,
        canPost: false,
        ban: { id: "b1", scope: "realm", scopeId: "r_eurth" },
        notice: banNotice({ scope: "realm", expiresAt: later, reason: "Spam" }),
      });
      expect(db.forumBan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: viewer.id, liftedAt: null }),
        })
      );
    }
  });
  it("5. refuses a signed-in user with no nation in the realm, and an officer without the board power", async () => {
    for (const viewer of [plain, claimsOfficer]) {
      const access = await realmPostingAccess(accessDb() as never, viewer, EURTH);
      expect(access).toMatchObject({
        isModerator: false,
        canPost: false,
        notice: "Only owners of a nation in Eurth can post here.",
        // U6: the UI offers "Claim a nation" on this flag, never by matching the notice.
        needsNation: true,
      });
    }
  });

  it("6. refuses an owner under a realm ban with its notice, before the nation rule", async () => {
    const ban = realmBan("u_owner");
    const access = await realmPostingAccess(accessDb({ bans: [ban] }) as never, owner, EURTH);
    expect(access).toMatchObject({
      ownedCountryIds: ["c_eurth"],
      canPost: false,
      ban: { id: "b1", scope: "realm", scopeId: "r_eurth", reason: "Spam", expiresAt: later },
      notice: banNotice(ban as never),
    });
    const outsider = await realmPostingAccess(
      accessDb({ bans: [realmBan("u_plain")] }) as never,
      plain,
      EURTH
    );
    expect(outsider).toMatchObject({
      canPost: false,
      notice: banNotice(ban as never),
      needsNation: false,
    });
  });
  it("6. leaves the section open under a category ban, but refuses posting in that category", async () => {
    const ban = banRow({
      userId: "u_owner",
      scope: "category",
      scopeId: "rcat_hub",
      expiresAt: later,
    });
    const db = accessDb({ bans: [ban] });
    await expect(realmPostingAccess(db as never, owner, EURTH)).resolves.toMatchObject({
      canPost: true,
      ban: null,
    });
    db.realm.findUnique.mockResolvedValue(EURTH as never);
    const hub = {
      id: "rcat_hub",
      scope: "realm",
      realmId: "r_eurth",
      visibility: "public",
      postRole: "any",
    };
    await expect(postingAccessFor(db as never, owner, hub, EURTH as never)).resolves.toEqual({
      canPost: false,
      notice: banNotice(ban as never),
      ban: expect.objectContaining({ id: "b1", scope: "category", scopeId: "rcat_hub" }),
    });
    await expect(
      postingAccessFor(db as never, owner, { ...hub, id: "rcat_character-threads" }, EURTH as never)
    ).resolves.toMatchObject({ canPost: true, notice: null, ban: null });
  });

  it("7. makes an archived realm read-only for owners and moderators alike, but never Ixnay", async () => {
    const archived = { ...EURTH, status: "archived" };
    for (const viewer of [owner, founder, officer, plain]) {
      await expect(
        realmPostingAccess(accessDb() as never, viewer, archived)
      ).resolves.toMatchObject({
        canPost: false,
        notice: "This realm is archived: its forum can be read but no longer changes.",
        needsNation: false,
      });
    }
    const db = accessDb({ owned: { u_owner: ["c_ix"] } });
    await expect(
      realmPostingAccess(db as never, owner, { ...IXNAY, status: "archived" })
    ).resolves.toMatchObject({
      canPost: true,
    });
  });
  it("8. gives Ixnay no founder: board officers and site admins moderate", async () => {
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, plain, IXNAY)
    ).resolves.toMatchObject({
      isModerator: false,
      canPost: false,
      notice: "Only owners of a nation in Ixnay can post here.",
    });
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, officer, IXNAY)
    ).resolves.toMatchObject({
      isModerator: true,
      canPost: true,
    });
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, admin, IXNAY)
    ).resolves.toMatchObject({
      isModerator: true,
      canPost: true,
    });
  });
});

describe("realm sections", () => {
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
  const EURTH = row("r_eurth", "eurth", "Eurth");
  const DRAFT = row("r_draft", "draft-land", "Draft Land", "draft");
  describe("listForumRealms", () => {
    function listDb(rows: Array<ReturnType<typeof row>>) {
      return { realm: { findMany: jest.fn(async (_args: { where: object }) => rows) } };
    }

    it("never lists a system realm: the where carries isSystem false for anonymous, regular and admin viewers", async () => {
      for (const viewer of [null, plain, admin]) {
        const db = listDb([]);
        await listForumRealms(db as never, viewer);
        expect(db.realm.findMany.mock.calls[0][0].where).toMatchObject({ isSystem: false });
      }
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

    it("gives NOT_FOUND for an unknown realm and a draft realm the viewer is not staff of", async () => {
      await expect(
        getRealmSection(sectionDb(null) as never, plain, "nowhere")
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
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
    it("names each board's latest thread without its author, so a persona's player never leaks", async () => {
      const out = await getRealmSection(sectionDb(EURTH) as never, owner, "eurth");
      expect(Object.keys(out.categories[0]!.latest!).sort()).toEqual([
        "at",
        "threadId",
        "threadTitle",
      ]);
    });
  });
});
