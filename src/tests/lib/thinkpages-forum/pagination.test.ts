import { pageWindow } from "~/lib/thinkpages-forum/pagination";

describe("pageWindow", () => {
  it("is just page 1 for a single page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("lists both pages of a two-page list", () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(2, 2)).toEqual([1, 2]);
  });

  it("has no gap when the pages touch", () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps the first and last page and gaps around the current window", () => {
    expect(pageWindow(5, 9)).toEqual([1, "gap", 4, 5, 6, "gap", 9]);
  });

  it("gaps only on the side that needs it", () => {
    expect(pageWindow(1, 9)).toEqual([1, 2, "gap", 9]);
    expect(pageWindow(9, 9)).toEqual([1, "gap", 8, 9]);
    expect(pageWindow(3, 9)).toEqual([1, 2, 3, 4, "gap", 9]);
  });

  it("widens the window with the radius", () => {
    expect(pageWindow(5, 12, 2)).toEqual([1, "gap", 3, 4, 5, 6, 7, "gap", 12]);
  });

  it("clamps a current page outside the list", () => {
    expect(pageWindow(20, 9)).toEqual([1, "gap", 8, 9]);
    expect(pageWindow(0, 9)).toEqual([1, 2, "gap", 9]);
  });

  it("treats an empty list as one page", () => {
    expect(pageWindow(1, 0)).toEqual([1]);
  });
});
