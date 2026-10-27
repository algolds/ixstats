import { copiesBestFirst, copyPicker, pickedCopy } from "~/lib/cards/face/copy-pick";
import type { CardCopyFacts, CardFinish } from "~/lib/cards/face/types";

const facts = (serialNumber: number, finish: CardFinish, level: number): CardCopyFacts => ({
  ownershipId: `o${serialNumber}`,
  finish,
  serialNumber,
  level,
});
const held = (copy: CardCopyFacts | null) => ({ face: { copy } });
const serials = (list: Array<{ facts: CardCopyFacts }>) => list.map((h) => h.facts.serialNumber);

describe("copiesBestFirst", () => {
  it("puts Serialised, then Holo, Foil and Standard first, whatever the level or serial", () => {
    const list = copiesBestFirst([
      held(facts(1, "STANDARD", 10)),
      held(facts(2, "FOIL", 9)),
      held(facts(3, "HOLO", 1)),
      held(facts(4, "SERIALISED", 1)),
    ]);
    expect(serials(list)).toEqual([4, 3, 2, 1]);
  });

  it("puts the higher level first within a finish, then the lower serial", () => {
    const list = copiesBestFirst([
      held(facts(9, "FOIL", 4)),
      held(facts(5, "FOIL", 2)),
      held(facts(3, "FOIL", 4)),
      held(facts(1, "FOIL", 7)),
    ]);
    expect(serials(list)).toEqual([1, 3, 9, 5]);
  });

  it("keeps each copy with its facts and leaves out one without them", () => {
    const copy = held(facts(7, "HOLO", 2));
    expect(copiesBestFirst([held(null), copy])).toEqual([{ copy, facts: copy.face.copy }]);
  });
});

describe("pickedCopy", () => {
  const list = copiesBestFirst([held(facts(1, "STANDARD", 1)), held(facts(2, "HOLO", 1))]);

  it("is the best copy until another is picked", () => {
    expect(pickedCopy(list, null)?.facts.serialNumber).toBe(2);
    expect(pickedCopy(list, "o1")?.facts.serialNumber).toBe(1);
  });

  it("falls back to the best copy once the picked one is gone, and to none without copies", () => {
    expect(pickedCopy(list, "o99")?.facts.serialNumber).toBe(2);
    expect(pickedCopy([], null)).toBeNull();
  });
});

describe("copyPicker", () => {
  it("needs no picker for one copy, chips up to five, and a dropdown from six", () => {
    expect([0, 1, 2, 5, 6, 50].map(copyPicker)).toEqual([
      "none",
      "none",
      "chips",
      "chips",
      "menu",
      "menu",
    ]);
  });
});
