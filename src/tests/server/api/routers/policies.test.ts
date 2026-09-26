import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { policiesRouter } from "~/server/api/routers/policies";
import { notificationAPI } from "~/lib/notifications/api";

const notifSpy = jest.spyOn(notificationAPI, "create").mockResolvedValue({ success: true } as any);

type MockFn = any;

const mockDb = {
  $transaction: jest.fn(async (cb: any) => cb(mockDb)) as MockFn,
  policy: {
    create: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
    findUnique: jest.fn() as MockFn,
  },
  user: {
    findFirst: jest.fn() as MockFn,
  },
  activitySchedule: {
    create: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
    delete: jest.fn() as MockFn,
  },
  policyEffectLog: {
    findMany: jest.fn() as MockFn,
    create: jest.fn() as MockFn,
  },
  country: {
    findUnique: jest.fn() as MockFn,
  },
  storytellerEffect: {
    create: jest.fn() as MockFn,
    updateMany: jest.fn() as MockFn,
  },
  governmentStructure: {
    findUnique: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
  },
  cabinetMeeting: {
    create: jest.fn() as MockFn,
  },
  meetingDecision: {
    create: jest.fn() as MockFn,
  },
  meetingActionItem: {
    create: jest.fn() as MockFn,
  },
  countryEvent: {
    create: jest.fn() as MockFn,
  },
  countryEventConsequence: {
    createMany: jest.fn() as MockFn,
  },
};

const baseContext = {
  db: mockDb,
  user: { clerkUserId: "user_1", countryId: "country_1" },
  auth: { userId: "user_1" },
} as any;

describe("policiesRouter scheduling and notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (cb: any) => cb(mockDb));
    mockDb.storytellerEffect.create.mockResolvedValue({ id: "effect_1" });
    mockDb.storytellerEffect.updateMany.mockResolvedValue({ count: 1 });
  });

  it("activates policies and triggers real-time notifications", async () => {
    const policyRecord = {
      id: "policy_1",
      countryId: "country_1",
      name: "Infrastructure Renewal",
      category: "economic",
      status: "draft",
      priority: "critical",
    };

    mockDb.policy.findUnique.mockResolvedValue(policyRecord);
    mockDb.governmentStructure.findUnique.mockResolvedValue({ totalBudget: 1000000 });
    mockDb.governmentStructure.update.mockResolvedValue({});
    mockDb.cabinetMeeting.create.mockResolvedValue({ id: "meeting_1" });
    mockDb.meetingDecision.create.mockResolvedValue({ id: "decision_1" });
    mockDb.meetingActionItem.create.mockResolvedValue({ id: "action_item_1" });
    mockDb.countryEvent.create.mockResolvedValue({ id: "event_1" });
    mockDb.countryEventConsequence.createMany.mockResolvedValue({ count: 1 });
    mockDb.policy.update.mockResolvedValue({ ...policyRecord, status: "active" });
    mockDb.user.findFirst.mockResolvedValue({ clerkUserId: "user_1" });
    mockDb.country.findUnique.mockResolvedValue({ name: "Testland" });

    const caller = createCallerFactory(policiesRouter)(baseContext);

    const updated = await caller.activatePolicy({ id: "policy_1" });

    expect(updated.status).toBe("active");
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "📜 Policy Activated",
        countryId: "country_1",
        metadata: expect.objectContaining({ policyId: "policy_1" }),
      })
    );
  });
});
