/** @jest-environment node */
import { listBuilderRealms, listMyNations, resolveBuilderRealm } from "~/server/modules/realms";

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

const user = { id: "u1", clerkUserId: "clerk_u1" };

function builderDb(opts: {
  membershipTier?: string;
  activeRealmId?: string | null;
  realms: Array<{ id: string; slug: string; name: string; settings: object | null }>;
  owned?: string[];
}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        membershipTier: opts.membershipTier ?? "basic",
        country: opts.activeRealmId ? { realmId: opts.activeRealmId } : null,
      }),
    },
    realm: {
      findMany: jest.fn().mockResolvedValue(opts.realms),
      findUnique: jest.fn(),
    },
    country: {
      findMany: jest.fn().mockResolvedValue((opts.owned ?? []).map((realmId) => ({ realmId }))),
      count: jest.fn(),
    },
  } as any;
}

describe("listBuilderRealms", () => {
  it("lists IxWorld first, with the player's standing against each realm's effective cap", async () => {
    const db = builderDb({
      membershipTier: "mycountry_premium",
      activeRealmId: "eurth",
      realms: [
        { id: "eurth", slug: "eurth", name: "Eurth", settings: { maxNationsPerUser: 3 } },
        { id: "default", slug: "ixworld", name: "IxWorld", settings: null },
        { id: "zed", slug: "zed", name: "Zed", settings: { maxNationsPerUser: 20 } },
      ],
      owned: ["default", "eurth", "eurth", "eurth"],
    });
    await expect(listBuilderRealms(db, user)).resolves.toEqual({
      defaultRealmId: "eurth",
      realms: [
        { id: "default", slug: "ixworld", name: "IxWorld", held: 1, cap: 1, canCreate: false },
        { id: "eurth", slug: "eurth", name: "Eurth", held: 3, cap: 3, canCreate: false },
        { id: "zed", slug: "zed", name: "Zed", held: 0, cap: 5, canCreate: true },
      ],
    });
  });

  it("offers IxWorld and active realms that are public, founded by the player, or where they hold a nation", async () => {
    const db = builderDb({ realms: [] });
    await listBuilderRealms(db, user);
    expect(db.realm.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: "default" },
          {
            status: "active",
            OR: [
              { visibility: "public" },
              { ownerId: "clerk_u1" },
              { countries: { some: { ownerUserId: "u1" } } },
            ],
          },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, settings: true },
    });
  });

  it("falls back to IxWorld as the default when the active nation's realm is not offered", async () => {
    const db = builderDb({
      activeRealmId: "closed",
      realms: [{ id: "default", slug: "ixworld", name: "IxWorld", settings: null }],
    });
    await expect(listBuilderRealms(db, user)).resolves.toMatchObject({ defaultRealmId: "default" });
  });
});

describe("resolveBuilderRealm", () => {
  function db(realm: object | null, held = 0, membershipTier = "basic") {
    return {
      user: { findUnique: jest.fn().mockResolvedValue({ membershipTier, country: null }) },
      realm: { findUnique: jest.fn().mockResolvedValue(realm), findMany: jest.fn() },
      country: { count: jest.fn().mockResolvedValue(held), findMany: jest.fn() },
    } as any;
  }

  it("IxWorld needs no realm row", async () => {
    await expect(resolveBuilderRealm(db(null), user)).resolves.toMatchObject({
      realmId: "default",
    });
  });

  it("IxWorld's row is open whatever its status", async () => {
    await expect(
      resolveBuilderRealm(db({ id: "default", status: "draft", settings: null }), user, "default")
    ).resolves.toMatchObject({ realmId: "default" });
  });

  it("refuses unknown, closed and full realms with typed errors", async () => {
    await expect(resolveBuilderRealm(db(null), user, "x")).rejects.toMatchObject({
      code: "REALM_NOT_FOUND",
    });
    await expect(
      resolveBuilderRealm(db({ id: "x", status: "generating", settings: null }), user, "x")
    ).rejects.toMatchObject({ code: "REALM_CLOSED" });
    await expect(
      resolveBuilderRealm(
        db({ id: "x", status: "active", settings: { maxNationsPerUser: 5 } }, 1),
        user,
        "x"
      )
    ).rejects.toMatchObject({ code: "CAP_REACHED", message: expect.stringMatching(/Premium/) });
  });

  it("a premium player under the realm cap passes", async () => {
    const d = db(
      { id: "x", status: "active", settings: { maxNationsPerUser: 5 } },
      4,
      "mycountry_premium"
    );
    await expect(resolveBuilderRealm(d, user, "x")).resolves.toMatchObject({
      realmId: "x",
      capacity: { held: 4, cap: 5, canTakeAnother: true },
    });
  });
});

describe("listMyNations", () => {
  it("groups the player's nations by realm (IxWorld first), with the active and dividend nations", async () => {
    const owned = [
      {
        id: "c1",
        name: "Aurelia",
        slug: "aurelia",
        flag: null,
        realmId: "default",
        realm: { slug: "ixworld", name: "IxWorld" },
      },
      {
        id: "e1",
        name: "Brava",
        slug: "brava",
        flag: "f.png",
        realmId: "eurth",
        realm: { slug: "eurth", name: "Eurth" },
      },
      {
        id: "a1",
        name: "Cadiz",
        slug: "cadiz",
        flag: null,
        realmId: "alpha",
        realm: { slug: "alpha", name: "Alpha" },
      },
      {
        id: "e2",
        name: "Dorn",
        slug: "dorn",
        flag: null,
        realmId: "eurth",
        realm: { slug: "eurth", name: "Eurth" },
      },
    ];
    const db = {
      country: {
        findMany: jest.fn().mockResolvedValue(owned),
        findFirst: jest.fn().mockResolvedValue({ id: "c1" }),
      },
    } as any;
    const result = await listMyNations(db, { id: "u1", countryId: "e2" });
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: "u1" } })
    );
    expect(result.activeCountryId).toBe("e2");
    expect(result.dividendCountryId).toBe("c1");
    expect(result.realms.map((r) => [r.id, r.nations.map((n) => n.id)])).toEqual([
      ["default", ["c1"]],
      ["alpha", ["a1"]],
      ["eurth", ["e1", "e2"]],
    ]);
    expect(result.realms[2]).toMatchObject({ slug: "eurth", name: "Eurth" });
  });

  it("an account with no nations gets an empty list", async () => {
    const db = {
      country: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;
    await expect(listMyNations(db, { id: "u1", countryId: null })).resolves.toEqual({
      activeCountryId: null,
      dividendCountryId: null,
      realms: [],
    });
  });
});
