import { createClaimsService } from "~/server/modules/realms";

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  resolvePrimaryWikiUsername: (name: string) => (name === "Carthinova" ? "Kir" : name),
}));
// If importing account-proof drags heavy modules into Jest, also:
// jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge/http-reader", () => ({ getFullIiwikiApiUrl: () => "https://iiwiki.test/api.php" }));

const actor = { id: "u1", clerkUserId: "clerk_u1", role: null };
const admin = { id: "a1", clerkUserId: "clerk_a1", role: { name: "admin", level: 10 } };
const country = {
  id: "c1",
  name: "Aurelia",
  realmId: "default",
  ownerUserId: null,
  wikiSource: "ixwiki",
  wikiPageTitle: null,
  realm: { settings: null },
};

function setup() {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    country: {
      findUnique: jest.fn().mockResolvedValue(country),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue({ username: "Kir" }) },
    realmClaim: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: "cl1", ...data })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const deps = {
    fetchPageCreator: jest.fn().mockResolvedValue("Kir"),
    onNationAssigned: jest.fn().mockResolvedValue(undefined),
  };
  return { db, deps, claims: createClaimsService(db, deps) };
}

describe("claimCountry", () => {
  it("auto-approves the verified page creator and runs side effects once", async () => {
    const { db, deps, claims } = setup();
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({
      status: "approved",
      autoApproved: true,
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { ownerUserId: "u1" },
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
    expect(deps.fetchPageCreator).toHaveBeenCalledWith("ixwiki", "Aurelia");
  });

  it("matches underscores and known alt accounts", async () => {
    const { deps, claims } = setup();
    deps.fetchPageCreator.mockResolvedValue("Carthinova"); // KNOWN_WIKI_ALTS: Carthinova → Kir
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "approved" });
  });

  it("stays pending on creator mismatch, missing verified link, or wiki failure", async () => {
    const a = setup();
    a.deps.fetchPageCreator.mockResolvedValue("Someone Else");
    await expect(a.claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "pending" });
    const b = setup();
    b.db.wikiAccountLink.findFirst.mockResolvedValue(null);
    await expect(b.claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "pending" });
    const c = setup();
    c.deps.fetchPageCreator.mockRejectedValue(new Error("cloudflare"));
    await expect(c.claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "pending" });
    expect(c.deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("refuses owned countries and full caps; reuses an existing pending claim", async () => {
    const a = setup();
    a.db.country.findUnique.mockResolvedValue({ ...country, ownerUserId: "u2" });
    await expect(a.claims.claimCountry(actor, "c1")).rejects.toMatchObject({
      code: "ALREADY_OWNED",
    });
    const b = setup();
    b.db.country.count.mockResolvedValue(1);
    await expect(b.claims.claimCountry(actor, "c1")).rejects.toMatchObject({ code: "CAP_REACHED" });
    const c = setup();
    c.db.realmClaim.findFirst.mockResolvedValue({ id: "old" });
    await expect(c.claims.claimCountry(actor, "c1")).resolves.toEqual({
      claimId: "old",
      status: "pending",
      autoApproved: false,
    });
  });
});

describe("reviewClaim", () => {
  const pending = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: "c1",
    realmId: "default",
    realm: { ownerId: "system" },
    user: { clerkUserId: "clerk_u1" },
    country: { name: "Aurelia" },
  };

  it("only moderators may review", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await expect(claims.reviewClaim(actor, "cl1", { approve: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("approving assigns, rejects competing pending claims, and notifies", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", status: "pending", id: { not: "cl1" } } })
    );
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
  });

  it("a lost race rejects the claim with a reason instead of throwing", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.country.findUnique.mockResolvedValue({ ...country, ownerUserId: "u2" });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "rejected",
    });
    expect(db.realmClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          rejectionReason: expect.stringContaining("another player"),
        }),
      })
    );
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("rejection needs a reason", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await expect(claims.reviewClaim(admin, "cl1", { approve: false })).rejects.toMatchObject({
      code: "REASON_REQUIRED",
    });
  });
});
