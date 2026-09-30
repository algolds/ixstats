/**
 * MC-2: politics lifecycle end to end, against a small in-memory Prisma stand-in.
 *
 *   configureLegislature + createParty → first election scheduled (IxTime)
 *   → elections cron resolves it → seats carry parties → a bill passes the floor
 *   → the follow-up election also resolves.
 *
 * Before MC-2 nothing created an election or a candidate, seats never had a party and
 * `legislation.holdVote` always threw "No seated legislature".
 */

// ── In-memory database (only what the politics paths touch) ────────────────

type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
let idSeq = 0;

function resetTables() {
  for (const k of [
    "country",
    "legislature",
    "legislativeSeat",
    "politicalParty",
    "election",
    "electionCandidate",
    "electionResult",
    "storytellerEffect",
    "policy",
  ]) {
    tables[k] = [];
  }
  idSeq = 0;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("lte" in cond && !(value <= cond.lte)) return false;
      if ("in" in cond && !cond.in.includes(value)) return false;
      if ("notIn" in cond && cond.notIn.includes(value)) return false;
      if ("not" in cond && value === cond.not) return false;
      return true;
    }
    return value === cond;
  });
}

function sortRows(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) return rows;
  const [[key, dir]] = Object.entries(orderBy) as [[string, "asc" | "desc"]];
  return [...rows].sort((a, b) => (dir === "asc" ? a[key] - b[key] : b[key] - a[key]));
}

// Relations are always hydrated (a superset of any select/include the code asks for).
const hydrate: Record<string, (row: Row) => Row> = {
  legislativeSeat: (s) => ({
    ...s,
    party: tables.politicalParty!.find((p) => p.id === s.partyId) ?? null,
  }),
  legislature: (l) => ({
    ...l,
    seats: sortRows(
      tables.legislativeSeat!.filter((s) => s.legislatureId === l.id),
      { seatNumber: "asc" }
    ).map(hydrate.legislativeSeat!),
  }),
  electionCandidate: (c) => ({
    ...c,
    party: tables.politicalParty!.find((p) => p.id === c.partyId)!,
  }),
  election: (e) => ({
    ...e,
    candidates: tables
      .electionCandidate!.filter((c) => c.electionId === e.id)
      .map(hydrate.electionCandidate!),
    results: sortRows(
      tables.electionResult!.filter((r) => r.electionId === e.id),
      { seatsWon: "desc" }
    ).map((r) => ({
      ...r,
      candidate: hydrate.electionCandidate!(
        tables.electionCandidate!.find((c) => c.id === r.candidateId)!
      ),
    })),
    legislature: hydrate.legislature!(tables.legislature!.find((l) => l.id === e.legislatureId)!),
    country: tables.country!.find((c) => c.id === e.countryId),
  }),
};

// Schema defaults the code relies on.
const defaults: Record<string, Row> = {
  politicalParty: { isActive: true, baseSupport: 25, currentSupport: 25 },
  legislativeSeat: { partyId: null },
  electionCandidate: { charisma: 50, politicalCapital: 50 },
};

function delegate(name: string) {
  const out = (row: Row | undefined) => (row ? (hydrate[name]?.(row) ?? { ...row }) : null);
  const insert = (data: Row) => {
    const row = { id: `${name}_${++idSeq}`, createdAt: new Date(), ...defaults[name], ...data };
    tables[name]!.push(row);
    return row;
  };
  return {
    findUnique: jest.fn(async ({ where }: Row) =>
      out(tables[name]!.find((r) => matches(r, where)))
    ),
    findFirst: jest.fn(async ({ where, orderBy }: Row = {}) =>
      out(
        sortRows(
          tables[name]!.filter((r) => matches(r, where)),
          orderBy
        )[0]
      )
    ),
    findMany: jest.fn(async ({ where, orderBy }: Row = {}) =>
      sortRows(
        tables[name]!.filter((r) => matches(r, where)),
        orderBy
      ).map((r) => out(r)!)
    ),
    count: jest.fn(
      async ({ where }: Row = {}) => tables[name]!.filter((r) => matches(r, where)).length
    ),
    create: jest.fn(async ({ data }: Row) => out(insert(data))),
    createMany: jest.fn(async ({ data }: Row) => {
      data.forEach((d: Row) => insert(d));
      return { count: data.length };
    }),
    update: jest.fn(async ({ where, data }: Row) => {
      const row = tables[name]!.find((r) => matches(r, where));
      if (!row) throw new Error(`${name}.update: not found`);
      Object.assign(row, data);
      return out(row);
    }),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const rows = tables[name]!.filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    }),
    deleteMany: jest.fn(async ({ where }: Row = {}) => {
      const before = tables[name]!.length;
      tables[name] = tables[name]!.filter((r) => !matches(r, where));
      return { count: before - tables[name]!.length };
    }),
  };
}

const fakeDb: Record<string, any> = {};
function buildDb() {
  resetTables();
  for (const name of Object.keys(tables)) fakeDb[name] = delegate(name);
  fakeDb.governmentStructure = {
    findUnique: jest.fn(async () => null),
    update: jest.fn(),
  };
  // The cron sweep: legislatures whose country has no upcoming/voting election.
  fakeDb.legislature.findMany = jest.fn(async () =>
    tables.legislature!.filter(
      (l) =>
        !tables.election!.some(
          (e) => e.countryId === l.countryId && ["upcoming", "voting"].includes(e.status)
        )
    )
  );
}

jest.mock("~/server/db", () => ({
  __esModule: true,
  // Getter: jest hoists this factory above `fakeDb`'s initialisation.
  get db() {
    return fakeDb;
  },
  isDatabaseReadOnly: false,
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/notifications", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/policies", () => ({ applyPolicyEffect: jest.fn().mockResolvedValue(undefined) }));

import { IxTime } from "~/lib/ixtime";
import { electionsRouter } from "~/server/api/routers/elections";
import { legislationRouter } from "~/server/api/routers/legislation";
import { processDueElections } from "~/lib/government/election-cron";
import { FIRST_ELECTION_DELAY_IX_DAYS } from "~/lib/government/election-lifecycle";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = "test_country_1";
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2040, 0, 1);

function callers() {
  const ctx = createMockRouterContext({ db: fakeDb }) as any;
  return {
    elections: electionsRouter.createCaller(ctx),
    legislation: legislationRouter.createCaller(ctx),
  };
}

async function setUpNation() {
  const { elections } = callers();
  await elections.configureLegislature({
    countryId: COUNTRY,
    name: "National Assembly",
    chamberType: "unicameral",
    totalSeats: 100,
    electoralSystem: "proportional",
    termLength: 4,
    electionCycle: "fixed",
  });
  await elections.createParty({
    countryId: COUNTRY,
    name: "Civic Union",
    ideology: "center_right",
    color: "#1d4ed8",
    leaderName: "A. Leader",
    baseSupport: 60,
  });
  await elections.createParty({
    countryId: COUNTRY,
    name: "Workers' Front",
    ideology: "left",
    color: "#dc2626",
    baseSupport: 40,
  });
}

describe("MC-2 politics lifecycle", () => {
  beforeEach(() => {
    buildDb();
    tables.country!.push({
      id: COUNTRY,
      name: "Testland",
      adjustedGdpGrowth: 0,
      currentPopulation: 1_000_000,
      overallNationalHealth: 50,
    });
    IxTime.setMultiplierOverride(0); // freeze the IxTime clock
    IxTime.setTimeOverride(START);
    jest.spyOn(Math, "random").mockReturnValue(0.5); // no random swing
  });
  afterEach(() => {
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
    jest.restoreAllMocks();
  });

  it("setup → first election → resolved → seats have parties → a bill passes", async () => {
    await setUpNation();

    // Setup scheduled exactly one first election, a short IxTime window out.
    expect(tables.election).toHaveLength(1);
    const first = tables.election![0]!;
    expect(first.status).toBe("upcoming");
    expect(first.name).toMatch(/^First General Election/);
    expect(first.scheduledIxTime).toBe(START + FIRST_ELECTION_DELAY_IX_DAYS * DAY);
    expect(tables.legislativeSeat!.every((s) => s.partyId == null)).toBe(true);

    const { elections, legislation } = callers();
    let status = await elections.getElectionStatus({ countryId: COUNTRY });
    expect(status.upcoming).toMatchObject({ isFirst: true, isDue: false });
    expect(status.seatedSeats).toBe(0);

    // Bills can't pass yet.
    const { id: billId } = await legislation.proposeBill({
      countryId: COUNTRY,
      name: "Enterprise Act",
      description: "Cuts red tape",
      ideology: "center_right",
    });
    await expect(legislation.holdVote({ billId })).rejects.toThrow("No seated legislature");

    // Not due yet: the cron leaves it alone.
    expect(await processDueElections()).toEqual({ resolved: 0, scheduled: 0, skipped: 0 });

    // The election day arrives on the IxTime clock.
    IxTime.setTimeOverride(first.scheduledIxTime + DAY);
    const run = await processDueElections();
    expect(run).toEqual({ resolved: 1, scheduled: 1, skipped: 0 });

    expect(first.status).toBe("completed");
    expect(tables.electionCandidate).toHaveLength(2);
    expect(tables.electionCandidate!.map((c) => c.candidateName).sort()).toEqual([
      "A. Leader",
      "Workers' Front list",
    ]);

    // Every seat now belongs to a party, split by D'Hondt (60/40 support, no swing).
    const seatCounts = new Map<string, number>();
    for (const s of tables.legislativeSeat!)
      seatCounts.set(s.partyId, (seatCounts.get(s.partyId) ?? 0) + 1);
    const [civic, workers] = tables.politicalParty!;
    expect(seatCounts.get(civic!.id)).toBe(60);
    expect(seatCounts.get(workers!.id)).toBe(40);

    status = await elections.getElectionStatus({ countryId: COUNTRY });
    expect(status.seatedSeats).toBe(100);
    expect(status.lastElection?.results.map((r) => r.seatsWon)).toEqual([60, 40]);
    expect(status.upcoming).toMatchObject({ isFirst: false });

    // The bill now goes to a real floor vote and passes 60–40.
    const vote = await legislation.holdVote({ billId });
    expect(vote).toMatchObject({ passed: true, yesSeats: 60, noSeats: 40 });
    expect(tables.policy!.find((p) => p.id === billId)!.status).toBe("active");
  });

  it("the follow-up election also resolves (it gets candidates too)", async () => {
    await setUpNation();
    IxTime.setTimeOverride(tables.election![0]!.scheduledIxTime + DAY);
    await processDueElections();

    const followUp = tables.election!.find((e) => e.status === "upcoming")!;
    expect(followUp.name).toMatch(/^General Election/);
    expect(followUp.scheduledIxTime).toBeGreaterThan(tables.election![0]!.scheduledIxTime);

    IxTime.setTimeOverride(followUp.scheduledIxTime + DAY);
    expect(await processDueElections()).toEqual({ resolved: 1, scheduled: 1, skipped: 0 });
    expect(followUp.status).toBe("completed");
    expect(tables.electionCandidate!.filter((c) => c.electionId === followUp.id)).toHaveLength(2);
  });

  it("a first election has no incumbent; the next one boosts the seated majority in a boom", async () => {
    tables.country![0]!.adjustedGdpGrowth = 0.05; // +5 points for an incumbent
    await setUpNation();
    IxTime.setTimeOverride(tables.election![0]!.scheduledIxTime + DAY);
    await processDueElections();
    const [civic, workers] = tables.politicalParty!;
    // Nobody governed yet, so the economy moved nobody: support 60/40 as registered.
    expect(civic!.currentSupport).toBe(60);
    expect(workers!.currentSupport).toBe(40);

    const followUp = tables.election!.find((e) => e.status === "upcoming")!;
    IxTime.setTimeOverride(followUp.scheduledIxTime + DAY);
    await processDueElections();
    // Civic Union holds the majority → +5; the opposition −2.5 (65 : 37.5 of the raw vote).
    expect(civic!.currentSupport).toBeCloseTo((65 / 102.5) * 100, 1);
  });

  it("the cron sweep schedules a first election for nations set up before MC-2", async () => {
    await setUpNation();
    tables.election = []; // as if setup happened before elections were scheduled

    expect(await processDueElections()).toEqual({ resolved: 0, scheduled: 1, skipped: 0 });
    expect(tables.election).toHaveLength(1);
    expect(tables.election![0]!.name).toMatch(/^First General Election/);
  });

  it("the owner can count a due election without waiting for the cron", async () => {
    await setUpNation();
    const { elections } = callers();

    // Not due: nothing is counted early.
    await expect(elections.resolveDueElection({ countryId: COUNTRY })).resolves.toMatchObject({
      resolved: false,
      reason: "not_due",
    });
    expect(tables.election![0]!.status).toBe("upcoming");

    IxTime.setTimeOverride(tables.election![0]!.scheduledIxTime);
    await expect(elections.resolveDueElection({ countryId: COUNTRY })).resolves.toMatchObject({
      resolved: true,
    });
    expect(tables.legislativeSeat!.every((s) => s.partyId != null)).toBe(true);
  });

  it("reconfiguring the legislature calls a snap election for the vacant chamber", async () => {
    await setUpNation();
    IxTime.setTimeOverride(tables.election![0]!.scheduledIxTime + DAY);
    await processDueElections();
    const followUp = tables.election!.find((e) => e.status === "upcoming")!;
    const now = IxTime.getCurrentIxTime();
    expect(followUp.scheduledIxTime - now).toBeGreaterThan(365 * DAY);

    await callers().elections.configureLegislature({
      countryId: COUNTRY,
      name: "National Assembly",
      chamberType: "unicameral",
      totalSeats: 120,
      electoralSystem: "proportional",
      termLength: 4,
      electionCycle: "fixed",
    });

    expect(tables.legislativeSeat!.every((s) => s.partyId == null)).toBe(true);
    expect(followUp.name).toMatch(/^Snap Election/);
    expect(followUp.scheduledIxTime).toBe(now + FIRST_ELECTION_DELAY_IX_DAYS * DAY);
  });

  it("one party is not enough: no election is scheduled", async () => {
    const { elections } = callers();
    await elections.configureLegislature({
      countryId: COUNTRY,
      name: "Assembly",
      chamberType: "unicameral",
      totalSeats: 50,
      electoralSystem: "fptp",
      termLength: 5,
      electionCycle: "fixed",
    });
    await elections.createParty({
      countryId: COUNTRY,
      name: "Only Party",
      ideology: "center",
      color: "#a855f7",
    });
    expect(tables.election).toHaveLength(0);
    const status = await elections.getElectionStatus({ countryId: COUNTRY });
    expect(status).toMatchObject({ activeParties: 1, minParties: 2, upcoming: null });
  });
});
