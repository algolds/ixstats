/** @jest-environment node */
/**
 * The admin's Loreward override form: a blank field is left out, so the stored value stays (the override keeps it);
 * only "No winner" or "No runner-up" empties a place. The success message counts the trophies the override moved.
 */
import { describe, it, expect } from "@jest/globals";
import {
  overrideFields,
  trophyChangeNote,
  type OverridePlaceForm,
} from "~/lib/lorewards/override-form";

const blank: OverridePlaceForm = { user: "", page: "", score: "", bytes: "", cleared: false };

describe("overrideFields", () => {
  it("leaves out every blank field, so a winner-only correction keeps the runner-up", () => {
    expect(overrideFields({ ...blank, user: " Cy ", page: "New page", score: "0" }, blank)).toEqual(
      {
        winnerUser: "Cy",
        winnerPage: "New page",
        winnerScore: 0,
        winnerBytes: undefined,
        runnerUpUser: undefined,
        runnerUpPage: undefined,
        runnerUpScore: undefined,
        runnerUpBytes: undefined,
      }
    );
  });

  it("sends null for all four fields of a place the admin emptied, whatever its inputs hold", () => {
    expect(
      overrideFields(blank, { user: "Bee", page: "Hive", score: "8", bytes: "80", cleared: true })
    ).toEqual({
      winnerUser: undefined,
      winnerPage: undefined,
      winnerScore: undefined,
      winnerBytes: undefined,
      runnerUpUser: null,
      runnerUpPage: null,
      runnerUpScore: null,
      runnerUpBytes: null,
    });
    expect(overrideFields({ ...blank, cleared: true }, { ...blank, bytes: "512" })).toMatchObject({
      winnerUser: null,
      winnerPage: null,
      winnerScore: null,
      winnerBytes: null,
      runnerUpBytes: 512,
    });
  });
});

describe("trophyChangeNote", () => {
  it("counts the trophies moved and voided, in the singular and the plural", () => {
    expect(trophyChangeNote({ reassigned: 1, voided: 0, mintDeferred: false })).toBe(
      "1 trophy moved"
    );
    expect(trophyChangeNote({ reassigned: 0, voided: 1, mintDeferred: false })).toBe(
      "1 trophy voided"
    );
    expect(trophyChangeNote({ reassigned: 2, voided: 3, mintDeferred: false })).toBe(
      "2 trophies moved, 3 trophies voided"
    );
  });

  it("says nothing when no trophy changed, and says when new trophies wait for the next sync", () => {
    expect(trophyChangeNote({ reassigned: 0, voided: 0, mintDeferred: false })).toBe("");
    expect(trophyChangeNote({ reassigned: 0, voided: 0, mintDeferred: true })).toBe(
      "New trophies are minted on the next sync."
    );
    expect(trophyChangeNote({ reassigned: 1, voided: 0, mintDeferred: true })).toBe(
      "1 trophy moved. New trophies are minted on the next sync."
    );
  });
});
