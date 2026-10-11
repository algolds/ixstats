/** @jest-environment node */
// The vault stack is replaced: this suite is about the rules around the ledger call, not the ledger.
jest.mock("~/lib/vault/vault-service", () => {
  class LedgerError extends Error {
    readonly code: string;
    readonly balance = 0;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { LedgerError, vaultService: { earnCreditsTx: jest.fn() } };
});
jest.mock("~/lib/vault/vault-bonus", () => ({ getBonusConfig: jest.fn() }));

import { Prisma } from "@prisma/client";
import { NON_ACTION_EVENT_TYPES, NON_ACTION_TITLES } from "~/lib/action-links";
import { ConflictError } from "~/lib/app-error";
import { startOfUtcDay } from "~/lib/action-rewards";
import { getBonusConfig } from "~/lib/vault/vault-bonus";
import { LedgerError, vaultService } from "~/lib/vault/vault-service";
import { grantActionLinkRewards } from "~/server/modules/action-links/rewards";

interface Activity {
  id: string;
  countryId: string;
  visibility: string;
  title: string;
  metadata: string | null;
}
interface LinkRow {
  postSource: string;
  postRef: string;
  activityId: string;
  countryId: string;
}
interface RewardRow {
  activityId: string;
  countryId: string;
  userId: string;
  amount: number;
  createdAt: Date;
}
interface State {
  activities: Activity[];
  links: LinkRow[];
  rewards: RewardRow[];
  /** Idempotency keys of ledger rows. */
  keys: string[];
}

/** The slice of Prisma's where language the reward transaction uses, read the way SQL reads it. */
interface Clause {
  id?: { in: string[] };
  countryId?: string;
  visibility?: string;
  title?: { notIn: string[] };
  metadata?: null | { contains: string };
  AND?: Clause[];
  OR?: Clause[];
  NOT?: Clause;
}

/** `NOT (metadata LIKE ...)` is NULL, so false, on a row with no metadata: the reason the picker's clause has an OR. */
function matches(row: Activity, clause: Clause): boolean {
  const { id, countryId, visibility, title, metadata, AND, OR, NOT } = clause;
  if (id && !id.in.includes(row.id)) return false;
  if (countryId !== undefined && row.countryId !== countryId) return false;
  if (visibility !== undefined && row.visibility !== visibility) return false;
  if (title && title.notIn.includes(row.title)) return false;
  if (metadata === null && row.metadata !== null) return false;
  if (metadata && (row.metadata === null || !row.metadata.includes(metadata.contains)))
    return false;
  if (AND && !AND.every((c) => matches(row, c))) return false;
  if (OR && !OR.some((c) => matches(row, c))) return false;
  if (NOT) {
    if (row.metadata === null) return false;
    if (matches(row, NOT)) return false;
  }
  return true;
}

const action = (id: string, extra: Partial<Activity> = {}): Activity => ({
  id,
  countryId: "c1",
  visibility: "public",
  title: "Directive issued",
  metadata: null,
  ...extra,
});
const link = (activityId: string, extra: Partial<LinkRow> = {}): LinkRow => ({
  postSource: "native",
  postRef: "p1",
  activityId,
  countryId: "c1",
  ...extra,
});
const today = () => startOfUtcDay(new Date());
const reward = (activityId: string, extra: Partial<RewardRow> = {}): RewardRow => ({
  activityId,
  countryId: "c1",
  userId: "u1",
  amount: 5,
  createdAt: today(),
  ...extra,
});

const config = (
  extra: Partial<{ enabled: number; forumActionReward: number; forumActionDailyCap: number }> = {}
) => ({
  enabled: 1,
  forumActionReward: 5,
  forumActionDailyCap: 3,
  ...extra,
});

/**
 * In-memory tables. Transactions run one at a time (what the advisory lock gives) and roll everything back on a throw.
 * `calls` records the order of the lock and the first reads.
 */
function world(initial: Partial<State> = {}) {
  const state: State = { activities: [], links: [], rewards: [], keys: [], ...initial };
  const calls: string[] = [];
  const read = <T>(rows: T[]): T[] => {
    calls.push("read");
    return rows;
  };
  const tx = {
    $executeRaw: jest.fn(async (_sql: TemplateStringsArray, ..._values: string[]) => {
      calls.push("raw");
      return 1;
    }),
    activityFeed: {
      findMany: jest.fn(async ({ where }: { where: Clause }) =>
        read(state.activities.filter((row) => matches(row, where)).map(({ id }) => ({ id })))
      ),
    },
    postActionLink: {
      findMany: jest.fn(async ({ where }: { where: LinkRow & { activityId: { in: string[] } } }) =>
        read(
          state.links.filter(
            (l) =>
              l.postSource === where.postSource &&
              l.postRef === where.postRef &&
              l.countryId === where.countryId &&
              where.activityId.in.includes(l.activityId)
          )
        )
      ),
    },
    forumActionReward: {
      findMany: jest.fn(async ({ where }: { where: { activityId: { in: string[] } } }) =>
        read(state.rewards.filter((r) => where.activityId.in.includes(r.activityId)))
      ),
      count: jest.fn(
        async ({ where }: { where: { countryId: string; createdAt: { gte: Date } } }) =>
          read(
            state.rewards.filter(
              (r) => r.countryId === where.countryId && r.createdAt >= where.createdAt.gte
            )
          ).length
      ),
      create: jest.fn(async ({ data }: { data: RewardRow }) => {
        if (state.rewards.some((r) => r.activityId === data.activityId)) {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "x",
          });
        }
        state.rewards.push(data);
        return data;
      }),
    },
    vaultTransaction: {
      findMany: jest.fn(async ({ where }: { where: { idempotencyKey: { in: string[] } } }) =>
        read(
          state.keys
            .filter((key) => where.idempotencyKey.in.includes(key))
            .map((idempotencyKey) => ({ idempotencyKey }))
        )
      ),
    },
  };
  let chain: Promise<void> = Promise.resolve();
  const transaction = jest.fn(
    (fn: (t: typeof tx) => Promise<number>, _options: { maxWait: number; timeout: number }) => {
      const run = chain.then(async () => {
        const before = {
          rewards: state.rewards.map((r) => ({ ...r })),
          keys: [...state.keys],
        };
        try {
          return await fn(tx);
        } catch (error) {
          state.rewards = before.rewards;
          state.keys = before.keys;
          throw error;
        }
      });
      chain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    }
  );
  return { db: { systemConfig: {}, $transaction: transaction }, tx, calls, state, transaction };
}
type World = ReturnType<typeof world>;

const INPUT = { userId: "u1", countryId: "c1", postSource: "native" as const, postRef: "p1" };
const grant = (w: World, ids: string[], extra: Partial<typeof INPUT> = {}) =>
  grantActionLinkRewards(w.db as never, { ...INPUT, ...extra, activityIds: ids });
/** A post that links `ids`, all of them the country's plain actions. */
const posted = (ids: string[], extra: Partial<State> = {}) =>
  world({ activities: ids.map((id) => action(id)), links: ids.map((id) => link(id)), ...extra });

const earn = jest.mocked(vaultService.earnCreditsTx);
const bonus = jest.mocked(getBonusConfig);

beforeEach(() => {
  jest.resetAllMocks();
  bonus.mockResolvedValue({ ...config() } as never);
  // Like the ledger: a credit leaves a row carrying its idempotency key.
  earn.mockImplementation(async (_tx, input) => ({ newBalance: 100, amount: input.amount }));
});

describe("grantActionLinkRewards", () => {
  it("pays the configured amount for a first link and records the payout", async () => {
    const w = posted(["a1"]);
    await expect(grant(w, ["a1"])).resolves.toBe(5);
    expect(earn).toHaveBeenCalledWith(
      w.tx,
      expect.objectContaining({
        userId: "u1",
        amount: 5,
        type: "EARN_SOCIAL",
        source: "forum_action",
        idempotencyKey: "forum_action:a1",
        metadata: { activityId: "a1", countryId: "c1", postRef: "p1" },
      })
    );
    expect(w.state.rewards).toEqual([
      { activityId: "a1", countryId: "c1", userId: "u1", amount: 5, createdAt: expect.any(Date) },
    ]);
  });

  it("applies the configured amount", async () => {
    bonus.mockResolvedValue(config({ forumActionReward: 8 }) as never);
    await expect(grant(posted(["a1"]), ["a1"])).resolves.toBe(8);
  });

  it("opens its transaction with a short wait and timeout, so a post is never held for long", async () => {
    const w = posted(["a1"]);
    await grant(w, ["a1"]);
    expect(w.transaction).toHaveBeenCalledTimes(1);
    expect(w.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 2000,
      timeout: 5000,
    });
  });

  it("takes the country's lock as its first statement, before it reads anything", async () => {
    const w = posted(["a1"]);
    await grant(w, ["a1"]);
    expect(w.calls[0]).toBe("raw");
    expect(w.calls).toContain("read");
    const [[sql]] = w.tx.$executeRaw.mock.calls;
    expect(sql.join("?")).toContain("pg_advisory_xact_lock(hashtext(?))");
  });

  it("keys the lock by country", async () => {
    const w = posted(["a1"]);
    await grant(w, ["a1"]);
    const [[, key]] = w.tx.$executeRaw.mock.calls;
    expect(key).toBe("action-reward:c1");
  });

  it("reports the credited amount when the social cap truncates it, and records that", async () => {
    earn.mockResolvedValueOnce({ newBalance: 100, amount: 3 });
    const w = posted(["a1"]);
    await expect(grant(w, ["a1"])).resolves.toBe(3);
    expect(w.state.rewards[0]).toMatchObject({ amount: 3 });
  });

  describe("one payout per action", () => {
    it("pays nothing for an action that already has a reward, whichever post pays it again", async () => {
      const w = posted(["a1"], { rewards: [reward("a1")] });
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(earn).not.toHaveBeenCalled();
      expect(w.state.rewards).toHaveLength(1);
    });

    it("pays nothing when the action was paid and its link row was deleted and recreated by an edit", async () => {
      // The link row is new (an edit recreated it), but the reward row is not: only the reward table remembers.
      const w = posted(["a1"], { rewards: [reward("a1", { createdAt: new Date(0) })] });
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(earn).not.toHaveBeenCalled();
    });

    it("pays nothing when the ledger already holds the action's key", async () => {
      const w = posted(["a1"], { keys: ["forum_action:a1"] });
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(earn).not.toHaveBeenCalled();
      expect(w.state.rewards).toHaveLength(0);
    });

    it("pays an action once when the post lists it twice", async () => {
      const w = posted(["a1"]);
      await expect(grant(w, ["a1", "a1"])).resolves.toBe(5);
      expect(earn).toHaveBeenCalledTimes(1);
    });

    it("rolls everything back when the reward row turns out to exist already (the primary key backstop)", async () => {
      const w = posted(["a1"]);
      w.tx.forumActionReward.findMany.mockResolvedValueOnce([]);
      w.state.rewards.push(reward("a1", { createdAt: new Date(0) }));
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });

    it("treats a duplicate reported as a conflict (the app's database client) as already paid", async () => {
      const w = posted(["a1"]);
      w.tx.forumActionReward.create.mockRejectedValueOnce(new ConflictError("duplicate"));
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });
  });

  describe("which actions pay", () => {
    it("pays nothing for a link the post no longer has, or that another post made", async () => {
      await expect(grant(world({ activities: [action("a1")] }), ["a1"])).resolves.toBe(0);
      const other = world({ activities: [action("a1")], links: [link("a1", { postRef: "p0" })] });
      await expect(grant(other, ["a1"])).resolves.toBe(0);
      expect(earn).not.toHaveBeenCalled();
    });

    it("pays nothing for another nation's action or a private one", async () => {
      const w = world({
        activities: [action("a1", { countryId: "c2" }), action("a2", { visibility: "private" })],
        links: [link("a1"), link("a2")],
      });
      await expect(grant(w, ["a1", "a2"])).resolves.toBe(0);
      expect(earn).not.toHaveBeenCalled();
    });

    it("matches the picker's rule: the activity query is the id plus pickableActivityWhere", async () => {
      const w = posted(["a1"]);
      await grant(w, ["a1"]);
      expect(w.tx.activityFeed.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { id: { in: ["a1"] } },
            expect.objectContaining({ countryId: "c1", visibility: "public" }),
          ],
        },
        select: { id: true },
      });
    });

    it.each(NON_ACTION_TITLES.map((title) => [title]))(
      "never pays the denylisted title %s",
      async (title) => {
        const w = world({ activities: [action("a1", { title })], links: [link("a1")] });
        await expect(grant(w, ["a1"])).resolves.toBe(0);
        expect(earn).not.toHaveBeenCalled();
      }
    );

    it.each(NON_ACTION_EVENT_TYPES.map((type) => [type]))(
      "never pays the denylisted event type %s",
      async (type) => {
        const metadata = JSON.stringify({ eventType: type, newTier: "Strong" });
        const w = world({ activities: [action("a1", { metadata })], links: [link("a1")] });
        await expect(grant(w, ["a1"])).resolves.toBe(0);
        expect(earn).not.toHaveBeenCalled();
      }
    );

    it("pays an action whose metadata names another event, and one with no metadata", async () => {
      const metadata = JSON.stringify({ eventType: "law_passed" });
      const w = world({
        activities: [action("a1", { metadata }), action("a2")],
        links: [link("a1"), link("a2")],
      });
      await expect(grant(w, ["a1", "a2"])).resolves.toBe(10);
    });

    it("pays the payable links of a post that also links a denylisted one", async () => {
      const w = world({
        activities: [action("a1", { title: NON_ACTION_TITLES[0] }), action("a2")],
        links: [link("a1"), link("a2")],
      });
      await expect(grant(w, ["a1", "a2"])).resolves.toBe(5);
      expect(w.state.rewards.map((r) => r.activityId)).toEqual(["a2"]);
    });
  });

  describe("the country's daily cap", () => {
    it("pays nothing once the country has been rewarded the cap's worth today", async () => {
      const w = posted(["a1"], { rewards: [reward("d1"), reward("d2"), reward("d3")] });
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(earn).not.toHaveBeenCalled();
    });

    it("does not count yesterday's rewards, or another country's, against today's cap", async () => {
      const yesterday = new Date(today().getTime() - 1);
      const w = posted(["a1"], {
        rewards: [
          reward("d1", { createdAt: yesterday }),
          reward("d2", { createdAt: yesterday }),
          reward("d3", { createdAt: yesterday }),
          reward("d4", { countryId: "c2" }),
        ],
      });
      await expect(grant(w, ["a1"])).resolves.toBe(5);
    });

    it("counts rewards whose link rows are long gone, so an edit cannot reopen a slot", async () => {
      // No link rows exist for d1..d3 at all: the count reads the reward table alone.
      const w = posted(["a1"], { rewards: [reward("d1"), reward("d2"), reward("d3")] });
      expect(w.state.links.map((l) => l.activityId)).toEqual(["a1"]);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
    });

    it("pays up to the cap across the new links of one post, in the post's order", async () => {
      bonus.mockResolvedValue(config({ forumActionDailyCap: 2 }) as never);
      const w = posted(["a1", "a2", "a3"]);
      await expect(grant(w, ["a1", "a2", "a3"])).resolves.toBe(10);
      expect(earn).toHaveBeenCalledTimes(2);
      expect(w.state.rewards.map((r) => r.activityId)).toEqual(["a1", "a2"]);
    });

    it("counts rewards already paid today against a post's remaining slots", async () => {
      bonus.mockResolvedValue(config({ forumActionDailyCap: 2 }) as never);
      const w = posted(["a1", "a2"], { rewards: [reward("d1")] });
      await expect(grant(w, ["a1", "a2"])).resolves.toBe(5);
    });

    it("queues two posts that contend for the last slot of the day, so only one is paid", async () => {
      bonus.mockResolvedValue(config({ forumActionDailyCap: 1 }) as never);
      const w = world({
        activities: [action("a1"), action("a2")],
        links: [link("a1"), link("a2", { postRef: "p2" })],
      });
      const [first, second] = await Promise.all([
        grant(w, ["a1"]),
        grant(w, ["a2"], { postRef: "p2" }),
      ]);
      expect(first + second).toBe(5);
      expect(earn).toHaveBeenCalledTimes(1);
      expect(w.state.rewards).toHaveLength(1);
      expect(w.transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the rules say no before any work", () => {
    it.each([
      ["the bonus master toggle is off", { enabled: 0 }],
      ["the reward is 0", { forumActionReward: 0 }],
      ["the daily cap is 0", { forumActionDailyCap: 0 }],
    ])("opens no transaction when %s", async (_label, extra) => {
      bonus.mockResolvedValue(config(extra) as never);
      const w = posted(["a1"]);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(w.transaction).not.toHaveBeenCalled();
    });

    it("does nothing for no links", async () => {
      const w = world();
      await expect(grant(w, [])).resolves.toBe(0);
      expect(bonus).not.toHaveBeenCalled();
      expect(w.transaction).not.toHaveBeenCalled();
    });
  });

  describe("when the ledger refuses", () => {
    it.each([
      ["the kill switch", "EARNING_DISABLED"],
      ["the social cap", "DAILY_CAP_REACHED"],
      ["maintenance", "MAINTENANCE"],
    ] as const)("pays and records nothing when %s refuses the credit", async (_label, code) => {
      earn.mockRejectedValueOnce(new LedgerError(code, code));
      const w = posted(["a1"]);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(w.state.rewards).toHaveLength(0);
    });

    it("keeps what was paid before the refusal, reports only that, and stops", async () => {
      earn.mockResolvedValueOnce({ newBalance: 100, amount: 5 });
      earn.mockRejectedValueOnce(new LedgerError("DAILY_CAP_REACHED", "cap"));
      const w = posted(["a1", "a2", "a3"]);
      await expect(grant(w, ["a1", "a2", "a3"])).resolves.toBe(5);
      expect(earn).toHaveBeenCalledTimes(2);
      expect(w.state.rewards.map((r) => r.activityId)).toEqual(["a1"]);
      // Proof the transaction is still alive when it reports credits as paid: one more statement after the refusal.
      expect(w.tx.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it("reports nothing paid when the transaction turns out to be dead after a refusal", async () => {
      earn.mockResolvedValueOnce({ newBalance: 100, amount: 5 });
      earn.mockRejectedValueOnce(new LedgerError("DAILY_CAP_REACHED", "cap"));
      const w = posted(["a1", "a2"]);
      w.tx.$executeRaw.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("aborted"));
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(grant(w, ["a1", "a2"])).resolves.toBe(0);
      expect(w.state.rewards).toHaveLength(0);
      log.mockRestore();
    });

    it("pays nothing when the ledger credits nothing", async () => {
      earn.mockResolvedValueOnce({ newBalance: 100, amount: 0 });
      const w = posted(["a1"]);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(w.state.rewards).toHaveLength(0);
    });
  });

  describe("any other failure reads as no reward and never throws", () => {
    it("on an unexpected ledger error, logging it", async () => {
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      earn.mockRejectedValueOnce(new Error("connection reset"));
      const w = posted(["a1"]);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(w.state.rewards).toHaveLength(0);
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it("on a transaction timeout or an unavailable connection pool, logging it", async () => {
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const w = posted(["a1"]);
      w.transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Transaction already closed", {
          code: "P2028",
          clientVersion: "x",
        })
      );
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it("when the bonus config cannot be read", async () => {
      const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
      bonus.mockRejectedValueOnce(new Error("config down"));
      const w = posted(["a1"]);
      await expect(grant(w, ["a1"])).resolves.toBe(0);
      expect(w.transaction).not.toHaveBeenCalled();
      log.mockRestore();
    });
  });
});
