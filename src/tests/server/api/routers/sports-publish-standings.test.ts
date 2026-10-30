/** @jest-environment node */
/**
 * `sports.publishStandingsToWiki`: only the league's manager (its creator, or a system owner) may publish its
 * standings to the wiki; the write itself is `publishLeagueStandings`.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
const mockPublish = jest.fn();
jest.mock("~/server/orchestration/league-wiki-export", () => ({
  __esModule: true,
  publishLeagueStandings: (...args: unknown[]) => mockPublish(...args),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { leaguesCrudRouter } from "~/server/api/routers/sports/leagues/crud";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addLeague, addPerson, asPerson, type Person } from "~/tests/helpers/sports-world";

const leagues = createCallerFactory(leaguesCrudRouter);

let db: MemoryPrisma;
let creator: Person;
let stranger: Person;

beforeEach(async () => {
  db = createMemoryPrisma();
  mockDb = db;
  creator = await addPerson(db as never, "creator");
  stranger = await addPerson(db as never, "stranger");
  await addLeague(db as never, {
    id: "lg1",
    managerId: creator.id,
    sportPreset: "hockey",
    clubs: [],
  });
  mockPublish.mockReset().mockResolvedValue({ success: true, revisionRef: "rev-8" });
});

describe("publishStandingsToWiki", () => {
  it("publishes for the league's creator and returns the outcome", async () => {
    const ctx = asPerson(db as never, creator);

    await expect(leagues(ctx).publishStandingsToWiki({ leagueId: "lg1" })).resolves.toEqual({
      success: true,
      revisionRef: "rev-8",
    });
    const [publishCtx, leagueId] = mockPublish.mock.calls[0] as [typeof ctx, string];
    expect(publishCtx.user?.id).toBe(creator.id);
    expect(leagueId).toBe("lg1");
  });

  it("passes an edit conflict through", async () => {
    mockPublish.mockResolvedValue({ success: false, conflict: true });

    await expect(
      leagues(asPerson(db as never, creator)).publishStandingsToWiki({ leagueId: "lg1" })
    ).resolves.toEqual({ success: false, conflict: true });
  });

  it("refuses anyone who does not manage the league, and publishes nothing", async () => {
    await expect(
      leagues(asPerson(db as never, stranger)).publishStandingsToWiki({ leagueId: "lg1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a league that does not exist", async () => {
    await expect(
      leagues(asPerson(db as never, creator)).publishStandingsToWiki({ leagueId: "nope" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
