/** @jest-environment node */
/**
 * WK-11: the ThinkPages account limit comes from Admin → ThinkPages.
 * WK-10: the ThinkPages → Discord feed configuration can be saved.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { adminThinkpagesDiscordFeedRouter } from "~/server/api/routers/admin/thinkpagesDiscordFeed";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { maxThinkpagesAccountsPerUser } from "~/server/shared/thinkpages-config";

const adminCtx = (db: unknown) =>
  createMockRouterContext({
    auth: { userId: "admin_1" },
    user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    db,
  });

const newAccount = {
  countryId: "c1",
  accountType: "citizen" as const,
  username: "newbie",
  firstName: "New",
};

describe("ThinkPages account limit (WK-11)", () => {
  it("defaults to 25 and reads the admin key", async () => {
    const db = createMockPrisma();
    expect(await maxThinkpagesAccountsPerUser(db as never)).toBe(25);
    db.systemConfig.findUnique.mockResolvedValue({ value: "3" });
    expect(await maxThinkpagesAccountsPerUser(db as never)).toBe(3);
    expect(db.systemConfig.findUnique.mock.calls[0]![0].where).toEqual({
      key: "thinkpages_maxAccountsPerUser",
    });
  });

  it("createAccount refuses once the configured limit is reached", async () => {
    const db = createMockPrisma();
    db.systemConfig.findUnique.mockResolvedValue({ value: "2" });
    db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    const caller = createCallerFactory(thinkpagesAccountsRouter)(
      createMockRouterContext({ db }) as never
    );

    await expect(caller.createAccount(newAccount)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You have reached the maximum of 2 ThinkPages accounts per user",
    });
    expect(db.thinkpagesAccount.create).not.toHaveBeenCalled();
  });

  it("getAccountLimit exposes the configured limit", async () => {
    const db = createMockPrisma();
    db.systemConfig.findUnique.mockResolvedValue({ value: "40" });
    const caller = createCallerFactory(thinkpagesAccountsRouter)(
      createMockRouterContext({ db }) as never
    );
    expect(await caller.getAccountLimit()).toBe(40);
  });
});

describe("saveThinkpagesDiscordFeedConfig (WK-10)", () => {
  it("rejects non-admins", async () => {
    const db = createMockPrisma();
    const caller = createCallerFactory(adminThinkpagesDiscordFeedRouter)(
      createMockRouterContext({
        db,
        user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
      }) as never
    );
    await expect(caller.saveThinkpagesDiscordFeedConfig({ enabled: true })).rejects.toThrow();
    expect(db.thinkpagesDiscordFeedConfig.update).not.toHaveBeenCalled();
  });

  it("switches the feed on and stores lists as JSON", async () => {
    const db = createMockPrisma();
    db.thinkpagesDiscordFeedConfig.findUnique.mockResolvedValue({ id: "default" });
    const caller = createCallerFactory(adminThinkpagesDiscordFeedRouter)(adminCtx(db) as never);

    await caller.saveThinkpagesDiscordFeedConfig({
      enabled: true,
      minEngagement: 3,
      hashtagBlocklist: ["spam"],
    });
    expect(db.thinkpagesDiscordFeedConfig.update).toHaveBeenCalledWith({
      where: { id: "default" },
      data: { enabled: true, minEngagement: 3, hashtagBlocklist: '["spam"]' },
    });
  });

  it("rejects a channel id that is not a Discord snowflake", async () => {
    const db = createMockPrisma();
    const caller = createCallerFactory(adminThinkpagesDiscordFeedRouter)(adminCtx(db) as never);
    await expect(
      caller.saveThinkpagesDiscordFeedConfig({ channelId: "not-a-channel" })
    ).rejects.toThrow();
  });
});
