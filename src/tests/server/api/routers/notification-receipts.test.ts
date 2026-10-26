/** @jest-environment node */
/**
 * Global and country-wide notifications are single shared rows: one player's read, dismiss or "mark all read" is
 * theirs alone (a NotificationReceipt), never a write to the shared row, while a personal notification keeps its own
 * columns. The list and the unread badge merge the caller's receipts.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { addNation } from "~/tests/helpers/forum-world";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(notificationsUserRouter);

let db: MemoryPrisma;

function as(clerkUserId: string) {
  return createCaller(
    createMockCallerContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, countryId: "c1" },
      rateLimitIdentifier: clerkUserId,
    })
  );
}

beforeEach(async () => {
  db = createMemoryPrisma();
  await db.realm.create({
    data: { id: "r1", slug: "r1", name: "Realm", ownerId: "owner", status: "active" },
  });
  await addNation(db, "c1", "r1", null);
  for (const id of ["alice", "bob"]) {
    await db.user.create({ data: { id: `db_${id}`, clerkUserId: id, countryId: "c1" } });
  }
  await db.notification.create({ data: { id: "global", title: "Global notice" } });
  await db.notification.create({
    data: { id: "country", title: "Country notice", countryId: "c1" },
  });
  await db.notification.create({ data: { id: "alice-own", title: "Alice only", userId: "alice" } });
  // A personal row that also names the country is still only its addressee's.
  await db.notification.create({
    data: { id: "bob-own", title: "Bob only", userId: "db_bob", countryId: "c1" },
  });
});

const ids = (r: { notifications: { id: string }[] }) => r.notifications.map((n) => n.id).sort();

describe("shared notifications keep read/dismiss state per user", () => {
  it("lists only rows the caller may see", async () => {
    expect(ids(await as("alice").getUserNotifications())).toEqual([
      "alice-own",
      "country",
      "global",
    ]);
    expect(ids(await as("bob").getUserNotifications())).toEqual(["bob-own", "country", "global"]);
  });

  it("markAsRead on a global row marks it read for the caller only", async () => {
    await as("alice").markAsRead({ notificationId: "global" });

    const aliceList = await as("alice").getUserNotifications();
    expect(aliceList.notifications.find((n) => n.id === "global")?.read).toBe(true);
    expect((await as("alice").getUnreadCount()).count).toBe(2);
    expect((await as("bob").getUnreadCount()).count).toBe(3);
    expect((await db.notification.findUnique({ where: { id: "global" } }))?.read).toBe(false);
  });

  it("dismissNotification hides a country row for the caller only", async () => {
    await as("alice").dismissNotification({ notificationId: "country" });

    expect(ids(await as("alice").getUserNotifications())).toEqual(["alice-own", "global"]);
    expect(ids(await as("bob").getUserNotifications())).toContain("country");
    expect((await db.notification.findUnique({ where: { id: "country" } }))?.dismissed).toBe(false);
  });

  it("markAllAsRead clears the caller's badge without touching anyone else's", async () => {
    await as("alice").markAsRead({ notificationId: "global" });
    await as("alice").markAllAsRead({});

    expect((await as("alice").getUnreadCount()).count).toBe(0);
    expect((await as("bob").getUnreadCount()).count).toBe(3);
    expect(await db.notificationReceipt.count({ where: { userId: "alice" } })).toBe(2);
    expect((await db.notification.findUnique({ where: { id: "alice-own" } }))?.read).toBe(true);
    expect((await db.notification.findUnique({ where: { id: "bob-own" } }))?.read).toBe(false);
  });

  it("unreadOnly lists the shared rows the caller has not read", async () => {
    await as("bob").markAsRead({ notificationId: "country" });
    expect(ids(await as("bob").getUserNotifications({ unreadOnly: true }))).toEqual([
      "bob-own",
      "global",
    ]);
  });

  it("refuses another user's personal notification", async () => {
    await expect(as("alice").markAsRead({ notificationId: "bob-own" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
