/** @jest-environment node */
/** The weekly merge (design decision 18): date-keyed duplicates fold into the ISO rows, and nothing a payout or a card points at is lost. */
import { planWeeklyMerge, type WeeklyRefs, type WeeklyRow } from "~/lib/lorewards/week-merge";

const row = (id: string, date: string, over: Partial<WeeklyRow> = {}): WeeklyRow => ({
  id,
  date,
  dateStart: null,
  dateEnd: null,
  winnerUser: "Galata",
  winnerPage: null,
  winnerScore: null,
  winnerBytes: null,
  runnerUpUser: null,
  runnerUpPage: null,
  runnerUpScore: null,
  runnerUpBytes: null,
  editCount: 0,
  metadata: null,
  status: "approved",
  overriddenAt: null,
  ...over,
});
const iso = (id: string, key: string, start: string, end: string, over: Partial<WeeklyRow> = {}) =>
  row(id, key, { dateStart: start, dateEnd: end, ...over });
const none: WeeklyRefs = { paid: new Set(), cards: new Map() };

it("folds a date-keyed twin into the ISO row and fills what the ISO row lacks", () => {
  const plan = planWeeklyMerge(
    [
      iso("a", "2026-W30", "2026-07-20", "2026-07-26"),
      row("b", "2026-07-20", { winnerPage: "Galatan Empire" }),
    ],
    none
  );
  expect(plan.merges).toEqual([
    {
      key: { date: "2026-W30", dateStart: "2026-07-20", dateEnd: "2026-07-26" },
      survivorId: "a",
      loserIds: ["b"],
      fill: { winnerPage: "Galatan Empire" },
    },
  ]);
});

it("fills a column from the first loser by id, and the edit count only when a loser's is larger", () => {
  const plan = planWeeklyMerge(
    [
      iso("a", "2026-W30", "2026-07-20", "2026-07-26", { editCount: 9 }),
      row("c", "2026-07-20", { winnerScore: 3, editCount: 4 }),
      row("b", "2026-07-20", { winnerScore: 5, metadata: "{}", editCount: 2 }),
    ],
    none
  );
  expect(plan.merges[0]).toMatchObject({
    loserIds: ["b", "c"],
    fill: { winnerScore: 5, metadata: "{}" },
  });
  const larger = planWeeklyMerge(
    [iso("a", "2026-W30", "2026-07-20", "2026-07-26"), row("b", "2026-07-20", { editCount: 7 })],
    none
  );
  expect(larger.merges[0]?.fill).toEqual({ editCount: 7 });
});

it("keeps the paid row, whatever its key", () => {
  const plan = planWeeklyMerge(
    [iso("a", "2026-W30", "2026-07-20", "2026-07-26"), row("b", "2026-07-20")],
    { paid: new Set(["b"]), cards: new Map() }
  );
  expect(plan.merges[0]).toMatchObject({ survivorId: "b", loserIds: ["a"] });
});

it("keeps the carded row over the ISO row, and the ISO row over a lower id", () => {
  const rows = [iso("b", "2026-W30", "2026-07-20", "2026-07-26"), row("a", "2026-07-20")];
  expect(
    planWeeklyMerge(rows, { paid: new Set(), cards: new Map([["a", ["winner"]]]) }).merges[0]
  ).toMatchObject({
    survivorId: "a",
    loserIds: ["b"],
  });
  expect(planWeeklyMerge(rows, none).merges[0]).toMatchObject({ survivorId: "b", loserIds: ["a"] });
  expect(
    planWeeklyMerge(
      [row("b", "2026-07-20"), row("a", "2026-07-20", { dateStart: "2026-07-20" })],
      none
    ).merges[0]
  ).toMatchObject({
    survivorId: "a",
    loserIds: ["b"],
  });
});

it("renames a lone history week, and leaves a canonical one alone", () => {
  const plan = planWeeklyMerge(
    [row("h", "2023-01-01"), iso("c", "2026-W31", "2026-07-27", "2026-08-02")],
    none
  );
  expect(plan.merges).toEqual([
    {
      key: { date: "2023-W01", dateStart: "2023-01-01", dateEnd: "2023-01-07" },
      survivorId: "h",
      loserIds: [],
      fill: {},
    },
  ]);
  expect(plan.unchanged).toBe(1);
});

it("reads the first day of an ISO row with no range from its key", () => {
  const plan = planWeeklyMerge([row("k", "2026-W31"), row("d", "2026-07-27")], none);
  expect(plan.merges).toEqual([
    {
      key: { date: "2026-W31", dateStart: "2026-07-27", dateEnd: "2026-08-02" },
      survivorId: "k",
      loserIds: ["d"],
      fill: {},
    },
  ]);
});

it("reports a row with no first day", () => {
  const plan = planWeeklyMerge([row("x", "2025-W53"), row("y", "someday")], none);
  expect(plan.merges).toEqual([]);
  expect(plan.skipped).toEqual([
    { key: "2025-W53", ids: ["x"], reason: "no first day" },
    { key: "someday", ids: ["y"], reason: "no first day" },
  ]);
});

it("reports two contests on one ISO week, and a week whose rows name different winners", () => {
  const plan = planWeeklyMerge(
    [
      row("s", "2026-03-22", { winnerUser: "Urcea" }),
      iso("m", "2026-W13", "2026-03-23", "2026-03-29", { winnerUser: "Rumahoki" }),
      iso("n", "2026-W14", "2026-03-30", "2026-04-05", { winnerUser: "Nasastan" }),
      row("u", "2026-03-30", { winnerUser: "Urcea" }),
    ],
    none
  );
  expect(plan.merges).toEqual([]);
  expect(plan.skipped).toEqual([
    { key: "2026-W13", ids: ["m", "s"], reason: "different first days" },
    { key: "2026-W14", ids: ["n", "u"], reason: "different holders" },
  ]);
});

it("reports a week whose rows name different runners-up", () => {
  const plan = planWeeklyMerge(
    [
      iso("a", "2026-W33", "2026-08-10", "2026-08-16", { runnerUpUser: "Kistan" }),
      row("b", "2026-08-10", { runnerUpUser: "Urcea" }),
    ],
    none
  );
  expect(plan.skipped).toEqual([{ key: "2026-W33", ids: ["a", "b"], reason: "different holders" }]);
});

it("treats an unrecorded runner-up as no disagreement", () => {
  const plan = planWeeklyMerge(
    [
      iso("a", "2026-W33", "2026-08-10", "2026-08-16", { runnerUpUser: "Kistan" }),
      row("b", "2026-08-10"),
    ],
    none
  );
  expect(plan.merges[0]?.loserIds).toEqual(["b"]);
});

it("leaves a week with an overridden or unapproved row, or rows of different statuses, for the admin", () => {
  const at = new Date("2026-08-20T00:00:00Z");
  const plan = planWeeklyMerge(
    [
      iso("a", "2026-W32", "2026-08-03", "2026-08-09", { overriddenAt: at }),
      row("b", "2026-08-03"),
      row("p", "2026-08-10", { status: "pending" }),
      iso("c", "2026-W34", "2026-08-17", "2026-08-23", { status: "rejected" }),
      row("d", "2026-08-17", { status: "rejected" }),
      row("e", "2023-01-01", { overriddenAt: at }),
    ],
    none
  );
  expect(plan.merges).toEqual([]);
  expect(plan.unchanged).toBe(0);
  expect(plan.skipped).toEqual([
    { key: "2023-W01", ids: ["e"], reason: "overridden or not approved" },
    { key: "2026-W32", ids: ["a", "b"], reason: "overridden or not approved" },
    { key: "2026-W33", ids: ["p"], reason: "overridden or not approved" },
    { key: "2026-W34", ids: ["c", "d"], reason: "overridden or not approved" },
  ]);
});

it("leaves an overridden week already under its ISO key unchanged, not skipped", () => {
  const at = new Date("2026-08-20T00:00:00Z");
  const plan = planWeeklyMerge(
    [iso("a", "2026-W32", "2026-08-03", "2026-08-09", { overriddenAt: at })],
    none
  );
  expect(plan).toEqual({ merges: [], skipped: [], unchanged: 1 });
});

it("refuses a week paid or carded under both rows", () => {
  const rows = [iso("a", "2026-W32", "2026-08-03", "2026-08-09"), row("b", "2026-08-03")];
  expect(
    planWeeklyMerge(rows, { paid: new Set(["a", "b"]), cards: new Map() }).skipped[0]?.reason
  ).toBe("paid twice");
  expect(
    planWeeklyMerge(rows, {
      paid: new Set(),
      cards: new Map([
        ["a", ["winner"]],
        ["b", ["winner"]],
      ]),
    }).skipped[0]?.reason
  ).toBe("carded twice");
  expect(
    planWeeklyMerge(rows, {
      paid: new Set(),
      cards: new Map([
        ["a", ["winner"]],
        ["b", ["runner-up"]],
      ]),
    }).merges[0]?.loserIds
  ).toEqual(["b"]);
});

it("lists merges and skipped weeks in key order", () => {
  const plan = planWeeklyMerge(
    [row("z", "2026-08-10"), row("y", "2023-01-01"), row("q", "2025-W53"), row("p", "2022-01-02")],
    none
  );
  expect(plan.merges.map((m) => m.key.date)).toEqual(["2022-W01", "2023-W01", "2026-W33"]);
  expect(plan.skipped.map((s) => s.key)).toEqual(["2025-W53"]);
});
