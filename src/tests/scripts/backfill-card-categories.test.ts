/** @jest-environment node */
/** The categories backfill script: guarded writes, every continuation followed, the IIWiki dev proxy honoured. */
import { CATEGORY_REVIEW_THRESHOLD } from "~/lib/cards/category-classifier";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  applyDecisions,
  backfillApiUrl,
  dropLegacyLabels,
  fetchSignals,
  parseBackfillArgs,
  readBackfillCards,
  retireAbandoned,
  runBackfill,
  type SignalCache,
} from "../../../scripts/cards/backfill-card-categories";

const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

it("follows every continue answer before it classifies", async () => {
  const query = jest
    .fn()
    .mockResolvedValueOnce({
      continue: { tlcontinue: "a", continue: "||" },
      query: { pages: [{ title: "A", categories: [{ title: "Category:Conflicts" }] }] },
    })
    .mockResolvedValueOnce({
      query: { pages: [{ title: "A", templates: [{ title: "Template:Infobox war" }] }] },
    });
  const signals = await fetchSignals(query, ["A"]);
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls[0]![0]).toMatchObject({
    titles: "A",
    prop: "categories|templates",
    tlnamespace: "10",
    clshow: "!hidden",
  });
  expect(query.mock.calls[1]![0]).toMatchObject({ tlcontinue: "a", continue: "||" });
  expect(signals.get("A")?.templates).toEqual(["Template:Infobox war"]);
  expect(signals.get("A")?.categories).toEqual(["Category:Conflicts"]);
});

it("asks 50 titles at a time", async () => {
  const query = jest.fn().mockResolvedValue({ query: { pages: [] } });
  await fetchSignals(
    query,
    Array.from({ length: 120 }, (_, i) => `T${i}`)
  );
  expect(query.mock.calls.map(([params]) => params.titles.split("|").length)).toEqual([50, 50, 20]);
});

it("stops, rather than looping, when an api.php drops the continuation parameters", async () => {
  // The dev relay forwards `continue` but not `clcontinue`/`tlcontinue`, so MediaWiki answers the first page again.
  const answer = {
    continue: { clcontinue: "1|X", continue: "||" },
    query: { pages: [{ title: "A" }] },
  };
  const query = jest.fn().mockResolvedValue(answer);
  await expect(fetchSignals(query, ["A"])).rejects.toBeInstanceOf(DiscoveryStopped);
  expect(query).toHaveBeenCalledTimes(2);
});

it("writes only over an unset or classifier category, and drops the card's legacy label", async () => {
  const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
  const written = await applyDecisions(db as never, [
    {
      card: { id: "c1" },
      decision: {
        kind: "write",
        classification: { category: "MILITARY", subcategory: "unit", confidence: 0.9 },
        needsReview: false,
        changed: true,
      },
    },
    { card: { id: "c2" }, decision: { kind: "protected" } },
    { card: { id: "c3" }, decision: { kind: "unread" } },
  ]);
  expect(written).toBe(1);
  expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  const sql = sqlOf(db.$executeRaw.mock.calls[0]!);
  expect(sql).toContain(`("categorySource" IS NULL OR "categorySource" = 'CLASSIFIER')`);
  expect(sql).toContain(`"cardType" = 'LORE'`);
  expect(sql).toContain(`"metadata" - 'category'`);
  expect(sql).not.toContain("realmId");
  expect(db.$executeRaw.mock.calls[0]!.slice(1)).toEqual(["MILITARY", "unit", 0.9, false, "c1"]);
});

it("writes the review flag of the run's threshold, in transactions of 200", async () => {
  const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
  const rows = Array.from({ length: 401 }, (_, i) => ({
    card: { id: `c${i}` },
    decision: {
      kind: "write" as const,
      classification: { category: "MILITARY" as const, subcategory: null, confidence: 0.9 },
      needsReview: true,
      changed: true,
    },
  }));
  await expect(applyDecisions(db as never, rows)).resolves.toBe(401);
  expect(db.$transaction).toHaveBeenCalledTimes(3);
  expect(db.$executeRaw.mock.calls[0]![4]).toBe(true);
});

it("sweeps the legacy labels only of cards the backfill has reached", async () => {
  const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(2375) });
  await expect(dropLegacyLabels(db as never)).resolves.toBe(2375);
  expect(sqlOf(db.$executeRaw.mock.calls[0]!)).toContain(`"categorySource" IS NOT NULL`);
});

it("reads IIWiki through the dev proxy when one is set, and IxWiki at its api.php", () => {
  expect(
    backfillApiUrl("iiwiki", { IIWIKI_DEV_PROXY_URL: "https://proxy.test/api.php" } as never)
  ).toBe("https://proxy.test/api.php");
  expect(backfillApiUrl("iiwiki", {} as never)).toBe("https://iiwiki.com/api.php");
  expect(backfillApiUrl("ixwiki", {} as never)).toMatch(/\/api\.php$/);
  expect(backfillApiUrl("commons", {} as never)).toBe("https://commons.wikimedia.org/w/api.php");
});

describe("readBackfillCards", () => {
  it("reads every lore card, a missing source as IxWiki, the full excerpt first", async () => {
    const db = createMockPrisma();
    db.card.findMany.mockResolvedValue([
      {
        id: "a",
        title: "A",
        wikiSource: null,
        wikiArticleTitle: "A",
        wikiExcerpt: "short",
        metadata: { fullExcerpt: "the full text", category: "HISTORY" },
        category: null,
        subcategory: null,
        categorySource: null,
        isRetired: false,
      },
      {
        id: "b",
        title: "B",
        wikiSource: "iiwiki",
        wikiArticleTitle: null,
        wikiExcerpt: "short",
        metadata: null,
        category: "MILITARY",
        subcategory: "unit",
        categorySource: "ADMIN",
        isRetired: true,
      },
    ]);
    await expect(readBackfillCards(db as never, null)).resolves.toEqual([
      {
        id: "a",
        title: "A",
        source: "ixwiki",
        articleTitle: "A",
        excerpt: "the full text",
        category: null,
        subcategory: null,
        categorySource: null,
        hasLegacyLabel: true,
        retired: false,
      },
      {
        id: "b",
        title: "B",
        source: "iiwiki",
        articleTitle: null,
        excerpt: "short",
        category: "MILITARY",
        subcategory: "unit",
        categorySource: "ADMIN",
        hasLegacyLabel: false,
        retired: true,
      },
    ]);
    expect(db.card.findMany.mock.calls[0]![0].where).toEqual({ cardType: "LORE" });
  });

  it("reads one wiki's cards with --source, IxWiki's with no source too", async () => {
    const db = createMockPrisma();
    await readBackfillCards(db as never, "ixwiki");
    await readBackfillCards(db as never, "iiwiki");
    expect(db.card.findMany.mock.calls[0]![0].where).toEqual({
      cardType: "LORE",
      OR: [{ wikiSource: "ixwiki" }, { wikiSource: null }],
    });
    expect(db.card.findMany.mock.calls[1]![0].where).toEqual({
      cardType: "LORE",
      wikiSource: "iiwiki",
    });
  });
});

describe("runBackfill", () => {
  const row = (
    id: string,
    wikiSource: string,
    over: Record<string, string | boolean | null> = {}
  ) => ({
    id,
    title: id,
    wikiSource,
    wikiArticleTitle: id,
    wikiExcerpt: null,
    metadata: { category: "HISTORY" },
    category: null,
    subcategory: null,
    categorySource: null,
    isRetired: false,
    ...over,
  });
  const battle = {
    query: {
      pages: [
        {
          title: "Kiro",
          categories: [{ title: "Category:Battles of Urcea" }],
          templates: [{ title: "Template:Infobox military conflict" }],
        },
      ],
    },
  };
  const options = { apply: true, source: null, reclassify: false, threshold: 0.5 };
  const freshCache = (): SignalCache => ({ version: 1, pages: {} });

  function setup(cards: ReturnType<typeof row>[]) {
    const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
    db.card.findMany.mockResolvedValue(cards);
    db.card.updateMany.mockResolvedValue({ count: 1 });
    return db;
  }
  const abandonedCache = (): SignalCache => ({
    version: 1,
    pages: {
      "ixwiki|gone": { categories: ["Category:Abandoned Lore"], templates: [], missing: false },
    },
  });

  it("skips a retired card: it reads nothing for it and counts it", async () => {
    const db = setup([row("Kiro", "ixwiki"), row("Seed", "ixwiki", { isRetired: true })]);
    const query = jest.fn().mockResolvedValue(battle);
    const result = await runBackfill(db as never, options, {
      queryFor: () => query,
      cache: freshCache(),
      saveCache: jest.fn(),
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]![0].titles).toBe("Kiro");
    expect(result.report.counts).toMatchObject({ retired: 1, writes: 1 });
    expect(db.$executeRaw.mock.calls.map((call) => call.at(-1))).not.toContain("Seed");
  });

  it("retires an Abandoned Lore card on apply, after its category write, and not on a dry run", async () => {
    const dry = setup([row("Gone", "ixwiki")]);
    const deps = { queryFor: () => jest.fn(), saveCache: jest.fn() };
    const preview = await runBackfill(
      dry as never,
      { ...options, apply: false },
      { ...deps, cache: abandonedCache() }
    );
    expect(preview.report.abandoned).toEqual([{ id: "Gone", title: "Gone", source: "ixwiki" }]);
    expect(preview.report.counts.review).toBe(0);
    expect(dry.card.updateMany).not.toHaveBeenCalled();

    const db = setup([row("Gone", "ixwiki")]);
    const result = await runBackfill(db as never, options, { ...deps, cache: abandonedCache() });
    expect(result.retired).toBe(1);
    expect(db.$executeRaw.mock.calls[0]!.slice(-2)).toEqual([false, "Gone"]);
    expect(db.card.updateMany).toHaveBeenCalledWith({
      where: { id: "Gone", cardType: "LORE", isRetired: false },
      data: { isRetired: true, retiredAt: expect.any(Date) },
    });
  });

  it("leaves a stopped wiki's cards untouched, writes the rest, and skips the sweep", async () => {
    const db = setup([
      row("Kiro", "ixwiki"),
      row("Far", "iiwiki"),
      row("Mine", "ixwiki", { categorySource: "ADMIN" }),
    ]);
    const ixwiki = jest.fn().mockResolvedValue(battle);
    const iiwiki = jest.fn().mockRejectedValue(
      new DiscoveryStopped({
        kind: "blocked",
        status: 403,
        message: "iiwiki refused the request (HTTP 403)",
      })
    );
    const queries: Record<string, WikiQuery> = { ixwiki, iiwiki };
    const result = await runBackfill(db as never, options, {
      queryFor: (source) => queries[source]!,
      cache: freshCache(),
      saveCache: jest.fn(),
    });
    expect(result.report.stops).toEqual({ iiwiki: "iiwiki refused the request (HTTP 403)" });
    expect(result.report.counts).toMatchObject({ writes: 1, unread: 1, protected: 1 });
    expect(result.written).toBe(1);
    expect(result.swept).toBe(0);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw.mock.calls[0]!.slice(1)).toEqual([
      "MILITARY",
      "battle-or-war",
      expect.any(Number),
      false,
      "Kiro",
    ]);
  });

  it("reuses the cache's reads, saves it after each batch, and sweeps when every card was read", async () => {
    const db = setup([row("Kiro", "ixwiki"), row("New", "ixwiki")]);
    const cache: SignalCache = {
      version: 1,
      pages: {
        "ixwiki|kiro": {
          categories: [],
          templates: ["Template:Infobox military conflict"],
          missing: false,
        },
      },
    };
    const query = jest.fn().mockResolvedValue({ query: { pages: [{ title: "New" }] } });
    const saveCache = jest.fn();
    const result = await runBackfill(db as never, options, {
      queryFor: () => query,
      cache,
      saveCache,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]![0].titles).toBe("New");
    expect(saveCache).toHaveBeenCalledTimes(1);
    expect(cache.pages["ixwiki|new"]).toEqual({ categories: [], templates: [], missing: false });
    expect(result.written).toBe(2);
    expect(sqlOf(db.$executeRaw.mock.calls.at(-1)!)).toContain(`"categorySource" IS NOT NULL`);
  });

  it("writes nothing on a dry run, and plans no write for a card an earlier run classified", async () => {
    const db = setup([
      row("Kiro", "ixwiki"),
      row("Old", "ixwiki", { categorySource: "CLASSIFIER", category: "HISTORY" }),
    ]);
    const query = jest.fn().mockResolvedValue(battle);
    const result = await runBackfill(
      db as never,
      { ...options, apply: false },
      {
        queryFor: () => query,
        cache: freshCache(),
        saveCache: jest.fn(),
      }
    );
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(query.mock.calls[0]![0].titles).toBe("Kiro");
    expect(result.report.counts).toMatchObject({ writes: 1, kept: 1 });
    expect(result.report.mode).toBe("dry-run");
  });
});

describe("retireAbandoned", () => {
  const gone = { id: "g1", title: "Gone", source: "ixwiki" as const };

  it("retires each card not yet retired, with one CARD_HIDE audit row each", async () => {
    const db = createMockPrisma();
    db.card.updateMany.mockResolvedValue({ count: 1 });
    await expect(retireAbandoned(db as never, [gone])).resolves.toBe(1);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: "CARD_HIDE",
        entityType: "CARD",
        target: "g1",
        details: "Retired: its IxWiki article is tagged Abandoned Lore",
      }),
    });
  });

  it("writes no second audit row for a card retired meanwhile, and nothing for no cards", async () => {
    const db = createMockPrisma();
    db.card.updateMany.mockResolvedValue({ count: 0 });
    await expect(retireAbandoned(db as never, [gone])).resolves.toBe(0);
    expect(db.auditLog.create).not.toHaveBeenCalled();
    await expect(retireAbandoned(db as never, [])).resolves.toBe(0);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("parseBackfillArgs", () => {
  it("defaults to a dry run over every wiki at the classifier's threshold", () => {
    expect(parseBackfillArgs([])).toMatchObject({
      apply: false,
      reclassify: false,
      source: null,
      threshold: CATEGORY_REVIEW_THRESHOLD,
      report: null,
      cache: "scripts/reports/card-categories-cache.json",
    });
  });

  it("reads every flag, and refuses an unknown wiki or a threshold outside 0 to 1", () => {
    expect(
      parseBackfillArgs([
        "--apply",
        "--reclassify",
        "--source",
        "iiwiki",
        "--threshold",
        "0.6",
        "--report",
        "/tmp/r.md",
        "--cache",
        "/tmp/c.json",
      ])
    ).toEqual({
      apply: true,
      reclassify: true,
      source: "iiwiki",
      threshold: 0.6,
      report: "/tmp/r.md",
      cache: "/tmp/c.json",
    });
    expect(() => parseBackfillArgs(["--source", "nowhere"])).toThrow(/--source/);
    expect(() => parseBackfillArgs(["--threshold", "2"])).toThrow(/--threshold/);
    expect(() => parseBackfillArgs(["--threshold"])).toThrow(/--threshold/);
  });
});
