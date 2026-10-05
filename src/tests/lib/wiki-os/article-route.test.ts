import { getArticleRoute, isNonArticlePath } from "~/lib/wiki-os/article-route";

describe("getArticleRoute", () => {
  it.each([
    ["/wiki/Aurelia", { slug: "Aurelia", tab: "read" }],
    ["/wiki/Aurelia/", { slug: "Aurelia", tab: "read" }],
    ["/wiki/Aurelia/edit", { slug: "Aurelia", tab: "edit" }],
    ["/wiki/Aurelia/talk", { slug: "Aurelia", tab: "talk" }],
    ["/wiki/Portal:Eurth", { slug: "Portal:Eurth", tab: "read" }],
    ["/wiki/New_Aurelia%20City", { slug: "New_Aurelia%20City", tab: "read" }],
    ["/util/history/Aurelia", { slug: "Aurelia", tab: "history" }],
  ])("%s is an article view", (pathname, expected) => {
    expect(getArticleRoute(pathname)).toEqual(expected);
  });

  it.each([
    "/wiki",
    "/wiki/Main_Page",
    "/wiki/search",
    "/wiki/recent-changes",
    "/wiki/Special:Random",
    "/wiki/special%3Arandom",
    "/wiki/Aurelia/unknown",
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
  it("treats tool routes, Special: pages and non-wiki paths as non-articles", () => {
    expect(isNonArticlePath("/wiki/search")).toBe(true);
    expect(isNonArticlePath("/wiki/Special:Random")).toBe(true);
    expect(isNonArticlePath("/util/search")).toBe(true);
    expect(isNonArticlePath("/wiki/Aurelia")).toBe(false);
    expect(isNonArticlePath("/wiki/Aurelia/talk")).toBe(false);
  });
});
