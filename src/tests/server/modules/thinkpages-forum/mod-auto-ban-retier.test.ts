/** @jest-environment node */
/**
 * Owner rulings on automatic bans (follow-ups M2, M3, M4). M2: lifting or overturning a manual site ban that covered
 * an automatic tier re-tiers at once, as the system. M3: automatic sitewide bans are site admins' alone, whoever's
 * warnings brought them. M4: each new warning while 5+ points stay active issues a fresh tier ban.
 */
import { DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import { issueWarning, liftBan, listBans, reviewAppeal } from "~/server/modules/thinkpages-forum";
import { appeal, ban, days, NOW, warning } from "~/tests/helpers/forum-appeal-fixtures";
import {
  admin,
  admin2,
  categories,
  eurthMod,
  realms,
  users,
} from "~/tests/helpers/forum-mod-fixtures";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";

/** 10 active points: two site warnings of 5 (u_a's). */
const tenPoints = [
  warning("w1", { categoryId: null, issuedBy: "u_a", points: 5 }),
  warning("w2", { categoryId: null, issuedBy: "u_a", points: 5 }),
];
/** A 60-day manual site ban that covered the 30-day tier, so no automatic ban was issued under it (M-2). */
const covering = ban("b_manual", {
  scope: "site",
  scopeId: null,
  issuedBy: "u_a",
  expiresAt: days(58),
  createdAt: days(-2),
});

const storeWith = (seed: { bans?: Row[]; warnings?: Row[]; appeals?: Row[] }) =>
  forumStore({ categories, realms, users, warnings: [], bans: [], ...seed });
type Store = ReturnType<typeof storeWith>;
const autoBansIn = (store: Store) => store.state.bans.filter((b) => b.auto === true);

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("re-tier when a covering manual site ban ends early (M2)", () => {
  it("issues the tier's automatic ban as the system when the manual ban is lifted, logged as a re-tier", async () => {
    const store = storeWith({ bans: [covering], warnings: tenPoints });
    const lifted = await liftBan(store.db as never, admin2, { banId: "b_manual" });
    const [auto] = autoBansIn(store);
    expect(auto).toMatchObject({
      userId: "u_m",
      scope: "site",
      scopeId: null,
      auto: true,
      autoTier: 10,
      issuedBy: "system",
      expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
      reason: "Automatic: 10 active warning points",
    });
    expect(lifted.autoBan).toEqual({
      kind: "issued",
      banId: auto!.id,
      autoTier: 10,
      days: 30,
      expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
      reason: "Automatic: 10 active warning points",
    });
    expect(store.logs.map((l) => [l.action, l.actorId])).toEqual([
      ["ban.lift", "u_a2"],
      ["ban.retier", "system"],
    ]);
    expect(store.logs[1]).toMatchObject({ targetType: "user", targetId: "u_m", scope: "site" });
    expect(detailOf(store.logs[1])).toEqual({
      banId: auto!.id,
      days: 30,
      points: 10,
      autoTier: 10,
      trigger: "ban lifted",
      liftedBanId: "b_manual",
    });
    expect(store.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("raises a lower automatic ban to the covered tier, from now, as the system", async () => {
    const lower = ban("b_auto", {
      scope: "site",
      scopeId: null,
      issuedBy: "u_eurth",
      auto: true,
      autoTier: 5,
      createdAt: days(-3),
      expiresAt: days(4),
    });
    const store = storeWith({ bans: [covering, lower], warnings: tenPoints });
    const lifted = await liftBan(store.db as never, admin2, { banId: "b_manual" });
    expect(lifted.autoBan).toMatchObject({ kind: "extended", banId: "b_auto", autoTier: 10 });
    expect(store.state.bans.find((b) => b.id === "b_auto")).toMatchObject({
      autoTier: 10,
      expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
      issuedBy: "u_eurth",
    });
    expect(store.logs.map((l) => [l.action, l.actorId])).toEqual([
      ["ban.lift", "u_a2"],
      ["ban.retier", "system"],
    ]);
    expect(autoBansIn(store)).toHaveLength(1);
  });

  it("re-tiers when an appeal overturns the manual ban, and reports it for the member's notice", async () => {
    const store = storeWith({
      bans: [covering],
      warnings: tenPoints,
      appeals: [appeal("a1", "ban", "b_manual")],
    });
    const review = await reviewAppeal(store.db as never, admin2, {
      appealId: "a1",
      outcome: "overturned",
      response: "Too harsh.",
    });
    expect(review.autoBan).toMatchObject({ kind: "issued", autoTier: 10, days: 30 });
    expect(store.logs.map((l) => [l.action, l.actorId])).toEqual([
      ["appeal.review", "u_a2"],
      ["ban.lift", "u_a2"],
      ["ban.retier", "system"],
    ]);
    expect(detailOf(store.logs[2])).toMatchObject({
      trigger: "ban lifted",
      liftedBanId: "b_manual",
    });
  });

  it("leaves things alone under the lowest tier, under another covering manual ban, or for other bans", async () => {
    const fewPoints = [warning("w1", { categoryId: null, points: 4 })];
    const permanent = ban("b_perm", { scope: "site", scopeId: null, expiresAt: null });
    const realmBan = ban("b_realm");
    const cases: Array<{ bans: Row[]; warnings: Row[]; banId: string }> = [
      { bans: [covering], warnings: fewPoints, banId: "b_manual" },
      { bans: [covering, permanent], warnings: tenPoints, banId: "b_manual" },
      { bans: [realmBan], warnings: tenPoints, banId: "b_realm" },
    ];
    for (const seed of cases) {
      const store = storeWith(seed);
      const lifted = await liftBan(store.db as never, admin2, { banId: seed.banId });
      expect(lifted.autoBan).toBeNull();
      expect(autoBansIn(store)).toHaveLength(0);
      expect(store.logs.map((l) => l.action)).toEqual(["ban.lift"]);
    }
  });

  it("never re-tiers on lifting an automatic ban itself", async () => {
    const auto = ban("b_auto", {
      scope: "site",
      scopeId: null,
      auto: true,
      autoTier: 10,
      expiresAt: days(20),
    });
    const store = storeWith({ bans: [auto], warnings: tenPoints });
    const lifted = await liftBan(store.db as never, admin2, { banId: "b_auto" });
    expect(lifted.autoBan).toBeNull();
    expect(store.state.bans).toHaveLength(1);
    expect(store.logs.map((l) => l.action)).toEqual(["ban.lift"]);
  });
});

describe("automatic sitewide bans are site admins' alone (M3, kept)", () => {
  const triggered = ban("b_auto", {
    scope: "site",
    scopeId: null,
    issuedBy: "u_eurth",
    auto: true,
    autoTier: 5,
  });

  it("the realm moderator whose warnings brought it can neither see, lift nor review it", async () => {
    const store = storeWith({ bans: [triggered], appeals: [appeal("a1", "ban", "b_auto")] });
    const listed = await listBans(store.db as never, eurthMod, { active: true }, 1);
    expect(listed.rows.map((r) => r.id)).toEqual([]);
    await expect(liftBan(store.db as never, eurthMod, { banId: "b_auto" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      reviewAppeal(store.db as never, eurthMod, {
        appealId: "a1",
        outcome: "overturned",
        response: "Mine.",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.state.bans[0]).toMatchObject({ liftedAt: null });
  });

  it("a site admin sees and lifts it", async () => {
    const store = storeWith({ bans: [triggered] });
    const listed = await listBans(store.db as never, admin, { active: true }, 1);
    expect(listed.rows.map((r) => r.id)).toEqual(["b_auto"]);
    await liftBan(store.db as never, admin2, { banId: "b_auto" });
    expect(store.state.bans[0]).toMatchObject({ liftedBy: "u_a2" });
  });
});

describe("a fresh tier ban on each warning while 5+ points stay active (M4, kept)", () => {
  const sevenPoints = [warning("w1", { categoryId: null, points: 5 })];
  const warn = (store: Store) =>
    issueWarning(store.db as never, admin, { userId: "u_m", points: 2, reason: "Again" });

  it("after the automatic ban expired", async () => {
    const expired = ban("b_old", {
      scope: "site",
      scopeId: null,
      auto: true,
      autoTier: 5,
      createdAt: days(-8),
      expiresAt: days(-1),
    });
    const store = storeWith({ bans: [expired], warnings: sevenPoints });
    const outcome = await warn(store);
    expect(outcome.autoBan).toMatchObject({ kind: "issued", autoTier: 5, days: 7 });
    expect(autoBansIn(store)).toHaveLength(2);
  });

  it("after an admin lifted it (an overturn)", async () => {
    const lifted = ban("b_old", {
      scope: "site",
      scopeId: null,
      auto: true,
      autoTier: 5,
      expiresAt: days(5),
      liftedAt: days(-1),
      liftedBy: "u_a2",
    });
    const store = storeWith({ bans: [lifted], warnings: sevenPoints });
    const outcome = await warn(store);
    expect(outcome.autoBan).toMatchObject({ kind: "issued", autoTier: 5 });
  });
});
