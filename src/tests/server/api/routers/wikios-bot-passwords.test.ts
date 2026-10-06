/** @jest-environment node */
// Plan 410: the Special:BotPasswords router needs a signed-in user with a verified wiki link.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn().mockResolvedValue([]) },
    wikiBlock: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRevision: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({ __esModule: true, isSystemOwner: () => false }));
jest.mock("~/lib/wiki-os/storage", () => ({
  __esModule: true,
  getVerifiedWikiLink: jest.fn(),
}));
jest.mock("~/lib/wiki-os/api-compat/bot-passwords", () => ({
  __esModule: true,
  listBotPasswords: jest.fn(),
  createBotPassword: jest.fn(),
  deleteBotPassword: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosBotPasswordsRouter } from "~/server/api/routers/wikios/bot-passwords";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getVerifiedWikiLink } from "~/lib/wiki-os/storage";
import {
  createBotPassword,
  deleteBotPassword,
  listBotPasswords,
} from "~/lib/wiki-os/api-compat/bot-passwords";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";

const createCaller = createCallerFactory(wikiosBotPasswordsRouter);
const signedIn = () =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
    }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getVerifiedWikiLink).mockResolvedValue({
    username: "Heku",
    verifiedById: null,
    mwRegisteredAt: null,
    mwEditCount: null,
  });
});

describe("wikiosBotPasswordsRouter", () => {
  it("refuses a signed-out caller", async () => {
    const anonymous = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(anonymous.listBotPasswords()).rejects.toThrow(/Authentication required/);
    await expect(anonymous.createBotPassword({ appId: "x", grants: [] })).rejects.toThrow(
      /Authentication required/
    );
    expect(createBotPassword).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("needs a verified wiki link, for every procedure", async () => {
    jest.mocked(getVerifiedWikiLink).mockResolvedValue(null);
    await expect(signedIn().listBotPasswords()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(signedIn().createBotPassword({ appId: "x", grants: [] })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(signedIn().deleteBotPassword({ id: "bp1" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(createBotPassword).not.toHaveBeenCalled();
  });

  it("lists the caller's bot passwords with the grants on offer and their wiki name", async () => {
    jest.mocked(listBotPasswords).mockResolvedValue([]);
    const result = await signedIn().listBotPasswords();
    expect(listBotPasswords).toHaveBeenCalledWith("db1");
    expect(result.wikiUsername).toBe("Heku");
    expect(result.grants.map((g) => g.grant)).toContain("editpage");
  });

  it("creates one and returns the login name and the password", async () => {
    jest.mocked(createBotPassword).mockResolvedValue({
      summary: { id: "bp1", appId: "Pywikibot", grants: ["basic"], createdAt: new Date(), lastUsedAt: null },
      password: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    });
    const result = await signedIn().createBotPassword({ appId: "Pywikibot", grants: ["editpage"] });
    expect(createBotPassword).toHaveBeenCalledWith("db1", { appId: "Pywikibot", grants: ["editpage"] });
    expect(result).toEqual({
      id: "bp1",
      appId: "Pywikibot",
      loginName: "Heku@Pywikibot",
      password: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    });
  });

  it("rejects an unknown grant at validation and maps a service refusal to a tRPC error", async () => {
    await expect(
      signedIn().createBotPassword({ appId: "x", grants: ["root" as never] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    jest.mocked(createBotPassword).mockRejectedValue(new PageOperationError("CONFLICT", "taken"));
    await expect(signedIn().createBotPassword({ appId: "x", grants: [] })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "taken",
    });
  });

  it("deletes the caller's own bot password", async () => {
    jest.mocked(deleteBotPassword).mockResolvedValue(undefined);
    expect(await signedIn().deleteBotPassword({ id: "bp1" })).toEqual({ success: true });
    expect(deleteBotPassword).toHaveBeenCalledWith("db1", "bp1");
  });
});
