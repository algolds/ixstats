/** @jest-environment node */
/**
 * The compliance backfill: old NationStates takedown markers come into the queue unless a request is active on the
 * card, every Lore card with art gets a licence record (with --fetch, the one its wiki states, and none for a card
 * its wiki did not answer for), and every restricted art that still shows is hidden, read from the database so a
 * re-run finishes the rest.
 */
jest.mock("~/server/modules/cards/cards.art-licence", () => ({
  ...jest.requireActual<typeof import("~/server/modules/cards/cards.art-licence")>(
    "~/server/modules/cards/cards.art-licence"
  ),
  captureArtLicence: jest.fn(),
}));
jest.mock("~/lib/realms/sources/wiki-discovery-client", () => ({
  ...jest.requireActual<typeof import("~/lib/realms/sources/wiki-discovery-client")>(
    "~/lib/realms/sources/wiki-discovery-client"
  ),
  createDiscoveryClient: jest.fn(),
}));

import type { Prisma } from "@prisma/client";
import {
  backfillLicences,
  backfillTakedowns,
  hideRestrictedArt,
} from "../../../scripts/cards/backfill-card-compliance";
import { captureArtLicence, type CapturedLicence } from "~/server/modules/cards/cards.art-licence";
import {
  createDiscoveryClient,
  DiscoveryStopped,
  type DiscoveryStopKind,
} from "~/lib/realms/sources/wiki-discovery-client";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ACTIVE_REQUEST = { status: { in: ["OPEN", "HIDDEN"] } };

/** A mock database whose transactions run on itself and whose locks resolve, ready to file and hide. */
function mockDb() {
  const db = createMockPrisma({ $executeRaw: jest.fn() });
  db.card.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id })
  );
  db.cardTakedown.create.mockImplementation(({ data }: { data: { cardId: string } }) =>
    Promise.resolve({ id: `td_${data.cardId}` })
  );
  db.cardTakedown.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({
      id: where.id,
      card: {
        id: where.id.replace(/^td_/, ""),
        artwork: "art.png",
        isRetired: false,
        metadata: {},
      },
    })
  );
  db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });
  db.card.updateMany.mockResolvedValue({ count: 1 });
  return db;
}

const filedCards = (db: ReturnType<typeof mockDb>) =>
  db.cardTakedown.create.mock.calls.map(([arg]: [{ data: { cardId: string } }]) => arg.data.cardId);

describe("backfillTakedowns", () => {
  const legacy = {
    id: "card_ns",
    retiredAt: new Date("2026-09-01T00:00:00Z"),
    metadata: { nsTakedown: { selfService: true, reason: "My flag" }, nsData: { flag: "f.png" } },
  };

  it("brings in a marked card whose only request was declined, and skips one a request is active on", async () => {
    const db = mockDb();
    db.card.findMany.mockResolvedValue([legacy]);

    await expect(backfillTakedowns(db as never, true)).resolves.toBe(1);

    expect(db.card.findMany).toHaveBeenCalledWith({
      where: { isRetired: true, takedowns: { none: ACTIVE_REQUEST } },
      select: { id: true, retiredAt: true, metadata: true },
    });
    expect(db.cardTakedown.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ cardId: "card_ns", status: "HIDDEN", savedArtwork: "f.png" }),
      ],
    });
  });

  it("writes nothing on a dry run", async () => {
    const db = mockDb();
    db.card.findMany.mockResolvedValue([legacy]);

    await expect(backfillTakedowns(db as never, false)).resolves.toBe(1);
    expect(db.cardTakedown.createMany).not.toHaveBeenCalled();
  });
});

describe("hideRestrictedArt", () => {
  const SHOWING = {
    status: "RESTRICTED",
    card: { artwork: { not: null }, takedowns: { none: ACTIVE_REQUEST } },
  };

  it("counts the restricted art that still shows on a dry run, writing nothing", async () => {
    const db = mockDb();
    db.cardArtLicence.count.mockResolvedValue(3);

    await expect(hideRestrictedArt(db as never, false)).resolves.toMatchObject({ pending: 3 });
    expect(db.cardArtLicence.count).toHaveBeenCalledWith({ where: SHOWING });
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
  });

  it("pages the database by card id and hides each card's art", async () => {
    const db = mockDb();
    db.cardArtLicence.findMany
      .mockResolvedValueOnce([
        { cardId: "a", licence: "CC BY-NC 4.0" },
        { cardId: "b", licence: "CC BY-ND 4.0" },
      ])
      .mockResolvedValueOnce([{ cardId: "c", licence: null }]);

    await expect(hideRestrictedArt(db as never, true, 2)).resolves.toEqual({
      pending: 3,
      filed: 3,
      skipped: 0,
      failed: [],
    });

    const pages = db.cardArtLicence.findMany.mock.calls.map(([arg]: [object]) => arg);
    expect(pages).toEqual([
      {
        where: { ...SHOWING, cardId: { gt: "" } },
        orderBy: { cardId: "asc" },
        take: 2,
        select: { cardId: true, licence: true },
      },
      expect.objectContaining({ where: { ...SHOWING, cardId: { gt: "b" } } }),
    ]);
    expect(filedCards(db)).toEqual(["a", "b", "c"]);
  });

  it("carries on past a card that fails, and a re-run hides the rest", async () => {
    const db = mockDb();
    db.cardArtLicence.findMany.mockResolvedValueOnce([
      { cardId: "a", licence: "CC BY-NC 4.0" },
      { cardId: "b", licence: "CC BY-NC 4.0" },
    ]);
    // Card a's art changed while it was being hidden: its filing rolls back
    db.card.updateMany.mockResolvedValueOnce({ count: 0 });

    const first = await hideRestrictedArt(db as never, true, 5);

    expect(first).toMatchObject({ pending: 2, filed: 1 });
    expect(first.failed).toEqual([{ cardId: "a", reason: expect.stringMatching(/card changed/) }]);

    // The re-run reads what is still restricted and showing: card a
    db.cardArtLicence.findMany.mockResolvedValueOnce([{ cardId: "a", licence: "CC BY-NC 4.0" }]);
    const second = await hideRestrictedArt(db as never, true, 5);

    expect(second).toEqual({ pending: 1, filed: 1, skipped: 0, failed: [] });
    expect(filedCards(db)).toEqual(["a", "b", "a"]);
  });
});

describe("backfillLicences with --fetch", () => {
  type LicenceRow = Prisma.CardArtLicenceCreateManyInput;
  const card = (id: string, wikiSource = "iiwiki") => ({
    id,
    wikiSource,
    artwork: `https://${wikiSource}.com/images/a/ab/${id}.png`,
  });
  const stop = (kind: DiscoveryStopKind, status: number | null) =>
    new DiscoveryStopped({ kind, status, message: `stopped: ${kind}` });
  const open = (fileTitle: string): CapturedLicence => ({
    fileTitle,
    fileUrl: "u",
    descriptionUrl: null,
    licence: "CC BY-SA 4.0",
    licenceUrl: null,
    artist: null,
    attribution: "a",
    status: "OPEN",
  });

  /** The database as the licence step reads and writes it: Lore cards with art, and the licence rows written. */
  function store(cards: Array<ReturnType<typeof card>>) {
    const written: LicenceRow[] = [];
    const db = createMockPrisma();
    db.card.findMany.mockImplementation(() =>
      Promise.resolve(cards.filter((c) => !written.some((row) => row.cardId === c.id)))
    );
    db.cardArtLicence.createMany.mockImplementation(({ data }: { data: LicenceRow[] }) => {
      written.push(...data);
      return Promise.resolve({ count: data.length });
    });
    return { db, written };
  }

  /** Each discovery client the run builds is a distinct query, so a capture names the client it read through. */
  let clients: Array<{ wiki: string; query: jest.Mock }> = [];
  beforeEach(() => {
    clients = [];
    jest.mocked(createDiscoveryClient).mockReset();
    jest.mocked(createDiscoveryClient).mockImplementation((wiki) => {
      const query = jest.fn();
      clients.push({ wiki, query });
      return { source: wiki, query, pace: jest.fn(), requests: () => 0, stopped: () => null };
    });
    jest.mocked(captureArtLicence).mockReset();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  /** Which client (by its build order) each capture read through. */
  const clientOfEachRead = () =>
    jest
      .mocked(captureArtLicence)
      .mock.calls.map(([query]) => clients.findIndex((client) => client.query === query));

  it("goes on past a 5xx with a fresh client, and leaves the card it lost unrecorded", async () => {
    const { db, written } = store([card("a"), card("b"), card("c")]);
    jest
      .mocked(captureArtLicence)
      .mockResolvedValueOnce(open("File:a.png"))
      .mockRejectedValueOnce(stop("error", 502))
      .mockResolvedValueOnce(open("File:c.png"));

    await backfillLicences(db as never, true, true);

    expect(clientOfEachRead()).toEqual([0, 0, 1]);
    // The replacement waits before its first request, as the import runner's does
    expect(createDiscoveryClient).toHaveBeenLastCalledWith("iiwiki", {
      maxRequests: 10_000,
      pauseFirst: true,
    });
    expect(written.map((row) => [row.cardId, row.status])).toEqual([
      ["a", "OPEN"],
      ["c", "OPEN"],
    ]);
  });

  it("parks a wiki that refuses: no row for any card it did not read, while the other wikis go on", async () => {
    for (const kind of ["blocked", "rate-limited"] as const) {
      const { db, written } = store([card("a"), card("b"), card("x", "ixwiki"), card("c")]);
      jest
        .mocked(captureArtLicence)
        .mockReset()
        .mockRejectedValueOnce(stop(kind, kind === "blocked" ? 403 : 429))
        .mockResolvedValueOnce(open("File:x.png"));

      await backfillLicences(db as never, true, true);

      expect(jest.mocked(captureArtLicence).mock.calls.map(([, wiki]) => wiki)).toEqual([
        "iiwiki",
        "ixwiki",
      ]);
      expect(written.map((row) => row.cardId)).toEqual(["x"]);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^3 IIWiki cards not checked/)
      );
    }
  });

  it("reads on a re-run the cards an earlier run could not", async () => {
    const { db, written } = store([card("a"), card("b"), card("c")]);
    jest
      .mocked(captureArtLicence)
      .mockResolvedValueOnce(open("File:a.png"))
      .mockRejectedValueOnce(stop("blocked", 403));
    await backfillLicences(db as never, true, true);
    expect(written.map((row) => row.cardId)).toEqual(["a"]);

    jest
      .mocked(captureArtLicence)
      .mockResolvedValueOnce(open("File:b.png"))
      .mockResolvedValueOnce(open("File:c.png"));
    await backfillLicences(db as never, true, true);

    // The file titles as the wiki names them, first letter capitalised
    expect(
      jest
        .mocked(captureArtLicence)
        .mock.calls.slice(2)
        .map(([, , file]) => file)
    ).toEqual(["File:B.png", "File:C.png"]);
    expect(written.map((row) => [row.cardId, row.status])).toEqual([
      ["a", "OPEN"],
      ["b", "OPEN"],
      ["c", "OPEN"],
    ]);
  });

  it("records a card whose wiki has no such file as unknown, and one whose art names no file", async () => {
    const { db, written } = store([
      card("a"),
      { id: "n", wikiSource: "iiwiki", artwork: "https://example.org/n.png" },
    ]);
    jest.mocked(captureArtLicence).mockResolvedValueOnce(null);

    await backfillLicences(db as never, true, true);

    expect(written.map((row) => [row.cardId, row.status])).toEqual([
      ["a", "UNKNOWN"],
      ["n", "UNKNOWN"],
    ]);
    expect(captureArtLicence).toHaveBeenCalledTimes(1);
  });
});
