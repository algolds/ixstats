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
  });
  const preview = (id: string) => items.find((i) => i.id === `directive:${id}`)?.preview;
  expect(preview("new")).toBe("Executing · Economy");
  expect(preview("old")).toBe("In force · Economy");
  expect(items.some((i) => i.preview.includes("% done"))).toBe(false);
});
