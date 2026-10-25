/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario (A5, Task 12 fix round 1): a quarantined inbound step never quietly undoes what classic MediaWiki did after
 * it, and never makes a false collision.
 *
 * - A quarantined log event is retried only while nothing later of its page (or user) has been applied: a retried
 *   delete would archive a page classic brought back, a retried grant would hand back rights classic took away, a
 *   retried unblock would lift a later block. Those are refused, and nothing changes; a log event nothing overtook still
 *   applies.
 * - A revision built on a quarantined one (R2 on R1, R1 quarantined) is a fast-forward over WikiOS's head, not a
 *   collision with it: no conflict row, nobody told. R1 retried later is filed as history.
 * - When the quarantined revision is the page's newest, "Resync page from classic" brings the page level with classic.
 *
 * Real auto-sync cycle, dead letters, revision sync and log events run over the in-memory WikiOS tables (Prisma mode)
 * and a MediaWiki that keeps state (fake-mediawiki-site.ts). Both WikiOS modes.
 */
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => {
  const fake = jest
    .requireActual("~/tests/helpers/fake-wiki-db")
    .createFakeWikiDb({ prisma: true });
  return { __esModule: true, fake, db: fake.db, isDatabaseReadOnly: true };
});
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn(), createMany: jest.fn().mockResolvedValue([]) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  renderArticleViaMediaWiki: jest.fn(async (wikitext: string) => ({
    html: `<p>${wikitext}</p>`,
    metadata: null,
  })),
}));

import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";
import { resyncQuarantined, retryQuarantined } from "~/lib/wiki-os/services/inbound-dead-letters";
import { PageOperationError } from "~/lib/wiki-os/core/page-operation-error";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const realFetch = global.fetch;
let site: ReturnType<typeof createFakeMediaWikiSite>;

const article = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const revisionsOf = (title: string) =>
  tables.wikiRevision.rows.filter((row) => row.articleId === article(title)?.id);
/** The page's head as WikiOS reads it: its newest live revision by time. */
const liveHead = (title: string) =>
  revisionsOf(title)
    .filter((row) => !row.parked)
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .at(-1)!;
const deadLetter = (stepKey: string) =>
  tables.wikiSyncDeadLetter.rows.find((row) => row.stepKey === stepKey);
const config = (key: string) => tables.systemConfig.rows.find((row) => row.key === key);

const PAGE_STALE = new PageOperationError(
  "CONFLICT",
  "A later classic change of this page was applied; retrying would undo it. Dismiss it instead."
);
const USER_STALE = new PageOperationError(
  "CONFLICT",
  "A later classic change of this user was applied; retrying would undo it. Dismiss it instead."
);

interface SiteEvent {
  logid: number;
  type: string;
  action: string;
  title: string;
  user: string;
  timestamp: string;
  comment: string;
  params: Record<string, unknown>;
  logpage?: number;
}

/** A log event as the cycle reads it (fetchLogEventsPage), which is what a dead letter keeps. */
const asRead = (event: SiteEvent) => ({
  logid: event.logid,
  type: event.type,
  action: event.action,
  title: event.title,
  user: event.user,
  timestamp: event.timestamp,
  comment: event.comment,
  params: event.params,
  ...(event.logpage ? { pageId: event.logpage } : {}),
});

/**
 * `event` as a step the cycle quarantined (five failed cycles): its row, and the log mark already past it. Returns
 * the row's id.
 */
function quarantined(event: SiteEvent): string {
  const mark = `${event.timestamp}|${event.logid}`;
  const row = tables.wikiSyncDeadLetter.insert({
    stepKey: `log:${event.logid}`,
    stream: "log",
    subject: event.title,
    label: `${event.type}/${event.action} ${event.title}`,
    mark,
    payload: asRead(event),
    attempts: 5,
    lastError: "db down",
    quarantinedAt: new Date(),
  });
  const logMark = config("wikiAutoSync.logHighWater")!;
  logMark.value = mark;
  return row.id;
}

let nextLogid = 500;
/** A rights or block event on MediaWiki, a second after the site's last write. */
function userEvent(
  type: string,
  action: string,
  title: string,
  params: Record<string, unknown>,
  offsetSeconds: number
): SiteEvent {
  const event: SiteEvent = {
    logid: nextLogid++,
    type,
    action,
    title,
    user: "Steward",
    timestamp: new Date(Date.parse(site.now()) + offsetSeconds * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    comment: "",
    params,
  };
  site.logEvents.push(event as never);
  return event;
}

beforeEach(() => {
  fake.reset();
  wikiBridgeCache.clear();
  jest.clearAllMocks();
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  site = createFakeMediaWikiSite();
  global.fetch = site.fetch as never;

  // Caphiria and Old page as both wikis have them: MediaWiki's revisions are WikiOS's stamped heads
  for (const [title, text] of [
    ["Caphiria", "Caphiria is a kingdom."],
    ["Old page", "An old page."],
  ] as const) {
    const revision = site.editAs("Founder", title, text);
    const row = tables.wikiArticle.insert({
      title,
      slug: title.toLowerCase().replace(/ /g, "_"),
      wikitext: text,
      mwPageId: site.pages.get(title)!.pageid,
      mwLatestRevId: revision.revid,
      htmlSyncedAt: new Date("2026-09-01"),
    });
    tables.wikiRevision.insert({
      articleId: row.id,
      wikitext: text,
      byteSize: text.length,
      mwRevId: revision.revid,
      sha1: mwSha1Base36(text),
      author: "Founder",
      origin: "classic",
      createdAt: new Date("2026-09-01"),
    });
  }
  tables.systemConfig.seed(
    { key: "wikiAutoSync.rcHighWater", value: site.now() },
    { key: "wikiAutoSync.logHighWater", value: site.now() }
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

describe.each(WIKIOS_MODES)("a quarantined inbound step [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  let consoleError: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    restoreMode();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  describe("a log event overtaken by a later classic change is refused (C1)", () => {
    it("a delete classic undid since (restored, then edited) does not archive the page", async () => {
      site.deletePage("Admin", "Old page");
      const deletion = site.logEvents.at(-1)! as SiteEvent;
      const id = quarantined(deletion);
      site.restorePage("Admin", "Old page");
      site.editAs("Bob", "Old page", "Old page is back.");
      await runAutoSyncCycle();
      expect(article("Old page")).toMatchObject({ status: "PUBLISHED" });

      await expect(retryQuarantined(id)).rejects.toEqual(PAGE_STALE);

      expect(article("Old page")).toMatchObject({
        status: "PUBLISHED",
        wikitext: "Old page is back.",
      });
      expect(deadLetter(`log:${deletion.logid}`)).toMatchObject({ resolvedAt: null });
    });

    it("a sysop grant classic revoked since is not handed back", async () => {
      const grant = userEvent(
        "rights",
        "rights",
        "User:Zed",
        { oldgroups: [], newgroups: ["sysop"] },
        1
      );
      const id = quarantined(grant);
      userEvent("rights", "rights", "User:Zed", { oldgroups: ["sysop"], newgroups: [] }, 2);
      await runAutoSyncCycle();
      const groupsBefore = tables.wikiUserGroup.rows.map((row) => ({ ...row }));

      await expect(retryQuarantined(id)).rejects.toEqual(USER_STALE);

      expect(tables.wikiUserGroup.rows).toEqual(groupsBefore);
      expect(tables.wikiUserGroup.rows.some((row) => row.group === "sysop")).toBe(false);
    });

    it("an unblock overtaken by a later block does not lift the block", async () => {
      const unblock = userEvent("block", "unblock", "User:Vandal", {}, 1);
      const id = quarantined(unblock);
      userEvent("block", "block", "User:Vandal", { sitewide: true, expiry: "infinite" }, 2);
      await runAutoSyncCycle();
      expect(tables.wikiBlock.rows).toHaveLength(1);

      await expect(retryQuarantined(id)).rejects.toEqual(USER_STALE);

      expect(tables.wikiBlock.rows).toEqual([
        expect.objectContaining({ wikiUsername: "Vandal", source: "mw-import" }),
      ]);
    });

    it("a log event nothing overtook still applies, and its row is resolved", async () => {
      const block = userEvent("block", "block", "User:Vandal", { sitewide: true }, 1);
      const id = quarantined(block);
      await runAutoSyncCycle();
      expect(tables.wikiBlock.rows).toHaveLength(0);

      await expect(retryQuarantined(id)).resolves.toBe("applied");

      expect(tables.wikiBlock.rows).toEqual([
        expect.objectContaining({ wikiUsername: "Vandal", source: "mw-import" }),
      ]);
      expect(deadLetter(`log:${block.logid}`)).toMatchObject({ resolvedAt: expect.any(Date) });
    });
  });

  /** Five cycles in which revision `revid`'s text cannot be read (its hash still can): it is quarantined. */
  const quarantineByCycles = async (revid: number) => {
    const siteFetch = site.fetch;
    global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const params = new URL(String(input)).searchParams;
      const textRead =
        params.get("revids") === String(revid) && params.get("rvprop") !== "ids|sha1";
      return textRead ? new Response("{}", { status: 500 }) : siteFetch(input, init);
    }) as never;
    for (let cycle = 0; cycle < 5; cycle++) await runAutoSyncCycle();
    global.fetch = siteFetch as never;
    expect(deadLetter(`rc:${revid}`)).toMatchObject({ quarantinedAt: expect.any(Date) });
  };

  it("a revision built on a quarantined one fast-forwards: no conflict, nobody told, and the quarantined one is history once retried (I2)", async () => {
    const r1 = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    const r2 = site.editAs("Bob", "Caphiria", "Caphiria is an empire in Sarpedon.");

    await quarantineByCycles(r1.revid);

    expect(liveHead("Caphiria")).toMatchObject({ mwRevId: r2.revid, parked: false });
    expect(article("Caphiria")).toMatchObject({ wikitext: "Caphiria is an empire in Sarpedon." });
    expect(tables.wikiConflict.rows).toEqual([]);
    expect(article("User talk:Founder")).toBeUndefined();
    expect(tables.wikiMirrorJob.rows).toEqual([]);

    const retried = await retryQuarantined(deadLetter(`rc:${r1.revid}`)!.id);

    expect(retried).toBe("applied");
    expect(revisionsOf("Caphiria").find((row) => row.mwRevId === r1.revid)).toBeDefined();
    expect(liveHead("Caphiria")).toMatchObject({ mwRevId: r2.revid });
    expect(tables.wikiConflict.rows).toEqual([]);
  });

  it("resyncing the page of a quarantined newest revision brings WikiOS level with classic (I3)", async () => {
    const r1 = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    await quarantineByCycles(r1.revid);
    expect(article("Caphiria")).toMatchObject({ wikitext: "Caphiria is a kingdom." });

    await expect(resyncQuarantined(deadLetter(`rc:${r1.revid}`)!.id)).resolves.toBe("applied");

    expect(article("Caphiria")).toMatchObject({ wikitext: "Caphiria is an empire." });
    expect(liveHead("Caphiria")).toMatchObject({ mwRevId: r1.revid });
    expect(deadLetter(`rc:${r1.revid}`)).toMatchObject({ resolvedAt: expect.any(Date) });
  });
});
