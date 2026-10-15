import { orderNations } from "~/lib/realms/nation-order";

const nations = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, mine: i === 7 || i === 21 }));
const ids = (list: { id: string }[]) => list.map((n) => n.id);

describe("orderNations", () => {
  it("puts the viewer's nations first", () => {
    const ordered = orderNations(nations, 1);
    expect(ordered.slice(0, 2).every((n) => n.mine)).toBe(true);
    expect(ordered.slice(2).some((n) => n.mine)).toBe(false);
  });

  it("keeps every nation once and leaves the input alone", () => {
    const before = ids(nations);
    expect(ids(orderNations(nations, 1)).sort()).toEqual([...before].sort());
    expect(ids(nations)).toEqual(before);
  });

  it("is stable for one seed and shuffles across seeds", () => {
    expect(ids(orderNations(nations, 1))).toEqual(ids(orderNations(nations, 1)));
    expect(ids(orderNations(nations, 1))).not.toEqual(ids(orderNations(nations, 2)));
  });
});
