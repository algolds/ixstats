/** @jest-environment node */
/**
 * Asking to delete an account (Privacy 5.2): the typed handle (or the Clerk username / email local part without one)
 * confirms it, the request starts the 14-day grace, asking again keeps the first date, cancelling clears it, and staff
 * playing as the user are refused.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { usersAccountDeletionRouter } from "~/server/api/routers/users/account-deletion";
import { requestAccountDeletion } from "~/server/modules/identity/identity.account-deletion";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(usersAccountDeletionRouter);
const DAY = 24 * 60 * 60 * 1000;

let db: MemoryPrisma;

function as(clerkUserId: string, extra: { impersonatorId?: string } = {}) {
  return createCaller(
    createMockCallerContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, countryId: null },
      rateLimitIdentifier: clerkUserId,
      ...extra,
    })
  );
}

beforeEach(async () => {
  db = createMemoryPrisma();
  await db.user.create({ data: { id: "db_alice", clerkUserId: "alice", handle: "alice_h" } });
});

describe("users account deletion", () => {
  it("reports nothing pending for a new account", async () => {
    expect(await as("alice").getAccountDeletion()).toEqual({ requestedAt: null, erasesAt: null });
  });

  it("refuses a request whose typed name is not the handle", async () => {
    await expect(
      as("alice").requestAccountDeletion({ confirmHandle: "someone" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const row = await db.user.findUnique({ where: { id: "db_alice" } });
    expect(row?.deletionRequestedAt).toBeNull();
  });

  it("starts the grace on the handle, keeps the first date on a repeat, and cancels", async () => {
    const first = await as("alice").requestAccountDeletion({ confirmHandle: "@Alice_H" });
    expect(first.requestedAt).toBeInstanceOf(Date);
    expect(first.erasesAt!.getTime() - first.requestedAt!.getTime()).toBe(14 * DAY);

    const again = await as("alice").requestAccountDeletion({ confirmHandle: "alice_h" });
    expect(again.requestedAt?.getTime()).toBe(first.requestedAt?.getTime());
    expect((await as("alice").getAccountDeletion()).requestedAt?.getTime()).toBe(
      first.requestedAt?.getTime()
    );

    expect(await as("alice").cancelAccountDeletion()).toEqual({
      requestedAt: null,
      erasesAt: null,
    });
    const row = await db.user.findUnique({ where: { id: "db_alice" } });
    expect(row?.deletionRequestedAt).toBeNull();
  });

  it("refuses staff playing as the user, asking or cancelling", async () => {
    await expect(
      as("alice", { impersonatorId: "staff" }).requestAccountDeletion({ confirmHandle: "alice_h" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const requestedAt = new Date(Date.now() - DAY);
    await db.user.update({ where: { id: "db_alice" }, data: { deletionRequestedAt: requestedAt } });
    await expect(
      as("alice", { impersonatorId: "staff" }).cancelAccountDeletion()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const row = await db.user.findUnique({ where: { id: "db_alice" } });
    expect(row?.deletionRequestedAt?.getTime()).toBe(requestedAt.getTime());
  });

  it("refuses to cancel once the grace has passed: the erasure may already be running", async () => {
    const requestedAt = new Date(Date.now() - 15 * DAY);
    await db.user.update({ where: { id: "db_alice" }, data: { deletionRequestedAt: requestedAt } });
    await expect(as("alice").cancelAccountDeletion()).rejects.toMatchObject({ code: "CONFLICT" });
    const row = await db.user.findUnique({ where: { id: "db_alice" } });
    expect(row?.deletionRequestedAt?.getTime()).toBe(requestedAt.getTime());
  });

  it("takes the Clerk username or email local part when there is no handle", async () => {
    await db.user.create({ data: { id: "db_bob", clerkUserId: "bob" } });
    const clerkNames = async () => ({ username: null, email: "bob.b@example.com" });
    const request = (confirmHandle: string) =>
      requestAccountDeletion(
        db,
        { user: { id: "db_bob", clerkUserId: "bob" }, confirmHandle, impersonating: false },
        clerkNames
      );
    await expect(request("bob")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await request("Bob.B")).requestedAt).toBeInstanceOf(Date);
  });
});
