/** @jest-environment node */
/**
 * SL-7: the activity producers that remain are the ones a real game event calls. Each one
 * records a typed ActivityFeed row and never throws (a failed write is logged, the action that
 * triggered it carries on).
 */
const mockDb = {
  country: { findUnique: jest.fn() },
  activityFeed: { create: jest.fn() },
  user: { findFirst: jest.fn().mockResolvedValue(null) },
};
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/event-bus", () => ({ eventBus: { publish: jest.fn() } }));
jest.mock("~/lib/notifications", () => ({
  notificationHooks: { onDiplomaticEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { ActivityHooks, economicTierRank } from "~/lib/activity/hooks";

function lastActivity() {
  return mockDb.activityFeed.create.mock.calls.at(-1)![0].data as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.country.findUnique.mockResolvedValue({ name: "Arcadia" });
  mockDb.activityFeed.create.mockResolvedValue({ id: "a1" });
});

describe("ActivityHooks producers", () => {
  it("alliance formed is a diplomatic entry for the founder", async () => {
    await ActivityHooks.Diplomatic.onAllianceFormed("c1", "Northern Pact", "military", "clerk_1");
    expect(lastActivity()).toMatchObject({
      type: "diplomatic",
      countryId: "c1",
      userId: "clerk_1",
      title: "Arcadia Founds the Northern Pact",
      relatedCountries: JSON.stringify(["c1"]),
    });
  });

  it("alliance joined is a diplomatic entry", async () => {
    await ActivityHooks.Diplomatic.onAllianceJoined("c2", "Northern Pact");
    expect(lastActivity()).toMatchObject({ type: "diplomatic", countryId: "c2", userId: null });
    expect(JSON.parse(lastActivity().metadata as string)).toMatchObject({
      eventType: "alliance_joined",
    });
  });

  it("a law with an economic effect files under Economic, others under Achievements", async () => {
    await ActivityHooks.Government.onLawPassed("c1", "Tariff Act", 0.5);
    expect(lastActivity().type).toBe("economic");
    await ActivityHooks.Government.onLawPassed("c1", "Flag Act", 0);
    expect(lastActivity().type).toBe("achievement");
  });

  it("an economic tier change is an economic milestone, worded by direction", async () => {
    await ActivityHooks.Economic.onEconomicTierChange("c1", "Developing", "Developed");
    expect(lastActivity()).toMatchObject({
      type: "economic",
      title: "Arcadia Rises to Developed Status",
      priority: "high",
    });
    await ActivityHooks.Economic.onEconomicTierChange("c1", "Strong", "Healthy");
    expect(lastActivity()).toMatchObject({ title: "Arcadia Falls to Healthy Status" });
  });

  it("never throws when the write fails", async () => {
    mockDb.activityFeed.create.mockRejectedValue(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      ActivityHooks.Diplomatic.onAllianceFormed("c1", "Pact", "economic")
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("writes nothing for an unknown country", async () => {
    mockDb.country.findUnique.mockResolvedValue(null);
    await ActivityHooks.Government.onLawPassed("missing", "Act", 1);
    expect(mockDb.activityFeed.create).not.toHaveBeenCalled();
  });

  it("keeps only producers with a caller", () => {
    expect(Object.keys(ActivityHooks).sort()).toEqual([
      "Diplomatic",
      "Economic",
      "Government",
      "User",
    ]);
  });
});

describe("economicTierRank", () => {
  it("orders tiers from Impoverished up and ranks unknown names lowest", () => {
    expect(economicTierRank("Impoverished")).toBe(0);
    expect(economicTierRank("Extravagant")).toBeGreaterThan(economicTierRank("Strong"));
    expect(economicTierRank("Nonsense")).toBe(-1);
  });
});
