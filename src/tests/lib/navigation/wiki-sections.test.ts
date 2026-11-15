/** The Wiki app lists 5 contextual sections and maps specialized /util/* tools to Utilities. */
import { getActiveSectionId, getApp } from "~/lib/navigation/app-sections";

describe("wiki sections", () => {
  it("lists the 5 peer Wiki destinations in order", () => {
    const ids = getApp("wiki").sections.map((section) => section.id);
    expect(ids).toEqual(["main", "repository", "stash", "recent-changes", "utilities"]);
  });

  it("marks Repository, Stash, and Recent changes current on their own routes", () => {
    const wiki = getApp("wiki");
    expect(getActiveSectionId(wiki, "/wiki", null)).toBe("main");
    expect(getActiveSectionId(wiki, "/wiki/Main_Page", null)).toBe("main");
    expect(getActiveSectionId(wiki, "/util/repository", null)).toBe("repository");
    expect(getActiveSectionId(wiki, "/stashes", null)).toBe("stash");
    expect(getActiveSectionId(wiki, "/util/recent-changes", null)).toBe("recent-changes");
  });

  it("highlights Utilities on /util and consolidated utility sub-routes", () => {
    const wiki = getApp("wiki");
    expect(getActiveSectionId(wiki, "/util", null)).toBe("utilities");
    expect(getActiveSectionId(wiki, "/util/lorewards", null)).toBe("utilities");
    expect(getActiveSectionId(wiki, "/util/search", null)).toBe("utilities");
    expect(getActiveSectionId(wiki, "/util/categories", null)).toBe("utilities");
  });
});
