/** @jest-environment node */
/**
 * A write that loses a race is recognised in either form it reaches the code (the raw Prisma error, or the
 * ConflictError / NotFoundError the app's db client wraps it into), so racing first writes resolve to the row that
 * won instead of failing: the default stash is the first consumer. Folds prisma-error-unique.test.ts.
 */
import { describe, it, expect } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "~/lib/app-error";
import { isMissingRecord, isUniqueViolation } from "~/lib/prisma-error";
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
