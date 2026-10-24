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
import { isWikiosV1Enabled, WIKIOS_PROTECTIONS_MARKER_KEY, WIKIOS_PROTECTIONS_REASON } from "~/lib/wiki-os/v1-switch";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";
import { assertWikiosWritable, decideAction, decideFilePageCreation, requireRight } from "~/lib/wiki-os/permissions";
import { rightsForGroups, type WikiPermissions } from "~/lib/wiki-os/rights";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { __resetWikiosEditingCacheForTests, isWikiosEditingEnabled, isWikiosEditingForcedByEnv, refreshWikiosEditingFlag, WIKIOS_EDITING_KEY, wikiosProtectionsImported } from "~/lib/wiki-os/editing-switch";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { renderStaleBatch } from "~/lib/wiki-os/services/render-service";
import { repushSkippedParks } from "~/lib/wiki-os/services/inbound-revision-sync";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { db } from "~/server/db";
import type { SystemConfig } from "@prisma/client";
import { sendAdminDm } from "~/lib/discord/admin-dm";
import { getEditingStatus, setEditing } from "~/lib/wiki-os/services/editing-admin";

const sysop: WikiPermissions = {
  groups: ["*", "user", "sysop"],
  rights: rightsForGroups(["*", "user", "sysop"]),
  block: null,
  ownUserNames: ["Admin"],
};
const request = { title: "Aurelia", permissions: sysop, restrictions: [], now: new Date() };

/** The marker the rights import writes once the protections exist (scripts/wikios-import-rights.ts). */
const markerRow = { value: JSON.stringify({ at: "2026-10-24T00:00:00.000Z", restrictions: 3 }) };
const isMarker = (args: { where: { key: string } }) =>
  args.where.key === WIKIOS_PROTECTIONS_MARKER_KEY;
/** `findUnique` answering the marker row and `flag` for the editing switch row. */
const answerRows =
  (flag: { value: string } | null) =>
  async (args: { where: { key: string } }) =>
    isMarker(args) ? markerRow : flag;

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
    // the switch row and the protections marker
    expect(db.systemConfig.findUnique).toHaveBeenCalledTimes(2);
  });

  it("the v1 switch forces it on over a switch row that is off, once the marker is read", async () => {
    process.env.WIKIOS_V1_ENABLED = "true";
    jest
      .mocked(db.systemConfig.findUnique)
      .mockImplementation(answerRows({ value: "false" }) as never);
    await expect(refreshWikiosEditingFlag()).resolves.toBe(true);
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
    findUnique.mockReset().mockImplementation(answerRows(null) as never);
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
      findUnique.mockImplementation(answerRows(configRow("true")) as never);
      await refreshWikiosEditingFlag();
      findUnique.mockRejectedValueOnce(new Error("db down"));
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
    it("keeps the last value when the read rejects with something other than an Error", async () => {
      findUnique.mockRejectedValueOnce("db down");
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await expect(refreshWikiosEditingFlag(true)).resolves.toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("editing switch"), "db down");
      warn.mockRestore();
    });
    it("a stale synchronous read starts a background refresh", async () => {
      findUnique.mockImplementation(answerRows(configRow("true")) as never);
      expect(isWikiosEditingEnabled()).toBe(false);
      await new Promise((r) => setImmediate(r));
      expect(findUnique).toHaveBeenCalledTimes(2);
      expect(isWikiosEditingEnabled()).toBe(true);
    });
  });
});

describeEachWikiosMode("the protections marker", (mode) => {
  const findUnique = jest.mocked(db.systemConfig.findUnique);
  /** The mode's rows without the marker: what the database holds before the rights import. */
  function withoutMarker() {
    const modeRows = findUnique.getMockImplementation()!;
    findUnique.mockImplementation(((args: { where: { key: string } }) =>
      isMarker(args) ? Promise.resolve(null) : modeRows(args as never)) as never);
  }

  it("v1 on with no marker refuses a save with the protections reason", async () => {
    withoutMarker();
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(false);
    expect(decideAction({ ...request, action: "edit" })).toEqual({
      allowed: false,
      code: "readonly",
      reason: WIKIOS_PROTECTIONS_REASON,
    });
    expect(decideFilePageCreation(request)).toMatchObject({ reason: WIKIOS_PROTECTIONS_REASON });
    expect(() => assertWikiosWritable()).toThrow(WIKIOS_PROTECTIONS_REASON);
    const route = await import("~/app/w/api.php/route");
    const response = await route.GET(
      new NextRequest("http://localhost:3000/w/api.php?action=query&meta=siteinfo&format=json")
    );
    expect(await response.json()).toMatchObject({
      error: { code: "readonly", info: WIKIOS_PROTECTIONS_REASON },
    });
  });

  it("the marker row lets both modes write", async () => {
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
    expect(wikiosProtectionsImported()).toBe(true);
    expect(decideAction({ ...request, action: "edit" })).toEqual({ allowed: true });
    expect(() => assertWikiosWritable()).not.toThrow();
  });

  /** The mode's rows, but the marker read rejects. */
  function markerReadFails() {
    const modeRows = findUnique.getMockImplementation()!;
    findUnique.mockImplementation(((args: { where: { key: string } }) =>
      isMarker(args) ? Promise.reject(new Error("db down")) : modeRows(args as never)) as never);
  }

  it("counts editing as on before any read, refuses an awaited write whose marker read failed, and allows it once the marker is read", async () => {
    // the synchronous check before the first read (the editing-switch mode has not read its row either)
    expect(isWikiosEditingEnabled()).toBe(mode === "v1");
    await refreshWikiosEditingFlag(); // let the background read it started settle
    __resetWikiosEditingCacheForTests();

    const modeRows = findUnique.getMockImplementation()!;
    markerReadFails();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("protections marker"), "db down");
    warn.mockRestore();
    expect(decideAction({ ...request, action: "edit" })).toEqual({
      allowed: false,
      code: "readonly",
      reason: WIKIOS_PROTECTIONS_REASON,
    });
    const ctx = { auth: { userId: null }, user: null } as never;
    await expect(requireRight(ctx, "block")).rejects.toThrow(WIKIOS_PROTECTIONS_REASON);

    findUnique.mockImplementation(modeRows);
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
    expect(decideAction({ ...request, action: "edit" })).toEqual({ allowed: true });
  });

  it("keeps a marker it has read when a later read fails", async () => {
    await refreshWikiosEditingFlag(true);
    markerReadFails();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
    warn.mockRestore();
    expect(wikiosProtectionsImported()).toBe(true);
  });

  it("a successful read with no row turns it off", async () => {
    await refreshWikiosEditingFlag(true);
    withoutMarker();
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(false);
    expect(wikiosProtectionsImported()).toBe(false);
    expect(isWikiosEditingEnabled()).toBe(false);
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
    // the rights import has run (the marker row) and the switch row is off (none)
    jest.mocked(db.systemConfig.findUnique).mockImplementation(answerRows(null) as never);
    // two mirror jobs still wait in the outbox
    jest.mocked(db.wikiMirrorJob.count).mockResolvedValue(2 as never);
  });
  afterEach(() => {
    process.env = env;
  });

  describe("editing admin", () => {
    it("the admin switch refuses to turn on before the protections import", async () => {
      jest.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
      // the protections come first, even when the mirror is not configured either
      delete process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
      await expect(setEditing(tx as never, actor, true)).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Run the protections import first (runbook steps 1 and 1b).",
      });
      expect(db.systemConfig.upsert).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
    });

    it("reports whether the protections import has run", async () => {
      await expect(getEditingStatus()).resolves.toMatchObject({ protectionsImported: true });
      jest.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
      await expect(getEditingStatus()).resolves.toMatchObject({ protectionsImported: false });
    });

    it("switches off a switch row left on while editing waits for the protections import", async () => {
      // the row says on, the marker is missing: editing waits, and would start by itself once the import runs
      jest.mocked(db.systemConfig.findUnique).mockImplementation((async (args: {
        where: { key: string };
      }) => (isMarker(args) ? null : { value: "true" })) as never);
      await expect(getEditingStatus()).resolves.toMatchObject({
        enabled: false,
        switchOn: true,
        protectionsImported: false,
      });

      const status = await setEditing(tx as never, actor, false);
      await flush();
      expect(db.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { value: "false" } })
      );
      expect(audit).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "wikios.editing.disable",
          changes: JSON.stringify({ from: true, to: false }),
        }),
      });
      expect(status).toMatchObject({ enabled: false, switchOn: false });
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
      jest
        .mocked(db.systemConfig.findUnique)
        .mockImplementation(answerRows({ value: "true" }) as never);
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
