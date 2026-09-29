/** @jest-environment node */
// Fix round 1 (rulings E-o, E-p, E-q): admin "*" reads, realm-correct name lookups, IxWorld-less cache keys.
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/economy/atomic-integration.server", () => ({
  calculateCountryDataWithAtomicEnhancement: jest.fn().mockResolvedValue({}),
}));
jest.mock("~/lib/admin/roster-parser", () => ({ parseRosterFile: jest.fn() }));

import { createCallerFactory, createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { parseRosterFile } from "~/lib/admin/roster-parser";
import { ALL_REALMS, DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { realmScopeInput, realmWhere } from "~/server/api/trpc/realm-scope";
import { identityProcedures } from "~/server/api/routers/countries/identity";
import { atomicProcedures } from "~/server/api/routers/countries/atomic";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { adminCountriesImportRouter } from "~/server/api/routers/admin/countries/import";
import { resolveTargetCountryRecord } from "~/lib/national-issues/evaluators/issue-instantiation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Row = {
  id: string;
  name: string;
  slug: string | null;
  realmId: string;
  [key: string]: unknown;
};
type Where = Record<string, any> | undefined;

/** Just enough of Prisma's `where` for these lookups: equality, in, not, equals(+insensitive), OR. */
function matches(row: Row, where: Where): boolean {
  return Object.entries(where ?? {}).every(([key, cond]) => {
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));
    if (cond === undefined) return true;
    const value = row[key];
    if (cond === null || typeof cond !== "object") return value === cond;
    if ("in" in cond) return cond.in.includes(value);
    if ("not" in cond) return value !== cond.not;
    if ("equals" in cond) {
      return cond.mode === "insensitive"
        ? String(value).toLowerCase() === String(cond.equals).toLowerCase()
        : value === cond.equals;
    }
    return true;
  });
}

function countryTable(rows: Row[]) {
  const find = (args?: { where?: Where; take?: number }) =>
    rows.filter((r) => matches(r, args?.where)).slice(0, args?.take ?? rows.length);
  return {
    findMany: jest.fn(async (args?: { where?: Where; take?: number }) => find(args)),
    findFirst: jest.fn(async (args?: { where?: Where }) => find(args)[0] ?? null),
    findUnique: jest.fn(async (args?: { where?: Where }) => find(args)[0] ?? null),
    create: jest.fn(async (args: { data: object }) => args.data),
    update: jest.fn(async (args: { data: object }) => args.data),
  };
}

// The other realm's same-name nation comes FIRST, so an unscoped lookup would return it.
const EURTH_GALLAMBRIA: Row = {
  id: "c_eu",
  name: "Gallambria",
  slug: "gallambria-eurth",
  realmId: "r_eurth",
  leader: "Eurth leader",
};
const IX_GALLAMBRIA: Row = {
  id: "c_ix",
  name: "Gallambria",
  slug: "gallambria-ix",
  realmId: DEFAULT_REALM_ID,
  leader: "IxWorld leader",
};

function publicCtx(country: ReturnType<typeof countryTable>, realmId?: string) {
  return {
    db: { country, realm: { findUnique: jest.fn().mockResolvedValue(null) } },
    user: realmId ? { id: "u1", clerkUserId: "clerk_u1", country: { realmId } } : null,
    auth: null,
    rateLimitIdentifier: "test",
    headers: new Headers(),
  } as never;
}

describe("E-p: a name resolves inside one realm; ids and slugs win first", () => {
  const byId = createCallerFactory(createTRPCRouter({ ...identityProcedures }));

  it("getByIdBasic resolves a bare name within the viewer's realm", async () => {
    const table = countryTable([EURTH_GALLAMBRIA, IX_GALLAMBRIA]);
    await expect(byId(publicCtx(table)).getByIdBasic({ id: "Gallambria" })).resolves.toMatchObject({
      id: "c_ix",
    });
    await expect(
      byId(publicCtx(table, "r_eurth")).getByIdBasic({ id: "Gallambria" })
    ).resolves.toMatchObject({
      id: "c_eu",
    });
  });

  it("getByIdBasic prefers an id, then a (globally unique) slug, over a name", async () => {
    const table = countryTable([{ ...EURTH_GALLAMBRIA, name: "c_ix" }, IX_GALLAMBRIA]);
    await expect(
      byId(publicCtx(table, "r_eurth")).getByIdBasic({ id: "c_ix" })
    ).resolves.toMatchObject({ id: "c_ix" });
    await expect(
      byId(publicCtx(table)).getByIdBasic({ id: "gallambria-eurth" })
    ).resolves.toMatchObject({
      id: "c_eu",
    });
  });

  it("getByNameWithAtomic (/maps?name=) resolves within the viewer's realm", async () => {
    const table = countryTable([EURTH_GALLAMBRIA, IX_GALLAMBRIA]);
    const atomic = createCallerFactory(createTRPCRouter({ ...atomicProcedures }));
    await expect(
      atomic(publicCtx(table)).getByNameWithAtomic({ name: "gallambria" })
    ).resolves.toMatchObject({
      id: "c_ix",
    });
  });

  it("national-issue targets come from the subject nation's realm", async () => {
    const subject: Row = {
      id: "c_subj",
      name: "Subject",
      slug: "subject",
      realmId: DEFAULT_REALM_ID,
    };
    const db = {
      country: countryTable([subject, EURTH_GALLAMBRIA, IX_GALLAMBRIA]),
      intent: { findMany: jest.fn().mockResolvedValue([{ target: "Gallambria" }]) },
    };
    const byIntent = await resolveTargetCountryRecord("c_subj", db as never, {} as never);
    expect(byIntent?.leader).toBe("IxWorld leader");

    db.intent.findMany.mockResolvedValue([]);
    db.country = countryTable([subject, EURTH_GALLAMBRIA]);
    await expect(
      resolveTargetCountryRecord("c_subj", db as never, {} as never)
    ).resolves.toBeNull();
  });

  it("blockAccount matches a slug first, then a name only within the viewer's realm", async () => {
    const table = countryTable([EURTH_GALLAMBRIA, IX_GALLAMBRIA]);
    const db = createMockPrisma({ country: table });
    db.userConnection.create.mockImplementation(async (args: { data: object }) => args.data);
    const ctx = createMockRouterContext({
      db,
      user: {
        id: "u1",
        clerkUserId: "test_user_clerk_id",
        country: { id: "c_me", name: "Me", slug: "me", realmId: DEFAULT_REALM_ID },
      },
    });
    const caller = createCallerFactory(usersPreferencesRouter)(ctx as never);

    await caller.blockAccount({ identifier: "@Gallambria" });
    expect(db.userConnection.create.mock.calls[0][0].data.targetCountryId).toBe("c_ix");

    await caller.blockAccount({ identifier: "gallambria-eurth" });
    expect(db.userConnection.create.mock.calls[1][0].data.targetCountryId).toBe("c_eu");
  });

  it("the roster import (IxWorld-only) never updates another realm's same-name nation", async () => {
    const table = countryTable([EURTH_GALLAMBRIA]);
    (parseRosterFile as jest.Mock).mockResolvedValue([
      { country: "Gallambria", population: 1_000_000, gdpPerCapita: 10_000 },
    ]);
    const ctx = createMockRouterContext({
      db: createMockPrisma({ country: table }),
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    });
    const caller = createCallerFactory(adminCountriesImportRouter)(ctx as never);

    await caller.importRosterData({
      analysisId: "a",
      replaceExisting: true,
      fileData: [1],
      fileName: "r.csv",
    });

    expect(table.update).not.toHaveBeenCalled();
    expect(table.create).toHaveBeenCalledTimes(1);
  });
});

describe('E-o: admins read every realm with realm "*"', () => {
  const db = { realm: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
  const eurthUser = { id: "u1", clerkUserId: "clerk_u1", country: { realmId: "r_eurth" } };

  it("gives a site admin no realm filter", async () => {
    const admin = { ...eurthUser, role: { name: "admin", level: 10 } };
    await expect(realmWhere({ db, user: admin }, ALL_REALMS)).resolves.toEqual({});
  });

  it('keeps a non-admin\'s "*" in their own realm', async () => {
    const member = { ...eurthUser, role: { name: "member", level: 100 } };
    await expect(realmWhere({ db, user: member }, ALL_REALMS)).resolves.toEqual({
      realmId: "r_eurth",
    });
    await expect(realmWhere({ db, user: null }, ALL_REALMS)).resolves.toEqual({
      realmId: DEFAULT_REALM_ID,
    });
  });
});

describe("E-q: the cache key names a realm only when it isn't IxWorld", () => {
  beforeEach(() => clearTrpcMemoryCache());

  const probe = jest.fn(async () => "rows");
  const router = createTRPCRouter({
    probe: cachedPublicProcedure.input(realmScopeInput.optional()).query(() => probe()),
  });
  const as = (realmId?: string) =>
    createCallerFactory(router)(publicCtx(countryTable([]), realmId));

  it("anonymous and IxWorld-nation viewers share an entry; an Eurth viewer gets its own", async () => {
    probe.mockClear();
    await as().probe();
    await as(DEFAULT_REALM_ID).probe();
    expect(probe).toHaveBeenCalledTimes(1);

    await as("r_eurth").probe();
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("never caches an all-realms read", async () => {
    probe.mockClear();
    await as().probe({ realm: ALL_REALMS });
    await as().probe({ realm: ALL_REALMS });
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
