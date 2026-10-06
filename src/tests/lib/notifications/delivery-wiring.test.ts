/** @jest-environment node */
/**
 * SL-5 wiring: notificationAPI hands only accepted single-user notifications to delivery, and
 * the notifications router reports configured channels, guards push subscriptions and records
 * email consent.
 */
const mockDeliver = jest.fn().mockResolvedValue(undefined);
const mockPrefsFindUnique = jest.fn();
const mockNotificationCreate = jest.fn();
const mockNotificationCreateMany = jest.fn();

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/lib/notifications/delivery/deliver", () => ({
  deliverNotification: (...a: unknown[]) => mockDeliver(...a),
}));
jest.mock("~/server/db", () => ({
  db: {
    userPreferences: { findUnique: (...a: unknown[]) => mockPrefsFindUnique(...a) },
    user: { findFirst: async () => null },
    notification: {
      create: (...a: unknown[]) => mockNotificationCreate(...a),
      createMany: (...a: unknown[]) => mockNotificationCreateMany(...a),
    },
    notificationEventConfig: { findMany: async () => [] },
  },
}));

import { createECDH } from "node:crypto";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { notificationsPreferencesRouter } from "~/server/api/routers/notifications/preferences";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

beforeEach(() => {
  jest.clearAllMocks();
  mockPrefsFindUnique.mockResolvedValue(null);
});

describe("notificationAPI hands accepted notifications to delivery", () => {
  it("delivers a created single-user notification", async () => {
    mockNotificationCreate.mockResolvedValue({ id: "n1", userId: "user_1", title: "Hi" });
    await notificationAPI.create({ title: "Hi", userId: "user_1", priority: "high" });
    expect(mockDeliver).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1", userId: "user_1" }),
      expect.anything()
    );
  });

  it("does not deliver a notification the recipient filtered out, or a broadcast", async () => {
    mockPrefsFindUnique.mockResolvedValue({
      economicAlerts: false,
      crisisAlerts: true,
      diplomaticAlerts: true,
      systemAlerts: true,
      notificationLevel: "low",
    });
    await notificationAPI.create({ title: "Market", userId: "user_1", category: "economic" });
    mockNotificationCreate.mockResolvedValue({ id: "n2", userId: null, title: "All" });
    await notificationAPI.create({ title: "All" });
    expect(mockDeliver).not.toHaveBeenCalled();
  });

  it("createMany delivers only accepted rows with a recipient", async () => {
    mockPrefsFindUnique.mockImplementation(async ({ where }: any) =>
      where.userId === "user_off"
        ? {
            economicAlerts: true,
            crisisAlerts: true,
            diplomaticAlerts: true,
            systemAlerts: false,
            notificationLevel: "low",
          }
        : null
    );
    mockNotificationCreateMany.mockResolvedValue({ count: 2 });
    await notificationAPI.createMany([
      { title: "A", userId: "user_on", category: "system" },
      { title: "B", userId: "user_off", category: "system" },
      { title: "C", countryId: "c1" },
    ]);
    expect(mockDeliver).toHaveBeenCalledTimes(1);
    expect(mockDeliver.mock.calls[0]![0]).toMatchObject({ title: "A", userId: "user_on" });
  });
});

describe("notifications router (delivery)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  function caller(db = createMockPrisma()) {
    const ctx = createMockRouterContext({
      db,
      auth: { userId: "user_1" },
      user: { id: "db_1", clerkUserId: "user_1", lastSeenAt: new Date() },
    });
    return { db, api: createCallerFactory(notificationsPreferencesRouter)(ctx as never) };
  }

  it("reports no channels while nothing is configured", async () => {
    delete process.env.EMAIL_API_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    expect(await caller().api.getDeliveryChannels()).toEqual({
      email: false,
      push: false,
      vapidPublicKey: null,
      pushSubscriptionCount: 0,
    });
  });

  it("reports configured channels with the VAPID public key", async () => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    Object.assign(process.env, {
      EMAIL_API_KEY: "k",
      EMAIL_FROM: "n@example.com",
      VAPID_PUBLIC_KEY: ecdh.getPublicKey("base64url"),
      VAPID_PRIVATE_KEY: ecdh.getPrivateKey("base64url"),
      VAPID_SUBJECT: "mailto:ops@example.com",
    });
    const { db, api } = caller();
    db.pushSubscription.count.mockResolvedValue(2);
    expect(await api.getDeliveryChannels()).toMatchObject({
      email: true,
      push: true,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
      pushSubscriptionCount: 2,
    });

    await expect(
      api.savePushSubscription({
        endpoint: "https://internal.example.com/hook",
        keys: { p256dh: "p", auth: "a" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await api.savePushSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/x",
      keys: { p256dh: "p", auth: "a" },
    });
    expect(db.pushSubscription.upsert.mock.calls[0]![0]).toMatchObject({
      where: { endpoint: "https://fcm.googleapis.com/fcm/send/x" },
      update: { userId: "user_1", p256dh: "p", auth: "a" },
    });
  });

  it("refuses push subscriptions while push is not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    await expect(
      caller().api.savePushSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/x",
        keys: { p256dh: "p", auth: "a" },
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("records email consent when email is switched on, and clears it when off", async () => {
    const { db, api } = caller();
    await api.upsertPreferences({ userId: "user_1", emailNotifications: true });
    expect(db.userPreferences.upsert.mock.calls[0]![0].update.emailEnabledAt).toBeInstanceOf(Date);
    await api.upsertPreferences({ userId: "user_1", emailNotifications: false });
    expect(db.userPreferences.upsert.mock.calls[1]![0].update.emailEnabledAt).toBeNull();
    await api.upsertPreferences({ userId: "user_1", emailDigest: true });
    expect(db.userPreferences.upsert.mock.calls[2]![0].update).toEqual({ emailDigest: true });
  });
});
