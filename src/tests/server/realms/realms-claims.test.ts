/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  getArticleWikitextShadow: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import { createClaimsService, DEFAULT_REALM_ID } from "~/server/modules/realms";
import { assignNation, nationCapacity } from "~/server/modules/realms";
import { prefillFromInfobox } from "~/server/modules/realms/realms.prefill";
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/server/shared/map-invalidation", () => ({
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));
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
    nationMaterialHold: { findUnique: jest.fn().mockResolvedValue(null) },
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
      where: { id: "c1", ownerUserId: null, claimable: true },
      data: { ownerUserId: "u1", ownedSince: expect.any(Date) },
    });
    expect(deps.onNationAssigned).toHaveBeenCalledTimes(1);
    expect(deps.fetchPageCreator).toHaveBeenCalledWith("ixwiki", "Aurelia");
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
      where: { id: "c1", ownerUserId: null, claimable: true },
      data: { ownerUserId: "u1", ownedSince: expect.any(Date) },
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
});

describe("listClaims", () => {
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
  it("can't review a claim in another realm, where they hold no grant", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue(claimIn([]));
    await expect(claims.reviewClaim(officer, "cl1", { approve: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
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

/** A nation page of Eurth; `takenSlugs` already belong to countries elsewhere (e.g. Ixnay). */
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

describe("claimNationPage", () => {
  it("a slug taken mid-create is a slug conflict, never 'belongs to another player'", async () => {
    const { db, deps, claims } = pageSetup();
    db.country.create.mockRejectedValue(slugViolation());
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).rejects.toMatchObject({
      name: "ClaimError",
      code: "SLUG_CONFLICT",
    });
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
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
  const ixnayRegion = () => region({ id: "ml-ixnay", realmId: DEFAULT_REALM_ID });
  /** The nation's outline as PostGIS would return it: the union of its active regions in its realm. */
  const unionQuery = (rows: RegionRow[]) =>
    jest.fn((_sql: string, countryId: string, realmId: string) => {
      const parts = rows.filter(
        (r) => r.countryId === countryId && r.realmId === realmId && r.isActive
      );
      const [first] = parts;
      const geometry =
        parts.length <= 1
          ? (first?.geometry ?? null)
          : {
              type: "MultiPolygon",
              coordinates: parts.map((r) => (r.geometry as any).coordinates),
            };
      return Promise.resolve([{ result: { geometry, wide: null } }]);
    });

  /** The map is reachable only through the approving transaction, whose client writes its own country rows. */
  function regionSetup(rows: RegionRow[]) {
    const s = pageSetup();
    const table = mapLayerTable(rows);
    const tx = {
      ...s.db,
      mapLayer: table,
      country: { ...s.db.country, update: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([{ present: true }]),
      $queryRawUnsafe: unionQuery(rows),
    };
    delete s.db.mapLayer;
    s.db.$transaction.mockImplementation((cb: (client: typeof tx) => unknown) => cb(tx));
    return { ...s, tx, table };
  }

  it("auto-approval links the realm's unlinked region named after the nation and syncs its geometry in the transaction", async () => {
    const rows = [ixnayRegion(), region()];
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
  it("never takes another realm's region, one already linked, or an inactive one", async () => {
    const rows = [
      ixnayRegion(),
      region({ id: "ml-linked", countryId: "c-other" }),
      region({ id: "ml-old", isActive: false }),
    ];
    const { table, tx, claims } = regionSetup(rows);
    await claims.claimNationPage(actor, EURTH, "Aurelia");
    expect(rows.map((r) => r.countryId)).toEqual([null, "c-other", null]);
    expect(table.updateMany).not.toHaveBeenCalled();
    expect(tx.country.update).not.toHaveBeenCalled();
  });
});

describe("realm status (AT-7)", () => {
  const eurthCountry = (status: string) => ({
    ...country,
    realmId: EURTH,
    realm: { settings: null, status },
  });

  it.each(["draft", "archived"])(
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
    await expect(claims.claimCountry(actor, "c1", { acceptedRules: false })).rejects.toMatchObject({
      code: "RULES_NOT_ACCEPTED",
    });
    expect(deps.fetchPageCreator).not.toHaveBeenCalled();
    expect(db.realmClaim.create).not.toHaveBeenCalled();
  });
});

describe("claimants see their claims and hear about rejections (AT-5)", () => {
  const pending = {
    id: "cl1",
    status: "pending",
    userId: "u1",
    countryId: "c1",
    realmId: "default",
    realm: { ownerId: "system", slug: "ixnay" },
    user: { clerkUserId: "clerk_u1" },
    country: { name: "Aurelia" },
  };
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
describe("claims on a released nation's held material (ToS §2.7, §2.8)", () => {
  const future = new Date(Date.now() + 86_400_000);
  const hold = (over: Record<string, unknown> = {}) => ({
    countryId: "c1",
    formerOwnerUserId: "u1",
    reason: "inactive",
    flag: "/flags/eurth--aurelia.png",
    coatOfArms: null,
    purgeAfter: future,
    ...over,
  });
  function heldSetup(held: ReturnType<typeof hold>, settings: unknown = null) {
    const t = setup();
    t.db.country.findUnique.mockResolvedValue({ ...country, realm: { settings } });
    t.db.country.update = jest.fn().mockResolvedValue({});
    t.db.nationMaterialHold = {
      findUnique: jest.fn().mockResolvedValue(held),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };
    return t;
  }

  it("approves the former holder within the window without review and restores the flag and arms", async () => {
    const { db, deps, claims } = heldSetup(hold());
    deps.fetchPageCreator.mockResolvedValue("Someone Else");
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({
      status: "approved",
      autoApproved: true,
    });
    expect(deps.fetchPageCreator).not.toHaveBeenCalled();
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { flag: "/flags/eurth--aurelia.png", coatOfArms: null },
    });
    expect(db.nationMaterialHold.delete).toHaveBeenCalledWith({ where: { countryId: "c1" } });
  });

  it("ends the window when another player's claim is approved: the material is purged, never handed over", async () => {
    const { db, claims } = heldSetup(hold({ formerOwnerUserId: "u9" }));
    await expect(claims.claimCountry(actor, "c1")).resolves.toMatchObject({ status: "approved" });
    expect(db.nationMaterialHold.update).toHaveBeenCalledWith({
      where: { countryId: "c1" },
      data: { purgeAfter: expect.any(Date) },
    });
    expect(db.nationMaterialHold.delete).not.toHaveBeenCalled();
  });
});

describe("scenery slots (Country.claimable false)", () => {
  const scenery = { ...country, claimable: false };

  it("claimCountry refuses a slot nobody may claim and files nothing", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue(scenery);
    await expect(claims.claimCountry(actor, "c1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
    expect(db.country.updateMany).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });
  it("an auto-approval that loses a flip to scenery is a claim error, not a 500, and assigns nothing", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique
      .mockResolvedValueOnce({ ...country, claimable: true })
      .mockResolvedValueOnce(scenery);
    await expect(claims.claimCountry(actor, "c1")).rejects.toMatchObject({
      name: "ClaimError",
      code: "NOT_FOUND",
      message: expect.stringMatching(/no longer open for claims/),
    });
    expect(db.country.updateMany).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
  });
  it("approving a claim filed before its country was made scenery rejects it with a reason and assigns nothing", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue(scenery);
    db.realmClaim.findUnique.mockResolvedValue({
      id: "cl1",
      status: "pending",
      userId: "u1",
      countryId: "c1",
      realmId: "default",
      realm: { ownerId: "system", slug: "ixnay", officers: [] },
      user: { clerkUserId: "clerk_u1" },
      country: { name: "Aurelia" },
    });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({
      status: "rejected",
    });
    expect(db.country.updateMany).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(deps.onNationAssigned).not.toHaveBeenCalled();
    expect(db.realmClaim.updateMany).toHaveBeenLastCalledWith({
      where: { id: "cl1", status: "pending" },
      data: expect.objectContaining({
        status: "rejected",
        rejectionReason: expect.stringMatching(/no longer open for claims/),
      }),
    });
    expect(deps.onClaimRejected).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringMatching(/no longer open for claims/) })
    );
  });
});

/**
 * Realm invites (`/r/{slug}?via={handle}`): a claim records its inviter only when the `via` handle names
 * another player who holds a nation in the claim's realm, and never replaces an inviter already recorded.
 * Anything else is ignored silently. On approval the inviter travels with the nation-assigned event.
 */
describe("claim invites", () => {
  const actor = { id: "u1", clerkUserId: "clerk_u1", role: null };
  const EURTH = "eurth-id";
  const INVITER = "u_inviter";
  const country = {
    id: "c1",
    name: "Aurelia",
    realmId: DEFAULT_REALM_ID,
    ownerUserId: null,
    wikiSource: "ixwiki",
    wikiPageTitle: null,
    realm: { settings: null },
  };
  interface CountryWhere {
    realmId?: string;
    ownerUserId?: string;
    name?: string;
  }
  /** `holdings`: user id → realm ids they hold a nation in. */
  function setup(holdings: Record<string, string[]> = { [INVITER]: [DEFAULT_REALM_ID, EURTH] }) {
    const db = {
      $transaction: jest.fn((cb: (tx: object) => Promise<object>): Promise<object> => cb(db)),
      country: {
        findUnique: jest.fn().mockResolvedValue(country),
        findFirst: jest.fn(({ where }: { where: CountryWhere }) => {
          const held =
            where.ownerUserId && where.realmId
              ? holdings[where.ownerUserId]?.includes(where.realmId)
              : false;
          return Promise.resolve(held ? { id: "held" } : null);
        }),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: "new-c", name: data.name })
        ),
      },
      realmPage: {
        findFirst: jest.fn().mockResolvedValue({
          wikiSource: "iiwiki",
          realm: { slug: "eurth", settings: null, status: "active" },
        }),
      },
      mapLayer: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // No verified wiki account: claims wait for review unless a test says otherwise.
      wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
      nationMaterialHold: { findUnique: jest.fn().mockResolvedValue(null) },
      realmClaim: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "cl1", ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const deps = {
      fetchPageCreator: jest.fn().mockResolvedValue("Kir"),
      onNationAssigned: jest.fn().mockResolvedValue(undefined),
      onClaimRejected: jest.fn().mockResolvedValue(undefined),
      resolveInviter: jest.fn((via: string) =>
        Promise.resolve(
          (
            { ambassador: INVITER, me_myself: "u1", drifter: "u_drifter" } as Record<string, string>
          )[via] ?? null
        )
      ),
    };
    return { db, deps, claims: createClaimsService(db as never, deps) };
  }
  const createdData = (db: ReturnType<typeof setup>["db"]) =>
    (db.realmClaim.create.mock.calls[0]?.[0] as { data: Record<string, string> }).data;
  describe("claim invites", () => {
    it("ignores a self-invite", async () => {
      const { db, claims } = setup({ u1: [DEFAULT_REALM_ID], [INVITER]: [DEFAULT_REALM_ID] });
      await expect(claims.claimCountry(actor, "c1", { via: "me_myself" })).resolves.toMatchObject({
        status: "pending",
      });
      expect(createdData(db)).not.toHaveProperty("invitedByUserId");
    });
    it("never overwrites an inviter already recorded", async () => {
      const { db, deps, claims } = setup();
      db.realmClaim.findFirst.mockResolvedValue({
        id: "old",
        userId: "u1",
        invitedByUserId: "u_first",
      });
      await claims.claimCountry(actor, "c1", { via: "ambassador" });
      expect(deps.resolveInviter).not.toHaveBeenCalled();
      expect(db.realmClaim.updateMany).not.toHaveBeenCalled();
    });

    it("keeps the stored inviter when a concurrent claim recorded one first", async () => {
      const { db, deps, claims } = setup();
      db.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir" });
      db.realmClaim.findFirst.mockResolvedValue({ id: "old", userId: "u1", invitedByUserId: null });
      // The guarded attach loses the race: the row has an inviter by now.
      db.realmClaim.updateMany.mockResolvedValueOnce({ count: 0 });
      db.realmClaim.findUnique.mockResolvedValue({ invitedByUserId: "u_first" });
      await claims.claimCountry(actor, "c1", { via: "ambassador" });
      expect(db.realmClaim.findUnique).toHaveBeenCalledWith({
        where: { id: "old" },
        select: { invitedByUserId: true },
      });
      expect(deps.onNationAssigned).toHaveBeenCalledWith(
        expect.objectContaining({ inviterUserId: "u_first" })
      );
    });
  });
});

describe("claiming a nation the source sync created", () => {
  const EURTH = "eurth-id";
  const actor = { id: "u1", clerkUserId: "clerk_u1", role: null };
  const realm = { settings: null, status: "active", slug: "eurth", rulesHtml: null };
  /** An unclaimed nation the realm's source sync created. */
  const unclaimed = {
    id: "c-sync",
    name: "Aurelia",
    realmId: EURTH,
    ownerUserId: null,
    wikiSource: "iiwiki",
    wikiPageTitle: "Aurelia",
    realm,
  };
  const prefill = {
    country: {
      flag: "https://img/flag.png",
      coatOfArms: "https://img/arms.png",
      leader: "Queen Ana",
      baselinePopulation: 9,
    },
    identity: { motto: "Onward", capitalCity: "Wiki City" },
  };
  function setup() {
    const db: any = {
      $transaction: jest.fn((cb: any) => cb(db)),
      country: {
        findUnique: jest.fn(async ({ select }: any) =>
          // loadClaimable selects the realm; fillEmptyFromPrefill selects the identity.
          select?.nationalIdentity
            ? {
                name: "Aurelia",
                flag: null,
                coatOfArms: "https://existing/arms.png",
                leader: null,
                governmentType: null,
                nationalIdentity: { capitalCity: "Map City", motto: null },
              }
            : unclaimed
        ),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => Promise.resolve({ id: "new-c", name: data.name })),
      },
      nationalIdentity: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      realmPage: {
        findFirst: jest.fn().mockResolvedValue({ wikiSource: "iiwiki", realm }),
      },
      mapLayer: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wikiAccountLink: { findFirst: jest.fn().mockResolvedValue({ username: "Kir" }) },
      nationMaterialHold: { findUnique: jest.fn().mockResolvedValue(null) },
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
      fetchNationPrefill: jest.fn().mockResolvedValue(prefill),
    };
    return { db, deps, claims: createClaimsService(db, deps) };
  }
  describe("claiming an unclaimed nation the source sync created", () => {
    it("a claim on its roster page becomes a claim on the existing country: handed over, never created again", async () => {
      const { db, deps, claims } = setup();
      db.country.findFirst.mockResolvedValue({ id: "c-sync", name: "Aurelia", ownerUserId: null });
      await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({
        status: "approved",
      });
      expect(db.country.create).not.toHaveBeenCalled();
      expect(db.country.updateMany).toHaveBeenCalledWith({
        where: { id: "c-sync", ownerUserId: null, claimable: true },
        data: { ownerUserId: "u1", ownedSince: expect.any(Date) },
      });
      expect(db.realmClaim.create.mock.calls[0][0].data).toMatchObject({ countryId: "c-sync" });
      expect(deps.onNationAssigned).toHaveBeenCalledWith(
        expect.objectContaining({ countryId: "c-sync" })
      );
    });

    it("the infobox then fills only what is still empty: flag and leader, never the arms or the map's capital", async () => {
      const { db, deps, claims } = setup();
      await claims.claimCountry(actor, "c-sync");
      expect(deps.fetchNationPrefill).toHaveBeenCalledWith("iiwiki", "Aurelia");
      expect(db.country.update).toHaveBeenCalledWith({
        where: { id: "c-sync" },
        data: { flag: "https://img/flag.png", leader: "Queen Ana" },
      });
      expect(db.nationalIdentity.update).toHaveBeenCalledWith({
        where: { countryId: "c-sync" },
        data: { motto: "Onward" },
      });
      // The sync's figures are never replaced by the infobox's.
      expect(JSON.stringify(db.country.update.mock.calls)).not.toContain("baselinePopulation");
    });
    it("finds the nation by its wiki page, not its name: a renamed nation is handed over, never duplicated", async () => {
      const { db, claims } = setup();
      db.country.findFirst.mockImplementation(async ({ where }: any) =>
        where.name === "Aurelia" ? null : { id: "c-sync", name: "Free Aurelia", ownerUserId: null }
      );
      // A create would look for a free slug: none is taken.
      const byId = db.country.findUnique.getMockImplementation();
      db.country.findUnique.mockImplementation(async (args: any) =>
        args.where.slug ? null : byId(args)
      );
      await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({
        status: "approved",
      });
      expect(db.country.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            realmId: EURTH,
            OR: [
              { wikiSource: "iiwiki", wikiPageTitle: "Aurelia" },
              { wikiPageTitle: null, name: "Aurelia" },
            ],
            claimable: true,
          },
        })
      );
      expect(db.country.create).not.toHaveBeenCalled();
    });
  });
});

describe("the nation cap", () => {
  function client(held: number, membershipTier: string | null) {
    return {
      country: { count: jest.fn().mockResolvedValue(held) },
      user: { findUnique: jest.fn().mockResolvedValue({ membershipTier }) },
    } as any;
  }
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
  });
  describe("the tier cap is enforced by assignNation and claims", () => {
    const unowned = {
      id: "c1",
      realmId: "r1",
      ownerUserId: null,
      realm: { settings: { maxNationsPerUser: 5 }, status: "active" },
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
  });
});

/**
 * AT-3: a claimed nation page's infobox prefills the nation its approval creates: baseline figures, flag and
 * coat of arms, and national identity. Nonsense values fall back to the baseline; a failing wiki gives nothing.
 */
describe("prefilling a claimed nation from its page", () => {
  describe("prefillFromInfobox", () => {
    it("drops an image value that is neither https nor the app's media proxy", () => {
      for (const flagUrl of [
        "javascript:alert(1)",
        "http://iiwiki.com/flag.png",
        "/somewhere/else.png",
        "/api/mediawiki/../admin",
      ]) {
        expect(prefillFromInfobox({ name: "X", flagUrl }, "iiwiki").country.flag).toBeUndefined();
      }
    });
  });
});
