/**
 * Recent activity merges effects with the other rows on real time: an effect is placed by when it was written, never
 * by its realm-clock stamp, so a directive effect from yesterday sorts below a ledger row from an hour ago and reads
 * "1d ago", not "just now", however fast (or paused) its realm's clock runs; diplomatic events with a severity stay
 * under Diplomacy; ledger narratives state only the change.
 */
import { buildCanonFeed, canonFeedSince } from "~/lib/mycountry/canon-feed";
import { describeRecord } from "~/components/mycountry/shell/recordNarrative";
import { timeAgo } from "~/lib/format/compact";

const HOUR = 60 * 60 * 1000;
const now = Date.now();

const sources = {
  effects: [
    {
      id: "e1",
      description: "Directive: Balance the budget",
      inputType: "GDP_LEVEL_ADJUSTMENT",
      createdAt: new Date(now - 24 * HOUR),
    },
  ],
  events: [{ id: "d1", title: "Border incident", createdAt: new Date(now - 2 * HOUR) }],
  decisions: [],
  logs: [
    {
      id: "l1",
      description: "Population update",
      deltaValue: 1200,
      targetField: "currentPopulation",
      sourceType: "issue",
      createdAt: new Date(now - HOUR),
    },
  ],
};

describe("buildCanonFeed", () => {
  it("shows an effect's coded source as words (stress C-26)", () => {
    const [item] = buildCanonFeed(
      {
        effects: [
          {
            id: "e2",
            description: "Foreign policy: free_trade (moderate) with Kandara",
            inputType: "TRADE_AGREEMENT",
            createdAt: new Date(now),
          },
          {
            id: "e3",
            description: null,
            inputType: "gdp_level_adjustment",
            createdAt: new Date(now - HOUR),
          },
        ],
        events: [],
        decisions: [],
        logs: [],
      },
      10
    );
    expect(item?.title).toBe("Foreign policy: free trade (moderate) with Kandara");
  });

  it("sorts effects on the real-time clock", () => {
    const items = buildCanonFeed(sources, 10);
    expect(items.map((i) => i.id)).toEqual(["log_l1", "dip_d1", "eff_e1"]);
    const effect = items.find((i) => i.kind === "effect")!;
    expect(Math.abs(effect.timestamp - (now - 24 * HOUR))).toBeLessThan(1000);
    expect(timeAgo(effect.timestamp)).not.toBe("just now");
  });

  it("files every diplomatic event under Diplomacy", () => {
    const items = buildCanonFeed(sources, 10);
    expect(items.find((i) => i.kind === "diplomacy")?.category).toBe("diplomatic");
  });

  it("filters on a 30 real-day window", () => {
    expect(canonFeedSince(now).getTime()).toBe(now - 30 * 24 * HOUR);
  });
});

describe("describeRecord", () => {
  it("states a ledger change without inventing a cause", () => {
    const { narrative } = describeRecord(
      {
        id: "x",
        title: "Census",
        kind: "ledger",
        timestamp: now,
        deltaValue: 1200,
        targetField: "currentPopulation",
      },
      "Ledger"
    );
    expect(narrative).toBe("Population changed by +1,200.");
  });
});
