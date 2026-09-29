import { Prisma } from "@prisma/client";
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

const EURTH = "eurth-id";
const nationPage = { wikiSource: "iiwiki", realm: { slug: "eurth", settings: null } };
/** What Postgres raises when a concurrent approval created the same (realmId, name) or slug first. */
const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`realmId`,`name`)",
    {
      code: "P2002",
      clientVersion: "6.19.3",
      meta: { modelName: "Country", target: ["realmId", "name"] },
    }
  );

function setup() {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    country: {
      findUnique: jest.fn().mockResolvedValue(country),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: "new-c", name: data.name })),
    },
    realmPage: { findFirst: jest.fn().mockResolvedValue(nationPage) },
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
      update: jest.fn().mockResolvedValue({}),
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

/** A nation page of Eurth; `takenSlugs` already belong to countries elsewhere (e.g. IxWorld). */
function pageSetup({ takenSlugs = [] as string[] } = {}) {
  const s = setup();
  s.db.country.findUnique.mockImplementation(({ where }: any) =>
    Promise.resolve(
      "slug" in where
        ? takenSlugs.includes(where.slug)
          ? { id: "elsewhere" }
          : null
        : { id: where.id, realmId: EURTH, ownerUserId: null, realm: { settings: null } }
    )
  );
  return s;
}

describe("claimNationPage", () => {
  it("auto-approves the verified creator: creates the realm's country, assigns it and notifies once", async () => {
    const { db, deps, claims } = pageSetup();
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toEqual({
      claimId: "cl1",
      status: "approved",
      autoApproved: true,
    });
    expect(db.realmPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: EURTH, kind: "nation", title: "Aurelia" } })
    );
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", source: "iiwiki", verifiedAt: { not: null } },
    });
    expect(deps.fetchPageCreator).toHaveBeenCalledWith("iiwiki", "Aurelia");
    expect(db.country.create).toHaveBeenCalledTimes(1);
    expect(db.country.create.mock.calls[0][0].data).toMatchObject({
      name: "Aurelia",
      slug: "aurelia",
      realmId: EURTH,
      wikiSource: "iiwiki",
      wikiPageTitle: "Aurelia",
      baselinePopulation: 1_000_000, // the users.createCountry baseline
    });
    expect(db.realmClaim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        realmId: EURTH,
        userId: "u1",
        wikiSource: "iiwiki",
        wikiPageTitle: "Aurelia",
        status: "approved",
        autoApproved: true,
      }),
    });
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "new-c", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(db.realmClaim.update).toHaveBeenCalledWith({
      where: { id: "cl1" },
      data: { countryId: "new-c" },
    });
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith({
      where: { realmId: EURTH, wikiPageTitle: "Aurelia", status: "pending", id: { not: "cl1" } },
      data: expect.objectContaining({ status: "rejected", reviewedBy: "system:auto" }),
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
    expect(deps.onNationAssigned).toHaveBeenCalledWith({
      userId: "u1",
      clerkUserId: "clerk_u1",
      countryId: "new-c",
      countryName: "Aurelia",
    });
  });

  it("suffixes the realm slug when the country slug is taken elsewhere (decision 5)", async () => {
    const { db, claims } = pageSetup({ takenSlugs: ["aurelia"] });
    await claims.claimNationPage(actor, EURTH, "Aurelia");
    expect(db.country.create.mock.calls[0][0].data.slug).toBe("aurelia-eurth");
  });

  it.each([
    [
      "the creator is someone else",
      (s: ReturnType<typeof setup>) => s.deps.fetchPageCreator.mockResolvedValue("Someone Else"),
    ],
    [
      "no verified wiki account",
      (s: ReturnType<typeof setup>) => s.db.wikiAccountLink.findFirst.mockResolvedValue(null),
    ],
    [
      "the wiki is down",
      (s: ReturnType<typeof setup>) =>
        s.deps.fetchPageCreator.mockRejectedValue(new Error("cloudflare")),
    ],
  ])("files a pending claim with no country when %s", async (_why, arrange) => {
    const s = pageSetup();
    arrange(s);
    await expect(s.claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toEqual({
      claimId: "cl1",
      status: "pending",
      autoApproved: false,
    });
    expect(s.db.realmClaim.create).toHaveBeenCalledWith({
      data: {
        realmId: EURTH,
        userId: "u1",
        wikiSource: "iiwiki",
        wikiPageTitle: "Aurelia",
        countryId: null,
        status: "pending",
      },
    });
    expect(s.db.country.create).not.toHaveBeenCalled();
    expect(s.db.$transaction).not.toHaveBeenCalled();
    expect(s.deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("refuses a page that is not a nation of the realm's index", async () => {
    const { db, claims } = pageSetup();
    db.realmPage.findFirst.mockResolvedValue(null);
    await expect(claims.claimNationPage(actor, EURTH, "Nowhere")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });

  it("refuses a nation whose country already exists in the realm", async () => {
    const { db, claims } = pageSetup();
    db.country.findFirst.mockResolvedValue({ id: "c-existing" });
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      code: "ALREADY_OWNED",
    });
    expect(db.country.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: EURTH, name: "Aurelia" } })
    );
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });

  it("applies the realm's nation cap and reuses the player's pending claim for the page", async () => {
    const a = pageSetup();
    a.db.country.count.mockResolvedValue(1);
    await expect(a.claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      code: "CAP_REACHED",
    });
    expect(a.db.country.count).toHaveBeenCalledWith({
      where: { ownerUserId: "u1", realmId: EURTH },
    });
    const b = pageSetup();
    b.db.realmClaim.findFirst.mockResolvedValue({ id: "old" });
    await expect(b.claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toEqual({
      claimId: "old",
      status: "pending",
      autoApproved: false,
    });
    expect(b.db.realmClaim.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", realmId: EURTH, wikiPageTitle: "Aurelia", status: "pending" },
    });
    expect(b.deps.fetchPageCreator).not.toHaveBeenCalled();
  });

  it("a country created by someone else mid-claim is ALREADY_OWNED, not a 500, and nothing is announced", async () => {
    const { db, deps, claims } = pageSetup();
    db.country.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "c-raced" });
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      name: "ClaimError",
      code: "ALREADY_OWNED",
    });
    expect(db.country.create).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("losing the create race to a concurrent approval (unique violation) is ALREADY_OWNED, not a 500", async () => {
    const { db, deps, claims } = pageSetup();
    db.country.create.mockRejectedValue(uniqueViolation());
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      name: "ClaimError",
      code: "ALREADY_OWNED",
    });
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("any other database failure is not disguised as a claim error", async () => {
    const { db, claims } = pageSetup();
    db.country.create.mockRejectedValue(new Error("connection reset"));
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toThrow(
      "connection reset"
    );
  });
});

describe("reviewClaim — nation page claims", () => {
  const pendingPage = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: null,
    realmId: EURTH,
    wikiSource: "iiwiki",
    wikiPageTitle: "Aurelia",
    realm: { ownerId: "system", slug: "eurth" },
    user: { clerkUserId: "clerk_u1" },
    country: null,
  };
  const guarded = { id: "cl1", status: "pending" };

  it("approving decides first, then creates the realm's country, assigns it, links the claim and turns away rivals", async () => {
    const { db, deps, claims } = pageSetup({ takenSlugs: ["aurelia"] });
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    expect(db.realmClaim.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ realm: { select: { ownerId: true, slug: true } } }),
      })
    );
    expect(db.realmClaim.updateMany).toHaveBeenNthCalledWith(1, {
      where: guarded,
      data: expect.objectContaining({ status: "approved", reviewedBy: "clerk_a1" }),
    });
    expect(db.realmClaim.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.country.create.mock.invocationCallOrder[0]
    );
    expect(db.country.create.mock.calls[0][0].data).toMatchObject({
      name: "Aurelia",
      slug: "aurelia-eurth",
      realmId: EURTH,
      wikiSource: "iiwiki",
      wikiPageTitle: "Aurelia",
    });
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "new-c", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(db.realmClaim.update).toHaveBeenCalledWith({
      where: { id: "cl1" },
      data: { countryId: "new-c" },
    });
    expect(db.realmClaim.updateMany).toHaveBeenNthCalledWith(2, {
      where: { realmId: EURTH, wikiPageTitle: "Aurelia", status: "pending", id: { not: "cl1" } },
      data: expect.objectContaining({ status: "rejected", reviewedBy: "system:auto" }),
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
    expect(deps.onNationAssigned).toHaveBeenCalledWith({
      userId: "u1",
      clerkUserId: "clerk_u1",
      countryId: "new-c",
      countryName: "Aurelia",
    });
  });

  it("a moderator can reject a page claim with a reason", async () => {
    const { db, claims } = pageSetup();
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await expect(
      claims.reviewClaim(admin, "cl1", { approve: false, reason: "Not your nation" })
    ).resolves.toEqual({ status: "rejected" });
    expect(db.country.create).not.toHaveBeenCalled();
  });

  it("if the nation's country appeared meanwhile, the claim is rejected with a reason", async () => {
    const { db, deps, claims } = pageSetup();
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    db.country.findFirst.mockResolvedValue({ id: "c-raced" });
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
    expect(db.country.create).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("losing the create race to a concurrent approval rejects the claim with a reason", async () => {
    const { db, deps, claims } = pageSetup();
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    db.country.create.mockRejectedValue(uniqueViolation());
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "rejected",
    });
    expect(db.realmClaim.updateMany).toHaveBeenLastCalledWith({
      where: guarded,
      data: expect.objectContaining({
        status: "rejected",
        reviewedBy: "system:auto",
        rejectionReason: expect.stringContaining("another player"),
      }),
    });
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("a claim with neither a country nor a page is not reviewable", async () => {
    const { db, claims } = pageSetup();
    db.realmClaim.findUnique.mockResolvedValue({ ...pendingPage, wikiPageTitle: null });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).rejects.toMatchObject({
      code: "NOT_PENDING",
    });
  });
});
