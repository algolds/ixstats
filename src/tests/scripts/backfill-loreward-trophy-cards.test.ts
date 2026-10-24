/** @jest-environment node */
/** The trophy backfill script: its flags and the lines it prints. */
import {
  backfillSummary,
  parseBackfillArgs,
} from "../../../scripts/backfill-loreward-trophy-cards";

const report = {
  missing: { "daily:winner": 2, "weekly:runner-up": 1 },
  minted: 3,
  granted: 1,
  waiting: 2,
};

it("dry-runs unless --apply, and --dry-run wins", () => {
  expect(parseBackfillArgs([])).toEqual({ apply: false });
  expect(parseBackfillArgs(["--apply"])).toEqual({ apply: true });
  expect(parseBackfillArgs(["--apply", "--dry-run"])).toEqual({ apply: false });
});

it("ends an apply with what it minted, granted and left waiting for a claim", () => {
  expect(backfillSummary(report, true).at(-1)).toBe("Minted 3, granted 1, 2 wait for a claim.");
});

it("ends a dry run with the cards already waiting and how to write", () => {
  const lines = backfillSummary({ ...report, minted: 0, granted: 0 }, false);
  expect(lines[0]).toBe('Trophy cards missing: 3 {"daily:winner":2,"weekly:runner-up":1}');
  expect(lines.slice(1)).toEqual([
    "Trophy cards already waiting for a claim: 2.",
    "Dry run: nothing written. Re-run with --apply to mint them.",
  ]);
});
