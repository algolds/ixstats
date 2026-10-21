/** @jest-environment node */
import { listBuilderRealms, resolveBuilderRealm } from "~/server/modules/realms";

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
  it("offers Ixnay and active, non-system realms that are public, founded by the player, or where they hold a nation", async () => {
    const db = builderDb({ realms: [] });
    await listBuilderRealms(db, user);
    expect(db.realm.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: "default" },
          {
            status: "active",
            isSystem: false,
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
});

describe("resolveBuilderRealm", () => {
  function db(realm: object | null, held = 0, membershipTier = "basic") {
    return {
      user: { findUnique: jest.fn().mockResolvedValue({ membershipTier, country: null }) },
      realm: { findUnique: jest.fn().mockResolvedValue(realm), findMany: jest.fn() },
      country: { count: jest.fn().mockResolvedValue(held), findMany: jest.fn() },
    } as any;
  }

  it("Ixnay's row is open whatever its status", async () => {
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
});
