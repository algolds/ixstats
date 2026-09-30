import { describe, it, expect } from "@jest/globals";
import {
  buildChronicle,
  countOwnerDirectives,
  leadParagraphs,
  parseLoreYear,
  pickLoreSection,
  redirectTarget,
  splitCanonFeed,
  splitWikiSections,
  toPublicDirectives,
  toPublicIssueOutcomes,
  wikiToParagraphs,
  yearlySeries,
  LORE_CHAPTER_KEYWORDS,
  type IntentLike,
  type IssueLike,
} from "~/app/countries/[slug]/_utils/profileLayer";

const ixTime = (iso: string) => Date.parse(iso);

const intent = (overrides: Partial<IntentLike>): IntentLike => ({
  id: "i",
  goal: "Goal",
  tier: "measured",
  category: "economy",
  status: "active",
  summary: null,
  progress: 40,
  createdIxTime: ixTime("2041-03-01T00:00:00Z"),
  ...overrides,
});

const issue = (overrides: Partial<IssueLike>): IssueLike => ({
  id: "n",
  title: "Issue",
  domain: "economy",
  status: "responded",
  chosenOptionLabel: "Option A",
  consequenceLog: "Approval rose.",
  respondedIxTime: ixTime("2041-05-01T00:00:00Z"),
  ...overrides,
});

describe("public record filter", () => {
  it("keeps only enacted directives (in force or completed), newest first", () => {
    const result = toPublicDirectives([
      intent({ id: "draft", status: "proposed" }),
      intent({ id: "old", status: "completed", createdIxTime: ixTime("2040-01-01T00:00:00Z") }),
      intent({ id: "withdrawn", status: "abandoned" }),
      intent({ id: "new", status: "active", createdIxTime: ixTime("2042-01-01T00:00:00Z") }),
    ]);
    expect(result.map((d) => d.id)).toEqual(["new", "old"]);
    expect(result.find((d) => d.id === "old")?.progress).toBe(40);
    // A draft tier never counts as enacted, whatever its status says.
    expect(toPublicDirectives([intent({ id: "odd", status: "active", tier: "proposed" })])).toEqual(
      []
    );
    // Nothing private rides along.
    expect(Object.keys(result[0]!)).not.toContain("changesJson");
    expect(Object.keys(result[0]!)).not.toContain("civCapCost");
  });

  it("counts drafts and directives in force for the owner layer only", () => {
    expect(
      countOwnerDirectives([
        intent({ status: "proposed" }),
        intent({ status: "proposed" }),
        intent({ status: "active" }),
        intent({ status: "completed" }),
      ])
    ).toEqual({ drafts: 2, active: 1 });
  });

  it("keeps only resolved issues and names the decision and outcome", () => {
    const result = toPublicIssueOutcomes([
      issue({ id: "open", status: "pending" }),
      issue({ id: "seen", status: "viewed" }),
      issue({ id: "expired", status: "expired" }),
      issue({ id: "dismissed", status: "dismissed" }),
      issue({ id: "chosen" }),
      issue({
        id: "lapsed",
        status: "auto_resolved",
        chosenOptionLabel: null,
        autoResolveLabel: "Default path",
        respondedIxTime: ixTime("2041-06-01T00:00:00Z"),
      }),
    ]);
    expect(result.map((o) => o.id)).toEqual(["lapsed", "chosen"]);
    expect(result[0]).toMatchObject({ decision: "Default path", resolvedBy: "default" });
    expect(result[1]).toMatchObject({
      decision: "Option A",
      outcome: "Approval rose.",
      resolvedBy: "government",
    });
  });
});

describe("chronicle", () => {
  it("parses lore years, skipping day numbers and honouring BC", () => {
    expect(parseLoreYear("12 March 1622")).toBe(1622);
    expect(parseLoreYear("c. 900 BC")).toBe(-900);
    expect(parseLoreYear("1848–1851")).toBe(1848);
    expect(parseLoreYear("{{start date|1701|5|3}}")).toBe(1701);
    expect(parseLoreYear("unknown")).toBeNull();
  });

  it("merges every source oldest first, preferring outcomes over bare canon titles", () => {
    const entries = buildChronicle({
      founding: [
        { event: "Unification", date: "4 July 1622" },
        { event: "Undated", date: "long ago" },
      ],
      storyPins: [
        { id: "p1", title: "Battle of the Ford", ixTimeYear: 1703, content: "Cavalry held." },
      ],
      directives: toPublicDirectives([intent({ id: "d1", goal: "Open the ports" })]),
      issueOutcomes: toPublicIssueOutcomes([issue({ id: "x1", title: "Grain riots" })]),
      decisions: [
        { id: "x1", title: "Grain riots", ixTime: ixTime("2041-05-01T00:00:00Z") },
        { id: "x2", title: "Rail strike", ixTime: ixTime("2041-07-01T00:00:00Z") },
      ],
      diplomacy: [{ id: "e1", title: "Treaty of Lune", ixTime: ixTime("2040-02-01T00:00:00Z") }],
    });

    expect(entries.map((e) => e.title)).toEqual([
      "Unification",
      "Battle of the Ford",
      "Treaty of Lune",
      "Open the ports",
      "Grain riots",
      "Rail strike",
    ]);
    expect(entries.filter((e) => e.title === "Grain riots")).toHaveLength(1);
    expect(entries.find((e) => e.title === "Grain riots")?.detail).toBe(
      "Option A — Approval rose."
    );
    expect(entries[0]).toMatchObject({ kind: "founding", dateLabel: "1622", source: "wiki" });
    expect(entries[1]).toMatchObject({ kind: "story", source: "map" });
  });

  it("splits the canon feed into decisions and diplomacy on the IxTime calendar", () => {
    const toIxTime = (ms: number) => ms * 2;
    const { decisions, diplomacy } = splitCanonFeed(
      [
        { id: "dec_abc", kind: "decision", title: "A", timestamp: 10 },
        { id: "dip_def", kind: "diplomacy", title: "B", timestamp: 20 },
        { id: "log_x", kind: "ledger", title: "C", timestamp: 30 },
      ],
      toIxTime
    );
    expect(decisions).toEqual([{ id: "abc", title: "A", ixTime: 20 }]);
    expect(diplomacy).toEqual([{ id: "def", title: "B", ixTime: 40 }]);
  });
});

describe("wiki lore", () => {
  const article = [
    "{{Infobox country",
    "| name = Testland",
    "| capital = [[Port Test]]",
    "}}",
    "'''Testland''', officially the {{wp|federal republic|Federal Republic}} of Testland, is a country on the coast of the [[Argic Ocean]].<ref>Source</ref>",
    "",
    "== History ==",
    "{{Main|History of Testland}}",
    "The first settlers reached the [[Test River|river valley]] in the ninth century and founded several towns.",
    "",
    "=== Unification ===",
    "In 1622 the towns united under a single crown after a long and costly war of succession.",
    "",
    '{| class="wikitable"',
    "| a || b",
    "|}",
    "* a list item that should be dropped from the prose",
    "",
    "== Geography ==",
    "[[File:Map.png|thumb|A map]]",
    "Testland is a land of rolling hills, broad rivers and a long, rugged coastline to the south.",
    "",
    "== Economy ==",
    "Short.",
  ].join("\n");

  it("splits the lead and level-2 sections", () => {
    const { lead, sections } = splitWikiSections(article);
    expect(lead).toContain("Infobox");
    expect(sections.map((s) => s.title)).toEqual(["History", "Geography", "Economy"]);
    expect(sections[0]!.body).toContain("Unification");
  });

  it("turns wikitext into clean prose paragraphs", () => {
    const { lead, sections } = splitWikiSections(article);
    expect(leadParagraphs(lead)).toEqual([
      "Testland, officially the Federal Republic of Testland, is a country on the coast of the Argic Ocean.",
    ]);
    const history = wikiToParagraphs(sections[0]!.body);
    expect(history).toEqual([
      "The first settlers reached the river valley in the ninth century and founded several towns.",
      "In 1622 the towns united under a single crown after a long and costly war of succession.",
    ]);
  });

  it("picks a chapter's section by keyword and skips sections without prose", () => {
    const { sections } = splitWikiSections(article);
    expect(pickLoreSection(sections, LORE_CHAPTER_KEYWORDS.land)?.heading).toBe("Geography");
    expect(pickLoreSection(sections, LORE_CHAPTER_KEYWORDS.economy)).toBeNull();
    expect(pickLoreSection(sections, LORE_CHAPTER_KEYWORDS.world)).toBeNull();
  });

  it("detects redirects", () => {
    expect(redirectTarget("#REDIRECT [[Republic of Testland]]")).toBe("Republic of Testland");
    expect(redirectTarget(article)).toBeNull();
  });
});

describe("economy series", () => {
  it("keeps one reading per year, oldest first, and drops empty points", () => {
    expect(
      yearlySeries([
        { year: 2041, gdp: 5, population: 1 },
        { year: 2040, gdp: 3, population: 1 },
        { year: 2041, gdp: 6, population: 2 },
        { year: 2039, gdp: 0, population: 1 },
      ])
    ).toEqual([
      { year: 2040, gdp: 3, population: 1 },
      { year: 2041, gdp: 6, population: 2 },
    ]);
    expect(yearlySeries(undefined)).toEqual([]);
  });
});
