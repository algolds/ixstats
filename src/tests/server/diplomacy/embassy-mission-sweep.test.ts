import {
  closeDueEmbassyMissions,
  missionTimeProgress,
} from "~/lib/diplomacy/embassy-mission-sweep";

const mockDb = {
  embassyMission: { updateMany: jest.fn() },
  foreignPolicyAction: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  allianceMember: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  diplomaticRelation: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
};
jest.mock("~/server/db", () => ({ db: mockDb }));

const DAY = 24 * 60 * 60 * 1000;

/** In-memory missions with just enough of Prisma's `where` for the sweep. */
function missionDb(rows: any[]) {
  const matches = (m: any, where: any) =>
    m.status === where.status &&
    (where.culturalExchange ? m.exchangeStatus === where.culturalExchange.is.status : true) &&
    (where.culturalExchangeId ? m.culturalExchangeId != null : true) &&
    (where.completesAt ? m.completesAt.getTime() <= where.completesAt.lte.getTime() : true);
  return {
    embassyMission: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = rows.filter((m) => matches(m, where));
        hit.forEach((m) => Object.assign(m, data));
        return { count: hit.length };
      }),
    },
  };
}

describe("closeDueEmbassyMissions", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  const mission = (over: any) => ({
    status: "active",
    progress: 0,
    culturalExchangeId: "ex1",
    exchangeStatus: "active",
    completesAt: new Date(now.getTime() + DAY),
    ...over,
  });

  it("completes due missions, cancels those of cancelled exchanges, leaves the rest", async () => {
    const rows = [
      mission({ id: "due", completesAt: new Date(now.getTime() - DAY) }),
      mission({ id: "running" }),
      mission({ id: "cancelled", exchangeStatus: "cancelled" }),
      mission({ id: "done", status: "completed", completesAt: new Date(now.getTime() - DAY) }),
    ];
    const res = await closeDueEmbassyMissions(missionDb(rows), now);
    expect(res).toEqual({ missionsCompleted: 1, missionsCancelled: 1 });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.due).toMatchObject({ status: "completed", progress: 100 });
    expect(byId.running).toMatchObject({ status: "active", progress: 0 });
    expect(byId.cancelled).toMatchObject({ status: "cancelled" });
  });

  it("runs from the diplomatic-drift cron and reports its counts", async () => {
    mockDb.embassyMission.updateMany
      .mockResolvedValueOnce({ count: 2 }) // cancelled
      .mockResolvedValueOnce({ count: 3 }); // completed
    const { runDiplomaticDrift } = await import("~/lib/diplomacy/drift-cron");
    const res = await runDiplomaticDrift();
    expect(res).toMatchObject({ missionsCompleted: 3, missionsCancelled: 2 });
  });
});

describe("missionTimeProgress", () => {
  const startedAt = new Date("2026-10-01T00:00:00Z");
  const completesAt = new Date("2026-10-11T00:00:00Z");

  it("is the elapsed share of the run, clamped to 0..100", () => {
    expect(missionTimeProgress({ startedAt, completesAt }, new Date("2026-10-06T00:00:00Z"))).toBe(
      50
    );
    expect(missionTimeProgress({ startedAt, completesAt }, new Date("2026-09-01T00:00:00Z"))).toBe(
      0
    );
    expect(missionTimeProgress({ startedAt, completesAt }, new Date("2026-12-01T00:00:00Z"))).toBe(
      100
    );
  });
});
