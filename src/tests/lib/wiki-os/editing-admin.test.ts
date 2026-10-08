/** @jest-environment node */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn() },
    wikiMirrorJob: { count: jest.fn(async () => 2) },
  },
}));
jest.mock("~/lib/discord/admin-dm", () => ({ sendAdminDm: jest.fn(async () => undefined) }));

import { sendAdminDm } from "~/lib/discord/admin-dm";
import {
  __resetWikiosEditingCacheForTests,
  isWikiosEditingEnabled,
} from "~/lib/wiki-os/editing-switch";
import { getEditingStatus, setEditing } from "~/lib/wiki-os/services/editing-admin";
import { db } from "~/server/db";

const actor = { id: "u_admin", clerkUserId: "user_admin", name: "Admin" };
const audit = jest.fn(async () => ({}));
const tx = { adminAuditLog: { create: audit } };
const flush = () => new Promise((resolve) => setImmediate(resolve));
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  env = { ...process.env };
  delete process.env.WIKIOS_V1_ENABLED;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "Mirror@bot";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "secret";
  process.env.WIKIOS_MEDIAWIKI_API = "https://wiki.test/api.php";
  __resetWikiosEditingCacheForTests();
  jest.clearAllMocks();
  jest.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
});
afterEach(() => {
  process.env = env;
});

describe("editing admin", () => {
  it("reports status", async () => {
    await expect(getEditingStatus()).resolves.toEqual({
      enabled: false,
      forcedByEnv: false,
      mirrorConfigured: true,
      missing: [],
    });
  });

  it("refuses to switch on when the mirror is not configured", async () => {
    delete process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
    await expect(setEditing(tx as never, actor, true)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("switches on: writes the row, audits and DMs", async () => {
    const status = await setEditing(tx as never, actor, true);
    await flush();
    expect(status.enabled).toBe(true);
    expect(isWikiosEditingEnabled()).toBe(true);
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "wikios.editing.enable",
        targetType: "wikios",
        adminId: "u_admin",
        adminName: "Admin",
      }),
    });
    expect(sendAdminDm).toHaveBeenCalledWith(
      expect.stringContaining("WikiOS editing turned on by Admin")
    );
  });

  it("switching off mentions the mirror jobs still draining", async () => {
    jest.mocked(db.systemConfig.findUnique).mockResolvedValue({ value: "true" } as never);
    await setEditing(tx as never, actor, false);
    await flush();
    expect(sendAdminDm).toHaveBeenCalledWith(
      expect.stringMatching(/turned off by Admin.*2 mirror jobs/)
    );
  });

  it("is a no-op when nothing changes", async () => {
    await setEditing(tx as never, actor, false);
    await flush();
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    expect(sendAdminDm).not.toHaveBeenCalled();
  });

  it("cannot be switched off while WIKIOS_V1_ENABLED forces it on", async () => {
    process.env.WIKIOS_V1_ENABLED = "true";
    await expect(setEditing(tx as never, actor, false)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("a failing DM never fails the switch", async () => {
    jest.mocked(sendAdminDm).mockRejectedValueOnce(new Error("discord down"));
    await expect(setEditing(tx as never, actor, true)).resolves.toMatchObject({ enabled: true });
    await flush();
  });
});
