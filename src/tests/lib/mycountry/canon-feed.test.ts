/**
 * Recent activity merges IxTime-stamped effects with wall-clock rows. Effects are converted to real
 * time first, so a directive effect from yesterday sorts below a ledger row from an hour ago and
 * reads "1d ago", not "just now"; diplomatic events with a severity stay under Diplomacy; ledger
 * narratives state only the change.
 */
import { IxTime } from "~/lib/ixtime";
import { buildCanonFeed, canonFeedEffectSince } from "~/lib/mycountry/canon-feed";
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
      ixTimeTimestamp: new Date(IxTime.convertToIxTime(now - 24 * HOUR)),
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
  it("sorts IxTime effects on the real-time clock", () => {
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

  it("filters effects with an IxTime window", () => {
    const since = canonFeedEffectSince(now).getTime();
    expect(since).toBeGreaterThan(now);
    expect(Math.abs(IxTime.convertFromIxTime(since) - (now - 30 * 24 * HOUR))).toBeLessThan(1000);
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
