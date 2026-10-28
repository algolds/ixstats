/**
 * Every country-scoped mutation (Plan 332), run by seven callers: a signed-out visitor, a member writing another
 * country's row, the owner, the owner of a nation that is not their active one, an admin on a foreign country, and an
 * admin playing as the member, on a foreign country and on the member's own. Each row is one mutation: its router, its
 * call for an own, second or foreign target, and the write it guards. A new country mutation is one row.
 *
 * Folds country-idor-government, -meetings, -policies, -quickactions, -transport and -misc, and
 * multi-nation-write-access: the row matrix, plus each file's own details below it. Also folds country-authorization
 * (the check decides on the fresh user row), cultural-artifact-upload-auth, diplomatic-scenarios-record-choice-auth and
 * audit-country-idor (the detector that lists the mutations needing a row).
 */
// Bandwidth capacity reads the projected population; the projection itself is not under test here.
jest.mock("~/server/shared/projected-population", () => ({
  __esModule: true,
  loadProjectedPopulation: jest.fn(async () => 10_000_000),
}));
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: { earnCredits: jest.fn().mockResolvedValue({ success: true }) },
}));
jest.mock("~/lib/diplomacy/choice-tracker", () => ({
  DiplomaticChoiceTracker: { recordChoice: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    $transaction: jest.fn().mockRejectedValue(new Error("write path reached")),
    wikiDiscussionThread: { findUnique: jest.fn().mockResolvedValue(null) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    wikiNameClaim: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    wikiUserGroup: { findMany: jest.fn().mockResolvedValue([]) },
    wikiBlock: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { count: jest.fn().mockResolvedValue(0) },
    wikiArticle: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
  isDatabaseReadOnly: false,
}));

import { db as moduleDb } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { governmentRouter } from "~/server/api/routers/government";
import { meetingsRouter } from "~/server/api/routers/meetings";
import { policiesRouter } from "~/server/api/routers/policies";
import { quickActionsRouter } from "~/server/api/routers/quickactions";
import { transportRouteMutationsRouter } from "~/server/api/routers/transport/routeMutations";
import { legislationRouter } from "~/server/api/routers/legislation";
import { diplomaticCulturalExchangesCoreMutationsRouter } from "~/server/api/routers/diplomacy/cultural/exchanges/core/mutations";
import { wikiosDiscussionsRouter } from "~/server/api/routers/wikios/discussions";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { onomaNameBankRouter } from "~/server/api/routers/onoma/namebank";
import { electionsPartiesRouter } from "~/server/api/routers/elections/parties";
import { diplomaticCulturalLifecycleParticipationRouter } from "~/server/api/routers/diplomacy/cultural/lifecycle/participation";
import { diplomaticScenariosChoicesRouter } from "~/server/api/routers/diplomaticScenarios/choices";
import {
  assertCountryResourceWriteAccess,
  assertCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { Project } from "ts-morph";
import {
  analyzeSource,
  applyAllowlist,
  isFailing,
} from "../../../../scripts/audit/audit-country-idor";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

const OWN = "country_own";
const SECOND = "country_second";
const FOREIGN = "country_foreign";
const MEMBER = { id: "db_member", clerkUserId: "user_member" };
const ADMIN = { id: "db_admin", clerkUserId: "user_admin" };

type Target = "own" | "second" | "foreign";
const COUNTRY: Record<Target, string> = { own: OWN, second: SECOND, foreign: FOREIGN };
const OWNER: Record<string, string> = {
  [OWN]: MEMBER.id,
  [SECOND]: MEMBER.id,
  [FOREIGN]: "db_someone_else",
};
/** `meeting_own`, `route_foreign`...: the country a resource id belongs to, or null for an unknown one. */
const countryOf = (id: string) => COUNTRY[id.split("_").pop() as Target] ?? null;

const memberUser = { ...MEMBER, countryId: OWN, role: { name: "member", level: 100 } };
const adminUser = { ...ADMIN, countryId: "country_admin", role: { name: "admin", level: 10 } };

type Db = Record<string, unknown>;
type Who = "signedOut" | "member" | "admin" | "playAs";

/** The caller's context over `db`, with the user and country lookups the ownership checks read. */
function context(who: Who, db: Db): MockCallerContext {
  if (who === "signedOut") return createMockCallerContext({ auth: null, user: null, db });
  const user = who === "admin" ? adminUser : memberUser;
  return createMockCallerContext({
    auth: { userId: user.clerkUserId },
    user,
    impersonatorId: who === "playAs" ? ADMIN.clerkUserId : undefined,
    db: {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { clerkUserId?: string } }) =>
          where.clerkUserId === ADMIN.clerkUserId ? adminUser : memberUser
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      country: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          OWNER[where.id]
            ? { id: where.id, name: "Testland", ownerUserId: OWNER[where.id], cities: [] }
            : null
        ),
      },
      ...db,
    },
  });
}

const writeReached = () => Promise.reject(new Error("write path reached"));
const byId = ({ where }: { where: { id: string } }) => {
  const countryId = countryOf(where.id);
  return Promise.resolve(countryId ? { id: where.id, countryId } : null);
};
const echoCreate = async ({ data }: { data: object }) => ({ id: "row_new", ...data });
const moduleTransaction = jest.mocked(moduleDb.$transaction);

/** A department row, when `departmentId` belongs to the country the query names. */
const ownDepartmentRow = async ({
  where,
}: {
  where: { id: string; governmentStructure: { countryId: string } };
}) =>
  countryOf(where.id) === where.governmentStructure.countryId
    ? { id: where.id, governmentStructureId: "gs_1", governmentStructure: { totalBudget: 1000 } }
    : null;
const governmentDb = (departments = 0) => ({
  country: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      OWNER[where.id]
        ? {
            id: where.id,
            name: "Testland",
            ownerUserId: OWNER[where.id],
            cities: [],
            createdAt: new Date(0),
            totalGovernmentSpending: 1000,
            currentTotalGdp: 5000,
            governmentComponents: [],
            // A staffed government has its budget (departments that never had one get one instead)
            governmentStructure: departments > 0 ? { id: "gs_1", totalBudget: 1000 } : null,
          }
        : null
    ),
  },
  governmentStructure: { findUnique: jest.fn().mockResolvedValue({ id: "gs_1" }) },
  governmentDepartment: {
    findMany: jest
      .fn()
      .mockResolvedValue(
        Array.from({ length: departments }, (_, i) => ({ id: `dept_${i}`, category: "Finance" }))
      ),
    findFirst: jest.fn(ownDepartmentRow),
    create: jest.fn(writeReached),
    delete: jest.fn(writeReached),
  },
  budgetAllocation: {
    findFirst: jest.fn().mockResolvedValue({ budgetYear: 2040 }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(departments),
    upsert: jest.fn(writeReached),
  },
  $transaction: jest.fn(writeReached),
});

const meetingsDb = () => ({
  cabinetMeeting: {
    create: jest.fn(async ({ data }: { data: object }) => ({
      id: "meeting_new",
      title: "Summit",
      scheduledDate: new Date(),
      ...data,
    })),
    findUnique: jest.fn(byId),
  },
  meetingAgendaItem: { create: jest.fn(echoCreate) },
  meetingAttendance: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(echoCreate) },
  governmentStructure: { findUnique: jest.fn(byId) },
  governmentDepartment: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const countryId = countryOf(where.id);
      return countryId ? { governmentStructure: { countryId } } : null;
    }),
  },
  governmentOfficial: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const countryId = countryOf(where.id);
      return countryId ? { governmentStructure: { countryId }, department: null } : null;
    }),
    create: jest.fn(echoCreate),
    update: jest.fn(echoCreate),
  },
});
const appointment = {
  name: "A. Minister",
  title: "Minister",
  role: "Cabinet Member",
  appointedDate: new Date("2026-10-01T00:00:00Z"),
};

const policiesDb = () => ({
  policy: {
    create: jest.fn(async ({ data }: { data: object }) => ({ id: "policy_new", ...data })),
    aggregate: jest.fn().mockResolvedValue({ _sum: { execBandwidthCost: 0 } }),
  },
  governmentStructure: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ governmentEffectiveness: 60, departments: [{ category: "finance" }] }),
  },
  governmentComponent: { findMany: jest.fn().mockResolvedValue([]) },
  nationalIssue: { count: jest.fn().mockResolvedValue(0) },
  intent: { aggregate: jest.fn().mockResolvedValue({ _sum: { execBandwidthCost: 0 } }) },
  budgetAllocation: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  // A policy is enacted on creation: its growth effect is synced (none for a custom policy).
  storytellerEffect: { findMany: jest.fn().mockResolvedValue([]) },
});
const policyInput = {
  userId: "someone_else",
  name: "Fiscal Discipline Act",
  description: "Balance the books",
  policyType: "economic" as const,
  category: "fiscal",
};

const quickActionsDb = () => ({
  cabinetMeeting: {
    create: jest.fn(async ({ data }: { data: object }) => ({ id: "meeting_new", ...data })),
  },
  meetingAttendance: { createMany: jest.fn() },
  meetingAgendaItem: { createMany: jest.fn() },
  activitySchedule: { create: jest.fn() },
});
const quickMeeting = { title: "Budget review", scheduledDate: new Date("2026-10-01T00:00:00Z") };

const transportDb = () => ({
  transportRoute: {
    findFirst: jest.fn(async ({ where }: { where: { id: string; countryId: string } }) =>
      countryOf(where.id) === where.countryId ? { countryId: where.countryId } : null
    ),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(writeReached),
    update: jest.fn(writeReached),
    delete: jest.fn(writeReached),
    deleteMany: jest.fn(writeReached),
  },
  countryGeoProfile: { findUnique: jest.fn().mockResolvedValue(null) },
});
const geometry = { type: "LineString", coordinates: [] };

const legislationDb = () => ({
  policy: {
    create: jest.fn().mockResolvedValue({ id: "bill_new" }),
    update: jest.fn(),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      countryId: countryOf(where.id),
      policyType: "legislative_bill",
      status: "in_committee",
      reviewNotes: JSON.stringify({ ideologyTarget: 0 }),
    })),
  },
  legislature: { findUnique: jest.fn().mockResolvedValue(null) },
});
const bill = { name: "Act", description: "An act", ideology: "center" as const };

// A running public exchange hosted by a third nation, with room left
const exchangeDb = () => ({
  culturalExchange: {
    findUnique: jest.fn().mockResolvedValue({
      title: "Festival",
      type: "festival",
      status: "active",
      isPublic: true,
      maxParticipants: null,
      hostCountryId: "country_host",
      hostCountryName: "Hostland",
      participatingCountries: [],
    }),
    update: jest.fn().mockResolvedValue({}),
  },
  culturalExchangeParticipant: { create: jest.fn().mockResolvedValue({ id: "p_1" }) },
});
const thread = { articleTitle: "Page", title: "Thread", content: "Hello" };
const nameEntry = {
  type: "saved-name" as const,
  title: "Name",
  values: ["A"],
  stashId: "standalone",
};

// A party that never stood in an election is deleted outright
const partiesDb = () => ({
  politicalParty: {
    findUnique: jest.fn(byId),
    delete: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
  },
  electionCandidate: { count: jest.fn().mockResolvedValue(0) },
});

interface Row {
  name: string;
  run: (ctx: MockCallerContext, target: Target) => Promise<unknown>;
  db: () => Db;
  /** The write this mutation guards. */
  write: (db: Db) => jest.Mock;
  /** How the call ends once it is past the check: a message it rejects with, or null when it resolves. */
  reach: string | null;
  /** False when a later business rule (not the ownership check) stops the call before the write. */
  reachesWrite?: false;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- one table over routers of different shapes */
const caller = (router: any, ctx: MockCallerContext): any => createCallerFactory(router)(ctx);
const ROWS: Row[] = [
  {
    name: "government.createStructure",
    run: (ctx, t) => caller(governmentRouter, ctx).createStructure({ countryId: COUNTRY[t] }),
    db: () => governmentDb(),
    write: (db) => db.$transaction as jest.Mock,
    reach: "write path reached",
  },
  {
    name: "government.setAllocation",
    run: (ctx, t) =>
      caller(governmentRouter, ctx).setAllocation({
        countryId: COUNTRY[t],
        departmentId: `dept_${t}`,
        allocatedPercent: 12,
      }),
    db: () => governmentDb(),
    write: (db) => (db.budgetAllocation as { upsert: jest.Mock }).upsert,
    reach: "write path reached",
  },
  {
    name: "government.addDepartment",
    run: (ctx, t) =>
      caller(governmentRouter, ctx).addDepartment({
        countryId: COUNTRY[t],
        name: "Ministry of Fisheries",
        category: "Agriculture",
      }),
    db: () => governmentDb(),
    write: (db) => (db.governmentDepartment as { create: jest.Mock }).create,
    reach: "write path reached",
  },
  {
    name: "government.removeDepartment",
    run: (ctx, t) =>
      caller(governmentRouter, ctx).removeDepartment({
        countryId: COUNTRY[t],
        departmentId: `dept_${t}`,
      }),
    db: () => governmentDb(),
    write: (db) => (db.governmentDepartment as { delete: jest.Mock }).delete,
    reach: "write path reached",
  },
  {
    name: "meetings.createMeeting",
    run: (ctx, t) =>
      caller(meetingsRouter, ctx).createMeeting({
        title: "Summit",
        scheduledDate: new Date(),
        userId: "someone_else",
        countryId: COUNTRY[t],
      }),
    db: meetingsDb,
    write: (db) => (db as ReturnType<typeof meetingsDb>).cabinetMeeting.create,
    reach: null,
  },
  {
    name: "meetings.addAgendaItem",
    run: (ctx, t) =>
      caller(meetingsRouter, ctx).addAgendaItem({
        meetingId: `meeting_${t}`,
        title: "Tariffs",
        order: 0,
      }),
    db: meetingsDb,
    write: (db) => (db as ReturnType<typeof meetingsDb>).meetingAgendaItem.create,
    reach: null,
  },
  {
    name: "meetings.recordAttendance",
    run: (ctx, t) =>
      caller(meetingsRouter, ctx).recordAttendance({
        meetingId: `meeting_${t}`,
        attendeeName: "Minister",
        attendanceStatus: "invited",
      }),
    db: meetingsDb,
    write: (db) => (db as ReturnType<typeof meetingsDb>).meetingAttendance.create,
    reach: null,
  },
  ...(["governmentStructureId", "departmentId"] as const).map((key) => ({
    name: `meetings.appointOfficial (${key})`,
    run: (ctx: MockCallerContext, t: Target) =>
      caller(meetingsRouter, ctx).appointOfficial({
        ...appointment,
        [key]: `${key === "departmentId" ? "department" : "structure"}_${t}`,
      }),
    db: meetingsDb,
    write: (db: Db) => (db as ReturnType<typeof meetingsDb>).governmentOfficial.create,
    reach: null,
  })),
  {
    name: "meetings.removeOfficial",
    run: (ctx, t) => caller(meetingsRouter, ctx).removeOfficial({ id: `official_${t}` }),
    db: meetingsDb,
    write: (db) => (db as ReturnType<typeof meetingsDb>).governmentOfficial.update,
    reach: null,
  },
  {
    name: "policies.createPolicy",
    run: (ctx, t) =>
      caller(policiesRouter, ctx).createPolicy({ ...policyInput, countryId: COUNTRY[t] }),
    db: policiesDb,
    write: (db) => (db as ReturnType<typeof policiesDb>).policy.create,
    reach: null,
  },
  {
    name: "quickActions.createMeeting",
    run: (ctx, t) =>
      caller(quickActionsRouter, ctx).createMeeting({
        countryId: COUNTRY[t],
        userId: "someone_else",
        meeting: quickMeeting,
      }),
    db: quickActionsDb,
    write: (db) => (db as ReturnType<typeof quickActionsDb>).cabinetMeeting.create,
    reach: null,
  },
  {
    name: "transport.generateRoutes",
    run: (ctx, t) =>
      caller(transportRouteMutationsRouter, ctx).generateRoutes({ countryId: COUNTRY[t] }),
    db: transportDb,
    write: (db) => (db as ReturnType<typeof transportDb>).transportRoute.deleteMany,
    reach: "Need at least 2 cities",
    reachesWrite: false,
  },
  {
    name: "transport.createRoute",
    run: (ctx, t) =>
      caller(transportRouteMutationsRouter, ctx).createRoute({
        countryId: COUNTRY[t],
        routeType: "rail",
        geometry,
      }),
    db: transportDb,
    write: (db) => (db as ReturnType<typeof transportDb>).transportRoute.create,
    reach: "write path reached",
  },
  ...(
    [
      ["deleteRoute", "delete", {}],
      ["updateRoute", "update", { name: "X" }],
      ["updateRouteGeometry", "update", { geometry }],
    ] as const
  ).map(([procedure, write, extra]) => ({
    name: `transport.${procedure}`,
    run: (ctx: MockCallerContext, t: Target) =>
      caller(transportRouteMutationsRouter, ctx)[procedure]({
        id: `route_${t}`,
        countryId: COUNTRY[t],
        ...extra,
      }),
    db: transportDb,
    write: (db: Db) => (db as ReturnType<typeof transportDb>).transportRoute[write],
    reach: "write path reached",
  })),
  {
    name: "legislation.proposeBill",
    run: (ctx, t) => caller(legislationRouter, ctx).proposeBill({ countryId: COUNTRY[t], ...bill }),
    db: legislationDb,
    write: (db) => (db as ReturnType<typeof legislationDb>).policy.create,
    reach: null,
  },
  {
    name: "legislation.holdVote",
    run: (ctx, t) => caller(legislationRouter, ctx).holdVote({ billId: `bill_${t}` }),
    db: legislationDb,
    write: (db) => (db as ReturnType<typeof legislationDb>).legislature.findUnique,
    reach: "No seated legislature",
  },
  {
    name: "diplomaticCultural.joinCulturalExchange",
    run: (ctx, t) =>
      caller(diplomaticCulturalExchangesCoreMutationsRouter, ctx).joinCulturalExchange({
        exchangeId: "ex_1",
        countryId: COUNTRY[t],
        countryName: "X",
      }),
    db: exchangeDb,
    write: (db) => (db as ReturnType<typeof exchangeDb>).culturalExchangeParticipant.create,
    reach: null,
  },
  {
    name: "wikios.createThread",
    run: (ctx, t) =>
      caller(wikiosDiscussionsRouter, ctx).createThread({ ...thread, countryId: COUNTRY[t] }),
    db: () => ({}),
    write: () => moduleTransaction,
    reach: "write path reached",
  },
  {
    name: "onoma.saveToNameBank",
    run: (ctx, t) =>
      caller(onomaNameBankRouter, ctx).saveToNameBank({ ...nameEntry, countryId: COUNTRY[t] }),
    db: () => ({ nameBank: { create: jest.fn(writeReached) } }),
    write: (db) => (db as { nameBank: { create: jest.Mock } }).nameBank.create,
    reach: "write path reached",
  },
  {
    name: "elections.deleteParty",
    run: (ctx, t) => caller(electionsPartiesRouter, ctx).deleteParty({ id: `party_${t}` }),
    db: partiesDb,
    write: (db) => (db as ReturnType<typeof partiesDb>).politicalParty.delete,
    reach: null,
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const CALLERS: Array<{
  who: string;
  as: Who;
  target: Target;
  outcome: "UNAUTHORIZED" | "FORBIDDEN" | "reach";
}> = [
  { who: "a signed-out visitor", as: "signedOut", target: "own", outcome: "UNAUTHORIZED" },
  {
    who: "a member writing another country's row",
    as: "member",
    target: "foreign",
    outcome: "FORBIDDEN",
  },
  { who: "the owner", as: "member", target: "own", outcome: "reach" },
  {
    who: "the owner of a nation that is not their active one",
    as: "member",
    target: "second",
    outcome: "reach",
  },
  { who: "an admin on a foreign country", as: "admin", target: "foreign", outcome: "reach" },
  {
    who: "an admin playing as the member, on a foreign country",
    as: "playAs",
    target: "foreign",
    outcome: "FORBIDDEN",
  },
  {
    who: "an admin playing as the member, on the member's own country",
    as: "playAs",
    target: "own",
    outcome: "reach",
  },
];

/** The code a refusal carries: a TRPCError's own, or the AppError a middleware threw. */
const codeOf = (error: unknown) => {
  const { code, cause } = error as { code?: string; cause?: { trpcCode?: string } };
  return cause?.trpcCode ?? code;
};
/** Every jest.fn under `value` that was called. */
const calledMocks = (value: unknown): jest.Mock[] =>
  jest.isMockFunction(value)
    ? value.mock.calls.length > 0
      ? [value]
      : []
    : value && typeof value === "object"
      ? Object.values(value).flatMap(calledMocks)
      : [];

beforeAll(() => {
  for (const level of ["info", "log", "warn", "error"] as const)
    jest.spyOn(console, level).mockImplementation(() => {});
});
beforeEach(() => jest.clearAllMocks());

describe.each(ROWS)("$name", (row) => {
  it.each(CALLERS)("$who: $outcome", async ({ as, target, outcome }) => {
    const db = row.db();
    const ctx = context(as, db);
    const result = row.run(ctx, target);
    if (outcome === "reach") {
      if (row.reach === null) await expect(result).resolves.toBeDefined();
      else await expect(result).rejects.toThrow(row.reach);
      if (row.reachesWrite !== false) expect(row.write(db)).toHaveBeenCalledTimes(1);
      return;
    }
    const error = await result.then(
      () => null,
      (e: unknown) => e
    );
    expect(codeOf(error)).toBe(outcome);
    expect(row.write(db)).not.toHaveBeenCalled();
    // A signed-out visitor is refused before anything is read
    if (outcome === "UNAUTHORIZED")
      expect([...calledMocks(ctx.db), ...calledMocks(moduleDb)]).toEqual([]);
  });
});

describe("and the details each country mutation adds", () => {
  const member = (db: Db) => context("member", db);
  const admin = (db: Db) => context("admin", db);

  it("government: a refused write reads no departments, a structure is created once, and another country's department is NOT_FOUND", async () => {
    const government = (db: Db) => createCallerFactory(governmentRouter)(member(db));
    const db = governmentDb();
    await expect(government(db).createStructure({ countryId: FOREIGN })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.governmentDepartment.findMany).not.toHaveBeenCalled();

    const staffed = governmentDb(9);
    await expect(government(staffed).createStructure({ countryId: OWN })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(staffed.$transaction).not.toHaveBeenCalled();

    const own = governmentDb();
    await expect(
      government(own).setAllocation({
        countryId: OWN,
        departmentId: "dept_foreign",
        allocatedPercent: 10,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      government(own).removeDepartment({ countryId: OWN, departmentId: "dept_foreign" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(own.budgetAllocation.upsert).not.toHaveBeenCalled();
    expect(own.governmentDepartment.delete).not.toHaveBeenCalled();
  });

  it("meetings, policies and quick actions record the caller as organiser or author, whatever userId was sent", async () => {
    const meetings = meetingsDb();
    await createCallerFactory(meetingsRouter)(member(meetings)).createMeeting({
      title: "Summit",
      scheduledDate: new Date(),
      userId: "someone_else",
      countryId: OWN,
    });
    expect(meetings.cabinetMeeting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ countryId: OWN, userId: MEMBER.clerkUserId }),
    });

    const policies = policiesDb();
    await createCallerFactory(policiesRouter)(member(policies)).createPolicy({
      ...policyInput,
      countryId: OWN,
    });
    expect(policies.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ countryId: OWN, userId: MEMBER.clerkUserId }),
    });

    const quick = quickActionsDb();
    await createCallerFactory(quickActionsRouter)(member(quick)).createMeeting({
      countryId: OWN,
      userId: "someone_else",
      meeting: quickMeeting,
    });
    const organiser = expect.objectContaining({ userId: MEMBER.clerkUserId });
    expect(quick.cabinetMeeting.create).toHaveBeenCalledWith({ data: organiser });
    expect(quick.activitySchedule.create).toHaveBeenCalledWith({ data: organiser });
  });

  it("meetings: an unknown meeting or official is NOT_FOUND, and an official needs an own structure and department", async () => {
    const db = meetingsDb();
    const meetings = createCallerFactory(meetingsRouter)(member(db));
    await expect(
      meetings.addAgendaItem({ meetingId: "meeting_missing", title: "Tariffs", order: 0 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      meetings.recordAttendance({
        meetingId: "meeting_missing",
        attendeeName: "M",
        attendanceStatus: "invited",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(meetings.removeOfficial({ id: "official_missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      meetings.appointOfficial({
        ...appointment,
        governmentStructureId: "structure_own",
        departmentId: "department_foreign",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(meetings.appointOfficial(appointment)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.meetingAgendaItem.create).not.toHaveBeenCalled();
    expect(db.meetingAttendance.create).not.toHaveBeenCalled();
    expect(db.governmentOfficial.create).not.toHaveBeenCalled();
    expect(db.governmentOfficial.update).not.toHaveBeenCalled();

    await createCallerFactory(meetingsRouter)(member(db)).appointOfficial({
      ...appointment,
      governmentStructureId: "structure_own",
      departmentId: "department_own",
    });
    expect(db.governmentOfficial.create).toHaveBeenCalledTimes(1);
  });

  it("transport: another country's route sent with the caller's own countryId is NOT_FOUND", async () => {
    const routesOf = (db: Db) => createCallerFactory(transportRouteMutationsRouter)(member(db));
    type Routes = ReturnType<typeof routesOf>;
    const route = { id: "route_foreign", countryId: OWN };
    for (const [send, write] of [
      [(routes: Routes) => routes.deleteRoute(route), "delete"],
      [(routes: Routes) => routes.updateRoute({ ...route, name: "X" }), "update"],
      [(routes: Routes) => routes.updateRouteGeometry({ ...route, geometry }), "update"],
    ] as const) {
      const db = transportDb();
      await expect(send(routesOf(db))).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(db.transportRoute[write]).not.toHaveBeenCalled();
    }
  });

  it("legislation: a vote on another country's bill updates nothing", async () => {
    const db = legislationDb();
    await expect(
      createCallerFactory(legislationRouter)(member(db)).holdVote({ billId: "bill_foreign" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.policy.update).not.toHaveBeenCalled();
  });

  it("wikios discussions: a thread with no country is allowed, and a comment as another country is refused", async () => {
    const discussions = createCallerFactory(wikiosDiscussionsRouter)(member({}));
    await expect(discussions.createThread(thread)).rejects.toThrow("write path reached");
    expect(moduleTransaction).toHaveBeenCalledTimes(1);
    await expect(
      discussions.postComment({ threadId: "t_1", content: "Hi", countryId: FOREIGN })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(moduleTransaction).toHaveBeenCalledTimes(1);
  });

  it("security.resolvePvNPCConflict strikes only NPC nations: never a player's, nor the caller's own even when nobody owns it", async () => {
    for (const [target, holder] of [
      [FOREIGN, { id: "db_someone_else" }],
      [OWN, null],
    ] as const) {
      const db = {
        user: {
          findUnique: jest.fn().mockResolvedValue(memberUser),
          findFirst: jest.fn().mockResolvedValue(holder),
        },
        militaryBranch: { findMany: jest.fn() },
        storytellerEffect: { createMany: jest.fn() },
      };
      const ctx = member(db);
      ctx.user = { ...ctx.user!, membershipTier: "mycountry_premium" };
      const strike = createCallerFactory(securityConflictsRouter)(ctx).resolvePvNPCConflict({
        targetCountryId: target,
      });
      await expect(strike).rejects.toMatchObject({ code: "FORBIDDEN" });
      if (target === FOREIGN) {
        await expect(strike).rejects.toThrow("NPC");
        expect(db.user.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: { ownedCountries: { some: { id: FOREIGN } } } })
        );
      }
      expect(db.militaryBranch.findMany).not.toHaveBeenCalled();
      expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
    }
  });

  it("onoma.saveToNameBank never updates another player's entry or writes into their stash", async () => {
    const base = { type: "saved-name" as const, title: "Name", values: ["A"] };
    const entries = {
      nameBank: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn(writeReached) },
    };
    await expect(
      createCallerFactory(onomaNameBankRouter)(member(entries)).saveToNameBank({
        ...base,
        stashId: "standalone",
        id: "someone_elses_entry",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(entries.nameBank.update).not.toHaveBeenCalled();

    const stashes = {
      stash: { findFirst: jest.fn().mockResolvedValue(null) },
      stashItem: { upsert: jest.fn(writeReached), findUnique: jest.fn(writeReached) },
    };
    await expect(
      createCallerFactory(onomaNameBankRouter)(member(stashes)).saveToNameBank({
        ...base,
        stashId: "someone_elses_stash",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Ownership accepts the caller's internal User id and (legacy) Clerk id, nobody else's
    expect(stashes.stash.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "someone_elses_stash",
          userId: { in: expect.arrayContaining([MEMBER.clerkUserId]) },
        },
      })
    );
    expect(stashes.stashItem.upsert).not.toHaveBeenCalled();
  });

  it("an admin adds agenda items and appoints officials on a foreign country", async () => {
    const db = meetingsDb();
    const meetings = createCallerFactory(meetingsRouter)(admin(db));
    await meetings.addAgendaItem({ meetingId: "meeting_foreign", title: "Tariffs", order: 0 });
    await meetings.appointOfficial({ ...appointment, governmentStructureId: "structure_foreign" });
    expect(db.meetingAgendaItem.create).toHaveBeenCalledTimes(1);
    expect(db.governmentOfficial.create).toHaveBeenCalledTimes(1);
  });
});

type AuthContext = Parameters<typeof assertCountryWriteAccess>[0];
type FreshUser = { id?: string; countryId: string | null; role: { name: string } };

/** A caller whose session says `cached` while the database now says `fresh`; `country` is the one row that exists. */
function staleSession(
  cached: { id?: string; countryId: string | null; role: string },
  fresh: FreshUser | null,
  country: { id: string; ownerUserId: string | null } = {
    id: "country_alpha",
    ownerUserId: "db_owner",
  }
): AuthContext {
  return {
    auth: { userId: "user_x" },
    user: { clerkUserId: "user_x", ...cached },
    db: {
      user: { findUnique: jest.fn().mockResolvedValue(fresh) },
      country: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === country.id ? country : null
        ),
      },
    },
  };
}

describe("the country-write check decides on the fresh user row", () => {
  const member = { role: { name: "member" } };

  it.each([
    [
      "a member whose session still names their old nation",
      { countryId: "old_country", role: "member" },
      { ...member, countryId: "country_alpha" },
      "country_alpha",
      null,
    ],
    [
      "a member promoted to admin since the session was cached",
      { countryId: "other_country", role: "member" },
      { countryId: "other_country", role: { name: "admin" } },
      "country_alpha",
      null,
    ],
    [
      "a Clerk id that now maps to a different platform user than the session's owner",
      { id: "db_owner", countryId: null, role: "member" },
      { ...member, id: "db_other", countryId: null },
      "country_alpha",
      "FORBIDDEN",
    ],
    [
      "a player writing a country that does not exist",
      { countryId: "home", role: "member" },
      { ...member, countryId: "home" },
      "country_missing",
      "NOT_FOUND",
    ],
  ] as const)("%s", async (_who, cached, fresh, target, refusal) => {
    const result = assertCountryWriteAccess(staleSession(cached, fresh), target);
    if (refusal) await expect(result).rejects.toMatchObject({ code: refusal });
    else await expect(result).resolves.toBeUndefined();
  });

  it("refuses a player an unowned (NPC) nation", async () => {
    const ctx = staleSession(
      { countryId: "mine", role: "member" },
      { ...member, countryId: "mine" },
      { id: "npc", ownerUserId: null }
    );
    await expect(assertCountryWriteAccess(ctx, "npc")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["a member", "member", { code: "NOT_FOUND", message: "Meeting not found" }],
    ["an admin", "admin", null],
    ["a member promoted to staff since the session was cached", "staff", null],
  ] as const)("a row with no known owning country: %s", async (_who, freshRole, refusal) => {
    const ctx = staleSession(
      { countryId: "other_country", role: "member" },
      { countryId: "other_country", role: { name: freshRole } }
    );
    const result = assertCountryResourceWriteAccess(ctx, null, "Meeting");
    if (refusal) await expect(result).rejects.toMatchObject(refusal);
    else await expect(result).resolves.toBeUndefined();
  });
});

describe("cultural exchange artifacts and diplomatic choices", () => {
  const upload = {
    exchangeId: "ex_1",
    type: "photo" as const,
    title: "Harvest",
    fileUrl: "https://example.com/a.png",
    contributor: "Caller",
  };
  const uploadDb = (
    exchange: { hostCountryId: string } | null,
    participant: { id: string } | null
  ) => ({
    culturalExchange: {
      findUnique: jest
        .fn()
        .mockResolvedValue(exchange && { ...exchange, hostCountryName: "Host", type: "festival" }),
    },
    culturalExchangeParticipant: { findFirst: jest.fn().mockResolvedValue(participant) },
    culturalArtifact: { create: jest.fn().mockResolvedValue({ id: "artifact_1" }) },
  });

  it.each([
    ["the exchange's host, without a participant row", { hostCountryId: OWN }, null, null],
    ["a participant country", { hostCountryId: FOREIGN }, { id: "participant_1" }, null],
    [
      "a country that is neither host nor participant",
      { hostCountryId: FOREIGN },
      null,
      "FORBIDDEN",
    ],
    ["anyone, on a missing exchange", null, null, "NOT_FOUND"],
  ] as const)("an artifact upload by %s", async (_who, exchange, participant, refusal) => {
    const db = uploadDb(exchange, participant);
    const upload$ = createCallerFactory(diplomaticCulturalLifecycleParticipationRouter)(
      context("member", db)
    ).uploadCulturalArtifact(upload);
    if (refusal) {
      await expect(upload$).rejects.toMatchObject({ code: refusal });
      expect(db.culturalArtifact.create).not.toHaveBeenCalled();
    } else {
      await expect(upload$).resolves.toEqual({ id: "artifact_1" });
      expect(db.culturalArtifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ exchangeId: "ex_1", countryId: OWN }),
      });
    }
  });

  // recordChoice validates cuids, so these ids are cuid-shaped: the caller owns A.
  const [A, B, C] = [
    "ckcountrya0000000000001",
    "ckcountryb0000000000002",
    "ckcountryc0000000000003",
  ];
  const SCENARIO = "ckscenario00000000000004";
  const scenario = (country1Id: string, country2Id: string) => ({
    id: SCENARIO,
    type: "cultural_exchange",
    title: "Test Scenario",
    narrative: "Narrative",
    country1Id,
    country2Id,
    status: "active",
    expiresAt: new Date(Date.now() + 86_400_000),
    responseOptions: JSON.stringify([
      { id: "choice_1", label: "Choice 1", effects: { culturalImpact: 10 } },
    ]),
    tags: JSON.stringify([]),
    culturalImpact: 10,
    diplomaticRisk: 5,
  });
  const choose = (signedIn: boolean, between: readonly [string, string], countryId: string) => {
    const owner = { id: "db_user_a", clerkUserId: "user_owns_a", countryId: A };
    // Every other delegate the choice touches (its rewards, its news) answers with nothing.
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ ...owner, role: { name: "user" } });
    db.country.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: "Country",
      flag: null,
    }));
    db.culturalScenario.findUnique.mockResolvedValue(scenario(...between));
    db.culturalScenario.updateMany.mockResolvedValue({ count: 1 });
    db.culturalScenario.findUniqueOrThrow.mockResolvedValue({
      ...scenario(...between),
      status: "completed",
    });
    const ctx = createMockCallerContext({
      auth: signedIn ? { userId: owner.clerkUserId } : null,
      user: signedIn ? { ...owner, role: { name: "user", level: 100 } } : null,
      db,
    });
    const result = createCallerFactory(diplomaticScenariosChoicesRouter)(ctx).recordChoice({
      scenarioId: SCENARIO,
      countryId,
      choiceId: "choice_1",
      choiceLabel: "Choice 1",
    });
    return { db, result };
  };

  it.each([
    ["a signed-out visitor", false, [A, B], A, "UNAUTHORIZED"],
    ["a member, for a country they do not own", true, [A, C], C, "FORBIDDEN"],
    ["the owner, on a scenario that does not involve their country", true, [B, C], A, "FORBIDDEN"],
    ["the owner of an involved country, for it", true, [A, B], A, null],
  ] as const)(
    "a diplomatic choice recorded by %s",
    async (_who, signedIn, between, countryId, refusal) => {
      const { db, result } = choose(signedIn, between, countryId);
      if (refusal) {
        const error = await result.then(
          () => null,
          (e: unknown) => e
        );
        expect(codeOf(error)).toBe(refusal);
        expect(db.culturalScenario.updateMany).not.toHaveBeenCalled();
      } else {
        await expect(result).resolves.toMatchObject({ success: true });
        expect(db.culturalScenario.updateMany).toHaveBeenCalledTimes(1);
      }
    }
  );
});

describe("audit:idor, which lists the mutations that need a row", () => {
  const FILE = "src/server/api/routers/fixture.ts";
  const SOURCE = `
export const fixtureRouter = createTRPCRouter({
  guarded: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return ctx.db.policy.create({ data: input });
    }),
  unguarded: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.policy.create({ data: input })),
  inline: countryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.country.id !== input.countryId) throw new TRPCError({ code: "FORBIDDEN" });
    }),
  rowById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.cabinetMeeting.delete({ where: { id: input.id } })),
  unrelatedRow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.forumPost.delete({ where: { id: input.id } })),
  adminOnly: adminProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.country.delete({ where: { id: input.countryId } })),
  readOnly: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.policy.findMany({ where: input })),
});
`;
  const analyze = () => analyzeSource(new Project({ useInMemoryFileSystem: true }), FILE, SOURCE);

  it("classifies country-scoped mutations and skips admin, queries and unrelated rows", () => {
    expect(Object.fromEntries(analyze().map((f) => [f.procedure, f.status]))).toEqual({
      guarded: "OK",
      unguarded: "MISSING",
      inline: "MANUAL",
      rowById: "MISSING",
    });
  });

  it("allowlists only the named procedures and fails while anything is unresolved", () => {
    const findings = applyAllowlist(analyze(), {
      [`${FILE}#inline`]: "compares ctx.country.id to input.countryId",
      [`${FILE}#unguarded`]: "reviewed",
      [`${FILE}#rowById`]: "reviewed",
    });
    expect(findings.find((f) => f.procedure === "inline")?.status).toBe("ALLOWED");
    expect(isFailing(findings)).toBe(false);
    expect(isFailing(analyze())).toBe(true);
  });
});
