/** @jest-environment node */
import { createClaimsService } from "~/server/modules/realms";
import { fillEmptyFromPrefill } from "~/server/modules/realms/realms.handover";

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  resolvePrimaryWikiUsername: (name: string) => name,
}));

const EURTH = "eurth-id";
const actor = { id: "u1", clerkUserId: "clerk_u1", role: null };
const admin = { id: "a1", clerkUserId: "clerk_a1", role: { name: "admin", level: 10 } };
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
  country: { flag: "https://img/flag.png", coatOfArms: "https://img/arms.png", leader: "Queen Ana", baselinePopulation: 9 },
  identity: { motto: "Onward", capitalCity: "Wiki City" },
};

function setup() {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    country: {
      findUnique: jest.fn(async ({ select }: any) =>
        // loadClaimable selects the realm; fillEmptyFromPrefill selects the identity.
        select?.nationalIdentity
          ? { name: "Aurelia", flag: null, coatOfArms: "https://existing/arms.png", leader: null, governmentType: null,
              nationalIdentity: { capitalCity: "Map City", motto: null } }
          : unclaimed
      ),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "new-c", name: data.name })),
    },
    nationalIdentity: { update: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
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
    realmClaim: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "cl1", ...data })),
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
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({ status: "approved" });
    expect(db.country.create).not.toHaveBeenCalled();
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c-sync", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(db.realmClaim.create.mock.calls[0][0].data).toMatchObject({ countryId: "c-sync" });
    expect(deps.onNationAssigned).toHaveBeenCalledWith(expect.objectContaining({ countryId: "c-sync" }));
  });

  it("the infobox then fills only what is still empty: flag and leader, never the arms or the map's capital", async () => {
    const { db, deps, claims } = setup();
    await claims.claimCountry(actor, "c-sync");
    expect(deps.fetchNationPrefill).toHaveBeenCalledWith("iiwiki", "Aurelia");
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c-sync" },
      data: { flag: "https://img/flag.png", leader: "Queen Ana" },
    });
    expect(db.nationalIdentity.update).toHaveBeenCalledWith({ where: { countryId: "c-sync" }, data: { motto: "Onward" } });
    // The sync's figures are never replaced by the infobox's.
    expect(JSON.stringify(db.country.update.mock.calls)).not.toContain("baselinePopulation");
  });

  it("a pending page claim approved after the sync created the nation hands that nation over", async () => {
    const { db, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue({
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
    });
    db.country.findFirst.mockResolvedValue({ id: "c-sync", name: "Aurelia", ownerUserId: null });
    await expect(claims.reviewClaim(admin, "cl1", { approve: true })).resolves.toEqual({ status: "approved" });
    expect(db.country.create).not.toHaveBeenCalled();
    expect(db.realmClaim.update).toHaveBeenCalledWith({ where: { id: "cl1" }, data: { countryId: "c-sync" } });
  });

  it("finds the nation by its wiki page, not its name: a renamed nation is handed over, never duplicated", async () => {
    const { db, claims } = setup();
    db.country.findFirst.mockImplementation(async ({ where }: any) =>
      where.name === "Aurelia" ? null : { id: "c-sync", name: "Free Aurelia", ownerUserId: null }
    );
    // A create would look for a free slug: none is taken.
    const byId = db.country.findUnique.getMockImplementation();
    db.country.findUnique.mockImplementation(async (args: any) => (args.where.slug ? null : byId(args)));
    await expect(claims.claimNationPage(actor, EURTH, "Aurelia")).resolves.toMatchObject({ status: "approved" });
    expect(db.country.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmId: EURTH,
          OR: [
            { wikiSource: "iiwiki", wikiPageTitle: "Aurelia" },
            { wikiPageTitle: null, name: "Aurelia" },
          ],
        },
      })
    );
    expect(db.country.create).not.toHaveBeenCalled();
  });

  it("a nation only on the realm's map (no wiki) always goes to manual review", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue({ ...unclaimed, wikiSource: null, wikiPageTitle: null });
    await expect(claims.claimCountry(actor, "c-sync")).resolves.toMatchObject({ status: "pending" });
    expect(deps.fetchPageCreator).not.toHaveBeenCalled();
    expect(db.country.updateMany).not.toHaveBeenCalled();
  });

  it("an IxWorld country's claim reads no infobox (unchanged behaviour)", async () => {
    const { db, deps, claims } = setup();
    db.country.findUnique.mockResolvedValue({ ...unclaimed, realmId: "default", wikiSource: "ixwiki" });
    await claims.claimCountry(actor, "c-sync");
    expect(deps.fetchNationPrefill).not.toHaveBeenCalled();
  });
});

describe("fillEmptyFromPrefill", () => {
  it("creates the identity when the nation has none, and does nothing without a prefill", async () => {
    const tx: any = {
      country: {
        findUnique: jest.fn().mockResolvedValue({ name: "X", flag: "f", coatOfArms: "a", leader: "l", governmentType: "g", nationalIdentity: null }),
        update: jest.fn(),
      },
      nationalIdentity: { create: jest.fn(), update: jest.fn() },
    };
    await fillEmptyFromPrefill(tx, "c", null);
    expect(tx.country.findUnique).not.toHaveBeenCalled();
    await fillEmptyFromPrefill(tx, "c", prefill as never);
    expect(tx.country.update).not.toHaveBeenCalled();
    expect(tx.nationalIdentity.create).toHaveBeenCalledWith({
      data: { countryId: "c", countryName: "X", motto: "Onward", capitalCity: "Wiki City" },
    });
  });
});
