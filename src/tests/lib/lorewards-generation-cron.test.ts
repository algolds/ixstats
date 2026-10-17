/** @jest-environment node */
/**
 * The daily Lore cron stages through the importer (cards refresh §2.4): every card waits in review, a failure is
 * counted, a skip is not, and a wiki that stops answering ends only its own run.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { syncLog: { create: jest.fn() } },
}));
jest.mock("~/lib/cards/lore-card-discovery", () => ({
  loreCardDiscovery: { fetchRandomArticlesWithImages: jest.fn() },
}));
jest.mock("~/server/modules/cards/cards.importer", () => ({
  oneOffImportContext: jest.fn(),
  stageArticleCard: jest.fn(),
}));

import { db } from "~/server/db";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { generateDailyLoreCards } from "~/lib/lorewards/generation-cron";
import {
  oneOffImportContext,
  stageArticleCard,
  type StageOutcome,
} from "~/server/modules/cards/cards.importer";

const random = jest.mocked(loreCardDiscovery.fetchRandomArticlesWithImages);
const stage = jest.mocked(stageArticleCard);
const context = { query: jest.fn(), thresholds: {} };

const OUTCOMES: Record<string, StageOutcome> = {
  A: { status: "STAGED", cardId: "card_a", rarity: "RARE", licence: null },
  B: { status: "FAILED", reason: "socket hang up" },
  C: { status: "SKIPPED", reason: "Already a card" },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.mocked(oneOffImportContext).mockResolvedValue(context as never);
  random
    .mockResolvedValueOnce(["A", "B", "C"]) // ixwiki, first attempt
    .mockResolvedValueOnce([]) // ixwiki has no more
    .mockResolvedValue(["X", "Y"]); // iiwiki
  stage.mockImplementation(async (_db, source, input) => {
    if (source === "iiwiki") {
      throw new DiscoveryStopped({ kind: "blocked", status: 403, message: "iiwiki refused" });
    }
    return OUTCOMES[input.title]!;
  });
});

describe("generateDailyLoreCards", () => {
  it("stages image-bearing pages, counting and logging failures but not skips", async () => {
    const result = await generateDailyLoreCards();

    expect(result).toMatchObject({
      success: true,
      generated: 1,
      ixwikiCount: 1,
      iiwikiCount: 0,
      failed: 1,
      rarityBreakdown: { RARE: 1 },
    });
    expect(result.errors).toEqual([
      'Failed to stage "B": socket hang up',
      "Error staging cards from iiwiki: DiscoveryStopped: iiwiki refused",
    ]);
    expect(stage).toHaveBeenCalledWith(
      db,
      "ixwiki",
      { title: "A", requestedBy: null, jobId: null, requireImage: true },
      context
    );
    expect(random).toHaveBeenCalledWith(5, "ixwiki");
    expect(console.error).toHaveBeenCalledWith(
      '[Lore Card Cron] Failed to stage "B": socket hang up'
    );
  });

  it("gives each wiki one licence client sized to its run, and stops a wiki that stops answering", async () => {
    await generateDailyLoreCards();

    expect(oneOffImportContext).toHaveBeenCalledWith(db, "ixwiki", 300);
    expect(oneOffImportContext).toHaveBeenCalledWith(db, "iiwiki", 300);
    // iiwiki refused its first page: no second page, no second attempt.
    expect(stage.mock.calls.filter(([, source]) => source === "iiwiki")).toHaveLength(1);
    expect(random.mock.calls.filter(([, source]) => source === "iiwiki")).toHaveLength(1);
    expect(jest.mocked(db.syncLog.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemsProcessed: 2, itemsFailed: 1 }),
    });
  });
});
