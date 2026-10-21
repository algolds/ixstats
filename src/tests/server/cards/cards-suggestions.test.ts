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
  opts: {
    recent?: number;
    carded?: string[];
    /** The review state of each card the carded title has (default: one approved card). */
    reviewStates?: string[];
    open?: boolean;
    pageKind?: string;
  } = {}
) {
  const reviewStates = opts.reviewStates ?? ["APPROVED"];
  const db = createMockPrisma({
    $queryRaw: jest.fn(async (sql: TemplateStringsArray) =>
      sql.join("?").includes('"reviewState"')
        ? reviewStates.map((reviewState) => ({ reviewState }))
        : (opts.carded ?? []).map((key) => ({ key }))
    ),
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
