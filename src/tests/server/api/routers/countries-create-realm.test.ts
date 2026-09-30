/** @jest-environment node */
/**
 * countries.createCountry is realm-aware and capped: it founds the nation in the chosen realm (else the realm of
 * the nation the player acts as, else IxWorld), refuses a closed or unknown realm, and refuses a player at their
 * nation cap instead of silently returning the nation they already have.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({
  ...jest.requireActual("~/lib/auth"),
  isSystemOwner: () => false,
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/layer-cache", () => ({ clearLayerCache: jest.fn() }));
jest.mock("~/lib/vault/vault-bonus", () => ({
  getBonusConfig: jest.fn().mockResolvedValue({ newPlayer: 0, wikiImport: 0 }),
  grantBonus: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/country-mutation-helpers", () => ({
  syncNationalIdentity: jest.fn(),
  syncDemographics: jest.fn(),
  syncIncomeAndSpending: jest.fn(),
  syncTaxSystem: jest.fn(),
  syncGovernmentStructure: jest.fn(),
  syncGovernmentComponents: jest.fn(),
  syncEconomyBuilderState: jest.fn(),
}));

import { createTRPCRouter } from "~/server/api/trpc";
import { managementCreateProcedures } from "~/server/api/routers/countries/management/create";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const router = createTRPCRouter(managementCreateProcedures);
const CLERK_ID = "clerk_p1";

interface Scenario {
  membershipTier?: string;
  /** Realm of the nation the player acts as (null: acts as none). */
  activeRealmId?: string | null;
  realms?: Record<string, { status: string; settings: object | null }>;
  /** Nations the player owns per realm. */
  held?: Record<string, number>;
  nameTaken?: boolean;
}

function setup(s: Scenario = {}) {
  const realms = s.realms ?? { default: { status: "active", settings: null } };
  const held = s.held ?? {};
  const db: any = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(({ where }: { where: { clerkUserId?: string; id?: string } }) =>
        Promise.resolve(
          where.clerkUserId
            ? { id: "u1", clerkUserId: CLERK_ID, roleId: "r_user", role: { name: "user" } }
            : {
                membershipTier: s.membershipTier ?? "basic",
                country: s.activeRealmId ? { realmId: s.activeRealmId } : null,
              }
        )
      ),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    realm: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const realm = realms[where.id];
        return Promise.resolve(realm ? { id: where.id, ...realm } : null);
      }),
    },
    country: {
      findFirst: jest.fn().mockResolvedValue(s.nameTaken ? { id: "other" } : null),
      count: jest.fn(({ where }: { where: { realmId: string } }) =>
        Promise.resolve(held[where.realmId] ?? 0)
      ),
      findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.slug) return Promise.resolve(null); // slug free
        return Promise.resolve({
          id: "c_new",
          realmId: db.country.create.mock.calls[0]?.[0].data.realmId,
          ownerUserId: null,
          realm: {
            settings: realms[db.country.create.mock.calls[0]?.[0].data.realmId]?.settings ?? null,
          },
        });
      }),
      create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "c_new", ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  db.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(db));
  const ctx = createMockRouterContext({
    db,
    auth: { userId: CLERK_ID },
    user: { id: "u1", clerkUserId: CLERK_ID, countryId: null, role: { name: "user" } },
  });
  return { db, caller: router.createCaller(ctx as never) };
}

const input = (extra: object = {}) => ({
  name: "New Aurelia",
  foundationCountry: null,
  economicInputs: {},
  ...extra,
});

describe("countries.createCountry — realm and cap", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it("a free player who already holds an IxWorld nation is refused (CONFLICT), not handed the old nation", async () => {
    const { db, caller } = setup({ activeRealmId: "default", held: { default: 1 } });
    await expect(caller.createCountry(input() as never)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/already hold 1 nation in this realm/),
    });
    expect(db.country.create).not.toHaveBeenCalled();
  });

  it("founds the nation in the chosen realm, assigns it and makes it the active nation", async () => {
    const { db, caller } = setup({
      membershipTier: "mycountry_premium",
      activeRealmId: "default",
      realms: {
        default: { status: "active", settings: null },
        eurth: { status: "active", settings: { maxNationsPerUser: 3 } },
      },
      held: { default: 1, eurth: 1 },
    });
    await caller.createCountry(input({ realmId: "eurth" }) as never);
    expect(db.country.count).toHaveBeenCalledWith({
      where: { ownerUserId: "u1", realmId: "eurth" },
    });
    expect(db.country.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "New Aurelia", realmId: "eurth" }),
    });
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c_new", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { countryId: "c_new" },
    });
  });

  it("without a realmId it uses the realm of the nation the player acts as", async () => {
    const { db, caller } = setup({
      membershipTier: "mycountry_premium",
      activeRealmId: "eurth",
      realms: { eurth: { status: "active", settings: { maxNationsPerUser: 2 } } },
      held: { eurth: 1 },
    });
    await caller.createCountry(input() as never);
    expect(db.realm.findUnique).toHaveBeenCalledWith({
      where: { id: "eurth" },
      select: { id: true, status: true, settings: true },
    });
    expect(db.country.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ realmId: "eurth" }),
    });
  });

  it("a new player with no nation defaults to IxWorld", async () => {
    const { db, caller } = setup();
    await caller.createCountry(input() as never);
    expect(db.country.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ realmId: "default" }),
    });
  });

  it("an unknown realm is NOT_FOUND and a closed realm FORBIDDEN; nothing is created", async () => {
    const unknown = setup();
    await expect(
      unknown.caller.createCountry(input({ realmId: "nowhere" }) as never)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(unknown.db.country.create).not.toHaveBeenCalled();

    const closed = setup({ realms: { old: { status: "archived", settings: null } } });
    await expect(
      closed.caller.createCountry(input({ realmId: "old" }) as never)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(closed.db.country.create).not.toHaveBeenCalled();
  });

  it("a name already used in the realm is CONFLICT before anything is written", async () => {
    const { db, caller } = setup({ nameTaken: true });
    await expect(caller.createCountry(input() as never)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/already exists in this realm/),
    });
    expect(db.country.findFirst).toHaveBeenCalledWith({
      where: { realmId: "default", name: "New Aurelia" },
      select: { id: true },
    });
    expect(db.country.create).not.toHaveBeenCalled();
  });

  it("a cap filled concurrently (inside the transaction) is CONFLICT, not a generic failure", async () => {
    const { db, caller } = setup();
    // The pre-check sees 0, the transaction's re-check sees 1.
    db.country.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(caller.createCountry(input() as never)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
