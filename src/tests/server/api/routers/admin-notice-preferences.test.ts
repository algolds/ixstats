/** @jest-environment node */
/**
 * SL-5: admin notices addressed to one user (the platform alert and the messaging "system
 * message" broadcast) respect the recipient's notification preferences. Country-wide and
 * global notices are not filtered.
 */
jest.mock("~/lib/notifications/recipient-preferences", () => ({
  recipientAccepts: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { createMessagingService } from "~/server/modules/messaging";
import { recipientAccepts } from "~/lib/notifications/recipient-preferences";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const accepts = recipientAccepts as jest.Mock;

function adminCaller(db: ReturnType<typeof createMockPrisma>) {
  return createCallerFactory(notificationsUserRouter)(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db,
    }) as never
  );
}

const ALERT = {
  title: "Maintenance",
  type: "system" as const,
  category: "system" as const,
  level: "low" as const,
  adminUserId: "admin_1",
};

describe("notifications.createNotification", () => {
  beforeEach(() => {
    accepts.mockReset();
  });

  it("writes nothing and returns null when the recipient's preferences filter it out", async () => {
    accepts.mockResolvedValue(false);
    const db = createMockPrisma();
    const result = await adminCaller(db).createNotification({ ...ALERT, userId: "u1" });
    expect(result).toBeNull();
    expect(accepts).toHaveBeenCalledWith("u1", "system", "low");
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("writes a single-user notice the recipient accepts", async () => {
    accepts.mockResolvedValue(true);
    const db = createMockPrisma();
    db.notification.create.mockResolvedValue({ id: "n1" });
    expect(await adminCaller(db).createNotification({ ...ALERT, userId: "u1" })).toEqual({
      id: "n1",
    });
  });

  it("does not filter country-wide or global notices", async () => {
    const db = createMockPrisma();
    db.notification.create.mockResolvedValue({ id: "n1" });
    await adminCaller(db).createNotification({ ...ALERT, countryId: "c1" });
    await adminCaller(db).createNotification(ALERT);
    expect(accepts).not.toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalledTimes(2);
  });
});

describe("messaging sendAdminBroadcast", () => {
  beforeEach(() => {
    accepts.mockReset();
  });

  function service(db: ReturnType<typeof createMockPrisma>) {
    const websocket = { broadcastMessage: jest.fn() };
    return {
      websocket,
      svc: createMessagingService({ db: db as never, websocket: websocket as never }),
    };
  }

  it("skips a user-scoped broadcast the recipient's preferences filter out", async () => {
    accepts.mockResolvedValue(false);
    const db = createMockPrisma();
    const { svc, websocket } = service(db);
    const result = await svc.sendAdminBroadcast("admin_1", {
      title: "Hello",
      scope: "user",
      userId: "u1",
      category: "diplomatic",
      level: "low",
    } as never);
    expect(result).toBeNull();
    expect(accepts).toHaveBeenCalledWith("u1", "diplomatic", "low");
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(websocket.broadcastMessage).not.toHaveBeenCalled();
  });

  it("does not filter country-wide or global broadcasts", async () => {
    const db = createMockPrisma();
    db.notification.create.mockResolvedValue({ id: "n1" });
    const { svc } = service(db);
    await svc.sendAdminBroadcast("admin_1", {
      title: "Hello",
      scope: "country",
      countryId: "c1",
    } as never);
    await svc.sendAdminBroadcast("admin_1", { title: "Hello", scope: "global" } as never);
    expect(accepts).not.toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalledTimes(2);
  });
});
