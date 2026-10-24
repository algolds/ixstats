/** History's one timeline: chronicle and feed merged on the in-game calendar, with filter tags. */
import type { ChronicleEntry } from "~/app/countries/[slug]/_utils/profileLayer";
import type { CountryActivityItem } from "~/app/countries/[slug]/_types";
import { filterTimeline, mergeTimeline } from "~/components/country-profile/history/merge-timeline";

const chronicle = (id: string, kind: ChronicleEntry["kind"], year: number): ChronicleEntry => ({
  id,
  kind,
  title: id,
  detail: null,
  year,
  dateLabel: String(year),
  source: kind === "founding" ? "wiki" : "ixtime",
});

const activity = (
  id: string,
  type: string,
  year: number,
  source = "activity"
): CountryActivityItem => ({
  id,
  type,
  source,
  title: id,
  description: "",
  timestamp: new Date(year * 1000),
});

// One in-game year per real second keeps the expectations readable.
const toYear = (ms: number) => ms / 1000;

describe("mergeTimeline", () => {
  it("merges both sources newest first on the in-game calendar", () => {
    const items = mergeTimeline(
      [chronicle("founded", "founding", -480), chronicle("decided", "decision", 2041.5)],
      [activity("post", "social", 2041.8, "thinkpages"), activity("trade", "economic", 2040)],
      toYear
    );
    expect(items.map((i) => i.id)).toEqual(["post", "decided", "trade", "founded"]);
    expect(items[0]!.at).toBe(2041.8);
  });

  it("puts a feed item before a chronicle entry on the same date, then orders by id", () => {
    const items = mergeTimeline(
      [chronicle("b-entry", "decision", 2041), chronicle("a-entry", "decision", 2041)],
      [activity("feed", "economic", 2041)],
      toYear
    );
    expect(items.map((i) => i.id)).toEqual(["feed", "a-entry", "b-entry"]);
  });

  it("tags the chronicle as Record, diplomacy also as Diplomatic, and the feed by its type", () => {
    const items = mergeTimeline(
      [chronicle("story", "story", 900), chronicle("pact", "diplomacy", 2040)],
      [
        activity("post", "social", 1, "thinkpages"),
        activity("gdp", "economic", 2),
        activity("embassy", "diplomatic", 3),
      ],
      toYear
    );
    const tags = Object.fromEntries(items.map((i) => [i.id, i.tags]));
    expect(tags.story).toEqual(["record"]);
    expect(tags.pact).toEqual(["record", "diplomatic"]);
    expect(tags.post).toEqual(["posts", "social"]);
    expect(tags.gdp).toEqual(["economic"]);
    expect(tags.embassy).toEqual(["diplomatic"]);
  });
});

describe("filterTimeline", () => {
  const items = mergeTimeline(
    [chronicle("pact", "diplomacy", 2040), chronicle("founded", "founding", -480)],
    [activity("embassy", "diplomatic", 3), activity("gdp", "economic", 2)],
    toYear
  );

  it("keeps everything under All", () => {
    expect(filterTimeline(items, "all")).toHaveLength(4);
  });

  it("shows only the chronicle under Record, and both diplomacy kinds under Diplomatic", () => {
    expect(filterTimeline(items, "record").map((i) => i.id)).toEqual(["pact", "founded"]);
    expect(filterTimeline(items, "diplomatic").map((i) => i.id)).toEqual(["pact", "embassy"]);
  });
});
