/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.invites", () => ({
  resolveInviterUserId: jest.fn((via: string) =>
    Promise.resolve(via === "ambassador" ? "u_inviter" : null)
  ),
  resolveRealmInviter: jest.fn().mockResolvedValue({ handle: "ambassador", displayName: "Amb" }),
}));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

import { Prisma } from "@prisma/client";
jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));

import { realmsRouter } from "~/server/api/routers/realms";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { NATION_SEARCH_LIMIT } from "~/server/api/routers/realms/places";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  loadRealmMetadataSource,
  realmMetadata,
  type RealmMetadataSource,
} from "~/server/modules/realms";
import { DEFAULT_REALM_ID, resolveViewerRealmId } from "~/server/modules/realms";
import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";
import { SYSTEM_REALM_IDS } from "~/lib/realms/realm-ids";
import {
  findRealmIdBySlug,
  getRealmHub,
  isRealmOpen,
  isRealmPublished,
} from "~/server/modules/realms";
import { deleteRealm } from "~/server/modules/realms/realms.admin";
/** The realm content terms consent every claim carries (ToS §2.6). */
const consent = { accepted: true as const };

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
      slug: "ixnay",
      name: "Ixnay",
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
    const realm = await caller(findUnique).getBySlug({ slug: "ixnay" });

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
  it("keeps a renamed nation's page taken: pages match countries by page reference, by name only without one", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      description: null,
      thumbnail: null,
      status: "active",
      visibility: "public",
      countries: [
        {
          id: "c1",
          name: "New Gallambria",
          slug: "gallambria-eurth",
          flag: null,
          ownerUserId: "u1",
          wikiSource: "iiwiki",
          wikiPageTitle: "Gallambria",
        },
        {
          id: "c2",
          name: "Borea",
          slug: "borea",
          flag: null,
          ownerUserId: null,
          wikiSource: "ixwiki",
          wikiPageTitle: null,
        },
      ],
      pages: [
        { title: "Aurelia", wikiSource: "iiwiki" },
        { title: "Borea", wikiSource: "iiwiki" },
        { title: "Gallambria", wikiSource: "iiwiki" },
      ],
      _count: { pages: 3 },
    });
    const realmPage = { findFirst: jest.fn().mockResolvedValue({ wikiSource: "iiwiki" }) };
    const realm = await caller(findUnique, realmPage).getBySlug({ slug: "eurth" });
    expect(realm?.nationPages).toEqual([{ title: "Aurelia", wikiSource: "iiwiki" }]);
    expect(JSON.stringify(realm)).not.toContain("wikiPageTitle");
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

  it.each(["draft"])(
    "hides a %s realm from the public and from signed-in players",
    async (status) => {
      const findUnique = jest.fn().mockResolvedValue(hubRow(status));
      await expect(caller(findUnique).getBySlug({ slug: "eurth" })).resolves.toBeNull();
      await expect(
        caller(findUnique, undefined, viewer("clerk_player")).getBySlug({ slug: "eurth" })
      ).resolves.toBeNull();
    }
  );
  it("keeps an archived realm readable with claims closed, and never exposes the founder id", async () => {
    const findUnique = jest.fn().mockResolvedValue(hubRow("archived"));
    const realm = await caller(findUnique).getBySlug({ slug: "eurth" });
    expect(realm).toMatchObject({ status: "archived", claimsOpen: false });
    expect(JSON.stringify(realm)).not.toContain("clerk_founder");
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
      nationMaterialHold: { findUnique: jest.fn().mockResolvedValue(null) },
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

  it("refuses a claim without the realm content consent", async () => {
    const db = claimDb();
    await expect(
      claimCaller(db).claimNationPage({ realmSlug: "eurth", title: "Aurelia" } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });

  it("records who gave permission when the material is someone else's", async () => {
    const db = claimDb();
    await claimCaller(db).claimNationPage({
      consent: { accepted: true, permissionNote: "  Kir, on the Eurth Discord  " },
      realmSlug: "eurth",
      title: "Aurelia",
    });
    expect(db.realmClaim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consentBasis: "permission",
        permissionNote: "Kir, on the Eurth Discord",
      }),
    });
  });
});

describe("realm invites through the router", () => {
  const player = { id: "u1", clerkUserId: "clerk_u1", countryId: null, role: null };

  function inviteDb() {
    return {
      realm: { findUnique: jest.fn().mockResolvedValue({ id: "eurth-id" }) },
      realmPage: {
        findFirst: jest.fn().mockResolvedValue({
          wikiSource: "iiwiki",
          realm: { slug: "eurth", settings: null, status: "active" },
        }),
      },
      country: {
        // The inviter holds a nation in Eurth; no nation named Aurelia exists yet.
        findFirst: jest.fn(({ where }: { where: { ownerUserId?: string } }) =>
          Promise.resolve(where.ownerUserId === "u_inviter" ? { id: "held" } : null)
        ),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }) },
      wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
      nationMaterialHold: { findUnique: jest.fn().mockResolvedValue(null) },
      realmClaim: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "cl1", ...data })),
      },
      $transaction: jest.fn(),
    };
  }

  function inviteCaller(db: object, signedIn = true) {
    const ctx = createMockRouterContext({
      db,
      auth: signedIn ? { userId: player.clerkUserId } : null,
      user: signedIn ? player : null,
    });
    return realmsRouter.createCaller(ctx as never);
  }

  it("an overlong via is dropped, never refused", async () => {
    const db = inviteDb();
    await expect(
      inviteCaller(db).claimNationPage({
        consent,
        realmSlug: "eurth",
        title: "Aurelia",
        via: "x".repeat(300),
      })
    ).resolves.toMatchObject({ status: "pending" });
    expect(db.realmClaim.create.mock.calls[0]?.[0]).not.toHaveProperty("data.invitedByUserId");
  });
});

describe("realms.adminCreateRealm", () => {
  const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };
  const createMany = jest.fn().mockResolvedValue({ count: 4 });
  const threadCreateMany = jest.fn().mockResolvedValue({ count: 1 });

  // N3: the realm and its categories are written through one transaction client, never the outer one.
  const transaction = jest.fn(async (fn: (tx: object) => Promise<object>) =>
    fn({
      realm: { create: transactionCreate },
      forumCategory: { createMany, findFirst: jest.fn().mockResolvedValue({ id: "cat_board" }) },
      forumThread: { createMany: threadCreateMany },
    })
  );
  let transactionCreate: jest.Mock = jest.fn();

  function adminCaller(create: jest.Mock, user = admin) {
    transactionCreate = create;
    const ctx = createMockRouterContext({
      db: { $transaction: transaction, auditLog: { create: jest.fn() } },
      auth: { userId: user.clerkUserId },
      user,
    });
    return realmsRouter.createCaller(ctx as never);
  }

  it("gives the new realm its board thread in the same transaction", async () => {
    threadCreateMany.mockClear();
    const create = jest.fn().mockResolvedValue({ id: "r1", slug: "eurth", name: "Eurth" });
    await adminCaller(create).adminCreateRealm({
      slug: "eurth",
      name: "Eurth",
      visibility: "public",
    });
    expect(threadCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ categoryId: "cat_board", title: "Eurth board" })],
      })
    );
  });

  it("rolls the realm back when seeding its categories fails (N3)", async () => {
    transaction.mockClear();
    createMany.mockRejectedValueOnce(new Error("connection reset"));
    const create = jest.fn().mockResolvedValue({ id: "r1", slug: "eurth", name: "Eurth" });
    await expect(
      adminCaller(create).adminCreateRealm({ slug: "eurth", name: "Eurth", visibility: "public" })
    ).rejects.toThrow("connection reset");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("turns a duplicate slug (P2002) into CONFLICT", async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );
    await expect(
      adminCaller(create).adminCreateRealm({ slug: "ixnay", name: "Copy", visibility: "public" })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "That slug is taken" });
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

  describe("tile access", () => {
    beforeEach(() => jest.mocked(invalidateRealmMap).mockClear());

    it.each(["draft", "active"] as const)(
      "moves the realm to a new map version after its status becomes %s",
      async (status) => {
        const realm = {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: "r_eurth" }),
        };
        await adminCaller(realm).adminUpdateRealm({ id: "r_eurth", status });

        expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
        expect(invalidateRealmMap).toHaveBeenCalledWith(expect.anything(), "r_eurth");
        // After the write, so a reader that rebuilds the memo sees the new status
        const [update] = realm.update.mock.invocationCallOrder;
        const [invalidated] = jest.mocked(invalidateRealmMap).mock.invocationCallOrder;
        expect(update).toBeLessThan(invalidated!);
      }
    );
  });
});

/**
 * The /realms landing page: `realms.searchNations` finds nations across the realms the directory lists only
 * (never a draft, generating or unlisted realm), marks claimable ones, never leaks owner ids, and runs behind the
 * public rate limit; the directory counts each realm's claimable nation pages.
 */
describe("nation search", () => {
  type Db = ReturnType<typeof createMockPrisma>;
  const EURTH = { id: "eurth", slug: "eurth", name: "Eurth" };
  const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay" };
  function makeDb(): Db {
    const db = createMockPrisma();
    db.realm.findMany.mockResolvedValue([IXNAY, EURTH]);
    db.country.findMany.mockImplementation(async ({ where }: any) => {
      // The "which pages has a country taken" lookup: Aurora by name (no page reference), Auberon renamed.
      if (where.OR)
        return [
          { realmId: "eurth", name: "Aurora", wikiSource: "ixwiki", wikiPageTitle: null },
          { realmId: "eurth", name: "New Auberon", wikiSource: "ixwiki", wikiPageTitle: "Auberon" },
        ];
      return [
        {
          id: "c1",
          name: "Aurelia",
          slug: "aurelia",
          flag: null,
          realmId: "eurth",
          ownerUserId: "u_secret",
        },
        {
          id: "c2",
          name: "Austral",
          slug: "austral",
          flag: "/f.png",
          realmId: "default",
          ownerUserId: null,
        },
      ];
    });
    db.realmPage.findMany.mockResolvedValue([
      { realmId: "eurth", title: "Aurora", wikiSource: "ixwiki" },
      { realmId: "eurth", title: "Auberon", wikiSource: "ixwiki" },
      { realmId: "eurth", title: "Auvergne", wikiSource: "ixwiki" },
    ]);
    return db;
  }
  function caller(db: Db) {
    return realmsRouter.createCaller(
      createMockRouterContext({ db, auth: null, user: null }) as never
    );
  }
  describe("realms.searchNations", () => {
    it("searches only the realms the directory lists", async () => {
      const db = makeDb();
      await caller(db).searchNations({ query: "  au " });

      expect(db.realm.findMany.mock.calls[0]![0].where).toEqual(DIRECTORY_REALM_WHERE);
      const countryWhere = db.country.findMany.mock.calls[0]![0].where;
      expect(countryWhere).toEqual({
        realmId: { in: ["default", "eurth"] },
        isDemo: false,
        claimable: true,
        name: { contains: "au", mode: "insensitive" },
      });
      expect(db.country.findMany.mock.calls[0]![0].take).toBe(NATION_SEARCH_LIMIT);
      expect(db.realmPage.findMany.mock.calls[0]![0].where).toEqual({
        realmId: { in: ["default", "eurth"] },
        kind: "nation",
        title: { contains: "au", mode: "insensitive" },
      });
    });
    it("caps the results", async () => {
      const db = makeDb();
      db.country.findMany.mockImplementation(async ({ where }: any) =>
        where.name?.in
          ? []
          : Array.from({ length: NATION_SEARCH_LIMIT }, (_, i) => ({
              id: `c${i}`,
              name: `Nation ${String(i).padStart(2, "0")}`,
              slug: null,
              flag: null,
              realmId: "eurth",
              ownerUserId: null,
            }))
      );
      const result = await caller(db).searchNations({ query: "na" });
      expect(result).toHaveLength(NATION_SEARCH_LIMIT);
    });
  });
});

/**
 * Realm page metadata (`/r/{slug}` link unfurls): the realm's name and a short description from its
 * own description, factbook or tags; no canonical (the realm's pages inherit it). Draft and unknown
 * realms add nothing, so the root defaults stand and nothing about an unpublished realm leaks.
 */
describe("realm page metadata", () => {
  function source(over: Partial<RealmMetadataSource> = {}): RealmMetadataSource {
    return {
      name: "Eurth",
      unlisted: false,
      description: null,
      factbookText: null,
      tags: [],
      nationCount: 12,
      openCount: 4,
      bannerUrl: null,
      ...over,
    };
  }
  describe("realmMetadata", () => {
    it("keeps an unlisted realm out of search results but still unfurls it", () => {
      expect(realmMetadata(source()).robots).toBeUndefined();
      const meta = realmMetadata(source({ unlisted: true }));
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.title).toBe("Eurth");
    });
  });
  describe("loadRealmMetadataSource", () => {
    const row = {
      id: "r1",
      name: "Eurth",
      status: "active",
      visibility: "public",
      description: "  ",
      factbookHtml: "<p>The <b>Eurth</b> factbook.</p>",
      tags: ["Modern"],
      bannerUrl: " /images/uploads/eurth-banner.png " as string | null,
    };

    type RealmRow = typeof row;

    function dbWith(realm: RealmRow | null, nations = 12, claimed = 8) {
      const db = createMockPrisma();
      db.realm.findUnique.mockResolvedValue(realm);
      db.country.count.mockImplementation(
        async ({ where }: { where: { ownerUserId?: { not: null } } }) =>
          where.ownerUserId ? claimed : nations
      );
      return db;
    }

    it("returns null for draft, generating and unknown realms", async () => {
      for (const status of ["draft", "generating"]) {
        const db = dbWith({ ...row, status });
        await expect(loadRealmMetadataSource(db as never, "eurth")).resolves.toBeNull();
        expect(db.country.count).not.toHaveBeenCalled();
      }
      await expect(loadRealmMetadataSource(dbWith(null) as never, "nope")).resolves.toBeNull();
    });
  });
});

describe("the viewer's realm", () => {
  const db = (row: { id: string; status?: string; ownerId?: string } | null) =>
    ({ realm: { findUnique: jest.fn().mockResolvedValue(row) } }) as any;
  describe("resolveViewerRealmId", () => {
    it("hides a draft or generating realm's slug from everyone but its staff (AT-6)", async () => {
      const draft = { id: "r_draft", status: "draft", ownerId: "clerk_founder" };
      const founder = { id: "u_f", clerkUserId: "clerk_founder", role: null };
      const admin = { id: "u_a", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } };
      const player = { id: "u_p", clerkUserId: "clerk_player", role: null };
      await expect(resolveViewerRealmId(db(draft), { realmSlug: "d" })).resolves.toBe(
        DEFAULT_REALM_ID
      );
      await expect(
        resolveViewerRealmId(db(draft), { realmSlug: "d", viewer: player })
      ).resolves.toBe(DEFAULT_REALM_ID);
      await expect(
        resolveViewerRealmId(db(draft), { realmSlug: "d", viewer: founder })
      ).resolves.toBe("r_draft");
      await expect(
        resolveViewerRealmId(db(draft), { realmSlug: "d", viewer: admin })
      ).resolves.toBe("r_draft");
      const generating = { ...draft, status: "generating" };
      await expect(resolveViewerRealmId(db(generating), { realmSlug: "d" })).resolves.toBe(
        DEFAULT_REALM_ID
      );
    });

    it("resolves unlisted and archived realms by slug for anyone (reachable by link)", async () => {
      for (const status of ["active", "archived"]) {
        const row = { id: "r_hidden", status, ownerId: "system", visibility: "unlisted" };
        await expect(resolveViewerRealmId(db(row as never), { realmSlug: "h" })).resolves.toBe(
          "r_hidden"
        );
      }
    });
  });
});

/** System realms (Realm.isSystem): shelves for cards, never listed, claimable, mapped or deleted (spec §5.1). */
describe("system realms", () => {
  const admin = { id: "u_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } };
  const systemRow = (id: string) => ({
    id,
    slug: id,
    name: id,
    description: null,
    thumbnail: null,
    ownerId: "system",
    status: "active",
    visibility: "public",
    countries: [],
    pages: [],
    _count: { pages: 0, countries: 0 },
  });
  describe("system realms", () => {
    it("are never open to claims or new nations, nor published, though their rows say active", () => {
      for (const id of SYSTEM_REALM_IDS) {
        expect(isRealmOpen(id, "active")).toBe(false);
        expect(isRealmPublished(id, "active")).toBe(false);
      }
      expect(isRealmOpen("eurth", "active")).toBe(true);
      expect(isRealmOpen("default", "draft")).toBe(true);
    });

    it("are left out of the directory", () => {
      expect(DIRECTORY_REALM_WHERE).toMatchObject({ isSystem: false });
    });

    it("have no hub, even for a site admin", async () => {
      const db = createMockPrisma();
      db.realm.findUnique.mockResolvedValue(systemRow("nationstates"));
      await expect(getRealmHub(db as never, "nationstates", admin)).resolves.toBeNull();
      expect(db.realmPage.findFirst).not.toHaveBeenCalled();
    });

    it("never become the viewer's realm: their slug resolves like an unknown one", async () => {
      const db = createMockPrisma();
      db.realm.findUnique.mockResolvedValue({ id: "iiwiki", status: "active", ownerId: "system" });
      await expect(findRealmIdBySlug(db as never, "iiwiki", admin)).resolves.toBeNull();
    });

    it("can't be deleted, and nor can a realm that still has cards", async () => {
      const db = createMockPrisma();
      await expect(
        deleteRealm(db as never, admin, { realmId: "althistory", confirmSlug: "althistory" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "System realms can't be deleted" });
      expect(db.realm.findUnique).not.toHaveBeenCalled();

      db.realm.findUnique.mockResolvedValue({
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        _count: { countries: 0 },
      });
      db.mapLayer.count.mockResolvedValue(0);
      db.card.count.mockResolvedValue(3);
      await expect(
        deleteRealm(db as never, admin, { realmId: "eurth", confirmSlug: "eurth" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(db.card.count).toHaveBeenCalledWith({ where: { realmId: "eurth" } });
      expect(db.$transaction).not.toHaveBeenCalled();
    });
    it("keep their slugs: no new realm may take one", () => {
      for (const slug of SYSTEM_REALM_IDS) expect(REALM_SLUG_PATTERN.test(slug)).toBe(false);
      expect(REALM_SLUG_PATTERN.test("mine")).toBe(false);
      expect(REALM_SLUG_PATTERN.test("iiwiki-fans")).toBe(true);
    });
  });
});
