import { sortHref, sortParam } from "~/lib/thinkpages-forum/thread-sort";

describe("sortParam", () => {
  it.each([
    ["latest", "latest"],
    ["newest", "newest"],
    ["replies", "replies"],
    [["replies", "newest"], "replies"],
    [undefined, "latest"],
    ["", "latest"],
    ["oldest", "latest"],
    [["bogus", "replies"], "latest"],
  ])("reads %j as %s", (value, expected) => {
    expect(sortParam(value)).toBe(expected);
  });
});

describe("sortHref", () => {
  it("leaves the default sort out of the URL", () => {
    expect(sortHref("/thinkpages/c/general", "latest")).toBe("/thinkpages/c/general");
    expect(sortHref("/thinkpages/c/general", "newest")).toBe("/thinkpages/c/general?sort=newest");
    expect(sortHref("/thinkpages/r/eurth/hub", "replies")).toBe(
      "/thinkpages/r/eurth/hub?sort=replies"
    );
  });
});
