/** @jest-environment node */
/**
 * A weekly or monthly contest can be stored twice: keyed `2026-W42` by the state file (with its range) and by its
 * first day by the OOL page. Its identity is its type and first day, so its places act once.
 */
import { describe, it, expect } from "@jest/globals";
import { matches, storedEntry } from "~/tests/helpers/loreward-entry-store";
import {
  contestEntriesWhere,
  contestHolder,
  contestIdentity,
  contestPlaceKey,
  describeConflict,
  groupByContest,
  type ContestEntry,
} from "~/lib/lorewards/contest-identity";

const entry = (id: string, over: Partial<ContestEntry> = {}): ContestEntry => ({
  id,
  type: "weekly",
  date: "2026-10-12",
  dateStart: null,
  winnerUser: "Urcea",
  runnerUpUser: null,
  ...over,
});
const stateKeyed = (id: string, over: Partial<ContestEntry> = {}) =>
  entry(id, { date: "2026-W42", dateStart: "2026-10-12", ...over });

describe("contestIdentity", () => {
  it("is a weekly's or monthly's first day, whichever key it is stored under", () => {
    expect(contestIdentity(stateKeyed("a"))).toBe("weekly:2026-10-12");
    expect(contestIdentity(entry("b"))).toBe("weekly:2026-10-12");
    const month = { type: "monthly", date: "2026-07", dateStart: "2026-07-01" };
    expect(contestIdentity(month)).toBe(
      contestIdentity({ ...month, date: "2026-07-01", dateStart: null })
    );
  });

  it("is a daily's date", () => {
    expect(contestIdentity({ type: "daily", date: "2026-10-16", dateStart: null })).toBe(
      "daily:2026-10-16"
    );
  });
});

describe("contestEntriesWhere", () => {
  it("finds every entry of a weekly, under either key, and only those", () => {
    const where = contestEntriesWhere(entry("b"));
    expect(where).toEqual({
      type: "weekly",
      OR: [{ dateStart: "2026-10-12" }, { dateStart: null, date: "2026-10-12" }],
    });
    expect(contestEntriesWhere(stateKeyed("a"))).toEqual(where);
    const rows = [
      storedEntry({ id: "ool", type: "weekly", date: "2026-10-12" }),
      storedEntry({ id: "state", type: "weekly", date: "2026-W42", dateStart: "2026-10-12" }),
      storedEntry({ id: "next", type: "weekly", date: "2026-W43", dateStart: "2026-10-19" }),
      storedEntry({ id: "daily", type: "daily", date: "2026-10-12" }),
    ];
    expect(
      rows
        .filter((row) => matches(row, where as Parameters<typeof matches>[1]))
        .map((row) => row.id)
    ).toEqual(["ool", "state"]);
  });

  it("finds a daily by its date", () => {
    expect(contestEntriesWhere({ type: "daily", date: "2026-10-16", dateStart: null })).toEqual({
      type: "daily",
      date: "2026-10-16",
    });
  });
});

describe("contestPlaceKey", () => {
  it("is one key for a place of a contest, whichever entry of it is asked", () => {
    expect(contestPlaceKey(stateKeyed("a"), "winner")).toBe("weekly:2026-10-12:winner");
    expect(contestPlaceKey(entry("b"), "winner")).toBe("weekly:2026-10-12:winner");
    expect(contestPlaceKey(entry("b"), "runner-up")).toBe("weekly:2026-10-12:runner-up");
  });
});

describe("groupByContest", () => {
  it("puts twins together in id order, keeping the contests in the order they first appear", () => {
    const groups = groupByContest([
      entry("z-ool"),
      entry("d1", { type: "daily", date: "2026-10-01" }),
      stateKeyed("a-state"),
    ]);
    expect(groups.map((g) => g.map((e) => e.id))).toEqual([["a-state", "z-ool"], ["d1"]]);
  });
});

describe("contestHolder", () => {
  it("acts through the state-keyed entry when the twins agree", () => {
    const [contest] = groupByContest([entry("a-ool"), stateKeyed("b-state")]);
    expect(contestHolder(contest!, "winner")).toEqual({ entry: stateKeyed("b-state") });
  });

  it("acts through the earliest entry by id without a state-keyed one, and through a single entry", () => {
    const [twins] = groupByContest([entry("b"), entry("a")]);
    expect(contestHolder(twins!, "winner")).toEqual({ entry: entry("a") });
    const [single] = groupByContest([entry("only")]);
    expect(contestHolder(single!, "winner")).toEqual({ entry: entry("only") });
  });

  it("names both entries, and acts through neither, when the twins disagree on a place", () => {
    const [contest] = groupByContest([
      entry("a-ool", { winnerUser: "Urcea" }),
      stateKeyed("b-state", { winnerUser: "Nasastan" }),
    ]);
    const holder = contestHolder(contest!, "winner");
    expect(holder).toEqual({
      conflict: [entry("a-ool"), stateKeyed("b-state", { winnerUser: "Nasastan" })],
    });
    // The runner-up place is not in dispute.
    expect(contestHolder(contest!, "runner-up")).toEqual({
      entry: stateKeyed("b-state", { winnerUser: "Nasastan" }),
    });
    if ("conflict" in holder) {
      expect(describeConflict(holder.conflict, "winner")).toBe(
        "weekly:2026-10-12 winner: a-ool (2026-10-12) names Urcea, b-state (2026-W42) names Nasastan"
      );
    }
  });

  it("treats a wikios> name and its bare label as different holders", () => {
    const [contest] = groupByContest([
      entry("a-ool", { winnerUser: "Kir Republic" }),
      stateKeyed("b-state", { winnerUser: "wikios>Kir Republic" }),
    ]);
    expect(contestHolder(contest!, "winner")).toHaveProperty("conflict");
  });
});
