/** @jest-environment node */
// `jest` is the ambient global here (not imported) so the hoisted jest.mock factory can use it.
const mockPrefsFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockNotificationCreate = jest.fn();
const mockNotificationCreateMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    userPreferences: { findUnique: (...a: unknown[]) => mockPrefsFindUnique(...a) },
    user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
    notification: {
      create: (...a: unknown[]) => mockNotificationCreate(...a),
      createMany: (...a: unknown[]) => mockNotificationCreateMany(...a),
    },
    notificationEventConfig: { findMany: async () => [] },
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  DEFAULT_RECIPIENT_PREFERENCES,
  isAllowedByPreferences,
  recipientAccepts,
} from "~/lib/notifications/recipient-preferences";
import { notificationAPI } from "~/lib/notifications/api";

const prefs = (over: Partial<typeof DEFAULT_RECIPIENT_PREFERENCES>) => ({
  ...DEFAULT_RECIPIENT_PREFERENCES,
  ...over,
});

describe("isAllowedByPreferences", () => {
  it("lets everything through with the defaults", () => {
    for (const category of ["economic", "diplomatic", "crisis", "system", "social", undefined]) {
      expect(isAllowedByPreferences(DEFAULT_RECIPIENT_PREFERENCES, category, "low")).toBe(true);
    }
  });

  it("blocks a category whose toggle is off, including its aliases", () => {
    const p = prefs({ economicAlerts: false, crisisAlerts: false });
    expect(isAllowedByPreferences(p, "economic", "high")).toBe(false);
    expect(isAllowedByPreferences(p, "cards", "high")).toBe(false);
    expect(isAllowedByPreferences(p, "military", "critical")).toBe(false);
    expect(isAllowedByPreferences(p, "diplomatic", "high")).toBe(true);
  });

  it("does not filter categories without a toggle", () => {
    const p = prefs({ economicAlerts: false, systemAlerts: false });
    expect(isAllowedByPreferences(p, "social", "low")).toBe(true);
    expect(isAllowedByPreferences(p, "achievement", "low")).toBe(true);
  });

  it("applies the minimum urgency", () => {
    expect(isAllowedByPreferences(prefs({ notificationLevel: "medium" }), "social", "low")).toBe(
      false
    );
    expect(isAllowedByPreferences(prefs({ notificationLevel: "medium" }), "social", null)).toBe(
      true
    );
    expect(isAllowedByPreferences(prefs({ notificationLevel: "high" }), "social", "medium")).toBe(
      false
    );
    expect(isAllowedByPreferences(prefs({ notificationLevel: "high" }), "social", "critical")).toBe(
      true
    );
    expect(isAllowedByPreferences(prefs({ notificationLevel: "all" }), "social", "low")).toBe(true);
  });
});

describe("recipientAccepts", () => {
  beforeEach(() => {
    mockPrefsFindUnique.mockReset();
    mockUserFindFirst.mockReset();
  });

  it("does not filter notifications without a single recipient", async () => {
    expect(await recipientAccepts(null, "economic", "low")).toBe(true);
    expect(mockPrefsFindUnique).not.toHaveBeenCalled();
  });

  it("resolves an internal user id to the Clerk-keyed preferences", async () => {
    mockPrefsFindUnique.mockImplementation(async (args: any) =>
      args.where.userId === "clerk_1" ? prefs({ diplomaticAlerts: false }) : null
    );
    mockUserFindFirst.mockResolvedValue({ clerkUserId: "clerk_1" });
    expect(await recipientAccepts("db_1", "diplomatic", "high")).toBe(false);
  });

  it("fails open when preferences cannot be read", async () => {
    mockPrefsFindUnique.mockRejectedValue(new Error("db down"));
    expect(await recipientAccepts("clerk_1", "economic", "low")).toBe(true);
  });
});

describe("notificationAPI honours recipient preferences", () => {
  beforeEach(() => {
    mockPrefsFindUnique.mockReset();
    mockUserFindFirst.mockReset();
    mockNotificationCreate.mockReset();
    mockNotificationCreateMany.mockReset();
    mockNotificationCreate.mockResolvedValue({ id: "n1", title: "t" });
    mockNotificationCreateMany.mockResolvedValue({ count: 1 });
  });

  it("create skips a category the recipient disabled", async () => {
    mockPrefsFindUnique.mockResolvedValue(prefs({ economicAlerts: false }));
    const id = await notificationAPI.create({
      title: "x",
      userId: "clerk_1",
      category: "economic",
    });
    expect(id).toBe("");
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("create delivers an enabled category", async () => {
    mockPrefsFindUnique.mockResolvedValue(prefs({ economicAlerts: false }));
    const id = await notificationAPI.create({ title: "x", userId: "clerk_1", category: "social" });
    expect(id).toBe("n1");
  });

  it("createMany drops only the suppressed rows", async () => {
    mockPrefsFindUnique.mockImplementation(async (args: any) =>
      args.where.userId === "clerk_off" ? prefs({ systemAlerts: false }) : null
    );
    await notificationAPI.createMany([
      { title: "a", userId: "clerk_off", category: "system" },
      { title: "b", userId: "clerk_on", category: "system" },
    ]);
    const data = (mockNotificationCreateMany.mock.calls[0]![0] as any).data;
    expect(data.map((d: any) => d.title)).toEqual(["b"]);
  });
});
