/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import {
  declareDirectiveActivity,
  withdrawDirectiveActivity,
} from "~/lib/activity/directive-activity";

const INPUT = {
  intentId: "int1",
  countryId: "c1",
  countryName: "Testland",
  userId: "clerk_1",
  goal: "Create industrial manufacturing jobs",
  tier: "moderate",
  category: "economy",
};

function fakeDb(existing: string[] = []) {
  const rows = new Set(existing);
  return {
    activityFeed: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        rows.has(where.id) ? { id: where.id } : null
      ),
      create: jest.fn(async ({ data }: { data: { id: string } }) => {
        rows.add(data.id);
        return { ...data };
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
}

describe("declareDirectiveActivity", () => {
  it("writes one public government row with a fixed id and the directive's identity in the metadata", async () => {
    const db = fakeDb();
    await expect(declareDirectiveActivity(db as never, INPUT)).resolves.toBe("dir-int1");
    expect(db.activityFeed.create).toHaveBeenCalledTimes(1);
    const [[call]] = db.activityFeed.create.mock.calls as never as [
      [{ data: Record<string, string> }],
    ];
    const data = call.data;
    expect(data).toMatchObject({
      id: "dir-int1",
      type: "directive",
      category: "government",
      visibility: "public",
      userId: "clerk_1",
      countryId: "c1",
      title: "Create industrial manufacturing jobs",
      priority: "medium",
      relatedCountries: JSON.stringify(["c1"]),
    });
    expect(JSON.parse(data.metadata)).toEqual({
      eventType: "directive_declared",
      intentId: "int1",
      countryId: "c1",
      userId: "clerk_1",
    });
  });

  it("says only what the public record already says in the description", async () => {
    const db = fakeDb();
    await declareDirectiveActivity(db as never, INPUT);
    const [[call]] = db.activityFeed.create.mock.calls as never as [
      [{ data: { description: string } }],
    ];
    expect(call.data.description).toBe("Testland declared a moderate directive in economy.");
  });

  it("is idempotent: a retry finds the row and writes nothing", async () => {
    const db = fakeDb(["dir-int1"]);
    await expect(declareDirectiveActivity(db as never, INPUT)).resolves.toBe("dir-int1");
    expect(db.activityFeed.create).not.toHaveBeenCalled();
  });

  it("treats a lost race on the fixed id as success", async () => {
    const db = fakeDb();
    db.activityFeed.create.mockImplementationOnce(async () => {
      db.activityFeed.findUnique.mockResolvedValueOnce({ id: "dir-int1" });
      throw new Error("Unique constraint failed on the fields: (`id`)");
    });
    await expect(declareDirectiveActivity(db as never, INPUT)).resolves.toBe("dir-int1");
  });

  it("returns null and logs when the write fails, never throwing", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = fakeDb();
    db.activityFeed.create.mockRejectedValueOnce(new Error("db down"));
    await expect(declareDirectiveActivity(db as never, INPUT)).resolves.toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("keeps a null user as null", async () => {
    const db = fakeDb();
    await declareDirectiveActivity(db as never, { ...INPUT, userId: null });
    const [[call]] = db.activityFeed.create.mock.calls as never as [[{ data: { userId: null } }]];
    expect(call.data.userId).toBeNull();
  });
});

describe("withdrawDirectiveActivity", () => {
  it("turns the directive's row private", async () => {
    const db = fakeDb();
    await withdrawDirectiveActivity(db as never, "int1");
    expect(db.activityFeed.updateMany).toHaveBeenCalledWith({
      where: { id: "dir-int1" },
      data: { visibility: "private" },
    });
  });

  it("propagates a failure so the abandoning transaction rolls back", async () => {
    const db = fakeDb();
    db.activityFeed.updateMany.mockRejectedValueOnce(new Error("db down"));
    await expect(withdrawDirectiveActivity(db as never, "int1")).rejects.toThrow("db down");
  });

  it("is not an error when the directive has no row", async () => {
    const db = fakeDb();
    db.activityFeed.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(withdrawDirectiveActivity(db as never, "int1")).resolves.toBeUndefined();
  });
});
