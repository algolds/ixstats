/** @jest-environment node */
/** The categories backfill's pure half: the API's pages read whole, the decision per card, the report. */
import {
  buildBackfillReport,
  collectPageSignals,
  planCardCategory,
  renderBackfillReport,
  type BackfillCard,
  type BackfillDecision,
  type PageSignals,
} from "~/lib/cards/category-backfill";

const card = (over: Partial<BackfillCard> = {}): BackfillCard => ({
  id: "c1",
  title: "Battle of Kiro",
  source: "ixwiki",
  articleTitle: "Battle of Kiro",
  excerpt: "The Battle of Kiro was fought in 1820.",
  category: null,
  subcategory: null,
  categorySource: null,
  hasLegacyLabel: true,
  retired: false,
  ...over,
});

describe("collectPageSignals", () => {
  it("merges a page's categories and templates across continuation answers", () => {
    const signals = collectPageSignals(
      ["Battle of Kiro"],
      [
        {
          continue: { tlcontinue: "1|10|x", continue: "||" },
          query: {
            pages: [
              { title: "Battle of Kiro", categories: [{ title: "Category:Battles of Urcea" }] },
            ],
          },
        },
        {
          query: {
            pages: [
              {
                title: "Battle of Kiro",
                templates: [{ title: "Template:Infobox military conflict" }],
              },
            ],
          },
        },
      ]
    );
    expect(signals.get("Battle of Kiro")).toEqual({
      categories: ["Category:Battles of Urcea"],
      templates: ["Template:Infobox military conflict"],
      missing: false,
    });
  });

  it("finds a page under its normalized and redirected name, and marks a missing one", () => {
    const signals = collectPageSignals(
      ["battle_of_Kiro", "Gone"],
      [
        {
          query: {
            normalized: [{ from: "battle_of_Kiro", to: "Battle of Kiro" }],
            redirects: [{ from: "Battle of Kiro", to: "Kiro, Battle of" }],
            pages: [
              { title: "Kiro, Battle of", categories: [{ title: "Category:Conflicts" }] },
              { title: "Gone", missing: true },
            ],
          },
        },
      ]
    );
    expect(signals.get("battle_of_Kiro")?.categories).toEqual(["Category:Conflicts"]);
    expect(signals.get("Gone")).toEqual({ categories: [], templates: [], missing: true });
  });

  it("reads each name once when continuation answers repeat it, and marks an invalid or absent title", () => {
    const page = {
      title: "A",
      categories: [{ title: "Category:X" }],
      templates: [{ title: "Template:T" }],
    };
    const signals = collectPageSignals(
      ["A", "Bad|", "Nowhere"],
      [{ query: { pages: [page, { title: "Bad|", invalid: true }] } }, { query: { pages: [page] } }]
    );
    expect(signals.get("A")).toEqual({
      categories: ["Category:X"],
      templates: ["Template:T"],
      missing: false,
    });
    expect(signals.get("Bad|")?.missing).toBe(true);
    expect(signals.get("Nowhere")).toEqual({ categories: [], templates: [], missing: true });
  });

  it("follows a redirect chain the API reports, without looping on a cycle", () => {
    const signals = collectPageSignals(
      ["Old", "Loop"],
      [
        {
          query: {
            redirects: [
              { from: "Old", to: "Middle" },
              { from: "Middle", to: "New" },
              { from: "Loop", to: "Loop" },
            ],
            pages: [{ title: "New", templates: [{ title: "Template:Infobox war" }] }],
          },
        },
      ]
    );
    expect(signals.get("Old")?.templates).toEqual(["Template:Infobox war"]);
    expect(signals.get("Loop")?.missing).toBe(true);
  });
});

describe("planCardCategory", () => {
  const read: PageSignals = {
    categories: ["Category:Battles of Urcea"],
    templates: ["Template:Infobox military conflict"],
    missing: false,
  };

  it.each(["ADMIN", "REALM_OWNER", "SUGGESTION"])(
    "never plans a write over a %s category",
    (source) => {
      expect(
        planCardCategory(card({ categorySource: source, category: "HISTORY" }), read, 0.5)
      ).toEqual({ kind: "protected" });
    }
  );

  it("skips a retired card, before anything else", () => {
    const retired = card({ retired: true, categorySource: "ADMIN" });
    expect(planCardCategory(retired, read, 0.5)).toEqual({ kind: "retired" });
    expect(planCardCategory(card({ retired: true }), null, 0.5)).toEqual({ kind: "retired" });
  });

  it("never flags an Abandoned Lore article for review: the apply retires it", () => {
    const abandoned = { ...read, categories: [...read.categories, "Category:Abandoned Lore"] };
    expect(planCardCategory(card(), abandoned, 1.01)).toMatchObject({
      kind: "write",
      needsReview: false,
    });
  });

  it("leaves a card whose wiki stopped answering for the next run, never Uncategorised", () => {
    expect(planCardCategory(card(), null, 0.5)).toEqual({ kind: "unread" });
  });

  it("classifies a card with no article on its title and excerpt alone", () => {
    expect(planCardCategory(card({ articleTitle: null }), null, 0.5).kind).toBe("write");
  });

  it("plans the classification, its review flag and whether it changes the card", () => {
    const decision = planCardCategory(card({ category: "HISTORY" }), read, 0.5);
    expect(decision).toMatchObject({
      kind: "write",
      classification: { category: "MILITARY", subcategory: "battle-or-war" },
      needsReview: false,
      changed: true,
    });
  });

  it("is unchanged when the card already holds the same category and subcategory", () => {
    const decision = planCardCategory(
      card({ category: "MILITARY", subcategory: "battle-or-war" }),
      read,
      0.5
    );
    expect(decision).toMatchObject({ kind: "write", changed: false });
  });

  it("keeps a classifier category from an earlier run, and redoes it with reclassify", () => {
    const classified = card({ category: "HISTORY", categorySource: "CLASSIFIER" });
    expect(planCardCategory(classified, read, 0.5)).toEqual({ kind: "kept" });
    expect(planCardCategory(classified, read, 0.5, { reclassify: true })).toMatchObject({
      kind: "write",
      classification: { category: "MILITARY" },
    });
    expect(
      planCardCategory(card({ categorySource: "ADMIN" }), read, 0.5, { reclassify: true })
    ).toEqual({ kind: "protected" });
  });

  it("counts a new subcategory alone as a change", () => {
    const decision = planCardCategory(card({ category: "MILITARY", subcategory: null }), read, 0.5);
    expect(decision).toMatchObject({ kind: "write", changed: true });
  });

  it("flags review below the threshold it is given, and always when nothing scored", () => {
    const strict = planCardCategory(card(), read, 1.01);
    expect(strict).toMatchObject({ kind: "write", needsReview: true });
    const nothing = planCardCategory(
      card({ title: "Zzq", excerpt: null }),
      { categories: [], templates: [], missing: true },
      0
    );
    expect(nothing).toMatchObject({
      kind: "write",
      classification: { category: null },
      needsReview: true,
    });
  });

  it("reads the wiki's own rules for the card's source", () => {
    const decision = planCardCategory(
      card({ title: "Zzq", excerpt: null, source: "althistory" }),
      { categories: ["Category:Timelines"], templates: [], missing: false },
      0.5
    );
    expect(decision).toMatchObject({
      kind: "write",
      classification: { category: "HISTORY", subcategory: "era-or-period" },
    });
  });
});

it("reports the distribution, the histogram, the low-confidence list, the changes, the unread and the unmapped", () => {
  const rows = [
    {
      card: card(),
      decision: planCardCategory(
        card(),
        { categories: ["Category:Urcea"], templates: [], missing: false },
        0.5
      ),
      signals: { categories: ["Category:Urcea"], templates: [], missing: false },
    },
    {
      card: card({ id: "c2", source: "iiwiki" }),
      decision: { kind: "unread" as const },
      signals: null,
    },
  ];
  const text = renderBackfillReport(
    buildBackfillReport(rows, {
      threshold: 0.5,
      mode: "dry-run",
      stops: { iiwiki: "iiwiki refused the request (HTTP 403)" },
    })
  );
  for (const heading of [
    "## Distribution",
    "## Confidence",
    "## Below the threshold",
    "## Changes",
    "## Not read",
    "## Unmapped",
    "## Legacy labels",
  ]) {
    expect(text).toContain(heading);
  }
  expect(text).toContain("iiwiki refused the request (HTTP 403)");
  expect(text).toContain("Urcea");
});

describe("buildBackfillReport", () => {
  const write = (
    category: "MILITARY" | "HISTORY" | null,
    confidence: number,
    over: { needsReview?: boolean; changed?: boolean; subcategory?: string | null } = {}
  ): BackfillDecision => ({
    kind: "write",
    classification: { category, subcategory: over.subcategory ?? null, confidence },
    needsReview: over.needsReview ?? false,
    changed: over.changed ?? true,
  });
  const meta = { threshold: 0.5, mode: "apply" as const, stops: {} };

  it("counts each card once per source, in tenths of confidence, and samples five per category", () => {
    const rows = [0.05, 0.15, 0.55, 0.95, 1, 1, 1].map((confidence, i) => ({
      card: card({ id: `c${i}`, source: i === 0 ? "iiwiki" : "ixwiki" }),
      decision: write(i === 0 ? null : "MILITARY", confidence, { subcategory: i ? "unit" : null }),
      signals: null,
    }));
    const report = buildBackfillReport(rows, meta);
    expect(report.cardsPerSource).toEqual({ iiwiki: 1, ixwiki: 6 });
    expect(report.histogram).toEqual([1, 1, 0, 0, 0, 1, 0, 0, 0, 4]);
    expect(report.distribution.overall).toEqual({ UNCATEGORISED: 1, MILITARY: 6 });
    expect(report.distribution.perSource.ixwiki).toEqual({ MILITARY: 6 });
    expect(report.subcategories.MILITARY).toEqual({ unit: 6 });
    expect(report.samples.MILITARY).toHaveLength(5);
  });

  it("lists the cards for review and the changes from a category the card had", () => {
    const report = buildBackfillReport(
      [
        {
          card: card({ id: "a", title: "Low" }),
          decision: write("MILITARY", 0.2, { needsReview: true }),
          signals: null,
        },
        {
          card: card({ id: "b", title: "Moved", category: "HISTORY" }),
          decision: write("MILITARY", 0.9),
          signals: null,
        },
        {
          card: card({ id: "c", title: "Fresh" }),
          decision: write("MILITARY", 0.9),
          signals: null,
        },
        {
          card: card({ id: "e", title: "Sub", category: "MILITARY" }),
          decision: write("MILITARY", 0.9, { subcategory: "unit" }),
          signals: null,
        },
        {
          card: card({ id: "d", title: "Same", category: "MILITARY" }),
          decision: write("MILITARY", 0.9, { changed: false }),
          signals: null,
        },
      ],
      meta
    );
    expect(report.belowThreshold).toEqual([
      { title: "Low", source: "ixwiki", line: "Military", confidence: 0.2 },
    ]);
    expect(report.changes).toEqual([
      { title: "Moved", source: "ixwiki", from: "History", to: "Military" },
    ]);
    expect(report.counts).toMatchObject({ changes: 1, subcategoryOnly: 1, review: 1, writes: 5 });
  });

  it("keeps the current category of a card it does not write, and counts the protected", () => {
    const report = buildBackfillReport(
      [
        {
          card: card({ id: "p", category: "HISTORY", categorySource: "ADMIN" }),
          decision: { kind: "protected" },
          signals: null,
        },
        { card: card({ id: "u" }), decision: { kind: "unread" }, signals: null },
      ],
      meta
    );
    expect(report.distribution.overall).toEqual({ HISTORY: 1, UNCATEGORISED: 1 });
    expect(report.counts).toMatchObject({ protected: 1, unread: 1, writes: 0 });
    expect(report.unread).toEqual([{ title: "Battle of Kiro", source: "ixwiki" }]);
  });

  it("counts the labels the writes drop, and the sweep's only when it runs", () => {
    const rows = [
      { card: card({ id: "w" }), decision: write("MILITARY", 0.9), signals: null },
      {
        card: card({ id: "p", categorySource: "ADMIN" }),
        decision: { kind: "protected" as const },
        signals: null,
      },
      {
        card: card({ id: "n", hasLegacyLabel: false }),
        decision: write("MILITARY", 0.9),
        signals: null,
      },
    ];
    expect(buildBackfillReport(rows, meta).legacyLabels).toEqual({
      onWrites: 1,
      bySweep: 1,
      sweepRuns: true,
    });
    const stopped = buildBackfillReport(rows, { ...meta, stops: { ixwiki: "down" } });
    expect(stopped.legacyLabels).toEqual({ onWrites: 1, bySweep: 0, sweepRuns: false });
  });

  it("ranks unmapped categories and infoboxes by how many cards name them", () => {
    const signals = (categories: string[], templates: string[] = []): PageSignals => ({
      categories,
      templates,
      missing: false,
    });
    const report = buildBackfillReport(
      [
        {
          card: card({ id: "a" }),
          decision: write(null, 0),
          signals: signals(["Category:Urcea", "Category:Kylaris"], ["Template:Infobox thing"]),
        },
        {
          card: card({ id: "b" }),
          decision: write(null, 0),
          signals: signals(["Category:Kylaris"]),
        },
      ],
      meta
    );
    expect(report.unmappedCategories).toEqual([
      ["Kylaris", 2],
      ["Urcea", 1],
    ]);
    expect(report.unmappedInfoboxes).toEqual([["infobox thing", 1]]);
  });

  it("counts the retired it skips, and lists the Abandoned Lore cards apart from the review", () => {
    const abandoned: PageSignals = {
      categories: ["Category:Abandoned Lore"],
      templates: [],
      missing: false,
    };
    const rows = [
      {
        card: card({ id: "r", title: "History of Ixnay", retired: true }),
        decision: { kind: "retired" as const },
        signals: null,
      },
      {
        card: card({ id: "a", title: "Gone Lore" }),
        decision: write("MILITARY", 0.2),
        signals: abandoned,
      },
      {
        card: card({ id: "p", title: "Kept Lore", categorySource: "ADMIN" }),
        decision: { kind: "protected" as const },
        signals: abandoned,
      },
      {
        card: card({ id: "x", title: "Retired Lore", retired: true }),
        decision: { kind: "retired" as const },
        signals: abandoned,
      },
    ];
    const report = buildBackfillReport(rows, meta);
    expect(report.counts).toMatchObject({ retired: 2, abandoned: 2, review: 0, writes: 1 });
    expect(report.abandoned).toEqual([
      { id: "a", title: "Gone Lore", source: "ixwiki" },
      { id: "p", title: "Kept Lore", source: "ixwiki" },
    ]);
    expect(report.cardsPerSource).toEqual({ ixwiki: 2 });
    expect(report.distribution.overall).toEqual({ MILITARY: 1, UNCATEGORISED: 1 });
    const text = renderBackfillReport(report);
    expect(text).toContain("- Retired, skipped: 2");
    expect(text).toContain("## Abandoned Lore");
    expect(text).toContain("| Gone Lore | ixwiki |");
    expect(text).not.toContain("History of Ixnay");
  });

  it("escapes a table cell's pipe in the markdown", () => {
    const text = renderBackfillReport(
      buildBackfillReport(
        [
          {
            card: card({ title: "A|B" }),
            decision: write("MILITARY", 0.1, { needsReview: true }),
            signals: null,
          },
        ],
        meta
      )
    );
    expect(text).toContain("A\\|B");
  });
});
