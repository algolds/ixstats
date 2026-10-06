import { getArticleRoute, isNonArticlePath } from "~/lib/wiki-os/article-route";

describe("getArticleRoute", () => {
  it.each([
    ["/wiki/Aurelia", { title: "Aurelia", tab: "read" }],
    ["/wiki/Aurelia/", { title: "Aurelia", tab: "read" }],
    ["/wiki/Talk:Aurelia", { title: "Talk:Aurelia", tab: "talk" }],
    ["/wiki/Portal:Eurth", { title: "Portal:Eurth", tab: "read" }],
    ["/wiki/New_Aurelia%20City", { title: "New Aurelia City", tab: "read" }],
    ["/wiki/A/B", { title: "A/B", tab: "read" }],
    // Titles that used to be tool routes are pages now (the old slugs redirect before this renders).
    ["/wiki/Search", { title: "Search", tab: "read" }],
    ["/util/history/Aurelia", { title: "Aurelia", tab: "history" }],
  ])("%s is a page view", (pathname, expected) => {
    expect(getArticleRoute(pathname)).toEqual(expected);
  });

  it("takes the view the page reports (`?action=edit|history`)", () => {
    expect(getArticleRoute("/wiki/Aurelia", "edit")).toEqual({ title: "Aurelia", tab: "edit" });
    expect(getArticleRoute("/wiki/Talk:Aurelia", "history")).toEqual({
      title: "Talk:Aurelia",
      tab: "history",
    });
  });

  it.each([
    "/wiki",
    "/wiki/Main_Page",
    "/wiki/Special:Random",
    "/wiki/special%3Arandom",
    "/util/search",
    "/util/history",
    "/util/whatlinkshere/Aurelia",
    "/stashes",
    "/dashboard",
  ])("%s is not", (pathname) => {
    expect(getArticleRoute(pathname)).toBeNull();
  });
});

describe("isNonArticlePath", () => {
  it("treats Special: pages and non-wiki paths as non-articles, every other /wiki/<title> as a page", () => {
    expect(isNonArticlePath("/wiki/Special:Random")).toBe(true);
    expect(isNonArticlePath("/util/search")).toBe(true);
    expect(isNonArticlePath("/wiki/Search")).toBe(false);
    expect(isNonArticlePath("/wiki/Aurelia")).toBe(false);
    expect(isNonArticlePath("/wiki/Talk:Aurelia")).toBe(false);
  });
});
