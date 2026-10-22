/** @jest-environment node */
/**
 * The app's db client wraps errors and caps reads, and code built on it loses nothing to either: a write that loses
 * a race is recognised in either form (the raw Prisma error, or the ConflictError / NotFoundError the client wraps it
 * into), so racing first writes resolve to the row that won (the default stash is the first consumer), and a read of
 * every row pages past the client's 1,000-row cap. Folds prisma-error-unique and system/find-all-by-id.
 */
import { describe, it, expect } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "~/lib/app-error";
import { isMissingRecord, isUniqueViolation } from "~/lib/prisma-error";
import { findAllById, type IdPage } from "~/lib/system/find-all-by-id";
import { getOrCreateDefaultStash } from "~/server/shared/default-stash";

const prismaError = (code: string, target?: string[]) =>
  new Prisma.PrismaClientKnownRequestError("x", {
    code,
    clientVersion: "test",
    meta: target ? { target } : undefined,
  });

it.each([
  [
    "a raw P2002 is a unique violation",
    () => isUniqueViolation(prismaError("P2002", ["advertRealmId"])),
    true,
  ],
  [
    "the db client's ConflictError is one",
    () => isUniqueViolation(new ConflictError("Unique constraint violation on Stash")),
    true,
  ],
  [
    "a wrapped one on another column is not that column's",
    () =>
      isUniqueViolation(
        new ConflictError("Unique constraint violation on ForumThread (advertRealmId)"),
        "activityId"
      ),
    false,
  ],
  ["a missing row is no unique violation", () => isUniqueViolation(prismaError("P2025")), false],
  ["a raw P2025 is a missing record", () => isMissingRecord(prismaError("P2025")), true],
  [
    "the db client's wrapped NotFoundError is one",
    () => isMissingRecord(new NotFoundError("ForumPost", undefined, { prismaError: "gone" })),
    true,
  ],
  ["the app's own NotFoundError is not", () => isMissingRecord(new NotFoundError("Post")), false],
] as const)("%s", (_case, check, expected) => {
  expect(check()).toBe(expected);
});

type StashDb = Parameters<typeof getOrCreateDefaultStash>[0];

function makeDb() {
  const stash = { findFirst: jest.fn(), create: jest.fn() };
  return { stash, db: { stash } as unknown as StashDb };
}

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("getOrCreateDefaultStash", () => {
  it("treats the app db client's wrapped ConflictError as the same concurrent first stash", async () => {
    const { stash, db } = makeDb();
    stash.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "winner", name: "My Stash", isDefault: true });
    stash.create.mockRejectedValue(new ConflictError("Unique constraint violation on Stash"));

    const result = await getOrCreateDefaultStash(db, ["u1"], "u1");

    expect(result.id).toBe("winner");
  });
  it("when a non-default 'My Stash' holds the name, creates the default under 'My Stash (default)'", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue(null);
    stash.create
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({ id: "fallback", name: "My Stash (default)", isDefault: true });

    const result = await getOrCreateDefaultStash(db, ["u1"], "u1");

    expect(result.id).toBe("fallback");
    expect(stash.create).toHaveBeenCalledTimes(2);
    expect(stash.create.mock.calls[1]![0]).toMatchObject({
      data: { userId: "u1", name: "My Stash (default)", isDefault: true },
    });
  });

  it("rethrows an error that is not a unique violation", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue(null);
    stash.create.mockRejectedValue(new Error("connection lost"));

    await expect(getOrCreateDefaultStash(db, ["u1"], "u1")).rejects.toThrow("connection lost");
    expect(stash.create).toHaveBeenCalledTimes(1);
  });
});

it("reads every row past the client's 1,000-row cap, in id-ordered pages", async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => ({ id: `id${String(i).padStart(5, "0")}` }));
  const fetchPage = jest.fn(async ({ take, cursor, skip = 0 }: IdPage) => {
    const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + skip : 0;
    return rows.slice(start, start + take);
  });
  const all = await findAllById(fetchPage, 500);
  expect(new Set(all.map((r) => r.id)).size).toBe(1203);
  expect(fetchPage.mock.calls[1]![0]).toMatchObject({ cursor: { id: "id00499" }, skip: 1 });
});
