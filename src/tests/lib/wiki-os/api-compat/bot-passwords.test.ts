/** @jest-environment node */
/** Plan 410: Special:BotPasswords — creating (shown once, stored hashed), listing and deleting. */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiBotPassword: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { Prisma } from "@prisma/client";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { verifyBotPassword } from "~/lib/wiki-os/api-compat/auth";
import {
  MAX_BOT_PASSWORDS,
  createBotPassword,
  deleteBotPassword,
  listBotPasswords,
} from "~/lib/wiki-os/api-compat/bot-passwords";
import { db } from "~/server/db";

const bp = db.wikiBotPassword as unknown as Record<"findMany" | "findUnique" | "count" | "create" | "deleteMany", jest.Mock>;
const row = (overrides = {}) => ({
  id: "bp1",
  appId: "Pywikibot",
  grants: ["basic", "editpage"],
  createdAt: new Date("2026-09-30T00:00:00Z"),
  lastUsedAt: null,
  ...overrides,
});

async function refusal(work: Promise<unknown>): Promise<PageOperationError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof PageOperationError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

beforeEach(() => {
  jest.clearAllMocks();
  bp.findUnique.mockResolvedValue(null);
  bp.count.mockResolvedValue(0);
  bp.create.mockImplementation(async ({ data }: { data: { appId: string; grants: string[] } }) =>
    row({ appId: data.appId, grants: data.grants })
  );
});

describe("listBotPasswords", () => {
  it("lists a user's bot passwords without the hash and drops grants it does not know", async () => {
    bp.findMany.mockResolvedValue([row({ grants: ["basic", "retired-grant", "editpage"] })]);
    const list = await listBotPasswords("u1");
    expect(list).toEqual([row({ grants: ["basic", "editpage"] })]);
    expect(bp.findMany.mock.calls[0]![0].where).toEqual({ userId: "u1" });
    expect(JSON.stringify(bp.findMany.mock.calls[0]![0].select)).not.toContain("passwordHash");
  });
});

describe("createBotPassword", () => {
  it("returns a 32-character password once and stores only its scrypt hash", async () => {
    const created = await createBotPassword("u1", { appId: " Pywikibot ", grants: ["editpage"] });
    expect(created.password).toMatch(/^[A-Z2-7]{32}$/);
    const data = bp.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ userId: "u1", appId: "Pywikibot" });
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(data.passwordHash).not.toContain(created.password);
    expect(await verifyBotPassword(created.password, data.passwordHash)).toBe(true);
    expect(JSON.stringify(created.summary)).not.toContain(created.password);
  });

  it("always stores basic and keeps grants in the table's order", async () => {
    await createBotPassword("u1", { appId: "A", grants: ["delete", "editpage"] });
    expect(bp.create.mock.calls[0]![0].data.grants).toEqual(["basic", "editpage", "delete"]);
  });

  it("refuses a bad app id, an unknown grant, a duplicate and too many", async () => {
    expect((await refusal(createBotPassword("u1", { appId: "bad@id", grants: [] }))).code).toBe("BAD_REQUEST");
    expect((await refusal(createBotPassword("u1", { appId: "x".repeat(33), grants: [] }))).code).toBe("BAD_REQUEST");
    expect((await refusal(createBotPassword("u1", { appId: "ok", grants: ["root"] }))).code).toBe("BAD_REQUEST");

    bp.findUnique.mockResolvedValue({ id: "taken" });
    expect((await refusal(createBotPassword("u1", { appId: "ok", grants: [] }))).code).toBe("CONFLICT");

    bp.findUnique.mockResolvedValue(null);
    bp.count.mockResolvedValue(MAX_BOT_PASSWORDS);
    expect((await refusal(createBotPassword("u1", { appId: "ok", grants: [] }))).code).toBe("BAD_REQUEST");
    expect(bp.create).not.toHaveBeenCalled();
  });

  it("reports a lost race on the unique index as a conflict", async () => {
    bp.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })
    );
    expect((await refusal(createBotPassword("u1", { appId: "ok", grants: [] }))).code).toBe("CONFLICT");
  });
});

describe("deleteBotPassword", () => {
  it("deletes only the caller's own bot password", async () => {
    bp.deleteMany.mockResolvedValue({ count: 1 });
    await deleteBotPassword("u1", "bp1");
    expect(bp.deleteMany).toHaveBeenCalledWith({ where: { id: "bp1", userId: "u1" } });
  });

  it("says not found when nothing was deleted (someone else's, or already gone)", async () => {
    bp.deleteMany.mockResolvedValue({ count: 0 });
    expect((await refusal(deleteBotPassword("u1", "bp1"))).code).toBe("NOT_FOUND");
  });
});
