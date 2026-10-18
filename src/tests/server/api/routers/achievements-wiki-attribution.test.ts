/** @jest-environment node */
/**
 * `achievements.getAllWithStatus` and wiki attribution (`showWikiAttribution`): another player's Lorewards medals
 * and wiki awards (whose titles name their articles) are left out while they turn it off, as the Passport hides
 * them (identity.link-privacy.ts). Their medals read as for a player with no wiki account and no award row is
 * listed. A switch that cannot be read counts as off. The viewer always sees their own.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { achievementsProgressRouter } from "~/server/api/routers/achievements/progress";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { privacyConfigRow, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

const ME = "u_me";
const OTHER = "u_other";
const PAGE = "Secret Page Title";

const master = (key: string) => ({
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
  isActive: true,
});

/** A catalogue in sync, and a wiki author `clerkUserId` with a daily Lore win and a featured-article award. */
function setup(clerkUserId: string) {
  const db = createMockPrisma();
  const active = ALL_DEFINITIONS.filter((d) => !d.retired).map((d) => master(d.id));
  db.achievement.findMany.mockImplementation(
    async ({ where }: { where: { isActive?: boolean } }) => (where.isActive ? active : [])
  );
  db.user.count.mockResolvedValue(10);
  db.user.findFirst.mockResolvedValue({ clerkUserId });
  db.user.findUnique.mockResolvedValue({ clerkUserId, wikiUsername: "Lore Hero" });
  db.user.findMany.mockResolvedValue([{ wikiUsername: "Lore Hero" }]);
  db.userAchievement.groupBy.mockResolvedValue([]);
  db.lorewardUserStats.findUnique.mockResolvedValue({ updatedAt: new Date(0) });
  db.lorewardUserStats.findMany.mockResolvedValue([
    { username: "Lore Hero", dailyWins: 3, weeklyWins: 0, monthlyWins: 0, totalScore: 30 },
  ]);
  db.wikiArticleAward.findMany.mockResolvedValue([
    {
      id: "award_1",
      name: "Featured Article",
      pageTitle: PAGE,
      pageSlug: "Secret_Page_Title",
      description: null,
      category: "FEATURED",
      recipientUsers: ["Lore Hero"],
      awardedAt: new Date(0),
    },
  ]);
  return db;
}

type Db = ReturnType<typeof setup>;

const rows = (db: Db, input: { countryId?: string } = { countryId: "c_other" }) =>
  createCallerFactory(achievementsProgressRouter)(
    createMockRouterContext({
      db,
      auth: { userId: ME },
      user: { id: "db_me", clerkUserId: ME },
    }) as never
  ).getAllWithStatus(input);

const loreOf = (list: Awaited<ReturnType<typeof rows>>) => ({
  bronze: list.find((r) => r.key === "ool-bronze")?.isUnlocked,
  awards: list.filter((r) => r.key.startsWith("wiki-award-")).length,
  namesPage: JSON.stringify(list).includes(PAGE),
});

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("getAllWithStatus: Lorewards medals and wiki awards", () => {
  it("leaves out another player's while they turn wiki attribution off", async () => {
    const db = setup(OTHER);
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(OTHER));
    expect(loreOf(await rows(db))).toEqual({ bronze: false, awards: 0, namesPage: false });
    expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
  });

  it("shows another player's while the switch is on", async () => {
    const db = setup(OTHER);
    db.userConnection.findMany.mockResolvedValue([
      privacyConfigRow(OTHER, { showWikiAttribution: true }),
    ]);
    expect(loreOf(await rows(db))).toEqual({ bronze: true, awards: 1, namesPage: true });
  });

  it("fails closed: a switch it cannot read leaves them out", async () => {
    const db = setup(OTHER);
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    expect(loreOf(await rows(db))).toEqual({ bronze: false, awards: 0, namesPage: false });
  });

  it("always shows the viewer their own, without reading the switch", async () => {
    const db = setup(ME);
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(ME));
    expect(loreOf(await rows(db, {}))).toEqual({ bronze: true, awards: 1, namesPage: true });
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });
});
