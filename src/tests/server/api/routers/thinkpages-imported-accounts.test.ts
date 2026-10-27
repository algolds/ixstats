/** @jest-environment node */
/**
 * ThinkPages usernames held by IxTwitter-imported accounts (owner `system_ixtwitter_*`) used to
 * block every member from that name forever. They are now claimable: creating a persona with the
 * name transfers the imported row (and its post history) to the member. Nation-bound imports
 * (verified) can only be claimed for their own nation. Also covers the new "corporate" type.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { canClaimImportedAccount } from "~/server/shared/thinkpages-imported-accounts";

jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByPattern: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

const CLERK_ID = "test_user_clerk_id";
const MY_COUNTRY = "test_country_1";
const createAccountsCaller = createCallerFactory(thinkpagesAccountsRouter);

const memberUser = {
  clerkUserId: CLERK_ID,
  countryId: MY_COUNTRY,
  role: { name: "member", level: 100 },
};

const personaInput = {
  countryId: MY_COUNTRY,
  accountType: "citizen" as const,
  username: "oldhandle",
  firstName: "Some",
};

function imported(overrides: Record<string, unknown> = {}) {
  return {
    id: "imp1",
    clerkUserId: "system_ixtwitter_handle_oldhandle",
    countryId: "placeholder_country",
    verified: false,
    username: "oldhandle",
    profileImageUrl: "https://cdn.discordapp.com/avatar.png",
    ...overrides,
  };
}

describe("canClaimImportedAccount", () => {
  it("lets anyone claim a Former Nation import, but a nation-bound one only for that nation", () => {
    expect(canClaimImportedAccount(imported(), MY_COUNTRY)).toBe(true);
    expect(canClaimImportedAccount(imported(), undefined)).toBe(true);
    const bound = imported({ verified: true, countryId: "kiravia" });
    expect(canClaimImportedAccount(bound, "kiravia")).toBe(true);
    expect(canClaimImportedAccount(bound, MY_COUNTRY)).toBe(false);
    expect(canClaimImportedAccount(bound, undefined)).toBe(false);
  });

  it("never treats a member-owned account as claimable", () => {
    expect(canClaimImportedAccount(imported({ clerkUserId: "user_other" }), MY_COUNTRY)).toBe(
      false
    );
  });
});

describe("username availability and claiming IxTwitter imports", () => {
  let db: any;
  beforeEach(() => {
    db = createMockPrisma();
    db.thinkpagesAccount.findMany.mockResolvedValue([]);
    db.thinkpagesAccount.findUnique.mockResolvedValue(null);
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: any) => ({
      id: "new",
      ...data,
    }));
    db.thinkpagesAccount.updateMany.mockResolvedValue({ count: 1 });
    db.thinkpagesAccount.findUniqueOrThrow.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      clerkUserId: CLERK_ID,
    }));
    db.country.findUnique.mockResolvedValue({ id: MY_COUNTRY });
  });

  const caller = () =>
    createAccountsCaller(createMockRouterContext({ db, user: memberUser }) as never);

  it("reports an unclaimed import's name as available and claimable", async () => {
    db.thinkpagesAccount.findUnique.mockResolvedValue(imported());
    await expect(
      caller().checkUsernameAvailability({ username: "oldhandle", countryId: MY_COUNTRY })
    ).resolves.toEqual({ isAvailable: true, claimable: true });
  });

  it("still reports a member-owned name as taken", async () => {
    db.thinkpagesAccount.findUnique.mockResolvedValue(imported({ clerkUserId: "user_other" }));
    await expect(
      caller().checkUsernameAvailability({ username: "oldhandle", countryId: MY_COUNTRY })
    ).resolves.toEqual({ isAvailable: false, claimable: false });
  });

  it("claims the imported row in place instead of failing with 'taken'", async () => {
    db.thinkpagesAccount.findUnique.mockResolvedValue(imported());
    const result = await caller().createAccount(personaInput);

    expect(db.thinkpagesAccount.create).not.toHaveBeenCalled();
    const { where, data } = db.thinkpagesAccount.updateMany.mock.calls[0][0];
    // Guarded on the synthetic owner so a concurrent claim cannot steal it twice
    expect(where).toEqual({ id: "imp1", clerkUserId: "system_ixtwitter_handle_oldhandle" });
    expect(data).toMatchObject({
      clerkUserId: CLERK_ID,
      countryId: MY_COUNTRY,
      accountType: "citizen",
      verified: false,
      isActive: true,
      profileImageUrl: "https://cdn.discordapp.com/avatar.png",
    });
    expect(result).toMatchObject({ id: "imp1", clerkUserId: CLERK_ID });
  });

  it("returns CONFLICT when someone else claimed it first", async () => {
    db.thinkpagesAccount.findUnique.mockResolvedValue(imported());
    db.thinkpagesAccount.updateMany.mockResolvedValue({ count: 0 });
    await expect(caller().createAccount(personaInput)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to claim another nation's import", async () => {
    db.thinkpagesAccount.findUnique.mockResolvedValue(
      imported({ verified: true, countryId: "kiravia" })
    );
    await expect(caller().createAccount(personaInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.thinkpagesAccount.updateMany).not.toHaveBeenCalled();
  });

  it("accepts the corporate account type", async () => {
    const result = await caller().createAccount({
      ...personaInput,
      username: "acmecorp",
      accountType: "corporate",
    });
    expect(result).toMatchObject({ accountType: "corporate", username: "acmecorp" });
  });
});
