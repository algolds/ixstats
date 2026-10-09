/** @jest-environment node */
import {
  FORUM_HOME,
  categoryHref,
  claimNationHref,
  forumHomeHref,
  hubHref,
  modHref,
  newThreadHref,
  postHref,
  STANDING_HREF,
  threadHref,
} from "~/lib/thinkpages-forum/links";

describe("forum links", () => {
  it("opens the home, with the realm in the query when given", () => {
    expect(FORUM_HOME).toBe("/thinkpages");
    expect(forumHomeHref()).toBe("/thinkpages");
    expect(forumHomeHref(null)).toBe("/thinkpages");
    expect(forumHomeHref("")).toBe("/thinkpages");
    expect(forumHomeHref("eurth")).toBe("/thinkpages?realm=eurth");
    expect(forumHomeHref("a b")).toBe("/thinkpages?realm=a%20b");
  });

  it("puts sitewide categories under /c and realm categories under /r/<slug>", () => {
    expect(categoryHref({ key: "general" })).toBe("/thinkpages/c/general");
    expect(categoryHref({ key: "general", realm: null })).toBe("/thinkpages/c/general");
    expect(categoryHref({ key: "hub", realm: { slug: "eurth" } })).toBe("/thinkpages/r/eurth/hub");
  });

  it("opens a realm's Hub, encoding the slug", () => {
    expect(hubHref("eurth")).toBe("/thinkpages/r/eurth/hub");
    expect(hubHref("a/b")).toBe("/thinkpages/r/a%2Fb/hub");
  });

  it("starts a thread under the category's path", () => {
    expect(newThreadHref({ key: "general" })).toBe("/thinkpages/c/general/new");
    expect(newThreadHref({ key: "hub", realm: { slug: "eurth" } })).toBe(
      "/thinkpages/r/eurth/hub/new"
    );
  });

  it("links threads by id and nation claims to the realm's Nations tab", () => {
    expect(threadHref("t1")).toBe("/thinkpages/t/t1");
    expect(postHref("p9")).toBe("/thinkpages/post/p9");
    expect(postHref("a/b")).toBe("/thinkpages/post/a%2Fb");
    expect(claimNationHref("eurth")).toBe("/r/eurth/nations");
  });

  it("encodes slugs so they cannot add path segments or query parameters", () => {
    expect(forumHomeHref("a&b=c")).toBe("/thinkpages?realm=a%26b%3Dc");
    expect(categoryHref({ key: "hub", realm: { slug: "../x" } })).toBe("/thinkpages/r/..%2Fx/hub");
    expect(claimNationHref("a/b")).toBe("/r/a%2Fb/nations");
  });

  it("opens the moderation console, encoding the tab and realm", () => {
    expect(modHref()).toBe("/thinkpages/mod");
    expect(modHref({ realm: "eurth" })).toBe("/thinkpages/mod?realm=eurth");
    expect(modHref({ tab: "bans", realm: "a&b" })).toBe("/thinkpages/mod?tab=bans&realm=a%26b");
    expect(modHref({ tab: "log=x" })).toBe("/thinkpages/mod?tab=log%3Dx");
  });

  it("links the member's standing on the forum home", () => {
    expect(STANDING_HREF).toBe("/thinkpages#standing");
  });
});
