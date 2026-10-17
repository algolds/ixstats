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

describe("processRegionCardsFromDump", () => {
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
    expect(db.syncLog.update).toHaveBeenLastCalledWith({
      where: { id: "log_1" },
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
