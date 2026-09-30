/** @jest-environment node */
import {
  assignNation,
  capReachedMessage,
  createClaimsService,
  NATION_TIER_CAPS,
  nationCapacity,
  tierNationCap,
} from "~/server/modules/realms";

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

function client(held: number, membershipTier: string | null) {
  return {
    country: { count: jest.fn().mockResolvedValue(held) },
    user: { findUnique: jest.fn().mockResolvedValue({ membershipTier }) },
  } as any;
}

describe("tierNationCap", () => {
  const saved = process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL = saved;
  });

  it("free accounts hold 1 nation per realm, MyCountry Premium 5", () => {
    delete process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
    expect(NATION_TIER_CAPS).toEqual({ free: 1, premium: 5 });
    expect(tierNationCap(null)).toBe(1);
    expect(tierNationCap("basic")).toBe(1);
    expect(tierNationCap("mycountry_premium")).toBe(5);
  });

  it("follows hasPremiumTier, including the test-build switch", () => {
    process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL = "true";
    expect(tierNationCap("basic")).toBe(5);
  });
});

describe("nationCapacity: min(realm cap, tier cap)", () => {
  it("a premium player in a realm capped at 3 gets 3", async () => {
    const c = client(2, "mycountry_premium");
    await expect(
      nationCapacity(c, { userId: "u1", realmId: "r1", settings: { maxNationsPerUser: 3 } })
    ).resolves.toEqual({ held: 2, cap: 3, realmCap: 3, tierCap: 5, canTakeAnother: true });
    expect(c.country.count).toHaveBeenCalledWith({ where: { ownerUserId: "u1", realmId: "r1" } });
    expect(c.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { membershipTier: true },
    });
  });

  it("a premium player in a realm capped at 20 gets the tier's 5", async () => {
    const capacity = await nationCapacity(client(5, "mycountry_premium"), {
      userId: "u1",
      realmId: "r1",
      settings: { maxNationsPerUser: 20 },
    });
    expect(capacity).toMatchObject({ cap: 5, canTakeAnother: false });
  });

  it("a free player in a realm capped at 5 gets 1", async () => {
    const capacity = await nationCapacity(client(1, "basic"), {
      userId: "u1",
      realmId: "r1",
      settings: { maxNationsPerUser: 5 },
    });
    expect(capacity).toMatchObject({ cap: 1, realmCap: 5, tierCap: 1, canTakeAnother: false });
  });

  it("a premium player in a realm left at the default cap gets 1 (decision 15)", async () => {
    const capacity = await nationCapacity(client(0, "mycountry_premium"), {
      userId: "u1",
      realmId: "r1",
      settings: null,
    });
    expect(capacity).toMatchObject({ cap: 1, canTakeAnother: true });
  });

  it("uses a membershipTier the caller passes instead of reading the user", async () => {
    const c = client(0, "basic");
    const capacity = await nationCapacity(c, {
      userId: "u1",
      realmId: "r1",
      settings: { maxNationsPerUser: 5 },
      membershipTier: "mycountry_premium",
    });
    expect(capacity.cap).toBe(5);
    expect(c.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("capReachedMessage", () => {
  it("names Premium only when Premium would raise the limit", () => {
    expect(capReachedMessage({ cap: 1, realmCap: 5, tierCap: 1 })).toMatch(
      /Premium raises the limit/
    );
    expect(capReachedMessage({ cap: 1, realmCap: 1, tierCap: 1 })).not.toMatch(/Premium/);
    expect(capReachedMessage({ cap: 5, realmCap: 20, tierCap: 5 })).not.toMatch(/Premium/);
    expect(capReachedMessage({ cap: 3, realmCap: 3, tierCap: 5 })).toMatch(/3 nations/);
  });
});

describe("the tier cap is enforced by assignNation and claims", () => {
  const unowned = {
    id: "c1",
    realmId: "r1",
    ownerUserId: null,
    realm: { settings: { maxNationsPerUser: 5 } },
  };

  function tx(held: number, membershipTier: string) {
    return {
      country: {
        findUnique: jest.fn().mockResolvedValue(unowned),
        count: jest.fn().mockResolvedValue(held),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ membershipTier }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as any;
  }

  it("assignNation: a free player with 1 nation in a 5-cap realm is refused", async () => {
    const t = tx(1, "basic");
    await expect(assignNation(t, { userId: "u1", countryId: "c1" })).rejects.toMatchObject({
      code: "CAP_REACHED",
    });
    expect(t.country.updateMany).not.toHaveBeenCalled();
  });

  it("assignNation: a premium player with 4 nations in a 5-cap realm takes a fifth", async () => {
    const t = tx(4, "mycountry_premium");
    await assignNation(t, { userId: "u1", countryId: "c1" });
    expect(t.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
  });

  it("claims: a free player with 1 nation in a 5-cap realm cannot file a claim", async () => {
    const db: any = {
      country: {
        findUnique: jest.fn().mockResolvedValue({
          ...unowned,
          name: "Aurelia",
          wikiSource: "ixwiki",
          wikiPageTitle: null,
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }) },
      realmClaim: { findFirst: jest.fn(), create: jest.fn() },
    };
    const claims = createClaimsService(db, {
      fetchPageCreator: jest.fn(),
      onNationAssigned: jest.fn(),
    });
    await expect(
      claims.claimCountry({ id: "u1", clerkUserId: "clerk_u1" }, "c1")
    ).rejects.toMatchObject({ code: "CAP_REACHED", message: expect.stringMatching(/Premium/) });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });
});
