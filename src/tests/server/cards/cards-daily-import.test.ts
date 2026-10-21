/** @jest-environment node */
/**
 * The daily lore import queues a job per switched-on wiki, once a day; nothing goes live (cards refresh spec §2.1).
 * A wiki whose draw fails queues nothing and fails the cron run by name, after the other wikis are queued
 * (spike-sources.md, rule 5).
 */
jest.mock("~/server/modules/cards/cards.import-jobs", () => ({ createImportJob: jest.fn() }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findMany: jest.fn() },
    cardImportJob: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock("~/lib/cards/lore-card-discovery", () => ({
  loreCardDiscovery: { fetchRandomArticlesWithImages: jest.fn() },
}));

import { db as appDb } from "~/server/db";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { createImportJob } from "~/server/modules/cards/cards.import-jobs";
import {
  queueDailyImports,
  queueDailyLoreImports,
} from "~/server/modules/cards/cards.daily-import";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const create = jest.mocked(createImportJob);
const setting = (key: string, enabled: boolean, count: number) => ({
  key,
  value: JSON.stringify({ enabled, count }),
});
const quiet = () => jest.spyOn(console, "error").mockImplementation(() => undefined);

beforeEach(() => jest.clearAllMocks());

describe("queueDailyImports", () => {
  it("queues image-required jobs for the switched-on wikis, leaving out pages with a card", async () => {
    const db = createMockPrisma({
      $queryRaw: jest.fn().mockResolvedValue([{ key: "carded page" }]),
    });
    db.systemConfig.findMany.mockResolvedValue([
      setting("card_daily_import_ixwiki", false, 20),
      setting("card_daily_import_iiwiki", true, 2),
    ]);
    const random = jest
      .fn()
      .mockResolvedValue(["Carded_page", "Fresh one", "Fresh two", "Fresh three"]);
    const run = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledWith(6, "iiwiki");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(db, {
      source: "iiwiki",
      kind: "DAILY",
      label: "Daily IIWiki import",
      titles: ["Fresh one", "Fresh two"],
      requestedBy: null,
      requireImage: true,
    });
    expect(run).toEqual({ queued: { iiwiki: 2 }, failed: {} });
  });

  it("draws again while it has too few fresh pages, at most five times, counting a page once", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([
      setting("card_daily_import_ixwiki", true, 30),
      setting("card_daily_import_iiwiki", false, 20),
    ]);
    const random = jest
      .fn()
      .mockResolvedValueOnce(["Elm", "Oak"])
      .mockResolvedValue(["elm", "Ash"]);
    const run = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(5);
    expect(random).toHaveBeenCalledWith(90, "ixwiki");
    expect(create).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        source: "ixwiki",
        label: "Daily IxWiki import",
        titles: ["Elm", "Oak", "Ash"],
      })
    );
    expect(run.queued).toEqual({ ixwiki: 3 });
  });

  it("queues nothing for a wiki that gives no pages, or one set to zero a day", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([
      setting("card_daily_import_ixwiki", true, 0),
      setting("card_daily_import_iiwiki", true, 20),
    ]);
    const random = jest.fn().mockResolvedValue([]);
    const run = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledWith(60, "iiwiki");
    expect(create).not.toHaveBeenCalled();
    expect(run).toEqual({ queued: { iiwiki: 0 }, failed: {} });
  });

  it("queues one batch a day: a wiki with a daily job since UTC midnight is skipped", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([]);
    db.cardImportJob.findFirst.mockImplementation(
      async ({ where }: { where: { source: string } }) =>
        where.source === "ixwiki" ? { id: "job_today" } : null
    );
    const random = jest.fn().mockResolvedValue(["Elm"]);
    const run = await queueDailyImports(db as never, random, new Date("2026-10-17T02:00:05Z"));

    expect(db.cardImportJob.findFirst).toHaveBeenCalledWith({
      where: {
        kind: "DAILY",
        source: "ixwiki",
        createdAt: { gte: new Date("2026-10-17T00:00:00Z") },
      },
      select: { id: true },
    });
    expect(random).toHaveBeenCalledTimes(5);
    expect(random.mock.calls.every(([, source]) => source === "iiwiki")).toBe(true);
    expect(run).toEqual({ queued: { iiwiki: 1 }, failed: {} });
  });

  it("goes on to the next wiki when one fails, and names the wiki in the reason", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([]);
    const error = quiet();
    const failure = new Error("connection reset");
    const random = jest.fn().mockRejectedValueOnce(failure).mockResolvedValue(["Elm"]);
    const run = await queueDailyImports(db as never, random);
    expect(run).toEqual({ queued: { iiwiki: 1 }, failed: { ixwiki: "IxWiki: connection reset" } });
    expect(error).toHaveBeenCalledWith("[Daily card import] ixwiki failed:", failure);
    error.mockRestore();
  });
});

describe("queueDailyLoreImports", () => {
  const random = jest.mocked(loreCardDiscovery.fetchRandomArticlesWithImages);

  beforeEach(() => {
    jest.mocked(appDb.systemConfig.findMany).mockResolvedValue([] as never);
    jest.mocked(appDb.cardImportJob.findFirst).mockResolvedValue(null as never);
    jest.mocked(appDb.$queryRaw).mockResolvedValue([] as never);
  });

  /** IxWiki answers with a page; IIWiki fails its draw with `failure`. */
  const iiwikiFails = (failure: Error) =>
    random.mockImplementation(async (_count, source) => {
      if (source === "iiwiki") throw failure;
      return ["Elm"];
    });

  it("queues the other wikis, then fails the run naming a wiki that refused its draw", async () => {
    const error = quiet();
    iiwikiFails(
      new DiscoveryStopped({
        kind: "blocked",
        status: 403,
        message: "iiwiki refused the request (HTTP 403)",
      })
    );
    await expect(queueDailyLoreImports()).rejects.toThrow(
      "Daily card import failed: IIWiki stopped answering (HTTP 403)."
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(appDb, expect.objectContaining({ source: "ixwiki" }));
    error.mockRestore();
  });

  it("fails the run naming a wiki whose draw got an HTTP error, with that wiki's reason", async () => {
    const error = quiet();
    iiwikiFails(new Error("IIWiki answered HTTP 503."));
    await expect(queueDailyLoreImports()).rejects.toThrow(
      "Daily card import failed: IIWiki answered HTTP 503."
    );
    expect(create).toHaveBeenCalledWith(appDb, expect.objectContaining({ source: "ixwiki" }));
    error.mockRestore();
  });

  it("joins the failed wikis' reasons into one sentence", async () => {
    const error = quiet();
    random.mockImplementation(async (_count, source) => {
      if (source === "ixwiki") throw new Error("connection reset");
      throw new DiscoveryStopped({ kind: "blocked", status: 403, message: "iiwiki refused" });
    });
    await expect(queueDailyLoreImports()).rejects.toMatchObject({
      message:
        "Daily card import failed: IxWiki: connection reset; IIWiki stopped answering (HTTP 403).",
    });
    expect(create).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("returns what it queued when every wiki's draw answers", async () => {
    random.mockResolvedValue(["Elm"]);
    await expect(queueDailyLoreImports()).resolves.toEqual({ ixwiki: 1, iiwiki: 1 });
    expect(random).toHaveBeenCalledWith(60, "ixwiki");
    expect(random).toHaveBeenCalledWith(60, "iiwiki");
  });
});
