/** @jest-environment node */
/**
 * A player joins Eurth by a member's invite, claims a nation page and takes part, through the real `realms`, `polls`
 * and `thinkpagesForum` procedures on the in-memory database (the wiki's page-creator lookup and the side-effect
 * hooks are faked). Rex has already filed a claim on Aurelia; Pia, Aurelia's verified page creator, arrives through
 * Max's link (`via=max`); before her claim she may not vote in Eurth's poll; her claim is approved at once, with
 * Eurth's growth table and Max as her inviter, and Rex's claim is turned down and he is told why; Pia votes and posts
 * in the Hub and on the board, Rex, holding no nation, only on the board as a visitor; her second claim stops at the
 * free cap; once Eurth is archived, claims are closed and its forum is read-only.
 *
 * Folds realm-notices (the rejected claimant's notice: text, link, `/realms` without a slug), polls-realm-vote (a
 * vote before and after the claim), and the plain paths of realms-claims (the verified creator's page claim creating
 * the realm's country with its growth table, rivals turned away and told, the archive refusal), realm-invites (the
 * inviter recorded and carried by the assignment), nation-cap (a claim at the cap) and realms-router. On Postgres:
 * two approvals of one page racing, and the verified creator's double submit.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: {
    create: jest.fn(async () => "n1"),
    createMany: jest.fn(async () => undefined),
  },
}));
jest.mock("~/lib/notifications/guard", () => ({ isNotificationEventEnabled: async () => true }));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: { onUserAccountChange: jest.fn(async () => undefined) },
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: { User: { onCountryLink: jest.fn(async () => undefined) } },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn(async () => undefined),
}));
jest.mock("~/server/shared/map-invalidation", () => ({
  invalidateRealmMap: jest.fn(async () => 1),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/account-proof", () => ({
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/account-proof"),
  fetchPageCreator: jest.fn(async (_source: string, title: string) =>
    title === "Aurelia" ? "Pia" : "Someone"
  ),
}));
jest.mock("~/server/modules/realms/realms.prefill", () => ({
  fetchNationPagePrefill: jest.fn(async () => null),
}));
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: () => ({ broadcastBoard: jest.fn(), broadcastMessage: jest.fn() }),
}));

import { queueAchievementCheck } from "~/lib/achievements/queue";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { pollsRouter } from "~/server/api/routers/polls";
import { realmsRouter } from "~/server/api/routers/realms";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createClaimsService } from "~/server/modules/realms";
import { notifyClaimRejected } from "~/server/modules/realms/realms.notices";
import {
  addMember,
  addNation,
  addRealm,
  addSiteBoards,
  as,
  forumDb,
  settle,
  type Member,
} from "~/tests/helpers/forum-world";
import type { MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { describeWithDb, prefix, scenarioDb } from "~/tests/helpers/scenario-db";

const realms = createCallerFactory(realmsRouter);
const polls = createCallerFactory(pollsRouter);
const forum = createCallerFactory(thinkpagesForumRouter);
const told = jest.mocked(notificationAPI.create);
const CONSENT = { accepted: true as const };
const GROWTH = { populationGrowthRate: 0.011, adjustedGdpGrowth: 0.0022 };
const TIERS = [
  "Impoverished",
  "Developing",
  "Developed",
  "Healthy",
  "Strong",
  "Very Strong",
  "Extravagant",
];

let db: MemoryPrisma;
let max: Member, pia: Member, rex: Member;

beforeEach(async () => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.clearAllMocks();
  db = forumDb();
  mockDb = db;
  await addSiteBoards(db as never);
  [max, pia, rex] = await Promise.all(
    ["max", "pia", "rex"].map((id) => addMember(db as never, id))
  );
  await addRealm(db as never, { id: "eurth", name: "Eurth", ownerClerkId: "fay-clerk" });
  await db.realm.update({
    where: { id: "eurth" },
    data: { settings: { nationDefaults: Object.fromEntries(TIERS.map((t) => [t, GROWTH])) } },
  });
  await addNation(db as never, "borealis", "eurth", max.id, "Borealis");
  for (const title of ["Aurelia", "Caldera"]) {
    await db.realmPage.create({
      data: { realmId: "eurth", wikiSource: "iiwiki", title, kind: "nation" },
    });
  }
  // Pia proved her iiwiki account, so the page she created is hers to claim at once
  await db.wikiAccountLink.create({
    data: { userId: pia.id, source: "iiwiki", username: "Pia", verifiedAt: new Date() },
  });
  await db.poll.create({
    data: {
      id: "poll",
      question: "Capital of the league?",
      realmId: "eurth",
      options: {
        create: [
          { id: "opt-a", label: "Borealis" },
          { id: "opt-b", label: "Aurelia" },
        ],
      },
    },
  });
});

afterEach(() => jest.restoreAllMocks());

it("an invited player claims a nation page, votes and posts; the rival is told; the cap and the archive hold", async () => {
  const asPia = realms(as(db as never, pia));

  // Rex files first; he is no page creator, so his claim waits for review
  expect(
    await realms(as(db as never, rex)).claimNationPage({
      realmSlug: "eurth",
      title: "Aurelia",
      consent: CONSENT,
    })
  ).toMatchObject({ status: "pending" });

  // Before her claim Pia holds no nation in Eurth: her vote is refused and nothing is stored
  const vote = () => polls(as(db as never, pia)).vote({ pollId: "poll", optionIds: ["opt-b"] });
  await expect(vote()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await db.pollVote.count()).toBe(0);

  // Pia claims Aurelia by Max's invite: approved at once, the country made with Eurth's growth, Max her inviter
  expect(
    await asPia.claimNationPage({
      realmSlug: "eurth",
      title: "Aurelia",
      via: "max",
      consent: CONSENT,
    })
  ).toMatchObject({ status: "approved", autoApproved: true });
  await settle();
  const aurelia = await db.country.findFirst({ where: { realmId: "eurth", name: "Aurelia" } });
  expect(aurelia).toMatchObject({ ownerUserId: pia.id, ...GROWTH });
  expect(await db.user.findUnique({ where: { id: pia.id } })).toMatchObject({
    countryId: aurelia.id,
  });
  const claims = await db.realmClaim.findMany({
    where: { wikiPageTitle: "Aurelia" },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      status: true,
      rejectionReason: true,
      invitedByUserId: true,
      countryId: true,
    },
  });
  expect(claims).toEqual([
    {
      userId: rex.id,
      status: "rejected",
      rejectionReason: "Another claim for this nation was approved",
      invitedByUserId: null,
      countryId: null,
    },
    {
      userId: pia.id,
      status: "approved",
      rejectionReason: null,
      invitedByUserId: max.id,
      countryId: aurelia.id,
    },
  ]);
  // The assignment's side effects name the inviter, whose recruiter achievements count it
  expect(jest.mocked(queueAchievementCheck)).toHaveBeenCalledWith(max.id);
  // Rex is told once, with the nation, the reason and the realm's nations
  expect(
    told.mock.calls.filter(([n]) => (n as { userId: string }).userId === rex.clerkUserId)
  ).toEqual([
    [
      expect.objectContaining({
        userId: rex.clerkUserId,
        title: "Claim rejected",
        message: "Your claim for Aurelia was rejected: Another claim for this nation was approved",
        category: "system",
        href: "/r/eurth/nations",
        source: "realms",
      }),
    ],
  ]);

  // Pia votes now, as herself; she posts in the Hub and on the board; Rex may not post in the Hub
  await vote();
  expect(
    await db.pollVote.findMany({ select: { pollId: true, optionId: true, userId: true } })
  ).toEqual([{ pollId: "poll", optionId: "opt-b", userId: pia.clerkUserId }]);
  const hubThread = {
    categoryKey: "hub",
    realm: "eurth",
    title: "Hello from Aurelia",
    html: "<p>Glad to be here</p>",
  };
  const started = await forum(as(db as never, pia)).createThread(hubThread);
  await forum(as(db as never, pia)).postBoardMessage({
    realm: "eurth",
    html: "<p>Evening, Eurth</p>",
  });
  const asRex = forum(as(db as never, rex));
  await expect(asRex.createThread({ ...hubThread, title: "Me too" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    asRex.reply({ threadId: started.threadId, html: "<p>Hi</p>" })
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  // The board takes visitors: Rex posts there as one, with no realm of his own to show
  expect(
    (await asRex.postBoardMessage({ realm: "eurth", html: "<p>Hi</p>" })).message
  ).toMatchObject({
    isVisitor: true,
    visitorRealm: null,
  });

  // A free account holds one nation here: Pia's second claim stops at the cap and files nothing
  await expect(
    asPia.claimNationPage({ realmSlug: "eurth", title: "Caldera", consent: CONSENT })
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await db.realmClaim.count({ where: { wikiPageTitle: "Caldera" } })).toBe(0);

  // Eurth is archived: no more claims, and its forum is read-only for its members
  await db.realm.update({ where: { id: "eurth" }, data: { status: "archived" } });
  await expect(
    realms(as(db as never, rex)).claimNationPage({
      realmSlug: "eurth",
      title: "Caldera",
      consent: CONSENT,
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const asPiaForum = forum(as(db as never, pia));
  await expect(
    asPiaForum.reply({ threadId: started.threadId, html: "<p>Still?</p>" })
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    asPiaForum.postBoardMessage({ realm: "eurth", html: "<p>Still?</p>" })
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it("a rejection notice for a realm it cannot name links to the directory", async () => {
  await notifyClaimRejected({
    clerkUserId: "c1",
    nationName: "Aurelia",
    realmSlug: null,
    reason: "Duplicate",
  });
  expect(told).toHaveBeenCalledWith(expect.objectContaining({ href: "/realms" }));
});

describeWithDb("realm-join-claim-post (Postgres)", () => {
  const pg = scenarioDb();
  let p: string;
  let realmId: string;
  const deps = {
    fetchPageCreator: jest.fn(async () => "Pia"),
    onNationAssigned: jest.fn(async () => undefined),
    onClaimRejected: jest.fn(async () => undefined),
    fetchNationPrefill: jest.fn(async () => null),
    resolveInviter: jest.fn(async () => null),
  };
  const actor = (id: string) => ({ id, clerkUserId: `${id}-clerk`, role: null });

  beforeEach(async () => {
    mockDb = pg;
    p = prefix();
    realmId = `${p}eurth`;
    for (const id of ["fay", "pia", "rex"]) {
      await pg.user.create({ data: { id: `${p}${id}`, clerkUserId: `${p}${id}-clerk` } });
    }
    await pg.realm.create({
      data: {
        id: realmId,
        slug: realmId,
        name: `Eurth ${p}`,
        ownerId: `${p}fay-clerk`,
        status: "active",
      },
    });
    await pg.realmPage.create({
      data: { realmId, wikiSource: "iiwiki", title: "Aurelia", kind: "nation" },
    });
  });
  afterEach(async () => {
    await pg.realmClaim.deleteMany({ where: { realmId } });
    await pg.user.updateMany({ where: { id: { startsWith: p } }, data: { countryId: null } });
    await pg.country.deleteMany({ where: { realmId } });
    await pg.realm.deleteMany({ where: { id: realmId } });
    await pg.wikiAccountLink.deleteMany({ where: { userId: { startsWith: p } } });
    await pg.user.deleteMany({ where: { id: { startsWith: p } } });
  });
  afterAll(() => pg.$disconnect());

  const owners = () =>
    pg.country.findMany({ where: { realmId }, select: { name: true, ownerUserId: true } });
  const statuses = async () =>
    (await pg.realmClaim.findMany({ where: { realmId }, select: { status: true } }))
      .map((c) => c.status)
      .sort();

  it("two approvals of one nation page racing: one country, one owner, the other claim turned away", async () => {
    const svc = createClaimsService(pg, deps);
    const filed = await Promise.all(
      ["pia", "rex"].map((id) =>
        svc.claimNationPage(actor(`${p}${id}`), realmId, "Aurelia", { consent: {} })
      )
    );
    expect(filed.map((c) => c.status)).toEqual(["pending", "pending"]);
    const founder = actor(`${p}fay`);
    await Promise.allSettled(
      filed.map((c) => svc.reviewClaim(founder, c.claimId, { approve: true }))
    );
    const nations = await owners();
    expect(nations).toHaveLength(1);
    expect([`${p}pia`, `${p}rex`]).toContain(nations[0]!.ownerUserId);
    expect(await statuses()).toEqual(["approved", "rejected"]);
  });

  it("the verified creator's double submit: one country and one approved claim", async () => {
    await pg.wikiAccountLink.create({
      data: { userId: `${p}pia`, source: "iiwiki", username: "Pia", verifiedAt: new Date() },
    });
    const svc = createClaimsService(pg, deps);
    const pia = actor(`${p}pia`);
    await Promise.allSettled([
      svc.claimNationPage(pia, realmId, "Aurelia", { consent: {} }),
      svc.claimNationPage(pia, realmId, "Aurelia", { consent: {} }),
    ]);
    expect(await owners()).toEqual([{ name: "Aurelia", ownerUserId: `${p}pia` }]);
    expect((await statuses()).filter((s) => s === "approved")).toHaveLength(1);
  });
});
