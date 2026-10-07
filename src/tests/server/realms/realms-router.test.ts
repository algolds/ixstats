/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { Prisma } from "@prisma/client";
import { realmsRouter } from "~/server/api/routers/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";

function caller(
  findUnique: jest.Mock,
  realmPage = { findFirst: jest.fn().mockResolvedValue(null) },
  viewer: {
    id: string;
    clerkUserId: string;
    role?: { name: string; level: number } | null;
  } | null = null
) {
  const ctx = createMockRouterContext({
    db: { realm: { findUnique }, realmPage },
    auth: viewer ? { userId: viewer.clerkUserId } : null,
    user: viewer,
  });
  return realmsRouter.createCaller(ctx as never);
}

describe("realms.getBySlug", () => {
  it("replaces owner ids with a claimed flag", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "default",
      slug: "ixworld",
      name: "IxWorld",
      description: null,
      thumbnail: null,
      status: "active",
      visibility: "public",
      countries: [
        { id: "c1", name: "Aurelia", slug: "aurelia", flag: null, ownerUserId: "u_secret" },
        { id: "c2", name: "Borea", slug: "borea", flag: null, ownerUserId: null },
      ],
      pages: [],
      _count: { pages: 0 },
    });
    const realm = await caller(findUnique).getBySlug({ slug: "ixworld" });

    expect(realm?.countries).toEqual([
      { id: "c1", name: "Aurelia", slug: "aurelia", flag: null, claimed: true, mine: false },
      { id: "c2", name: "Borea", slug: "borea", flag: null, claimed: false, mine: false },
    ]);
    for (const c of realm?.countries ?? []) expect(c).not.toHaveProperty("ownerUserId");
    expect(JSON.stringify(realm)).not.toContain("u_secret");
  });

  it("marks the signed-in viewer's own nations (for Play as, ruling F-1) without exposing owner ids", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      description: null,
      thumbnail: null,
      status: "active",
      visibility: "public",
      countries: [
        { id: "e1", name: "Gallambria", slug: "gallambria", flag: null, ownerUserId: "u_viewer" },
        { id: "e2", name: "Sunseong", slug: "sunseong", flag: null, ownerUserId: "u_other" },
        { id: "e3", name: "Vestria", slug: "vestria", flag: null, ownerUserId: null },
      ],
      pages: [],
      _count: { pages: 0 },
    });
    const realm = await caller(findUnique, undefined, {
      id: "u_viewer",
      clerkUserId: "clerk_viewer",
    }).getBySlug({
      slug: "eurth",
    });
    expect(realm?.countries.map((c) => [c.id, c.mine])).toEqual([
      ["e1", true],
      ["e2", false],
      ["e3", false],
    ]);
    expect(JSON.stringify(realm)).not.toContain("u_other");
    expect(JSON.stringify(realm)).not.toContain("u_viewer");
  });

  it("returns null for an unknown slug", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    await expect(caller(findUnique).getBySlug({ slug: "nowhere" })).resolves.toBeNull();
  });

  it("lists the nation pages no country of the realm has taken, and the size and source of the lore index", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      description: null,
      thumbnail: null,
      status: "active",
      visibility: "public",
      countries: [
        { id: "c1", name: "Gallambria", slug: "gallambria-eurth", flag: null, ownerUserId: "u1" },
      ],
      pages: [
        { title: "Aurelia", wikiSource: "iiwiki" },
        { title: "Gallambria", wikiSource: "iiwiki" },
      ],
      _count: { pages: 2637 },
    });
    const realmPage = { findFirst: jest.fn().mockResolvedValue({ wikiSource: "iiwiki" }) };
    const realm = await caller(findUnique, realmPage).getBySlug({ slug: "eurth" });

    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: "eurth" },
      select: expect.objectContaining({
        pages: {
          where: { kind: "nation" },
          orderBy: { title: "asc" },
          select: { title: true, wikiSource: true },
        },
        _count: { select: { pages: true } },
      }),
    });
    expect(realmPage.findFirst).toHaveBeenCalledWith({
      where: { realmId: "eurth-id" },
      select: { wikiSource: true },
    });
    expect(realm).toMatchObject({
      nationPages: [{ title: "Aurelia", wikiSource: "iiwiki" }],
      lorePageCount: 2637,
      loreSource: "iiwiki",
    });
    expect(realm).not.toHaveProperty("pages");
    expect(realm).not.toHaveProperty("_count");
    expect(JSON.stringify(realm)).not.toContain("u1");
  });

  it("a realm without a lore index has no nation pages and no lore source", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "default",
      slug: "ixworld",
      name: "IxWorld",
      description: null,
      thumbnail: null,
      status: "active",
      visibility: "public",
      countries: [],
      pages: [],
      _count: { pages: 0 },
    });
    const realmPage = { findFirst: jest.fn() };
    const realm = await caller(findUnique, realmPage).getBySlug({ slug: "ixworld" });
    expect(realm).toMatchObject({ nationPages: [], lorePageCount: 0, loreSource: null });
    expect(realmPage.findFirst).not.toHaveBeenCalled();
  });
});

describe("realms.getBySlug — realm status (AT-7)", () => {
  const hubRow = (status: string) => ({
    id: "eurth-id",
    slug: "eurth",
    name: "Eurth",
    description: null,
    thumbnail: null,
    ownerId: "clerk_founder",
    status,
    visibility: "public",
    countries: [],
    pages: [{ title: "Aurelia", wikiSource: "iiwiki" }],
    _count: { pages: 0 },
  });
  const viewer = (clerkUserId: string, role: { name: string; level: number } | null = null) => ({
    id: `u_${clerkUserId}`,
    clerkUserId,
    role,
  });

  it.each(["draft", "generating"])(
    "hides a %s realm from the public and from signed-in players",
    async (status) => {
      const findUnique = jest.fn().mockResolvedValue(hubRow(status));
      await expect(caller(findUnique).getBySlug({ slug: "eurth" })).resolves.toBeNull();
      await expect(
        caller(findUnique, undefined, viewer("clerk_player")).getBySlug({ slug: "eurth" })
      ).resolves.toBeNull();
    }
  );

  it("shows a draft realm to its founder and to site admins, with claims closed", async () => {
    const findUnique = jest.fn().mockResolvedValue(hubRow("draft"));
    for (const v of [
      viewer("clerk_founder"),
      viewer("clerk_admin", { name: "admin", level: 10 }),
    ]) {
      const realm = await caller(findUnique, undefined, v).getBySlug({ slug: "eurth" });
      expect(realm).toMatchObject({ slug: "eurth", claimsOpen: false });
    }
  });

  it("keeps an archived realm readable with claims closed, and never exposes the founder id", async () => {
    const findUnique = jest.fn().mockResolvedValue(hubRow("archived"));
    const realm = await caller(findUnique).getBySlug({ slug: "eurth" });
    expect(realm).toMatchObject({ status: "archived", claimsOpen: false });
    expect(JSON.stringify(realm)).not.toContain("clerk_founder");
  });

  it("an active realm is open for claims", async () => {
    const findUnique = jest.fn().mockResolvedValue(hubRow("active"));
    await expect(caller(findUnique).getBySlug({ slug: "eurth" })).resolves.toMatchObject({
      claimsOpen: true,
    });
  });
});

describe("realms.claimNationPage", () => {
  const player = {
    id: "u1",
    clerkUserId: "clerk_u1",
    countryId: null,
    role: { name: "user", level: 100 },
  };

  function claimDb(realm: { id: string } | null = { id: "eurth-id" }) {
    return {
      realm: { findUnique: jest.fn().mockResolvedValue(realm) },
      realmPage: {
        findFirst: jest.fn().mockResolvedValue({
          wikiSource: "iiwiki",
          realm: { slug: "eurth", settings: null, status: "active" },
        }),
      },
      country: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }) },
      wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
      realmClaim: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "cl1", ...data })),
      },
      $transaction: jest.fn(),
    };
  }

  function claimCaller(db: ReturnType<typeof claimDb>, signedIn = true) {
    const ctx = createMockRouterContext({
      db,
      auth: signedIn ? { userId: player.clerkUserId } : null,
      user: signedIn ? player : null,
    });
    return realmsRouter.createCaller(ctx as never);
  }

  it("claims the realm's nation page by realm slug; without a verified wiki account it is pending", async () => {
    const db = claimDb();
    await expect(
      claimCaller(db).claimNationPage({ realmSlug: "eurth", title: "Aurelia" })
    ).resolves.toEqual({ claimId: "cl1", status: "pending", autoApproved: false });
    expect(db.realm.findUnique).toHaveBeenCalledWith({
      where: { slug: "eurth" },
      select: { id: true },
    });
    expect(db.realmPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: "eurth-id", kind: "nation", title: "Aurelia" } })
    );
    expect(db.realmClaim.create).toHaveBeenCalledWith({
      data: {
        realmId: "eurth-id",
        userId: "u1",
        wikiSource: "iiwiki",
        wikiPageTitle: "Aurelia",
        countryId: null,
        status: "pending",
      },
    });
  });

  it("an unknown realm is NOT_FOUND", async () => {
    const db = claimDb(null);
    await expect(
      claimCaller(db).claimNationPage({ realmSlug: "nowhere", title: "Aurelia" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Realm not found" });
    expect(db.realmPage.findFirst).not.toHaveBeenCalled();
  });

  it("a page outside the realm's index is NOT_FOUND and a nation that exists is CONFLICT", async () => {
    const missing = claimDb();
    missing.realmPage.findFirst.mockResolvedValue(null);
    await expect(
      claimCaller(missing).claimNationPage({ realmSlug: "eurth", title: "Nowhere" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const taken = claimDb();
    taken.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(
      claimCaller(taken).claimNationPage({ realmSlug: "eurth", title: "Aurelia" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires sign-in", async () => {
    const db = claimDb();
    await expect(
      claimCaller(db, false).claimNationPage({ realmSlug: "eurth", title: "Aurelia" })
    ).rejects.toThrow("Authentication required");
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  /** A realm whose founder wrote rules: claims need "I have read the realm's rules". */
  function rulesDb() {
    const db = claimDb();
    db.realmPage.findFirst.mockResolvedValue({
      wikiSource: "iiwiki",
      realm: { slug: "eurth", settings: null, status: "active", rulesHtml: "<p>Be civil.</p>" },
    } as never);
    return db;
  }

  it("refuses a claim in a realm with rules until the player accepts them", async () => {
    const db = rulesDb();
    await expect(
      claimCaller(db).claimNationPage({ realmSlug: "eurth", title: "Aurelia" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(/rules/) });
    await expect(
      claimCaller(db).claimNationPage({ realmSlug: "eurth", title: "Aurelia", acceptedRules: false })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
    expect(db.wikiAccountLink.findFirst).not.toHaveBeenCalled();
  });

  it("files the claim once the rules are accepted, recording when", async () => {
    const db = rulesDb();
    await expect(
      claimCaller(db).claimNationPage({ realmSlug: "eurth", title: "Aurelia", acceptedRules: true })
    ).resolves.toMatchObject({ status: "pending" });
    const data = db.realmClaim.create.mock.calls[0][0].data;
    expect(data.rulesAcceptedAt).toBeInstanceOf(Date);
  });
});

describe("realms.adminCreateRealm", () => {
  const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };
  const member = { id: "db_member", clerkUserId: "member_1", role: { name: "user", level: 100 } };

  function adminCaller(create: jest.Mock, user = admin) {
    const ctx = createMockRouterContext({
      db: { realm: { create }, auditLog: { create: jest.fn() } },
      auth: { userId: user.clerkUserId },
      user,
    });
    return realmsRouter.createCaller(ctx as never);
  }

  it("creates an active realm owned by system unless an owner is given", async () => {
    const create = jest.fn().mockResolvedValue({ id: "r1", slug: "eurth", name: "Eurth" });

    await adminCaller(create).adminCreateRealm({
      slug: "eurth",
      name: "Eurth",
      visibility: "public",
    });
    await adminCaller(create).adminCreateRealm({
      slug: "eurth-2",
      name: "Eurth II",
      description: "Second",
      visibility: "unlisted",
      ownerId: "user_founder",
    });

    expect(create).toHaveBeenNthCalledWith(1, {
      data: {
        slug: "eurth",
        name: "Eurth",
        visibility: "public",
        ownerId: "system",
        status: "active",
      },
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      data: {
        slug: "eurth-2",
        name: "Eurth II",
        description: "Second",
        visibility: "unlisted",
        ownerId: "user_founder",
        status: "active",
      },
    });
  });

  it.each(["Eurth", "e", "a".repeat(41), "eu rth", "eurth!", "eurth_2"])(
    "rejects the slug %p without touching the database",
    async (slug) => {
      const create = jest.fn();
      await expect(
        adminCaller(create).adminCreateRealm({ slug, name: "Eurth", visibility: "public" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(create).not.toHaveBeenCalled();
    }
  );

  it("turns a duplicate slug (P2002) into CONFLICT", async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );
    await expect(
      adminCaller(create).adminCreateRealm({ slug: "ixworld", name: "Copy", visibility: "public" })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "That slug is taken" });
  });

  it("is admin-only", async () => {
    const create = jest.fn();
    await expect(
      adminCaller(create, member).adminCreateRealm({
        slug: "eurth",
        name: "Eurth",
        visibility: "public",
      })
    ).rejects.toThrow("Admin privileges required");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("realms.adminUpdateRealm", () => {
  const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };

  function adminCaller(realm: { findUnique: jest.Mock; update: jest.Mock; findMany?: jest.Mock }) {
    const ctx = createMockRouterContext({
      db: { realm, auditLog: { create: jest.fn() } },
      auth: { userId: admin.clerkUserId },
      user: admin,
    });
    return realmsRouter.createCaller(ctx as never);
  }

  it("adminListRealms reports each realm's effective cap (default 1)", async () => {
    const realm = {
      findMany: jest.fn().mockResolvedValue([
        { id: "r_eurth", settings: { maxNationsPerUser: 3 } },
        { id: "default", settings: null },
      ]),
      findUnique: jest.fn(),
      update: jest.fn(),
    };
    await expect(adminCaller(realm).adminListRealms()).resolves.toMatchObject([
      { id: "r_eurth", maxNationsPerUser: 3 },
      { id: "default", maxNationsPerUser: 1 },
    ]);
  });

  it("merges maxNationsPerUser into Realm.settings and keeps the other keys", async () => {
    const realm = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ settings: { maxNationsPerUser: 1, theme: "dusk" } }),
      update: jest.fn().mockResolvedValue({ id: "r_eurth" }),
    };
    await adminCaller(realm).adminUpdateRealm({
      id: "r_eurth",
      name: "Eurth",
      maxNationsPerUser: 3,
    });

    expect(realm.update).toHaveBeenCalledWith({
      where: { id: "r_eurth" },
      data: { name: "Eurth", settings: { maxNationsPerUser: 3, theme: "dusk" } },
    });
  });

  it("starts settings from empty when the realm has none", async () => {
    const realm = {
      findUnique: jest.fn().mockResolvedValue({ settings: null }),
      update: jest.fn().mockResolvedValue({ id: "r_eurth" }),
    };
    await adminCaller(realm).adminUpdateRealm({ id: "r_eurth", maxNationsPerUser: 2 });

    expect(realm.update.mock.calls[0][0].data).toEqual({ settings: { maxNationsPerUser: 2 } });
  });

  it("leaves settings untouched when no cap is sent", async () => {
    const realm = { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: "r_eurth" }) };
    await adminCaller(realm).adminUpdateRealm({ id: "r_eurth", status: "archived" });

    expect(realm.findUnique).not.toHaveBeenCalled();
    expect(realm.update).toHaveBeenCalledWith({
      where: { id: "r_eurth" },
      data: { status: "archived" },
    });
  });

  it.each([0, 21, 1.5])("rejects a cap of %p", async (maxNationsPerUser) => {
    const realm = { findUnique: jest.fn(), update: jest.fn() };
    await expect(
      adminCaller(realm).adminUpdateRealm({ id: "r_eurth", maxNationsPerUser })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(realm.update).not.toHaveBeenCalled();
  });

  it("reports an unknown realm as NOT_FOUND", async () => {
    const realm = { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() };
    await expect(
      adminCaller(realm).adminUpdateRealm({ id: "nope", maxNationsPerUser: 2 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(realm.update).not.toHaveBeenCalled();
  });
});

describe("realms.adminListUsers (AT-19)", () => {
  const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };
  const nation = (id: string, name: string, realmId: string, realmName: string | null) => ({
    id,
    name,
    realmId,
    realm: realmName ? { name: realmName } : null,
  });

  it("lists every nation a user holds across realms and marks the active one", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "u1",
        clerkUserId: "clerk_u1",
        countryId: "e1",
        membershipTier: "premium",
        isActive: true,
        createdAt: new Date(0),
        country: nation("e1", "Gallambria", "eurth-id", "Eurth"),
        ownedCountries: [
          nation("c1", "Aurelia", "default", null),
          nation("e1", "Gallambria", "eurth-id", "Eurth"),
        ],
      },
      {
        id: "u2",
        clerkUserId: "clerk_u2",
        countryId: "c2",
        membershipTier: "basic",
        isActive: true,
        createdAt: new Date(0),
        // A legacy active link without an ownership row is still shown.
        country: nation("c2", "Borea", "default", null),
        ownedCountries: [],
      },
    ]);
    const ctx = createMockRouterContext({
      db: { user: { findMany }, auditLog: { create: jest.fn() } },
      auth: { userId: admin.clerkUserId },
      user: admin,
    });
    const users = await realmsRouter.createCaller(ctx as never).adminListUsers();

    expect(users.map((u) => u.nations)).toEqual([
      [
        { id: "c1", name: "Aurelia", realmId: "default", realmName: null, active: false },
        { id: "e1", name: "Gallambria", realmId: "eurth-id", realmName: "Eurth", active: true },
      ],
      [{ id: "c2", name: "Borea", realmId: "default", realmName: null, active: true }],
    ]);
    for (const u of users) {
      expect(u).not.toHaveProperty("country");
      expect(u).not.toHaveProperty("ownedCountries");
    }
  });
});
