/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// requireWikiUserId returns the internal User id (since 2026-08-22); it used to return the Clerk id.
// Blurbs looked the user up by Clerk id with the internal id ("User not found"), and stashes written
// under the Clerk id vanished from the stash list. These tests pin both fixes.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    blurbPrompt: { findUnique: jest.fn() },
    blurbResponse: { findUnique: jest.fn(), create: jest.fn() },
    thinkpagesAccount: { findFirst: jest.fn() },
    thinkpagesPost: { create: jest.fn() },
    stash: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    stashItem: { upsert: jest.fn(), findMany: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { blurbsRespondRouter } from "~/server/api/routers/blurbs/respond";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

const mockDb = db as unknown as {
  user: { findFirst: jest.Mock };
  blurbPrompt: { findUnique: jest.Mock };
  blurbResponse: { findUnique: jest.Mock; create: jest.Mock };
  thinkpagesAccount: { findFirst: jest.Mock };
  thinkpagesPost: { create: jest.Mock };
  stash: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  stashItem: { upsert: jest.Mock };
};

const ctx = () =>
  createMockRouterContext({
    auth: { userId: "user_clerk_1" },
    user: {
      id: "db_user_1",
      clerkUserId: "user_clerk_1",
      countryId: "country_1",
      role: { name: "user", level: 100 },
    },
  }) as never;

describe("blurbs.submitResponse identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Only the Clerk id finds the user, as in production (findWikiUserByAuthId matches clerkUserId).
    mockDb.user.findFirst.mockImplementation(async (args: { where: { clerkUserId?: string } }) =>
      args.where.clerkUserId === "user_clerk_1" ? { id: "db_user_1", countryId: "country_1" } : null
    );
    mockDb.blurbPrompt.findUnique.mockResolvedValue({
      id: "prompt_1",
      status: "ACTIVE",
      slug: "p",
      title: "Prompt",
    });
    mockDb.blurbResponse.findUnique.mockResolvedValue(null);
    mockDb.thinkpagesAccount.findFirst.mockResolvedValue({ id: "acct_1" });
    mockDb.thinkpagesPost.create.mockResolvedValue({ id: "post_1" });
    mockDb.blurbResponse.create.mockImplementation(async (args: { data: unknown }) => args.data);
  });

  it("finds the signed-in user by Clerk id and saves the dispatch under the internal id", async () => {
    const caller = createCallerFactory(blurbsRespondRouter)(ctx());
    const result = await caller.submitResponse({ promptId: "prompt_1", content: "Hello" });

    expect(mockDb.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: "user_clerk_1" } })
    );
    expect(result).toMatchObject({ userId: "db_user_1", countryId: "country_1" });
    // The ThinkPages cross-post looks the account up by Clerk id, too.
    expect(mockDb.thinkpagesAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: "user_clerk_1", countryId: "country_1" } })
    );
    expect(result).toMatchObject({ thinkpagesPostId: "post_1" });
  });
});

describe("wikios stash identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists stashes keyed by the internal id and by the legacy Clerk id", async () => {
    mockDb.stash.findMany.mockResolvedValue([
      {
        id: "legacy",
        name: "My Stash",
        color: "#000",
        icon: null,
        isDefault: true,
        order: 0,
        _count: { items: 3 },
      },
    ]);
    const caller = createCallerFactory(wikiosStashRouter)(ctx());
    const stashes = await caller.getStashes();

    expect(mockDb.stash.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ["db_user_1", "user_clerk_1"] } } })
    );
    expect(stashes).toEqual([expect.objectContaining({ id: "legacy", itemCount: 3 })]);
  });

  it("stashes into the legacy default stash instead of creating a second one", async () => {
    mockDb.stash.findFirst.mockResolvedValue({ id: "legacy", userId: "user_clerk_1" });
    mockDb.stashItem.upsert.mockResolvedValue({});
    const caller = createCallerFactory(wikiosStashRouter)(ctx());
    const result = await caller.stashPage({ pageTitle: "Caphiria" });

    expect(result).toEqual({ success: true, stashId: "legacy" });
    expect(mockDb.stash.create).not.toHaveBeenCalled();
  });

  it("does not stash into a named stash that belongs to someone else", async () => {
    mockDb.stash.findFirst.mockResolvedValue(null);
    mockDb.stashItem.upsert.mockClear();
    const caller = createCallerFactory(wikiosStashRouter)(ctx());

    await expect(caller.stashPage({ pageTitle: "Caphiria", stashId: "other" })).rejects.toThrow(
      "Stash not found"
    );
    expect(mockDb.stash.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other", userId: { in: ["db_user_1", "user_clerk_1"] } },
      })
    );
    expect(mockDb.stashItem.upsert).not.toHaveBeenCalled();
  });

  it("does not delete a stash that belongs to someone else", async () => {
    mockDb.stash.findUnique.mockResolvedValue({
      id: "other",
      userId: "user_clerk_2",
      isDefault: false,
    });
    const caller = createCallerFactory(wikiosStashRouter)(ctx());
    await expect(caller.deleteStash({ id: "other" })).rejects.toThrow("Stash not found");
  });
});
