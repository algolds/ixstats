import { createClaimsService } from "~/server/modules/realms";

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  resolvePrimaryWikiUsername: (name: string) => (name === "Carthinova" ? "Kir" : name),
}));

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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", source: "ixwiki", verifiedAt: { not: null } },
    });
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
    expect(deps.fetchPageCreator).toHaveBeenCalledWith("ixwiki", "Aurelia");
  });

  it("checks the verified link and the page on the nation's own wiki", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue({
      ...country,
      wikiSource: "iiwiki",
      wikiPageTitle: "Aurelia (nation)",
    });
    await claims.claimCountry(actor, "c1");
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", source: "iiwiki", verifiedAt: { not: null } },
    });
    expect(deps.fetchPageCreator).toHaveBeenCalledWith("iiwiki", "Aurelia (nation)");
  });

  it("matches underscores, a lower-case first letter and known alt accounts", async () => {
    const a = setup();
    a.deps.fetchPageCreator.mockResolvedValue("Some_user");
    a.db.wikiAccountLink.findFirst.mockResolvedValue({ username: "some user" });
    await expect(a.claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "approved" });
    const b = setup();
    b.deps.fetchPageCreator.mockResolvedValue("Carthinova"); // KNOWN_WIKI_ALTS: Carthinova → Kir
    await expect(b.claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "approved" });
  });

  it("does not fold case beyond the first letter (MediaWiki treats Some User and Some user as different accounts)", async () => {
    const { deps, db, claims } = setup();
    deps.fetchPageCreator.mockResolvedValue("Some_User");
    db.wikiAccountLink.findFirst.mockResolvedValue({ username: "Some user" });
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "pending" });
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
  const guarded = { id: "cl1", status: "pending" };

  it("only moderators may review", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await expect(claims.reviewClaim(actor, "cl1", { approve: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("approving moves pending → approved first, then assigns, rejects competing claims and notifies", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    expect(db.realmClaim.updateMany).toHaveBeenNthCalledWith(1, {
      where: guarded,
      data: expect.objectContaining({ status: "approved", reviewedBy: "clerk_a1" }),
    });
    expect(db.realmClaim.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { countryId: "c1", status: "pending", id: { not: "cl1" } } })
    );
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
  });

  it("an overlapping review that already decided the claim wins: NOT_PENDING, nothing assigned", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.realmClaim.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).rejects.toMatchObject({
      code: "NOT_PENDING",
    });
    expect(db.country.updateMany).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("rejecting an already-decided claim is NOT_PENDING", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.realmClaim.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      claims.reviewClaim(admin, "cl1", { approve: false, reason: "Not your nation" })
    ).rejects.toMatchObject({ code: "NOT_PENDING" });
  });

  it("rejecting records the moderator and reason through the guarded transition", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await expect(
      claims.reviewClaim(admin, "cl1", { approve: false, reason: "  Not your nation " })
    ).resolves.toEqual({ status: "rejected" });
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith({
      where: guarded,
      data: expect.objectContaining({
        status: "rejected",
        reviewedBy: "clerk_a1",
        rejectionReason: "Not your nation",
      }),
    });
  });

  it("a lost race rejects the claim with a reason instead of throwing", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.country.findUnique.mockResolvedValue({ ...country, ownerUserId: "u2" });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "rejected",
    });
    expect(db.realmClaim.updateMany).toHaveBeenLastCalledWith({
      where: guarded,
      data: expect.objectContaining({
        status: "rejected",
        rejectionReason: expect.stringContaining("another player"),
      }),
    });
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("a race lost at the guarded ownership write is rejected the same way", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.country.updateMany.mockResolvedValue({ count: 0 });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "rejected",
    });
    expect(db.user.update).not.toHaveBeenCalled();
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

describe("listClaims", () => {
  it("scopes a realm founder to the realms they own", async () => {
    const { db, claims } = setup();
    await claims.listClaims({ id: "u7", clerkUserId: "clerk_founder", role: null }, "pending");
    expect(db.realmClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pending", realm: { ownerId: "clerk_founder" } } })
    );
  });

  it("gives site admins every realm", async () => {
    const { db, claims } = setup();
    await claims.listClaims(admin, "pending");
    expect(db.realmClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pending" } })
    );
  });

  it("identifies claimants only by verified wiki accounts", async () => {
    const { db, claims } = setup();
    await claims.listClaims(admin, "pending");
    const { include } = db.realmClaim.findMany.mock.calls[0][0];
    expect(include.user.select.wikiAccountLinks).toEqual({
      where: { verifiedAt: { not: null } },
      select: { source: true, username: true },
    });
  });
});
