/** @jest-environment node */
import { byContestDayDesc, findEntriesNewestFirst } from "~/lib/lorewards/entry-feed";

const e = (id: string, type: string, date: string, dateStart: string | null = null) => ({
  id,
  type,
  date,
  dateStart,
});

it("orders a weekly by its first day among dailies, not by its key", () => {
  const rows = [
    e("w", "weekly", "2026-W02", "2026-01-05"),
    e("d1", "daily", "2026-10-01"),
    e("d2", "daily", "2026-01-01"),
  ];
  expect([...rows].sort(byContestDayDesc).map((r) => r.id)).toEqual(["d1", "w", "d2"]);
});

it("pages the merged list: two reads of skip + take each, then the slice", async () => {
  const findMany = jest
    .fn()
    .mockResolvedValueOnce([e("w", "weekly", "2026-W40", "2026-09-28")])
    .mockResolvedValueOnce([
      e("d3", "daily", "2026-10-03"),
      e("d2", "daily", "2026-10-02"),
      e("d1", "daily", "2026-09-27"),
    ]);
  const page = await findEntriesNewestFirst(
    { lorewardEntry: { findMany } } as never,
    { status: "approved" },
    { take: 2, skip: 1 }
  );
  expect(page.map((r) => r.id)).toEqual(["d2", "w"]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ take: 3, orderBy: { date: "desc" } })
  );
});

it("sorts an ISO-keyed weekly with no first day by its Monday, and ties newest id first", () => {
  const rows = [
    e("a", "daily", "2026-08-17"),
    e("w", "weekly", "2026-W34"),
    e("b", "daily", "2026-08-17"),
    e("d", "daily", "2026-08-16"),
  ];
  expect([...rows].sort(byContestDayDesc).map((r) => r.id)).toEqual(["w", "b", "a", "d"]);
});

it("keeps the caller's where on both reads, weeklies and the rest", async () => {
  const findMany = jest.fn().mockResolvedValue([]);
  await findEntriesNewestFirst(
    { lorewardEntry: { findMany } } as never,
    { status: "approved" },
    { take: 5 }
  );
  expect(findMany.mock.calls.map(([args]) => args)).toEqual([
    {
      where: { AND: [{ status: "approved" }, { type: "weekly" }] },
      orderBy: { date: "desc" },
      take: 5,
    },
    {
      where: { AND: [{ status: "approved" }, { type: { not: "weekly" } }] },
      orderBy: { date: "desc" },
      take: 5,
    },
  ]);
});
