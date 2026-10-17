/** @jest-environment node */
/** A card definition a NationStates import creates waits for review; a region sync's card names its sync. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/nationstates/api-client", () => ({
  nsApiClient: { fetchCardDump: jest.fn(), parseNSDump: jest.fn() },
}));

import { nsApiClient } from "~/lib/nationstates/api-client";
import {
  nsCardDefinitionData,
  processRegionCardsFromDump,
} from "~/lib/nationstates/sync-processor";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const elm = {
  id: "123",
  season: "3",
  name: "Elm",
  rarity: "RARE",
  region: "Lazarus",
  market_value: "0.5",
  govt: "Centrist",
  flag: "https://www.nationstates.net/images/flags/elm.png",
};

describe("nsCardDefinitionData", () => {
  it("lands pending review and records the sync that created it", () => {
    const data = nsCardDefinitionData(elm, {
      importedFrom: "region:Lazarus",
      rarity: "RARE",
      marketValue: 100,
      syncLogId: "log_1",
    });
    expect(data).toMatchObject({
      id: "card_ns_123_s3",
      title: "Elm",
      artwork: elm.flag,
      cardType: "NS",
      realmId: "nationstates",
      rarity: "RARE",
      season: 3,
      reviewState: "PENDING",
      nsCardId: 123,
      nsSeason: 3,
      totalSupply: 1,
      marketValue: 100,
      metadata: { importedFrom: "region:Lazarus", syncLogId: "log_1" },
    });
    expect(data.metadata).toMatchObject({
      nsData: {
        id: "123",
        name: "Elm",
        flag: elm.flag,
        region: "Lazarus",
        season: "3",
        market_value: "0.5",
      },
    });
  });

  it("names no sync for a card a deck import creates, and shows the placeholder without a flag", () => {
    const data = nsCardDefinitionData(
      { ...elm, flag: undefined },
      { importedFrom: "Testlandia", rarity: "COMMON", marketValue: 5, syncLogId: null }
    );
    expect(data).toMatchObject({
      reviewState: "PENDING",
      artwork: "/images/cards/lore-placeholder.svg",
    });
    expect(data.metadata).not.toHaveProperty("syncLogId");
  });
});

/**
 * A SyncLog an admin can stop mid-run. An `update` always lands; an `updateMany` only while the log's status is one
 * its `where` names. Only the status and the message are kept.
 */
function stoppableLog(db: ReturnType<typeof createMockPrisma>) {
  const log: { status: string; errorMessage: string | null } = {
    status: "IN_PROGRESS",
    errorMessage: null,
  };
  const write = (data: Partial<typeof log>) => {
    if (data.status !== undefined) log.status = data.status;
    if (data.errorMessage !== undefined) log.errorMessage = data.errorMessage;
  };
  db.syncLog.findUnique.mockImplementation(async () => ({ status: log.status, metadata: {} }));
  db.syncLog.update.mockImplementation(async ({ data }: { data: Partial<typeof log> }) => {
    write(data);
    return log;
  });
  db.syncLog.updateMany.mockImplementation(
    async ({ where, data }: { where: { status: { in: string[] } }; data: Partial<typeof log> }) => {
      if (!where.status.in.includes(log.status)) return { count: 0 };
      write(data);
      return { count: 1 };
    }
  );
  const stop = () => Object.assign(log, { status: "FAILED", errorMessage: "Stopped by an admin" });
  return { log, stop };
}

describe("processRegionCardsFromDump", () => {
  it("keeps an admin's stop when the dumps it went on reading match no card", async () => {
    const db = createMockPrisma();
    const { log, stop } = stoppableLog(db);
    jest.mocked(nsApiClient.fetchCardDump).mockImplementation(async () => {
      stop();
      return "<xml/>" as never;
    });
    jest.mocked(nsApiClient.parseNSDump).mockResolvedValue([] as never);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await processRegionCardsFromDump(db as never, "log_1", ["lazarus"], [3]);

    expect(log).toEqual({ status: "FAILED", errorMessage: "Stopped by an admin" });
    jest.mocked(console.warn).mockRestore();
  });

  it("still fails a run whose dumps match no card when no one stopped it", async () => {
    const db = createMockPrisma();
    const { log } = stoppableLog(db);
    jest.mocked(nsApiClient.fetchCardDump).mockResolvedValue("<xml/>" as never);
    jest.mocked(nsApiClient.parseNSDump).mockResolvedValue([] as never);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await processRegionCardsFromDump(db as never, "log_1", ["lazarus"], [3]);

    expect(log).toMatchObject({
      status: "FAILED",
      errorMessage: "No cards matched the requested region(s) in the card dumps.",
    });
    jest.mocked(console.warn).mockRestore();
  });

  it("keeps an admin's stop that lands after the last card's check", async () => {
    const db = createMockPrisma();
    const { log, stop } = stoppableLog(db);
    jest.mocked(nsApiClient.fetchCardDump).mockResolvedValue("<xml/>" as never);
    jest.mocked(nsApiClient.parseNSDump).mockResolvedValue([elm] as never);
    db.card.create.mockImplementation(async () => {
      stop();
      return { id: "card_ns_123_s3" };
    });

    await processRegionCardsFromDump(db as never, "log_1", ["lazarus"], [3]);

    expect(log).toEqual({ status: "FAILED", errorMessage: "Stopped by an admin" });
  });

  it("finishes a run paused after the last card's check, since no card is left to resume", async () => {
    const db = createMockPrisma();
    const { log } = stoppableLog(db);
    jest.mocked(nsApiClient.fetchCardDump).mockResolvedValue("<xml/>" as never);
    jest.mocked(nsApiClient.parseNSDump).mockResolvedValue([elm] as never);
    db.card.create.mockImplementation(async () => {
      log.status = "PAUSED";
      return { id: "card_ns_123_s3" };
    });

    await processRegionCardsFromDump(db as never, "log_1", ["lazarus"], [3]);

    expect(log).toEqual({ status: "SUCCESS", errorMessage: null });
  });

  it("creates each new card of the region waiting for review, under the sync's id", async () => {
    jest.mocked(nsApiClient.fetchCardDump).mockResolvedValue("<xml/>" as never);
    jest
      .mocked(nsApiClient.parseNSDump)
      .mockResolvedValue([elm, { ...elm, id: "124", region: "Balder" }] as never);
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });
    db.card.create.mockResolvedValue({ id: "card_ns_123_s3" });

    await processRegionCardsFromDump(db as never, "log_1", ["lazarus"], [3]);

    expect(db.card.create).toHaveBeenCalledTimes(1);
    expect(db.card.create.mock.calls[0]![0].data).toMatchObject({
      nsCardId: 123,
      reviewState: "PENDING",
      metadata: { importedFrom: "region:lazarus", syncLogId: "log_1" },
    });
    expect(db.syncLog.updateMany).toHaveBeenLastCalledWith({
      where: { id: "log_1", status: { in: ["IN_PROGRESS", "PAUSED"] } },
      data: expect.objectContaining({ status: "SUCCESS", cardsCreated: 1 }),
    });
  });

  it("beats its heartbeat after each season dump it reads, keeping the metadata a resume needs, and with every card", async () => {
    jest
      .mocked(nsApiClient.fetchCardDump)
      .mockResolvedValueOnce("<xml/>" as never)
      .mockRejectedValueOnce(new Error("HTTP 404: Not Found"));
    jest.mocked(nsApiClient.parseNSDump).mockResolvedValue([elm] as never);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createMockPrisma();
    const saved = { regionNames: ["lazarus"], lastProcessedIndex: -1, startedBy: "db_admin" };
    db.syncLog.findUnique.mockImplementation(async ({ select }: { select: { metadata?: true } }) =>
      select.metadata ? { metadata: saved } : { status: "IN_PROGRESS" }
    );
    db.card.create.mockResolvedValue({ id: "card_ns_123_s3" });

    await processRegionCardsFromDump(db as never, "log_1", ["lazarus"], [3, 4]);

    const writes = db.syncLog.update.mock.calls.map(([call]) => call.data);
    expect(writes.slice(0, 2)).toEqual([
      { metadata: { ...saved, heartbeatAt: expect.any(String) } },
      { metadata: { ...saved, heartbeatAt: expect.any(String) } },
    ]);
    expect(writes[2]!.metadata).toMatchObject({
      lastProcessedIndex: 0,
      heartbeatAt: expect.any(String),
    });
    jest.mocked(console.error).mockRestore();
  });
});
