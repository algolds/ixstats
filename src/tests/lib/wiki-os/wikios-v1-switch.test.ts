/** @jest-environment node */
/**
 * The WikiOS v1 cutover and the editing switch: until it is on, every page action and every write with no page check
 * of its own (rights, imports, bot passwords, api.php) is refused with MediaWiki's readonly code before anything is
 * read, the mirror applies no job and drains what is pending once it goes off, nothing renders in the background and no
 * parked revision is pushed back. The switch row is cached and kept when a read fails; only a configured mirror may
 * turn it on, WIKIOS_V1_ENABLED forces it on and keeps it on, and every change is audited and its DM best effort.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiAccountLink: { findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn() },
    wikiBlock: { findMany: jest.fn() },
    wikiRevision: { count: jest.fn() },
    wikiRestriction: { findMany: jest.fn() },
    wikiMirrorJob: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    wikiArticle: { findMany: jest.fn(), count: jest.fn() },
    $queryRawUnsafe: jest.fn(),
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));
jest.mock("~/lib/auth", () => ({ __esModule: true, isSystemOwner: () => true }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/wiki-os/api-compat/deps", () => ({ createApiDeps: jest.fn() }));
jest.mock("~/lib/system/job-lock", () => ({ withJobLock: jest.fn() }));
jest.mock("~/lib/wiki-os/services/staged-uploads", () => ({
  ...jest.requireActual("~/lib/wiki-os/services/staged-uploads"),
  sweepStagedOrphansIfDue: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/discord/admin-dm", () => ({ sendAdminDm: jest.fn(async () => undefined) }));

import { NextRequest } from "next/server";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import { assertWikiosWritable, decideAction, decideFilePageCreation, requireRight } from "~/lib/wiki-os/permissions";
import { rightsForGroups, type WikiPermissions } from "~/lib/wiki-os/rights";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { __resetWikiosEditingCacheForTests, isWikiosEditingEnabled, isWikiosEditingForcedByEnv, refreshWikiosEditingFlag, WIKIOS_EDITING_KEY } from "~/lib/wiki-os/editing-switch";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { renderStaleBatch } from "~/lib/wiki-os/services/render-service";
import { repushSkippedParks } from "~/lib/wiki-os/services/inbound-revision-sync";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { db } from "~/server/db";
import type { SystemConfig } from "@prisma/client";
import { sendAdminDm } from "~/lib/discord/admin-dm";
import { setEditing } from "~/lib/wiki-os/services/editing-admin";

const sysop: WikiPermissions = {
  groups: ["*", "user", "sysop"],
  rights: rightsForGroups(["*", "user", "sysop"]),
  block: null,
  verifiedWikiUsername: "Admin",
};
const request = { title: "Aurelia", permissions: sysop, restrictions: [], now: new Date() };

let was: string | undefined;
beforeEach(() => {
  was = process.env.WIKIOS_V1_ENABLED;
  delete process.env.WIKIOS_V1_ENABLED;
  jest.clearAllMocks();
  // the editing switch is off (no row) and the outbox empty unless a test says otherwise
  __resetWikiosEditingCacheForTests();
  jest.mocked(db.systemConfig.findUnique).mockResolvedValue(null as never);
  jest.mocked(db.wikiMirrorJob.count).mockResolvedValue(0 as never);
  jest.mocked(db.wikiMirrorJob.findMany).mockResolvedValue([] as never);
  jest.mocked(db.wikiMirrorJob.updateMany).mockResolvedValue({ count: 0 } as never);
  jest.mocked(db.wikiMirrorJob.deleteMany).mockResolvedValue({ count: 0 } as never);
});
afterEach(() => {
  process.env.WIKIOS_V1_ENABLED = was;
});

describe("the switch", () => {
  it("is off unless set to 1, true, on or yes", () => {
    expect(isWikiosV1Enabled()).toBe(false);
    for (const value of ["", "0", "false", "off", "no", "enabled", "tru"]) {
      process.env.WIKIOS_V1_ENABLED = value;
      expect(isWikiosV1Enabled()).toBe(false);
    }
    for (const value of ["1", "true", "TRUE", " on ", "yes"]) {
      process.env.WIKIOS_V1_ENABLED = value;
      expect(isWikiosV1Enabled()).toBe(true);
    }
  });
});

describe("off: WikiOS is read-only", () => {
  it("refuses every page action, even a sysop's, with MediaWiki's readonly code", () => {
    for (const action of ["edit", "create", "move", "delete", "protect", "upload"] as const) {
      expect(decideAction({ ...request, action })).toMatchObject({
        allowed: false,
        code: "readonly",
      });
    }
    expect(decideFilePageCreation(request)).toMatchObject({ allowed: false, code: "readonly" });
  });

  it("refuses the writes with no page check of their own (rights, imports, bot passwords) before reading anything", async () => {
    expect(() => assertWikiosWritable()).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    const ctx = { userId: "user_1" } as unknown as WikiAuthContext;
    await expect(requireRight(ctx, "block")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.wikiUserGroup.findMany).not.toHaveBeenCalled();
  });
  it("api.php answers readonly to every request, without reading it", async () => {
    const route = await import("~/app/w/api.php/route");
    for (const req of [
      new NextRequest("http://localhost:3000/w/api.php?action=query&meta=siteinfo&format=json"),
      new NextRequest("http://localhost:3000/w/api.php", { method: "POST", body: "action=login" }),
    ]) {
      const response = await (req.method === "POST" ? route.POST(req) : route.GET(req));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "readonly" } });
      expect(req.bodyUsed).toBe(false);
    }
  });
});

describe("off: the cron work that writes to MediaWiki or renders through it does nothing", () => {
  it("the mirror applies no outbox job", async () => {
    await expect(runMirrorCycle()).resolves.toMatchObject({ skipped: true, done: 0 });
    expect(db.wikiMirrorJob.findMany).not.toHaveBeenCalled();
  });

  it("the background render renders nothing", async () => {
    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 0, failed: 0 });
    expect(db.wikiArticle.findMany).not.toHaveBeenCalled();
  });

  it("no parked revision is pushed back to MediaWiki", async () => {
    await expect(repushSkippedParks()).resolves.toBe(0);
    expect(db.systemConfig.findUnique).not.toHaveBeenCalled();
  });
});

describe("off: full-text search", () => {
  it("answers from the old query, not the search vector that is empty until the manual SQL runs", async () => {
    jest.mocked(db.wikiArticle.findMany).mockResolvedValue([]);
    jest.mocked(db.wikiArticle.count).mockResolvedValue(0);

    await expect(NativeSearchService.fulltextSearch("Aurelia")).resolves.toEqual({
      results: [],
      total: 0,
    });
    expect(db.wikiArticle.findMany).toHaveBeenCalledTimes(1);
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

describe("admin editing switch (WIKIOS_V1_ENABLED off)", () => {
  let skipSync: string | undefined;
  beforeEach(() => {
    skipSync = process.env.SKIP_MEDIAWIKI_SYNC;
    delete process.env.SKIP_MEDIAWIKI_SYNC;
  });
  afterEach(() => {
    if (skipSync === undefined) delete process.env.SKIP_MEDIAWIKI_SYNC;
    else process.env.SKIP_MEDIAWIKI_SYNC = skipSync;
  });

  async function editing(on: boolean) {
    jest
      .mocked(db.systemConfig.findUnique)
      .mockResolvedValue({ value: on ? "true" : "false" } as never);
    await refreshWikiosEditingFlag(true);
  }

  it("allows writes when the switch is on", async () => {
    await editing(true);
    expect(decideAction({ ...request, action: "edit" })).toEqual({ allowed: true });
    expect(decideFilePageCreation(request)).toEqual({ allowed: true });
    expect(() => assertWikiosWritable()).not.toThrow();
  });

  it("refuses writes with readonly when the switch is off", async () => {
    await editing(false);
    expect(decideAction({ ...request, action: "edit" })).toMatchObject({
      allowed: false,
      code: "readonly",
    });
    expect(() => assertWikiosWritable()).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("an async entry reads the switch itself, so a cold cache does not refuse a write", async () => {
    jest.mocked(db.systemConfig.findUnique).mockResolvedValue({ value: "true" } as never);
    const ctx = { auth: { userId: null }, user: null } as never;
    // requireRight awaits the read, passes the readonly gate, and only then reaches the rights check
    await expect(requireRight(ctx, "block")).rejects.toMatchObject({
      message: expect.stringContaining('You do not have the "block" right.'),
    });
    expect(db.systemConfig.findUnique).toHaveBeenCalledTimes(1);
  });

  it("the v1 switch forces it on without reading the row", async () => {
    process.env.WIKIOS_V1_ENABLED = "true";
    await expect(refreshWikiosEditingFlag()).resolves.toBe(true);
    expect(db.systemConfig.findUnique).not.toHaveBeenCalled();
  });

  it("the mirror runs when the switch is on", async () => {
    await editing(true);
    const result = await runMirrorCycle({ maxJobs: 1 });
    expect(result.skipped).toBe(false);
  });

  it("the mirror drains pending jobs after the switch goes off", async () => {
    await editing(false);
    jest.mocked(db.wikiMirrorJob.count).mockResolvedValue(3 as never);
    const result = await runMirrorCycle({ maxJobs: 1 });
    expect(result.skipped).toBe(false);
    expect(db.wikiMirrorJob.count).toHaveBeenCalledWith({
      where: { source: "ixwiki", state: { in: ["pending", "running"] } },
    });
  });
});

describe("the editing switch", () => {
  const findUnique = jest.mocked(db.systemConfig.findUnique);
  const upsert = jest.mocked(db.systemConfig.upsert);

  /** The row the switch reads; only `value` matters to it. */
  const configRow = (value: string): SystemConfig => ({
    id: "cfg_wikios_editing",
    key: WIKIOS_EDITING_KEY,
    value,
    description: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });

  let was: string | undefined;
  beforeEach(() => {
    was = process.env.WIKIOS_V1_ENABLED;
    delete process.env.WIKIOS_V1_ENABLED;
    __resetWikiosEditingCacheForTests();
    jest.clearAllMocks();
    findUnique.mockReset().mockResolvedValue(null);
    upsert.mockReset().mockResolvedValue(configRow("false"));
    jest.useRealTimers();
  });
  afterEach(() => {
    if (was === undefined) delete process.env.WIKIOS_V1_ENABLED;
    else process.env.WIKIOS_V1_ENABLED = was;
  });

  describe("editing switch", () => {
    it("is forced on by WIKIOS_V1_ENABLED", () => {
      process.env.WIKIOS_V1_ENABLED = "true";
      expect(isWikiosEditingForcedByEnv()).toBe(true);
      expect(isWikiosEditingEnabled()).toBe(true);
    });
    it("keeps the last value when the read fails", async () => {
      findUnique.mockResolvedValueOnce(configRow("true"));
      await refreshWikiosEditingFlag();
      findUnique.mockRejectedValueOnce(new Error("db down"));
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
    it("a stale synchronous read starts a background refresh", async () => {
      findUnique.mockResolvedValue(configRow("true"));
      expect(isWikiosEditingEnabled()).toBe(false);
      await new Promise((r) => setImmediate(r));
      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(isWikiosEditingEnabled()).toBe(true);
    });
  });
});

describe("switching editing on and off", () => {
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
    // two mirror jobs still wait in the outbox
    jest.mocked(db.wikiMirrorJob.count).mockResolvedValue(2 as never);
  });
  afterEach(() => {
    process.env = env;
  });

  describe("editing admin", () => {
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
});
