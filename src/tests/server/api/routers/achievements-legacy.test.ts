/** @jest-environment node */
/**
 * `achievements.getAllWithStatus` and Legacy: a player's unlocks of retired achievements stay in
 * the list (flagged), nobody else sees them, and the catalogue syncs only when it is behind.
 */
import { createCallerFactory } from "~/server/api/trpc";
import { achievementsProgressRouter } from "~/server/api/routers/achievements/progress";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { RETIRED_IDS } from "~/lib/achievements/sync";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(achievementsProgressRouter);

const master = (key: string, isActive: boolean) => ({
  key,
  title: key,
  description: "",
  category: "General",
  rarity: "Common",
  points: 10,
  iconUrl: "Trophy",
  triggerType: "GENERAL",
  conditionJson: "{}",
  rewardsJson: null,
  isActive,
});

const ACTIVE_KEYS = ALL_DEFINITIONS.filter((d) => !d.retired).map((d) => d.id);
const RETIRED_KEY = "econ-first-million";

function setup(opts: { activeKeys?: string[]; staleRetiredActive?: boolean; unlocks?: string[] }) {
  const db = createMockPrisma();
  const active = (opts.activeKeys ?? ACTIVE_KEYS).map((key) => master(key, true));
  if (opts.staleRetiredActive) active.push(master(RETIRED_KEY, true));
  const legacy = [master(RETIRED_KEY, false)];
  db.achievement.findMany.mockImplementation(
    async ({ where }: { where: { isActive?: boolean; key?: { in?: string[] } } }) => {
      if (where.key?.in && where.isActive === false) {
        return legacy.filter((m) => where.key!.in!.includes(m.key));
      }
      return where.isActive ? active : [];
    }
  );
  db.achievement.upsert.mockResolvedValue({});
  db.user.count.mockResolvedValue(10);
  db.userAchievement.findMany.mockResolvedValue(
    (opts.unlocks ?? []).map((achievementId) => ({
      achievementId,
      unlockedAt: new Date("2026-09-01T00:00:00Z"),
      metadata: null,
    }))
  );
  db.userAchievement.groupBy.mockResolvedValue([]);
  return db;
}

const callerFor = (db: ReturnType<typeof setup>) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: "u_me" },
      user: { id: "db_me", clerkUserId: "u_me" },
    }) as never
  );

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("getAllWithStatus", () => {
  it("returns the player's unlocked retired achievements as Legacy, after the active ones", async () => {
    const db = setup({ unlocks: [RETIRED_KEY, "gen-welcome"] });

    const rows = await callerFor(db).getAllWithStatus({});

    const legacy = rows.find((r) => r.key === RETIRED_KEY);
    expect(legacy).toMatchObject({ isLegacy: true, isUnlocked: true });
    expect(rows.find((r) => r.key === "gen-welcome")).toMatchObject({
      isLegacy: false,
      isUnlocked: true,
    });
    expect(rows.filter((r) => "isLegacy" in r && r.isLegacy)).toHaveLength(1);
  });

  it("leaves retired achievements out for a player who never earned them", async () => {
    const db = setup({ unlocks: ["gen-welcome"] });

    const rows = await callerFor(db).getAllWithStatus({});

    expect(rows.some((r) => r.key === RETIRED_KEY)).toBe(false);
  });

  it("does not sync when the active rows are all there, however many definitions are retired", async () => {
    const db = setup({ unlocks: [] });

    await callerFor(db).getAllWithStatus({});

    expect(RETIRED_IDS.size).toBeGreaterThan(0);
    expect(db.achievement.upsert).not.toHaveBeenCalled();
  });

  it("syncs once when the catalogue is behind, or still has an active retired row", async () => {
    const behind = setup({ activeKeys: ACTIVE_KEYS.slice(1) });
    await callerFor(behind).getAllWithStatus({});
    expect(behind.achievement.upsert).toHaveBeenCalled();

    const stale = setup({ staleRetiredActive: true });
    await callerFor(stale).getAllWithStatus({});
    expect(stale.achievement.upsert).toHaveBeenCalled();
  });
});
