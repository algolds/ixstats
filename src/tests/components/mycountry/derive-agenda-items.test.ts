/**
 * An active directive on the agenda shows its execution phase, never a stuck "0% done" (its stored
 * progress only moves when linked resistance resolves).
 */
jest.mock("iconoir-react", () => new Proxy({}, { get: () => () => null }));

import { deriveAgendaItems } from "~/components/mycountry/shell/agenda/deriveAgendaItems";

const DAY = 86_400_000;
const now = Date.UTC(2043, 0, 15);
const directive = (id: string, createdIxTime: number) => ({
  id,
  goal: `Goal ${id}`,
  status: "active",
  category: "economy",
  progress: 0,
  createdIxTime,
});

it("shows Executing in the execution week and In force after it", () => {
  const items = deriveAgendaItems({
    intents: [directive("new", now - DAY), directive("old", now - 30 * DAY)],
    nowIxTime: now,
    multiplier: 2,
  });
  const preview = (id: string) => items.find((i) => i.id === `directive:${id}`)?.preview;
  expect(preview("new")).toBe("Executing · Economy");
  expect(preview("old")).toBe("In force · Economy");
  expect(items.some((i) => i.preview.includes("% done"))).toBe(false);
});

describe("deadline pressure at the realm's speed", () => {
  const issue = (deadlineIxTime: number) => ({
    id: "i1",
    title: "Port strike",
    deadlineIxTime,
  });
  const election = (scheduledIxTime: number) => ({
    id: "e1",
    name: "General election",
    scheduledIxTime,
  });
  const urgencyOf = (multiplier: number, deadline: number, scheduled: number) =>
    deriveAgendaItems({
      issues: [issue(deadline)],
      elections: [election(scheduled)],
      nowIxTime: now,
      multiplier,
    }).map((i) => [i.kind, i.urgency]);

  it("keeps Ixnay's thresholds: two in-world days for an issue, a week for an election", () => {
    expect(urgencyOf(2, now + 2 * DAY, now + 7 * DAY)).toEqual([
      ["issue", "due-soon"],
      ["election", "due-soon"],
    ]);
    expect(urgencyOf(2, now + 3 * DAY, now + 8 * DAY)).toEqual([
      ["issue", null],
      ["election", "upcoming"],
    ]);
  });

  it("turns due soon earlier in game time in a 6× realm (a real day is six in-world days)", () => {
    expect(urgencyOf(6, now + 5 * DAY, now + 20 * DAY)).toEqual([
      ["issue", "due-soon"],
      ["election", "due-soon"],
    ]);
  });

  it("never comes due in a paused realm, though a past deadline stays overdue", () => {
    expect(urgencyOf(0, now + DAY, now + DAY)).toEqual([
      ["issue", null],
      ["election", "upcoming"],
    ]);
    expect(urgencyOf(0, now - DAY, now + DAY)[0]).toEqual(["issue", "overdue"]);
  });
});
