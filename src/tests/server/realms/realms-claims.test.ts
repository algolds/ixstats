import { Prisma } from "@prisma/client";
import { createClaimsService, DEFAULT_REALM_ID } from "~/server/modules/realms";
import { IXSTATS_NATION_GROWTH_DEFAULTS } from "~/lib/realms/nation-growth-defaults";

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
const nationPage = {
  wikiSource: "iiwiki",
  realm: { slug: "eurth", settings: null, status: "active" },
};
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
/** What Postgres raises when another country took the new nation's slug between the free-slug search and the create. */
const slugViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { modelName: "Country", target: ["slug"] },
  });

interface RegionRow {
  id: string;
  realmId: string;
  layerType: string;
  featureId: string;
  displayName: string | null;
  countryId: string | null;
  isActive: boolean;
  geometry: object;
  centroid: object;
  boundingBox: number[];
  areaSqKm: number;
}
type Where = Record<string, unknown> & { OR?: Where[] };

/** Prisma-style equality where (plus OR) over rows — enough for map layer lookups and guarded links. */
function matches(row: RegionRow, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Where[]).some((w) => matches(row, w));
    const cell = row[key as keyof RegionRow];
    if (value && typeof value === "object" && "in" in value) {
      return (value as { in: unknown[] }).in.includes(cell);
    }
    return cell === value;
  });
}

/** An in-memory map_layers table: finds read it, guarded updates write it. */
function mapLayerTable(rows: RegionRow[]) {
  return {
    findFirst: jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null)
    ),
    findMany: jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(rows.filter((r) => matches(r, where)))
    ),
    updateMany: jest.fn(({ where, data }: { where: Where; data: Partial<RegionRow> }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hit.length });
    }),
  };
}

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
    mapLayer: mapLayerTable([]),
    user: {
      // A free-tier account (nationCapacity reads membershipTier).
      findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
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
    onClaimRejected: jest.fn().mockResolvedValue(undefined),
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
    c.db.realmClaim.findFirst.mockResolvedValue({ id: "old", userId: "u1" });
    c.deps.fetchPageCreator.mockResolvedValue("Someone Else");
    await expect(c.claims.claimCountry(actor, "c1")).resolves.toEqual({
      claimId: "old",
      status: "pending",
      autoApproved: false,
    });
    expect(c.db.realmClaim.create).not.toHaveBeenCalled();
    expect(c.db.realmClaim.updateMany).not.toHaveBeenCalled();
  });

  it("re-verifies a pending claim: once the creator is verified it is upgraded in place, not duplicated (F-5.1)", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findFirst.mockResolvedValue({
      id: "old",
      userId: "u1",
      countryId: "c1",
      status: "pending",
    });
    await expect(claims.claimCountry(actor, "c1")).resolves.toEqual({
      claimId: "old",
      status: "approved",
      autoApproved: true,
    });
    // The guarded decide (pending → approved) upgrades the existing row…
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith({
      where: { id: "old", status: "pending" },
      data: {
        status: "approved",
        autoApproved: true,
        reviewedBy: "system:auto",
        reviewedAt: expect.any(Date),
      },
    });
    // …then the nation is handed over; no second claim row.
    expect(db.realmClaim.create).not.toHaveBeenCalled();
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
  });

  it("an upgrade that a moderator decided first is NOT_PENDING and assigns nothing", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findFirst.mockResolvedValue({
      id: "old",
      userId: "u1",
      countryId: "c1",
      status: "pending",
    });
    db.realmClaim.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(claims.claimCountry(actor, "c1")).rejects.toMatchObject({ code: "NOT_PENDING" });
    expect(db.country.updateMany).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("an auto-approval that loses the ownership race is ALREADY_OWNED as a claim error, not a 500 (F-5.3)", async () => {
    const { db, deps, claims } = setup();
    db.country.updateMany.mockResolvedValue({ count: 0 }); // someone else took the nation after the read
    await expect(claims.claimCountry(actor, "c1")).rejects.toMatchObject({
      name: "ClaimError",
      code: "ALREADY_OWNED",
    });
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });

  it("known alt accounts are merged for ixwiki only — an iiwiki page by the alt stays pending (F-5.2)", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue({ ...country, wikiSource: "iiwiki" });
    deps.fetchPageCreator.mockResolvedValue("Carthinova"); // an ixwiki alt of Kir; on iiwiki it is someone else
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "pending" });
    expect(db.country.updateMany).not.toHaveBeenCalled();
  });
});

describe("reviewClaim", () => {
  const pending = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: "c1",
    realmId: "default",
    realm: { ownerId: "system", officers: [] },
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
    expect(db.user.updateMany).not.toHaveBeenCalled();
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
    expect(db.user.updateMany).not.toHaveBeenCalled();
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
  it("scopes a player to the realms they found or review claims for as an officer", async () => {
    const { db, claims } = setup();
    await claims.listClaims({ id: "u7", clerkUserId: "clerk_founder", role: null }, "pending");
    expect(db.realmClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "pending",
          realm: {
            OR: [
              { ownerId: "clerk_founder" },
              { officers: { some: { userId: "clerk_founder", powers: { has: "claims" } } } },
            ],
          },
        },
      })
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

describe("officers with the claims power", () => {
  const founder = { id: "f1", clerkUserId: "clerk_founder", role: null };
  const officer = { id: "o1", clerkUserId: "clerk_officer", role: null };
  /** The review query returns only the reviewer's own grant in the claim's realm (`officers` where userId). */
  const claimIn = (officers: object[], claimant = "clerk_u1") => ({
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: "c1",
    realmId: "default",
    realm: { ownerId: "clerk_founder", slug: "eurth", status: "active", officers },
    user: { clerkUserId: claimant },
    country: { name: "Aurelia" },
  });
  const grant = (powers: string[]) => [{ userId: "clerk_officer", powers }];

  it("review a claim in their own realm, looked up by their own grant", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(claimIn(grant(["claims"])));
    await expect(claims.reviewClaim(officer, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    expect(db.realmClaim.findUnique.mock.calls[0][0].include.realm.select.officers).toEqual({
      where: { userId: "clerk_officer" },
      select: { userId: true, powers: true },
    });
    expect(db.realmClaim.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "cl1", status: "pending" },
      data: expect.objectContaining({ status: "approved", reviewedBy: "clerk_officer" }),
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);

    const other = setup();
    other.db.realmClaim.findUnique.mockResolvedValue(claimIn(grant(["claims"])));
    await expect(
      other.claims.reviewClaim(officer, "cl1", { approve: false, reason: "Not your page" })
    ).resolves.toEqual({ status: "rejected" });
  });

  it("can't review a claim in another realm, where they hold no grant", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(claimIn([]));
    await expect(claims.reviewClaim(officer, "cl1", { approve: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.realmClaim.updateMany).not.toHaveBeenCalled();
  });

  it("refuses officers without the claims power", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(claimIn(grant(["board", "diplomacy"])));
    await expect(
      claims.reviewClaim(officer, "cl1", { approve: false, reason: "Not your page" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realmClaim.updateMany).not.toHaveBeenCalled();
  });

  it("can't approve their own claim; the founder and site admins still can approve theirs", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(claimIn(grant(["claims"]), "clerk_officer"));
    await expect(claims.reviewClaim(officer, "cl1", { approve: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.realmClaim.updateMany).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();

    const own = setup();
    own.db.realmClaim.findUnique.mockResolvedValue(claimIn([], "clerk_founder"));
    await expect(own.claims.reviewClaim(founder, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    const staff = setup();
    staff.db.realmClaim.findUnique.mockResolvedValue(claimIn([], "clerk_a1"));
    await expect(staff.claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
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
        : {
            id: where.id,
            realmId: EURTH,
            ownerUserId: null,
            realm: { settings: null, status: "active" },
          }
    )
  );
  return s;
}

/** A realm growth table (Realm.settings.nationDefaults) differing from IxStats's for the default $50,000 tier. */
const realmGrowth = {
  ...IXSTATS_NATION_GROWTH_DEFAULTS,
  Strong: { populationGrowthRate: 0.009, adjustedGdpGrowth: 0.0007 },
};

describe("claimNationPage", () => {
  it("creates the nation with the realm's growth for its tier", async () => {
    const { db, claims } = pageSetup();
    db.realmPage.findFirst.mockResolvedValue({
      ...nationPage,
      realm: { ...nationPage.realm, settings: { nationDefaults: realmGrowth } },
    });
    await claims.claimNationPage(actor, EURTH, "Aurelia");
    expect(db.country.create.mock.calls[0][0].data).toMatchObject({
      populationGrowthRate: 0.009,
      adjustedGdpGrowth: 0.0007,
      maxGdpGrowthRate: 0.0275,
    });
  });

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
      baselinePopulation: 1_000_000, // the baseline-country default
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

  it("numbers the realm slug when that is taken too, instead of failing the claim", async () => {
    const { db, deps, claims } = pageSetup({
      takenSlugs: ["aurelia", "aurelia-eurth", "aurelia-eurth-2"],
    });
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({
      status: "approved",
    });
    expect(db.country.create.mock.calls[0][0].data.slug).toBe("aurelia-eurth-3");
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
  });

  it("a title with no Latin letters or digits gets a fallback slug, not an empty one", async () => {
    const { db, claims } = pageSetup({ takenSlugs: ["nation"] });
    await claims.claimNationPage(actor, EURTH, "Ἀθῆναι");
    expect(db.country.create.mock.calls[0][0].data.slug).toBe("nation-eurth");
  });

  it("a slug taken mid-create is a slug conflict, never 'belongs to another player'", async () => {
    const { db, deps, claims } = pageSetup();
    db.country.create.mockRejectedValue(slugViolation());
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      name: "ClaimError",
      code: "SLUG_CONFLICT",
    });
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
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
    // Matched by the page reference, or by name for a nation stored without one.
    expect(db.country.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmId: EURTH,
          OR: [
            { wikiSource: expect.any(String), wikiPageTitle: "Aurelia" },
            { wikiPageTitle: null, name: "Aurelia" },
          ],
        },
      })
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
    b.db.realmClaim.findFirst.mockResolvedValue({ id: "old", userId: "u1" });
    b.deps.fetchPageCreator.mockResolvedValue("Someone Else");
    await expect(b.claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toEqual({
      claimId: "old",
      status: "pending",
      autoApproved: false,
    });
    expect(b.db.realmClaim.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", realmId: EURTH, wikiPageTitle: "Aurelia", status: "pending" },
    });
    expect(b.db.realmClaim.create).not.toHaveBeenCalled();
    expect(b.db.country.create).not.toHaveBeenCalled();
  });

  it("re-verifies the player's pending page claim and upgrades it in place once verified (F-5.1)", async () => {
    const { db, deps, claims } = pageSetup();
    db.realmClaim.findFirst.mockResolvedValue({
      id: "old",
      userId: "u1",
      countryId: null,
      status: "pending",
    });
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toEqual({
      claimId: "old",
      status: "approved",
      autoApproved: true,
    });
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith({
      where: { id: "old", status: "pending" },
      data: {
        status: "approved",
        autoApproved: true,
        reviewedBy: "system:auto",
        reviewedAt: expect.any(Date),
      },
    });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
    expect(db.country.create).toHaveBeenCalledTimes(1);
    expect(db.realmClaim.update).toHaveBeenCalledWith({
      where: { id: "old" },
      data: { countryId: "new-c" },
    });
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith({
      where: { realmId: EURTH, wikiPageTitle: "Aurelia", status: "pending", id: { not: "old" } },
      data: expect.objectContaining({ status: "rejected" }),
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
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
    realm: { ownerId: "system", slug: "eurth", status: "active" },
    user: { clerkUserId: "clerk_u1" },
    country: null,
  };
  const guarded = { id: "cl1", status: "pending" };

  it("approving creates the nation with the realm's growth, else IxStats's defaults", async () => {
    const { db, claims } = pageSetup();
    db.realmClaim.findUnique.mockResolvedValue({
      ...pendingPage,
      realm: { ...pendingPage.realm, settings: { nationDefaults: realmGrowth } },
    });
    await claims.reviewClaim(admin, "cl1", { approve: true });
    expect(db.country.create.mock.calls[0][0].data).toMatchObject(realmGrowth.Strong);

    const plain = pageSetup();
    plain.db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await plain.claims.reviewClaim(admin, "cl1", { approve: true });
    expect(plain.db.country.create.mock.calls[0][0].data).toMatchObject(
      IXSTATS_NATION_GROWTH_DEFAULTS.Strong
    );
  });

  it("approving decides first, then creates the realm's country, assigns it, links the claim and turns away rivals", async () => {
    const { db, deps, claims } = pageSetup({ takenSlugs: ["aurelia"] });
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    expect(db.realmClaim.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          realm: {
            select: {
              ownerId: true,
              slug: true,
              status: true,
              settings: true,
              officers: { where: { userId: "clerk_a1" }, select: { userId: true, powers: true } },
            },
          },
        }),
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

  it("a slug taken mid-create leaves the claim pending for another try instead of rejecting it", async () => {
    const { db, deps, claims } = pageSetup();
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    db.country.create.mockRejectedValue(slugViolation());
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).rejects.toMatchObject({
      name: "ClaimError",
      code: "SLUG_CONFLICT",
    });
    expect(db.realmClaim.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "rejected" }) })
    );
    expect(deps.onClaimRejected).not.toHaveBeenCalled();
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

describe("approved nation-page claims take their map region (decision 11)", () => {
  const region = (overrides: Partial<RegionRow> = {}): RegionRow => ({
    id: "ml-eurth",
    realmId: EURTH,
    layerType: "political",
    featureId: "Aurelia",
    displayName: null,
    countryId: null,
    isActive: true,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    centroid: { type: "Point", coordinates: [0.5, 0.5] },
    boundingBox: [0, 0, 1, 1],
    areaSqKm: 1000,
    ...overrides,
  });
  const ixworldRegion = () => region({ id: "ml-ixworld", realmId: DEFAULT_REALM_ID });
  const pendingPage = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: null,
    realmId: EURTH,
    wikiSource: "iiwiki",
    wikiPageTitle: "Aurelia",
    realm: { ownerId: "system", slug: "eurth", status: "active" },
    user: { clerkUserId: "clerk_u1" },
    country: null,
  };

  /** The map is reachable only through the approving transaction, whose client writes its own country rows. */
  function regionSetup(rows: RegionRow[]) {
    const s = pageSetup();
    const table = mapLayerTable(rows);
    const tx = {
      ...s.db,
      mapLayer: table,
      country: { ...s.db.country, update: jest.fn().mockResolvedValue({}) },
    };
    delete s.db.mapLayer;
    s.db.$transaction.mockImplementation((cb: (client: typeof tx) => unknown) => cb(tx));
    return { ...s, tx, table };
  }

  it("auto-approval links the realm's unlinked region named after the nation and syncs its geometry in the transaction", async () => {
    const rows = [ixworldRegion(), region()];
    const { tx, claims } = regionSetup(rows);
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({
      status: "approved",
    });
    expect(rows.map((r) => r.countryId)).toEqual([null, "new-c"]);
    expect(tx.country.findUnique).toHaveBeenCalledWith({
      where: { id: "new-c" },
      select: { name: true, realmId: true },
    });
    expect(tx.country.update).toHaveBeenCalledWith({
      where: { id: "new-c" },
      data: expect.objectContaining({
        geometry: rows[1]!.geometry,
        centroid: rows[1]!.centroid,
        landArea: 1000,
      }),
    });
  });

  it("a nation drawn as several regions takes all of them, and its outline is their union", async () => {
    const islands = region({
      id: "ml-isles",
      featureId: "aurelia_isles",
      displayName: "Aurelia",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 5],
          ],
        ],
      },
      centroid: [5.5, 5.5],
      boundingBox: [5, 5, 6, 6],
      areaSqKm: 1000,
    });
    const rows = [region({ centroid: [0.5, 0.5] }), islands, ixworldRegion()];
    const { tx, claims } = regionSetup(rows);
    await claims.claimNationPage(actor, EURTH, "Aurelia");
    expect(rows.map((r) => r.countryId)).toEqual(["new-c", "new-c", null]);
    const data = tx.country.update.mock.calls[0][0].data;
    expect(data.geometry.type).toBe("MultiPolygon");
    expect(data.geometry.coordinates).toHaveLength(2);
    expect(data).toMatchObject({ landArea: 2000, centroid: [3, 3], boundingBox: [0, 0, 6, 6] });
  });

  it("review approval matches the region by its display name too", async () => {
    const rows = [region({ featureId: "country_3", displayName: "Aurelia" })];
    const { db, tx, claims } = regionSetup(rows);
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    expect(rows[0]!.countryId).toBe("new-c");
    expect(tx.country.update).toHaveBeenCalledTimes(1);
  });

  it("no region of that name is a no-op: the claim is approved and no geometry is written", async () => {
    const { deps, table, tx, claims } = regionSetup([region({ featureId: "Borealis" })]);
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({
      status: "approved",
    });
    expect(table.updateMany).not.toHaveBeenCalled();
    expect(tx.country.update).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
  });

  it("never takes another realm's region, one already linked, or an inactive one", async () => {
    const rows = [
      ixworldRegion(),
      region({ id: "ml-linked", countryId: "c-other" }),
      region({ id: "ml-old", isActive: false }),
    ];
    const { table, tx, claims } = regionSetup(rows);
    await claims.claimNationPage(actor, EURTH, "Aurelia");
    expect(rows.map((r) => r.countryId)).toEqual([null, "c-other", null]);
    expect(table.updateMany).not.toHaveBeenCalled();
    expect(tx.country.update).not.toHaveBeenCalled();
  });

  it("claiming an existing country leaves the map alone", async () => {
    const { table, claims } = regionSetup([region()]);
    await claims.claimCountry(actor, "c1");
    expect(table.findFirst).not.toHaveBeenCalled();
  });
});

describe("realm status (AT-7)", () => {
  const eurthCountry = (status: string) => ({
    ...country,
    realmId: EURTH,
    realm: { settings: null, status },
  });

  it.each(["draft", "generating", "archived"])(
    "a %s realm refuses country claims and files nothing",
    async (status) => {
      const { db, claims } = setup();
      db.country.findUnique.mockResolvedValue(eurthCountry(status));
      await expect(claims.claimCountry(actor, "c1")).rejects.toMatchObject({
        code: "REALM_CLOSED",
      });
      expect(db.realmClaim.create).not.toHaveBeenCalled();
    }
  );

  it("an archived realm refuses nation page claims", async () => {
    const { db, claims } = setup();
    db.realmPage.findFirst.mockResolvedValue({
      ...nationPage,
      realm: { ...nationPage.realm, status: "archived" },
    });
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      code: "REALM_CLOSED",
    });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });

  it("an active realm and IxWorld (with or without a realm row) take claims", async () => {
    const { db, claims } = setup();
    db.country.findUnique.mockResolvedValue(eurthCountry("active"));
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "approved" });
    const ixworld = setup();
    ixworld.db.country.findUnique.mockResolvedValue({ ...country, realm: null });
    await expect(ixworld.claims.claimCountry(actor, "c1")).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("a pending claim in a realm archived since can be rejected but not approved", async () => {
    const claim = {
      id: "cl1",
      status: "pending",
      userId: "u1",
      countryId: "c9",
      realmId: EURTH,
      realm: { ownerId: "system", slug: "eurth", status: "archived" },
      user: { clerkUserId: "clerk_u1" },
      country: { name: "Gallambria" },
    };
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(claim);
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).rejects.toMatchObject({
      code: "REALM_CLOSED",
    });
    expect(db.realmClaim.updateMany).not.toHaveBeenCalled();
    expect(db.country.updateMany).not.toHaveBeenCalled();
    await expect(
      claims.reviewClaim(admin, "cl1", { approve: false, reason: "Realm archived" })
    ).resolves.toEqual({ status: "rejected" });
  });
});

describe("realm rules", () => {
  const RULES = "<p>Be civil. No godmodding.</p>";
  const ruledCountry = {
    ...country,
    realmId: EURTH,
    realm: { settings: null, status: "active", slug: "eurth", rulesHtml: RULES },
  };

  it("refuses a country claim until the player accepts the rules, before any wiki check", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue(ruledCountry);
    await expect(claims.claimCountry(actor, "c1")).rejects.toMatchObject({
      code: "RULES_NOT_ACCEPTED",
    });
    await expect(claims.claimCountry(actor, "c1", { acceptedRules: false })).rejects.toMatchObject(
      { code: "RULES_NOT_ACCEPTED" }
    );
    expect(deps.fetchPageCreator).not.toHaveBeenCalled();
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });

  it("records when the rules were accepted on the claim it files", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue(ruledCountry);
    deps.fetchPageCreator.mockResolvedValue("Someone else");
    await expect(claims.claimCountry(actor, "c1", { acceptedRules: true })).resolves.toMatchObject(
      { status: "pending" }
    );
    expect(db.realmClaim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ countryId: "c1", rulesAcceptedAt: expect.any(Date) }),
    });
  });

  it("applies to nation page claims too", async () => {
    const { db, claims } = pageSetup();
    db.realmPage.findFirst.mockResolvedValue({
      ...nationPage,
      realm: { ...nationPage.realm, rulesHtml: RULES },
    });
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      code: "RULES_NOT_ACCEPTED",
    });
    await expect(
      claims.claimNationPage(actor, EURTH, "Aurelia", { acceptedRules: true })
    ).resolves.toMatchObject({ status: "approved" });
    expect(db.realmClaim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ wikiPageTitle: "Aurelia", rulesAcceptedAt: expect.any(Date) }),
    });
  });

  it("needs nothing in a realm without rules, and records no acceptance", async () => {
    const { db, deps, claims } = setup();
    deps.fetchPageCreator.mockResolvedValue("Someone else");
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "pending" });
    expect(db.realmClaim.create.mock.calls[0][0].data).not.toHaveProperty("rulesAcceptedAt");
  });
});

describe("claimants see their claims and hear about rejections (AT-5)", () => {
  const pending = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: "c1",
    realmId: "default",
    realm: { ownerId: "system", slug: "ixworld" },
    user: { clerkUserId: "clerk_u1" },
    country: { name: "Aurelia" },
  };

  it("a moderator's rejection tells the claimant the nation and the reason", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    await claims.reviewClaim(admin, "cl1", { approve: false, reason: " Not your nation " });
    expect(deps.onClaimRejected).toHaveBeenCalledWith({
      clerkUserId: "clerk_u1",
      nationName: "Aurelia",
      realmSlug: "ixworld",
      reason: "Not your nation",
    });
  });

  it("an automatic rejection (the nation was taken first) is announced too", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.country.findUnique.mockResolvedValue({ ...country, ownerUserId: "u2" });
    await claims.reviewClaim(admin, "cl1", { approve: true });
    expect(deps.onClaimRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "clerk_u1",
        reason: expect.stringContaining("another player"),
      })
    );
  });

  it("an approval tells the rival claimants it turned away", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    db.realmClaim.findMany.mockResolvedValue([{ user: { clerkUserId: "clerk_rival" } }]);
    await claims.reviewClaim(admin, "cl1", { approve: true });
    expect(db.realmClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", status: "pending", id: { not: "cl1" } } })
    );
    expect(deps.onClaimRejected).toHaveBeenCalledWith({
      clerkUserId: "clerk_rival",
      nationName: "Aurelia",
      realmSlug: "ixworld",
      reason: "Another claim for this nation was approved",
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
  });

  it("a failing notice never undoes the decision", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(pending);
    deps.onClaimRejected.mockRejectedValue(new Error("notifications down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      claims.reviewClaim(admin, "cl1", { approve: false, reason: "Not yours" })
    ).resolves.toEqual({ status: "rejected" });
    error.mockRestore();
  });

  it("myClaims lists only the player's own claims, optionally in one realm, with the reason", async () => {
    const { db, claims } = setup();
    await claims.myClaims(actor, "eurth");
    expect(db.realmClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", realm: { slug: "eurth" } },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({ status: true, rejectionReason: true }),
      })
    );
    const select = db.realmClaim.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("reviewedBy");
    await claims.myClaims(actor);
    expect(db.realmClaim.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });
});

describe("a claimed nation page prefills its new country (AT-3)", () => {
  const pendingPage = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: null,
    realmId: EURTH,
    wikiSource: "iiwiki",
    wikiPageTitle: "Aurelia",
    realm: { ownerId: "system", slug: "eurth", status: "active" },
    user: { clerkUserId: "clerk_u1" },
    country: null,
  };
  const prefill = {
    country: { baselinePopulation: 4_200_000, government: "Federal republic" },
    identity: { officialName: "Federal Republic of Aurelia", capitalCity: "Port Aurel" },
  };

  it("an approval reads the page first and founds the nation with its figures and identity", async () => {
    const { db, deps } = pageSetup();
    const fetchNationPrefill = jest.fn().mockResolvedValue(prefill);
    const service = createClaimsService(db, { ...deps, fetchNationPrefill });
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await service.reviewClaim(admin, "cl1", { approve: true });
    expect(fetchNationPrefill).toHaveBeenCalledWith("iiwiki", "Aurelia");
    expect(fetchNationPrefill.mock.invocationCallOrder[0]).toBeLessThan(
      db.$transaction.mock.invocationCallOrder[0]
    );
    const data = db.country.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: "Aurelia",
      baselinePopulation: 4_200_000,
      governmentType: "Federal republic",
      nationalIdentity: {
        create: {
          countryName: "Aurelia",
          officialName: "Federal Republic of Aurelia",
          capitalCity: "Port Aurel",
        },
      },
    });
  });

  it("the verified creator's instant approval is prefilled too", async () => {
    const { db, deps } = pageSetup();
    const fetchNationPrefill = jest.fn().mockResolvedValue(prefill);
    const service = createClaimsService(db, { ...deps, fetchNationPrefill });
    await service.claimNationPage(actor, EURTH, "Aurelia");
    expect(db.country.create.mock.calls[0][0].data).toMatchObject({
      baselinePopulation: 4_200_000,
      nationalIdentity: { create: expect.objectContaining({ capitalCity: "Port Aurel" }) },
    });
  });

  it("a failed read founds the nation with the plain baseline", async () => {
    const { db, deps } = pageSetup();
    const fetchNationPrefill = jest.fn().mockRejectedValue(new Error("wiki down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = createClaimsService(db, { ...deps, fetchNationPrefill });
    db.realmClaim.findUnique.mockResolvedValue(pendingPage);
    await expect(service.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "approved",
    });
    const data = db.country.create.mock.calls[0][0].data;
    expect(data.baselinePopulation).toBe(1_000_000);
    expect(data).not.toHaveProperty("nationalIdentity");
    warn.mockRestore();
  });

  it("claiming an existing country reads no page", async () => {
    const { db, deps } = setup();
    const fetchNationPrefill = jest.fn();
    const service = createClaimsService(db, { ...deps, fetchNationPrefill });
    await service.claimCountry(actor, "c1");
    expect(fetchNationPrefill).not.toHaveBeenCalled();
  });
});
