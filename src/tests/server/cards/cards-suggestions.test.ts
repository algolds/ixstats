/** @jest-environment node */
/** Free suggestions: anyone signed in, 3 a rolling day, uncarded articles only. */
import {
  mySuggestions,
  suggestCard,
  SUGGESTIONS_PER_DAY,
} from "~/server/modules/cards/cards.suggestions";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-10-28T12:00:00Z");

function makeDb(
  opts: { recent?: number; carded?: string[]; open?: boolean; pageKind?: string } = {}
) {
  const db = createMockPrisma({
    $queryRaw: jest.fn().mockResolvedValue((opts.carded ?? []).map((key) => ({ key }))),
    $executeRaw: jest.fn().mockResolvedValue(1),
  });
  db.loreCardRequest.count.mockResolvedValue(opts.recent ?? 0);
  db.loreCardRequest.findFirst.mockResolvedValue(opts.open ? { id: "other" } : null);
  db.realmPage.findMany.mockResolvedValue(
    opts.pageKind ? [{ realmId: "eurth", kind: opts.pageKind }] : []
  );
  db.loreCardRequest.create.mockResolvedValue({ id: "req_new" });
  return db;
}

describe("suggestCard", () => {
  it("files a free suggestion in the article's home realm", async () => {
    const db = makeDb();
    expect(
      await suggestCard(
        db as never,
        "db_player",
        { source: "althistory", title: "Balkanized_North_America" },
        NOW
      )
    ).toEqual({ id: "req_new" });
    expect(db.loreCardRequest.create).toHaveBeenCalledWith({
      data: {
        userId: "db_player",
        wikiSource: "althistory",
        articleTitle: "Balkanized North America",
        realmId: "althistory",
        status: "PENDING",
      },
    });
    expect(db.loreCardRequest.count).toHaveBeenCalledWith({
      where: { userId: "db_player", requestedAt: { gte: new Date("2026-10-27T12:00:00Z") } },
    });
    expect(db.loreCardRequest.findFirst).toHaveBeenCalledWith({
      where: {
        wikiSource: "althistory",
        articleTitle: { equals: "Balkanized North America", mode: "insensitive" },
        status: "PENDING",
      },
      select: { id: true },
    });
  });

  it("takes the player's lock, then counts, checks and files in that one transaction", async () => {
    const db = makeDb();
    const tx = makeDb();
    db.$transaction.mockImplementation((run: (client: typeof tx) => Promise<unknown>) => run(tx));
    await suggestCard(db as never, "db_player", { source: "ixwiki", title: "Elm" }, NOW);
    const [sql, namespace, key] = tx.$executeRaw.mock.calls[0]!;
    expect(sql.join("?")).toContain("pg_advisory_xact_lock(?::int, hashtext(?))");
    expect([namespace, key]).toEqual([7333, "db_player"]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.loreCardRequest.count.mock.invocationCallOrder[0]!
    );
    expect(tx.loreCardRequest.findFirst).toHaveBeenCalled();
    expect(tx.loreCardRequest.create).toHaveBeenCalled();
    expect(db.loreCardRequest.count).not.toHaveBeenCalled();
    expect(db.loreCardRequest.create).not.toHaveBeenCalled();
  });

  it("homes the suggestion in the realm that imported the page first", async () => {
    const db = makeDb({ pageKind: "lore" });
    await suggestCard(db as never, "p", { source: "iiwiki", title: "Elm" }, NOW);
    expect(db.loreCardRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ realmId: "eurth" }),
    });
  });

  it("allows the third suggestion in a day and refuses the fourth", async () => {
    await expect(
      suggestCard(
        makeDb({ recent: SUGGESTIONS_PER_DAY - 1 }) as never,
        "p",
        { source: "ixwiki", title: "Elm" },
        NOW
      )
    ).resolves.toEqual({ id: "req_new" });
    const full = makeDb({ recent: SUGGESTIONS_PER_DAY });
    await expect(
      suggestCard(full as never, "p", { source: "ixwiki", title: "Elm" }, NOW)
    ).rejects.toThrow(/3 articles a day/);
    expect(full.loreCardRequest.create).not.toHaveBeenCalled();
  });

  it("refuses an article that has a card, one already suggested, and a realm's nation page", async () => {
    await expect(
      suggestCard(
        makeDb({ carded: ["elm"] }) as never,
        "p",
        { source: "ixwiki", title: "Elm" },
        NOW
      )
    ).rejects.toThrow(/already has a card/);
    await expect(
      suggestCard(makeDb({ open: true }) as never, "p", { source: "ixwiki", title: "Elm" }, NOW)
    ).rejects.toThrow(/already suggested/);
    await expect(
      suggestCard(
        makeDb({ pageKind: "nation" }) as never,
        "p",
        { source: "iiwiki", title: "Elm" },
        NOW
      )
    ).rejects.toThrow("A realm's nation page does not become a lore card");
  });

  it("refuses a title that is not an article before counting anything", async () => {
    const db = makeDb();
    await expect(
      suggestCard(db as never, "p", { source: "ixwiki", title: "Template:Infobox country" }, NOW)
    ).rejects.toThrow("Only wiki articles become lore cards");
    await expect(
      suggestCard(db as never, "p", { source: "ixwiki", title: "[[" }, NOW)
    ).rejects.toThrow(/not a page title/);
    expect(db.loreCardRequest.count).not.toHaveBeenCalled();
    expect(db.loreCardRequest.create).not.toHaveBeenCalled();
  });
});

describe("mySuggestions", () => {
  it("lists the player's own suggestions, newest first", async () => {
    const db = createMockPrisma();
    await mySuggestions(db as never, "db_player");
    expect(db.loreCardRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "db_player" },
        orderBy: { requestedAt: "desc" },
      })
    );
  });
});
