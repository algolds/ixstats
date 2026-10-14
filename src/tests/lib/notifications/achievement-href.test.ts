/** @jest-environment node */
/**
 * An unlock notification opens the achievement it announces: /vault/achievements?a=<key>, carried through the
 * notification hook (which already receives the key as `achievementId`) to the stored href.
 */
jest.mock("~/server/db", () => ({ db: { notification: { create: jest.fn() } } }));
jest.mock("~/lib/notifications/guard", () => ({
  isNotificationEventEnabled: jest.fn(() => Promise.resolve(true)),
  guardNotificationEvent: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("~/lib/notifications/recipient-preferences", () => ({
  recipientAccepts: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("~/lib/notifications/delivery/deliver", () => ({ deliverNotification: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { notificationAPI } from "~/lib/notifications/api";
import { notificationHooks } from "~/lib/notifications/hooks";
import { db } from "~/server/db";

const create = jest.mocked(db.notification.create);

beforeEach(() => {
  create.mockReset();
  create.mockImplementation(((args: { data: object }) =>
    Promise.resolve({ id: "n1", userId: null, ...args.data })) as never);
});

const storedHref = () => (create.mock.calls[0]![0] as { data: { href: string | null } }).data.href;

describe("achievement unlock notification link", () => {
  it("links the API notification to the achievement in the Vault", async () => {
    await notificationAPI.trigger({
      achievement: {
        key: "econ-first-million",
        name: "First Million",
        description: "d",
        category: "Economic",
        userId: "u1",
      },
    });
    expect(storedHref()).toBe("/vault/achievements?a=econ-first-million");
  });

  it("encodes a key that needs it", async () => {
    await notificationAPI.trigger({
      achievement: { key: "a b&c", name: "n", description: "d", category: "c", userId: "u1" },
    });
    expect(storedHref()).toBe("/vault/achievements?a=a%20b%26c");
  });

  it("the unlock hook passes the achievement id through as the key", async () => {
    await notificationHooks.onAchievementUnlock({
      userId: "u1",
      achievementId: "pop-giant",
      name: "Giant",
      description: "d",
      category: "General",
    });
    expect(storedHref()).toBe("/vault/achievements?a=pop-giant");
  });
});
