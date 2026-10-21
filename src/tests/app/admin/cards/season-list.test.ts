/** @jest-environment node */
/** The admin's season field: ranges and single seasons; an empty or unreadable list means every season. */
import { parseSeasonList } from "~/app/admin/cards/imports/ns/season-list";

it.each([
  ["1-3, 5", [1, 2, 3, 5]],
  ["13", [13]],
  ["3-1", []],
  ["", []],
  ["x, 2", [2]],
  ["2, 2-3", [2, 3]],
  [" 4 - 6 ,", [4, 5, 6]],
  ["0, 101, 99-102", [99, 100]],
  ["1e2, 0x3, -4, 2.5", []],
])("%p reads as %p", (text, seasons) => {
  expect(parseSeasonList(text)).toEqual(seasons);
});

it("reads a huge range as far as the last season, without walking it", () => {
  expect(parseSeasonList("98-99999999999")).toEqual([98, 99, 100]);
});
