import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

import {
  assemblePackages,
  classifyGoal,
  weightAcceptance,
} from "~/lib/intent/assemble";
import { generateIntentSummationDraft } from "~/lib/intent/intent-summation";

describe("Intent System & Package Assembly", () => {
  it("correctly classifies domestic goals without regex rejection on capitalized words", () => {
    const goals = [
      { text: "Transition to Green Energy", expected: "infrastructure" },
      { text: "Provide subsidies to Clean Energy Startups", expected: "fiscal" },
      { text: "Invest with High Speed Rail Transit", expected: "infrastructure" },
      { text: "Expand healthcare access to Rural Communities", expected: "social" },
      { text: "Boost military defense readiness", expected: "defense" },
      { text: "Crack down on urban crime and corruption", expected: "security" },
      { text: "Create industrial manufacturing jobs", expected: "economy" },
    ];

    for (const g of goals) {
      const { category } = classifyGoal(g.text);
      expect(category).toBe(g.expected);
    }
  });

  it("blocks explicit bilateral foreign military or diplomatic treaties", () => {
    const foreignGoals = [
      "Prepare for war with Burgundie",
      "Sign military alliance with Urcea",
      "Open embassy in Morstaybishlia",
      "Impose sanctions on enemy state",
      "Declare war against hostile nation",
    ];

    for (const g of foreignGoals) {
      expect(() => classifyGoal(g)).toThrow("Cabinet Directives are restricted to domestic policy");
    }
  });

  it("assembles all 5 packages with valid consequences and zero forbidden fields", () => {
    const result = assemblePackages("Build modern public transit network");
    expect(result.category).toBe("infrastructure");
    expect(result.packages).toHaveLength(5);

    const tiers = result.packages.map((p) => p.tier);
    expect(tiers).toEqual([
      "measured",
      "moderate",
      "extreme",
      "broker_unlocked",
      "structural_unlocked",
    ]);

    for (const pkg of result.packages) {
      expect(pkg.changes.length).toBeLessThanOrEqual(4);
      expect(pkg.civCapCost).toBeGreaterThan(0);
    }
  });

  it("weights stakeholder acceptance based on aligned power broker status", () => {
    expect(weightAcceptance("bad", { brokerUnlocked: true })).toBe("mid");
    expect(weightAcceptance("good", { brokerUnlocked: true })).toBe("good");
    expect(weightAcceptance("mid", {})).toBe("mid");
  });
});

describe("ThinkPages Intent Auto-Summation", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      intent: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: "intent_123",
          goal: "Transition to Clean Energy",
          tier: "moderate",
          category: "infrastructure",
          changesJson: JSON.stringify([
            { label: "Public Works budget +2 notches" },
            { label: 'Enact "Infrastructure Program"' },
          ]),
          summary: "The government pursued Transition to Clean Energy.",
        }),
      },
      country: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: "country_456",
          name: "Sanctaria",
          slug: "sanctaria",
          flag: "https://example.com/flag.png",
        }),
      },
      thinkpagesAccount: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(null),
        create: jest.fn<() => Promise<any>>().mockImplementation((args: any) =>
          Promise.resolve({
            id: "account_789",
            ...args.data,
          })
        ),
      },
      user: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({
          clerkUserId: "user_clerk_123",
        }),
      },
      thinkpagesPost: {
        create: jest.fn<() => Promise<any>>().mockImplementation((args: any) =>
          Promise.resolve({
            id: "post_999",
            ...args.data,
          })
        ),
      },
    };
  });

  it("generates a draft summation post with official government account structure", async () => {
    const res = await generateIntentSummationDraft({
      db: mockDb,
      intentId: "intent_123",
      countryId: "country_456",
      visibility: "draft",
    });

    expect(res).not.toBeNull();
    expect(res?.postId).toBe("post_999");
    expect(res?.accountId).toBe("account_789");
    expect(res?.visibility).toBe("draft");

    expect(mockDb.thinkpagesAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountType: "GOVERNMENT",
          username: "gov_sanctaria",
          displayName: "Sanctaria Executive",
          clerkUserId: "user_clerk_123",
          verified: true,
        }),
      })
    );

    expect(mockDb.thinkpagesPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account_789",
          visibility: "draft",
          isAutoGenerated: true,
        }),
      })
    );
  });
});
