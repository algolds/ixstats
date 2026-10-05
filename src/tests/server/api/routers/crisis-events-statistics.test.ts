import { crisisEventsRouter } from "~/server/api/routers/crisis-events";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(crisisEventsRouter);

const event = (overrides: Record<string, unknown>) => ({
  id: "e",
  type: "natural",
  category: "governance",
  severity: "low",
  responseStatus: "pending",
  casualties: 0,
  economicImpact: 0,
  affectedCountries: null,
  ...overrides,
});

function caller(rows: ReturnType<typeof event>[]) {
  const db = createMockPrisma();
  db.crisisEvent.findMany.mockResolvedValue(rows);
  return {
    db,
    api: createCaller(createMockRouterContext({ auth: null, user: null, db }) as never),
  };
}

describe("crisisEvents.getStatistics country scope", () => {
  it("counts every crisis when no country is given", async () => {
    const { api } = caller([
      event({ id: "a", affectedCountries: '["c1"]' }),
      event({ id: "b", affectedCountries: '["c2"]' }),
    ]);
    const stats = await api.getStatistics({ timeframe: "month" });
    expect(stats.activeEvents).toBe(2);
  });

  it("counts only crises that list the country, in JSON or legacy comma form", async () => {
    const { api, db } = caller([
      event({ id: "json", affectedCountries: '["c1","c9"]', severity: "critical" }),
      event({ id: "legacy", affectedCountries: "c9, c1" }),
      event({ id: "other", affectedCountries: '["c2"]' }),
      // a substring match must not count: "c1" is not "c10"
      event({ id: "prefix", affectedCountries: '["c10"]' }),
      event({ id: "none", affectedCountries: null }),
    ]);
    const stats = await api.getStatistics({ timeframe: "month", countryId: "c1" });
    expect(stats.activeEvents).toBe(2);
    expect(stats.criticalEvents).toBe(1);
    expect(stats.totalEvents).toBe(2);
    // The database narrows first with a contains prefilter on the stored string.
    expect(db.crisisEvent.findMany.mock.calls[0][0].where).toMatchObject({
      affectedCountries: { contains: "c1" },
    });
  });
});
