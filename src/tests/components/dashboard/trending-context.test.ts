/** Non-wiki Trending rows explain where they trend from and link somewhere useful. */
import { trendingContext } from "~/components/dashboard/sections/feed/trendingContext";

const ts = new Date().toISOString();

describe("trendingContext", () => {
  it("describes a ThinkPages post by its engagement and links to the post", () => {
    const ctx = trendingContext({
      source: "thinkpages",
      url: "/dashboard/post/p1",
      timestamp: ts,
      engagement: { likes: 1, replies: 3, reposts: 0, views: 1200 },
    });
    expect(ctx.origin).toMatch(/ThinkPages post/);
    expect(ctx.signals).toEqual(["1 like", "3 replies", "1,200 views"]);
    expect(ctx).toMatchObject({ href: "/dashboard/post/p1", action: "Open post" });
  });

  it("sends nation activity, which has no page of its own, to the activity feed", () => {
    expect(trendingContext({ source: "ixstats", timestamp: ts })).toMatchObject({
      href: "/feed",
      action: "Open activity feed",
    });
  });

  it("explains a crisis without inventing a link, counting casualties", () => {
    const ctx = trendingContext({ source: "crisis", timestamp: ts, engagement: { views: 2 } });
    expect(ctx).toMatchObject({ href: null, action: null, signals: ["2 casualties"] });
    expect(ctx.origin).toMatch(/crisis/);
  });
});
