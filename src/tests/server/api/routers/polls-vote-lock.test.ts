/** @jest-environment node */
/**
 * A ballot is cast under a per-(poll, voter) lock (51002), taken before the "already voted?" read, so a voter's two
 * parallel ballots on a single-choice poll land one option, not two; a repeated option is one choice; and the
 * feature-voting toggle reads and writes under the same lock. Another voter's ballot takes its own lock.
 *
 * Regression: vote read "already voted?" and then wrote with createMany, unlocked, so two parallel ballots with
 * different options both landed on a single-choice poll (realm governance polls included).
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { pollsRouter } from "~/server/api/routers/polls";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addPerson, asPerson, type Person } from "~/tests/helpers/sports-world";

const polls = createCallerFactory(pollsRouter);

let db: MemoryPrisma;
let pia: Person;
let rex: Person;

const vote = (who: Person, pollId: string, optionIds: string[]) =>
  polls(asPerson(db as never, who)).vote({ pollId, optionIds });

async function addPoll(id: string, data: { multiple?: boolean; pollType?: string } = {}) {
  await db.poll.create({
    data: {
      id,
      question: `Question ${id}?`,
      ...data,
      options: {
        create: [
          { id: `${id}-a`, label: "A" },
          { id: `${id}-b`, label: "B" },
        ],
      },
    },
  });
}

beforeEach(async () => {
  db = createMemoryPrisma();
  mockDb = db;
  pia = await addPerson(db as never, "pia");
  rex = await addPerson(db as never, "rex");
});

describe("vote", () => {
  it("lands one option of a voter's two parallel ballots on a single-choice poll", async () => {
    await addPoll("single");

    const results = await Promise.allSettled([
      vote(pia, "single", ["single-a"]),
      vote(pia, "single", ["single-b"]),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "BAD_REQUEST", message: "You have already voted on this poll" },
    });
    expect(await db.pollVote.count({ where: { pollId: "single" } })).toBe(1);
  });

  it("takes the voter's lock on the poll before reading, one lock per voter", async () => {
    await addPoll("single");
    const start = db.store.log.length;

    await vote(pia, "single", ["single-a"]);
    await vote(rex, "single", ["single-b"]);

    const entries = db.store.log.slice(start);
    expect(entries.filter((e) => e.kind === "advisory")).toEqual([
      { kind: "advisory", ns: 51002, key: `single:${pia.clerkUserId}` },
      { kind: "advisory", ns: 51002, key: `single:${rex.clerkUserId}` },
    ]);
    expect(entries.findIndex((e) => e.kind === "advisory")).toBeLessThan(
      entries.findIndex((e) => e.kind === "write" && e.model === "PollVote")
    );
  });

  it("counts a repeated option once on a multiple-choice poll", async () => {
    await addPoll("multi", { multiple: true });

    await vote(pia, "multi", ["multi-a", "multi-a", "multi-b"]);

    expect(
      (await db.pollVote.findMany({ where: { pollId: "multi" }, select: { optionId: true } }))
        .map((v) => v.optionId)
        .sort()
    ).toEqual(["multi-a", "multi-b"]);
  });

  it("toggles a feature vote on and off under the lock", async () => {
    await addPoll("features", { pollType: "feature-voting" });

    await expect(vote(pia, "features", ["features-a"])).resolves.toMatchObject({ action: "vote" });
    await expect(vote(pia, "features", ["features-a"])).resolves.toMatchObject({
      action: "unvote",
    });
    expect(await db.pollVote.count({ where: { pollId: "features" } })).toBe(0);
  });
});
