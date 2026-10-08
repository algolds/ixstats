/** @jest-environment node */
/**
 * Realm invites (`/r/{slug}?via={handle}`): a claim records its inviter only when the `via` handle names
 * another player who holds a nation in the claim's realm, and never replaces an inviter already recorded.
 * Anything else is ignored silently. On approval the inviter travels with the nation-assigned event.
 */
import { createClaimsService, DEFAULT_REALM_ID } from "~/server/modules/realms";

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  resolvePrimaryWikiUsername: (name: string) => name,
}));

const actor = { id: "u1", clerkUserId: "clerk_u1", role: null };
const admin = { id: "a1", clerkUserId: "clerk_a1", role: { name: "admin", level: 10 } };
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
    $transaction: jest.fn((cb: (tx: object) => Promise<object>) => cb(db)),
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
        ({ ambassador: INVITER, me_myself: "u1", drifter: "u_drifter" } as Record<string, string>)[
          via
        ] ?? null
      )
    ),
  };
  return { db, deps, claims: createClaimsService(db as never, deps) };
}

const createdData = (db: ReturnType<typeof setup>["db"]) =>
  (db.realmClaim.create.mock.calls[0]?.[0] as { data: Record<string, string> }).data;

describe("claim invites", () => {
  it("records the inviter who holds a nation in the claim's realm", async () => {
    const { db, deps, claims } = setup();
    await claims.claimCountry(actor, "c1", { via: "ambassador" });
    expect(deps.resolveInviter).toHaveBeenCalledWith("ambassador");
    expect(db.country.findFirst).toHaveBeenCalledWith({
      where: { realmId: DEFAULT_REALM_ID, ownerUserId: INVITER },
      select: { id: true },
    });
    expect(createdData(db)).toMatchObject({ invitedByUserId: INVITER, status: "pending" });
  });

  it("records the inviter on a nation page claim in their realm", async () => {
    const { db, claims } = setup();
    await claims.claimNationPage(actor, EURTH, "Aurelia", { via: "ambassador" });
    expect(createdData(db)).toMatchObject({ invitedByUserId: INVITER, wikiPageTitle: "Aurelia" });
  });

  it("ignores a self-invite", async () => {
    const { db, claims } = setup({ u1: [DEFAULT_REALM_ID], [INVITER]: [DEFAULT_REALM_ID] });
    await expect(claims.claimCountry(actor, "c1", { via: "me_myself" })).resolves.toMatchObject({
      status: "pending",
    });
    expect(createdData(db)).not.toHaveProperty("invitedByUserId");
  });

  it("ignores an inviter without a nation in the claim's realm", async () => {
    const { db, claims } = setup({ [INVITER]: [EURTH] });
    await claims.claimCountry(actor, "c1", { via: "ambassador" });
    expect(createdData(db)).not.toHaveProperty("invitedByUserId");
    const other = setup();
    await other.claims.claimCountry(actor, "c1", { via: "drifter" });
    expect(createdData(other.db)).not.toHaveProperty("invitedByUserId");
  });

  it("ignores an unknown, blank or failing via without an error", async () => {
    const unknown = setup();
    await expect(
      unknown.claims.claimCountry(actor, "c1", { via: "nobody" })
    ).resolves.toMatchObject({ status: "pending" });
    expect(createdData(unknown.db)).not.toHaveProperty("invitedByUserId");

    const blank = setup();
    await blank.claims.claimCountry(actor, "c1", { via: "   " });
    expect(blank.deps.resolveInviter).not.toHaveBeenCalled();
    expect(createdData(blank.db)).not.toHaveProperty("invitedByUserId");

    const failing = setup();
    failing.deps.resolveInviter.mockRejectedValue(new Error("db down"));
    await expect(
      failing.claims.claimCountry(actor, "c1", { via: "ambassador" })
    ).resolves.toMatchObject({ status: "pending" });
    expect(createdData(failing.db)).not.toHaveProperty("invitedByUserId");
  });

  it("files no inviter without a via", async () => {
    const { db, deps, claims } = setup();
    await claims.claimCountry(actor, "c1");
    expect(deps.resolveInviter).not.toHaveBeenCalled();
    expect(createdData(db)).not.toHaveProperty("invitedByUserId");
  });

  it("adds the inviter to the player's pending claim that has none, guarded on it still having none", async () => {
    const { db, claims } = setup();
    db.realmClaim.findFirst.mockResolvedValue({ id: "old", userId: "u1", invitedByUserId: null });
    await expect(claims.claimCountry(actor, "c1", { via: "ambassador" })).resolves.toMatchObject({
      claimId: "old",
      status: "pending",
    });
    expect(db.realmClaim.updateMany).toHaveBeenCalledWith({
      where: { id: "old", invitedByUserId: null },
      data: { invitedByUserId: INVITER },
    });
    expect(db.realmClaim.create).not.toHaveBeenCalled();
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

describe("the inviter on approval", () => {
  it("an auto-approved invited claim carries the inviter in the nation-assigned event", async () => {
    const { db, deps, claims } = setup();
    db.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir" });
    await expect(claims.claimCountry(actor, "c1", { via: "ambassador" })).resolves.toMatchObject({
      status: "approved",
    });
    expect(createdData(db)).toMatchObject({ invitedByUserId: INVITER, status: "approved" });
    expect(deps.onNationAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ countryId: "c1", inviterUserId: INVITER })
    );
  });

  it("an auto-approved upgrade of a pending claim keeps its first inviter", async () => {
    const { db, deps, claims } = setup();
    db.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir" });
    db.realmClaim.findFirst.mockResolvedValue({
      id: "old",
      userId: "u1",
      invitedByUserId: "u_first",
    });
    await claims.claimCountry(actor, "c1", { via: "ambassador" });
    expect(deps.onNationAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ inviterUserId: "u_first" })
    );
  });

  it("a moderator's approval of an invited claim carries its inviter", async () => {
    const { db, deps, claims } = setup();
    db.realmClaim.findUnique.mockResolvedValue({
      id: "cl1",
      status: "pending",
      userId: "u1",
      countryId: "c1",
      realmId: DEFAULT_REALM_ID,
      invitedByUserId: INVITER,
      realm: { ownerId: "system", officers: [] },
      user: { clerkUserId: "clerk_u1" },
      country: { name: "Aurelia" },
    });
    await claims.reviewClaim(admin, "cl1", { approve: true });
    expect(deps.onNationAssigned).toHaveBeenCalledWith({
      userId: "u1",
      clerkUserId: "clerk_u1",
      countryId: "c1",
      countryName: "Aurelia",
      inviterUserId: INVITER,
    });
  });

  it("an uninvited approval has no inviter in its event", async () => {
    const { db, deps, claims } = setup();
    db.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir" });
    await claims.claimCountry(actor, "c1");
    expect(deps.onNationAssigned.mock.calls[0]?.[0]).not.toHaveProperty("inviterUserId");
  });
});
