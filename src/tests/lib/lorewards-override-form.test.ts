/** @jest-environment node */
/**
 * The admin's Loreward override form: a blank field is left out, so the stored value stays (the override keeps it);
 * only "No winner" or "No runner-up" empties a place. The success message counts the trophies the override moved.
 */
import { describe, it, expect } from "@jest/globals";
import {
  overrideDateSchema,
  overrideFields,
  overrideToast,
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

describe("overrideToast", () => {
  const moved = { reassigned: 1, voided: 0, mintDeferred: false };
  const nothing = { reassigned: 0, voided: 0, mintDeferred: false };

  it("says saved and announced when the bot was told, with the trophy note", () => {
    expect(overrideToast(true, moved)).toEqual({
      tone: "success",
      title: "Winner overridden",
      message: "The override is saved and announced. 1 trophy moved",
    });
    expect(overrideToast(true, nothing).message).toBe("The override is saved and announced.");
  });

  it("says the override is saved but nothing was announced when the bot was not told", () => {
    expect(overrideToast(false, moved)).toEqual({
      tone: "warning",
      title: "Saved",
      message:
        "The Discord bot was not told, so nothing was announced. It picks the change up on its next sync. 1 trophy moved",
    });
    expect(overrideToast(false, { ...nothing, mintDeferred: true }).message).toBe(
      "The Discord bot was not told, so nothing was announced. It picks the change up on its next sync. New trophies are minted on the next sync."
    );
  });
});

describe("overrideDateSchema", () => {
  it("takes a real calendar date, leap days included", () => {
    for (const day of ["2026-10-22", "2026-02-28", "2024-02-29", "2026-12-31"]) {
      expect(overrideDateSchema.safeParse(day).success).toBe(true);
    }
  });

  it("refuses a day the calendar lacks, a state key and anything not YYYY-MM-DD", () => {
    for (const day of [
      "2026-02-30",
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-W43",
      "2026-07",
      "",
    ]) {
      expect(overrideDateSchema.safeParse(day).success).toBe(false);
    }
    expect(overrideDateSchema.safeParse("2026-02-30").error?.issues[0]?.message).toBe(
      "Enter a real calendar date, as YYYY-MM-DD."
    );
  });
});
