/**
 * SL-16: rivalries form from match results (repeated close meetings, or a same-nation derby).
 */
import { describe, it, expect } from "@jest/globals";
import { RIVALRY_RULE, assessRivalry, isCloseResult } from "~/lib/sports/rivalry";

const m = (homeScore: number, awayScore: number) => ({ homeScore, awayScore });

describe("isCloseResult", () => {
  it("treats draws and one-goal games as close in low-scoring sports", () => {
    expect(isCloseResult(0, 0)).toBe(true);
    expect(isCloseResult(2, 1)).toBe(true);
    expect(isCloseResult(3, 1)).toBe(false);
  });

  it("scales the margin with the combined score", () => {
    expect(isCloseResult(101, 96)).toBe(true); // within 5% of 197
    expect(isCloseResult(110, 90)).toBe(false);
  });
});

describe("assessRivalry", () => {
  it("needs enough meetings with enough close ones", () => {
    expect(assessRivalry([m(1, 1), m(2, 1)], false).intensity).toBeNull();
    expect(assessRivalry([m(1, 1), m(5, 0), m(4, 0)], false).intensity).toBeNull();
    expect(assessRivalry([m(1, 1), m(2, 1), m(4, 0)], false)).toEqual({
      meetings: 3,
      closeMeetings: 2,
      derby: false,
      intensity: RIVALRY_RULE.base + 2 * RIVALRY_RULE.perClose,
    });
  });

  it("forms a derby sooner and adds the derby bonus", () => {
    expect(assessRivalry([m(4, 0)], true).intensity).toBeNull();
    expect(assessRivalry([m(4, 0), m(0, 3)], true).intensity).toBe(
      RIVALRY_RULE.base + RIVALRY_RULE.derbyBonus
    );
  });

  it("caps intensity at 100 and ignores unscored meetings", () => {
    const many = Array.from({ length: 10 }, () => m(1, 1));
    expect(assessRivalry(many, true).intensity).toBe(100);
    expect(
      assessRivalry([m(1, 1), m(1, 1), { homeScore: null, awayScore: null }], false).meetings
    ).toBe(2);
  });
});
