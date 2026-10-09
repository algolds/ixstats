/** @jest-environment node */
import {
  FORUM_HOME,
  categoryHref,
  claimNationHref,
  forumHomeHref,
  newThreadHref,
  threadHref,
} from "~/lib/thinkpages-forum/links";

describe("forum links", () => {
  it("opens the home, with the realm in the query when given", () => {
    expect(FORUM_HOME).toBe("/thinkpages/forum");
    expect(forumHomeHref()).toBe("/thinkpages/forum");
    expect(forumHomeHref(null)).toBe("/thinkpages/forum");
    expect(forumHomeHref("eurth")).toBe("/thinkpages/forum?realm=eurth");
  });

  it("puts sitewide categories under /c and realm categories under /r/<slug>", () => {
    expect(categoryHref({ key: "general" })).toBe("/thinkpages/c/general");
    expect(categoryHref({ key: "general", realm: null })).toBe("/thinkpages/c/general");
    expect(categoryHref({ key: "hub", realm: { slug: "eurth" } })).toBe("/thinkpages/r/eurth/hub");
  });

  it("starts a thread under the category's path", () => {
    expect(newThreadHref({ key: "general" })).toBe("/thinkpages/c/general/new");
    expect(newThreadHref({ key: "hub", realm: { slug: "eurth" } })).toBe(
      "/thinkpages/r/eurth/hub/new"
    );
  });

  it("links threads by id and nation claims to the realm's Nations tab", () => {
    expect(threadHref("t1")).toBe("/thinkpages/t/t1");
    expect(claimNationHref("eurth")).toBe("/r/eurth/nations");
  });

  it("encodes slugs so they cannot add path segments or query parameters", () => {
    expect(forumHomeHref("a&b=c")).toBe("/thinkpages/forum?realm=a%26b%3Dc");
    expect(categoryHref({ key: "hub", realm: { slug: "../x" } })).toBe("/thinkpages/r/..%2Fx/hub");
    expect(claimNationHref("a/b")).toBe("/r/a%2Fb/nations");
  });
});
