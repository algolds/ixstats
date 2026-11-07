/** The Exchange's addresses (src/lib/exchange/routes.ts): every section and object page has its own URL. */
import { bondHref, companyHref, exchangeRouteOf, nationHref, storyHref } from "~/lib/exchange/routes";
import { movedPageRedirectFor } from "~/lib/navigation/moved-pages";

describe("exchangeRouteOf", () => {
  it.each([
    ["/exchange", { kind: "section", section: "front" }],
    ["/exchange/", { kind: "section", section: "front" }],
    ["/exchange/markets/", { kind: "section", section: "markets" }],
    ["/exchange/leaderboards", { kind: "section", section: "leaderboards" }],
    ["/exchange/c/abc", { kind: "company", id: "abc" }],
    ["/exchange/b/b1", { kind: "bond", id: "b1" }],
    ["/exchange/n/x1", { kind: "nation", id: "x1" }],
    ["/exchange/s/n1", { kind: "story", id: "n1" }],
    ["/exchange/c/", { kind: "unknown" }],
    ["/exchange/nope", { kind: "unknown" }],
  ])("%s", (path, route) => {
    expect(exchangeRouteOf(path)).toEqual(route);
  });

  it("builds object hrefs", () => {
    expect([companyHref("c1"), bondHref("b1"), nationHref("x1"), storyHref("n1")]).toEqual([
      "/exchange/c/c1",
      "/exchange/b/b1",
      "/exchange/n/x1",
      "/exchange/s/n1",
    ]);
  });
});

describe("old Exchange addresses", () => {
  it("send the Labs and Vault addresses to /exchange, keeping the query", () => {
    expect(movedPageRedirectFor("/labs/exchange", "realm=x")).toBe("/exchange?realm=x");
    expect(movedPageRedirectFor("/vault/exchange", "")).toBe("/exchange");
  });
});
