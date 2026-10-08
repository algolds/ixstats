import { MAX_PAGE, pageCount, pageParam } from "~/lib/thinkpages-forum/paging";

describe("forum paging", () => {
  it("reads ?page= as a whole number from 1 to MAX_PAGE, else 1", () => {
    expect(pageParam("3")).toBe(3);
    expect(pageParam(["4", "9"])).toBe(4);
    expect(pageParam(String(MAX_PAGE))).toBe(MAX_PAGE);
    for (const bad of [undefined, "", "0", "-2", "1.5", "abc", String(MAX_PAGE + 1)]) {
      expect(pageParam(bad)).toBe(1);
    }
  });

  it("counts at least one page", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
  });
});
