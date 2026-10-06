/** @jest-environment node */
/**
 * The WikiOS v1 switch (`WIKIOS_V1_ENABLED`, lib/wiki-os/v1-switch.ts). Off, an ordinary deploy is safe before
 * the cutover's operator steps: WikiOS takes no writes, api.php answers `readonly`, and the mirror, the
 * background renders and the parked-revision re-push do nothing, and full-text search does not read the search vector
 * the manual SQL fills. The other suites run with it on (setupTests.ts).
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiAccountLink: { findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn() },
    wikiBlock: { findMany: jest.fn() },
    wikiRevision: { count: jest.fn() },
    wikiRestriction: { findMany: jest.fn() },
    wikiMirrorJob: { findMany: jest.fn(), count: jest.fn() },
    wikiArticle: { findMany: jest.fn(), count: jest.fn() },
    $queryRawUnsafe: jest.fn(),
    systemConfig: { findUnique: jest.fn() },
  },
}));
jest.mock("~/lib/auth", () => ({ __esModule: true, isSystemOwner: () => true }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/wiki-os/api-compat/deps", () => ({ createApiDeps: jest.fn() }));
jest.mock("~/lib/system/job-lock", () => ({ withJobLock: jest.fn() }));

import { NextRequest } from "next/server";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import {
  assertWikiosWritable,
  decideAction,
  decideFilePageCreation,
  requireRight,
} from "~/lib/wiki-os/permissions";
import { rightsForGroups, type WikiPermissions } from "~/lib/wiki-os/rights";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { renderStaleBatch } from "~/lib/wiki-os/services/render-service";
import { repushSkippedParks } from "~/lib/wiki-os/services/inbound-revision-sync";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { db } from "~/server/db";

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

  it("allows them again once it is on", () => {
    process.env.WIKIOS_V1_ENABLED = "true";
    expect(decideAction({ ...request, action: "edit" })).toEqual({ allowed: true });
    expect(() => assertWikiosWritable()).not.toThrow();
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
