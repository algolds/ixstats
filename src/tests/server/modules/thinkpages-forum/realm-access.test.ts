/** @jest-environment node */
import { banNotice, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import {
  canPostInCategory,
  canSeeRealm,
  categoryPostingAccess,
  loadForumRealm,
  realmPostingAccess,
  type ForumRealm,
} from "~/server/modules/thinkpages-forum";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";

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
const next = { id: "u_next", clerkUserId: "next", countryId: null, role: role("user", 100) };
const plain = { id: "u_plain", clerkUserId: "plain", countryId: null, role: role("user", 100) };

const EURTH: ForumRealm = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
};
const IXWORLD: ForumRealm = {
  id: "default",
  slug: "ixworld",
  name: "IxWorld",
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

describe("loadForumRealm", () => {
  const rows = [
    { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  ];
  function realmDb(extra: typeof rows = []) {
    const all = [...rows, ...extra];
    return {
      realm: {
        findUnique: jest.fn(
          async ({ where }: { where: { slug?: string; id?: string } }) =>
            all.find((r) =>
              where.slug !== undefined ? r.slug === where.slug : r.id === where.id
            ) ?? null
        ),
      },
    };
  }

  it("synthesizes IxWorld for its slugs and id when it has no realm row", async () => {
    for (const ref of [{ slug: "ixworld" }, { slug: "default" }, { id: "default" }]) {
      await expect(loadForumRealm(realmDb() as never, ref)).resolves.toEqual(IXWORLD);
    }
  });

  it("names IxWorld from its row when one exists, under the ixworld slug", async () => {
    const db = realmDb([
      {
        id: "default",
        slug: "default",
        name: "IxWorld Prime",
        status: "active",
        ownerId: "system",
      },
    ]);
    await expect(loadForumRealm(db as never, { slug: "ixworld" })).resolves.toEqual({
      ...IXWORLD,
      name: "IxWorld Prime",
    });
    await expect(loadForumRealm(db as never, { id: "default" })).resolves.toEqual({
      ...IXWORLD,
      name: "IxWorld Prime",
    });
  });

  it("loads a realm row by slug and by id", async () => {
    const db = realmDb();
    await expect(loadForumRealm(db as never, { slug: "eurth" })).resolves.toEqual(EURTH);
    await expect(loadForumRealm(db as never, { id: "r_eurth" })).resolves.toEqual(EURTH);
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "eurth" } })
    );
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r_eurth" } })
    );
  });

  it("returns null for an unknown realm", async () => {
    await expect(loadForumRealm(realmDb() as never, { slug: "nowhere" })).resolves.toBeNull();
    await expect(loadForumRealm(realmDb() as never, { id: "r_nowhere" })).resolves.toBeNull();
  });
});

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

  it("shows active and archived realms to anyone", () => {
    for (const status of ["active", "archived"]) {
      expect(canSeeRealm(null, { ...EURTH, status })).toBe(true);
      expect(canSeeRealm(plain, { ...EURTH, status })).toBe(true);
    }
  });

  it("always shows IxWorld, whatever its row's status, as the switcher always lists it (U7)", () => {
    for (const status of ["draft", "generating", "archived", null]) {
      expect(canSeeRealm(null, { ...IXWORLD, status })).toBe(true);
      expect(canSeeRealm(plain, { ...IXWORLD, status })).toBe(true);
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

  it("1. refuses anonymous with a sign-in notice", async () => {
    const db = accessDb();
    await expect(realmPostingAccess(db as never, null, EURTH)).resolves.toEqual({
      ownedCountryIds: [],
      isModerator: false,
      ban: null,
      canPost: false,
      notice: "Sign in and claim a nation in Eurth to post here.",
      needsNation: false,
    });
    expect(db.country.findMany).not.toHaveBeenCalled();
    expect(db.forumBan.findMany).not.toHaveBeenCalled();
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

  it("4. lets the owner of a nation in the realm post", async () => {
    const db = accessDb();
    const access = await realmPostingAccess(db as never, owner, EURTH);
    expect(access).toEqual({
      ownedCountryIds: ["c_eurth"],
      isModerator: false,
      ban: null,
      canPost: true,
      notice: null,
      needsNation: false,
    });
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: "r_eurth", ownerUserId: "u_owner" } })
    );
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

  it("6. refuses an owner under a site ban in the realm", async () => {
    const ban = banRow({ userId: "u_owner", reason: "Abuse" });
    await expect(
      realmPostingAccess(accessDb({ bans: [ban] }) as never, owner, EURTH)
    ).resolves.toMatchObject({
      canPost: false,
      ban: { scope: "site" },
      notice: banNotice({ scope: "site", expiresAt: null, reason: "Abuse" }),
    });
  });

  it("6. ignores expired and lifted bans, another realm's ban and another member's ban", async () => {
    const bans = [
      realmBan("u_owner", { id: "b_expired", expiresAt: new Date(Date.now() - DAY_MS) }),
      realmBan("u_owner", { id: "b_lifted", liftedAt: new Date() }),
      realmBan("u_owner", { id: "b_other", scopeId: "r_bee" }),
      realmBan("u_next", { id: "b_next" }),
    ];
    await expect(
      realmPostingAccess(accessDb({ bans }) as never, owner, EURTH)
    ).resolves.toMatchObject({ canPost: true, ban: null, notice: null });
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
    await expect(categoryPostingAccess(db as never, owner, hub)).resolves.toEqual({
      canPost: false,
      notice: banNotice(ban as never),
      ban: expect.objectContaining({ id: "b1", scope: "category", scopeId: "rcat_hub" }),
    });
    await expect(
      categoryPostingAccess(db as never, owner, { ...hub, id: "rcat_character-threads" })
    ).resolves.toMatchObject({ canPost: true, notice: null, ban: null });
  });

  it("7. makes an archived realm read-only for owners and moderators alike, but never IxWorld", async () => {
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
      realmPostingAccess(db as never, owner, { ...IXWORLD, status: "archived" })
    ).resolves.toMatchObject({
      canPost: true,
    });
  });

  it("8. gives IxWorld no founder: board officers and site admins moderate", async () => {
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, plain, IXWORLD)
    ).resolves.toMatchObject({
      isModerator: false,
      canPost: false,
      notice: "Only owners of a nation in IxWorld can post here.",
    });
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, officer, IXWORLD)
    ).resolves.toMatchObject({
      isModerator: true,
      canPost: true,
    });
    await expect(
      realmPostingAccess(accessDb({ owned: {} }) as never, admin, IXWORLD)
    ).resolves.toMatchObject({
      isModerator: true,
      canPost: true,
    });
  });
});

describe("canPostInCategory", () => {
  const site = {
    id: "cat_general",
    scope: "site",
    realmId: null,
    visibility: "public",
    postRole: "any",
  };
  const hub = {
    id: "rcat_hub",
    scope: "realm",
    realmId: "r_eurth",
    visibility: "public",
    postRole: "any",
  };
  function categoryDb(realm: ForumRealm | null = EURTH) {
    const db = accessDb();
    db.realm.findUnique.mockResolvedValue(realm as never);
    return db;
  }

  it("applies the phase 1 rule to sitewide categories without loading a realm", async () => {
    const db = categoryDb();
    await expect(canPostInCategory(db as never, plain, site)).resolves.toBe(true);
    await expect(
      canPostInCategory(db as never, plain, { ...site, postRole: "staff" })
    ).resolves.toBe(false);
    await expect(canPostInCategory(db as never, null, site)).resolves.toBe(false);
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a sitewide category under a site or that category's ban, never under a realm ban", async () => {
    const site_ = banRow({ userId: "u_plain", reason: "Abuse" });
    const db = accessDb({ bans: [site_] });
    await expect(categoryPostingAccess(db as never, plain, site)).resolves.toEqual({
      canPost: false,
      notice: banNotice({ scope: "site", expiresAt: null, reason: "Abuse" }),
      ban: expect.objectContaining({ scope: "site" }),
    });
    expect(db.forumBan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u_plain", liftedAt: null }),
      })
    );
    const inCategory = banRow({ userId: "u_plain", scope: "category", scopeId: "cat_general" });
    await expect(
      canPostInCategory(accessDb({ bans: [inCategory] }) as never, plain, site)
    ).resolves.toBe(false);
    await expect(
      canPostInCategory(accessDb({ bans: [inCategory] }) as never, plain, {
        ...site,
        id: "cat_side",
      })
    ).resolves.toBe(true);
    const realmOnly = banRow({ userId: "u_plain", scope: "realm", scopeId: "r_eurth" });
    await expect(
      canPostInCategory(accessDb({ bans: [realmOnly] }) as never, plain, site)
    ).resolves.toBe(true);
  });

  it("lets a site admin post sitewide whatever ban rows exist, without a lookup", async () => {
    const db = accessDb({ bans: [banRow({ userId: "u_admin" })] });
    await expect(categoryPostingAccess(db as never, admin, site)).resolves.toEqual({
      canPost: true,
      notice: null,
      ban: null,
    });
    expect(db.forumBan.findMany).not.toHaveBeenCalled();
  });

  it("follows the realm posting rule in realm categories", async () => {
    await expect(canPostInCategory(categoryDb() as never, owner, hub)).resolves.toBe(true);
    await expect(canPostInCategory(categoryDb() as never, plain, hub)).resolves.toBe(false);
    await expect(canPostInCategory(categoryDb() as never, admin, hub)).resolves.toBe(true);
    await expect(
      canPostInCategory(categoryDb() as never, owner, { ...hub, postRole: "staff" })
    ).resolves.toBe(false);
  });

  it("refuses a realm category whose realm is hidden from the viewer or gone", async () => {
    await expect(
      canPostInCategory(categoryDb({ ...EURTH, status: "draft" }) as never, owner, hub)
    ).resolves.toBe(false);
    await expect(canPostInCategory(categoryDb(null) as never, owner, hub)).resolves.toBe(false);
  });
});
