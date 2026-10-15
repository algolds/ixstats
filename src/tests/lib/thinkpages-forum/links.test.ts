/** @jest-environment node */
import {
  ATTACH_PARAM,
  FORUM_HOME,
  categoryHref,
  claimNationHref,
  forumHomeHref,
  handleProfileHref,
  hubHref,
  isForumPath,
  modHref,
  NEW_POSTS_HREF,
  newThreadAttachHref,
  newThreadHref,
  personaProfileHref,
  postHref,
  realmBoardAttachHref,
  realmBoardHref,
  realmHref,
  STANDING_HREF,
  threadHref,
  unreadHref,
  WATCHED_HREF,
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

  it("opens a realm's landing page, encoding the slug, and anchors a message on it", () => {
    expect(realmHref("eurth")).toBe("/thinkpages/r/eurth");
    expect(realmHref("a/b")).toBe("/thinkpages/r/a%2Fb");
    expect(realmBoardHref("eurth")).toBe("/thinkpages/r/eurth");
    expect(realmBoardHref("eurth", "p 1")).toBe("/thinkpages/r/eurth#post-p%201");
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

  it("names the signed-in pages, the jump to unread and the profile links", () => {
    expect(NEW_POSTS_HREF).toBe("/thinkpages/new");
    expect(WATCHED_HREF).toBe("/thinkpages/watched");
    expect(unreadHref("t1")).toBe("/thinkpages/t/t1/unread");
    expect(unreadHref("a/b")).toBe("/thinkpages/t/a%2Fb/unread");
    expect(handleProfileHref("kir")).toBe("/id/kir");
    expect(personaProfileHref("Aria_V")).toBe("/dashboard/profile/Aria_V");
    expect(personaProfileHref("a/b")).toBe("/dashboard/profile/a%2Fb");
  });
});

describe("isForumPath", () => {
  it("is true for the forum and anything under it, false for lookalikes", () => {
    expect(isForumPath("/thinkpages")).toBe(true);
    expect(isForumPath("/thinkpages/c/general")).toBe(true);
    expect(isForumPath("/thinkpages-old")).toBe(false);
    expect(isForumPath("/dashboard")).toBe(false);
    expect(isForumPath("/")).toBe(false);
  });
});

describe("attach links", () => {
  it("opens a realm's board with the composer prefilled", () => {
    expect(ATTACH_PARAM).toBe("attach");
    expect(realmBoardAttachHref("eurth", "dir-abc")).toBe("/thinkpages/r/eurth?attach=dir-abc");
  });

  it("opens a category's new-thread form with the composer prefilled", () => {
    expect(newThreadAttachHref({ key: "hub", realm: { slug: "eurth" } }, "dir-abc")).toBe(
      "/thinkpages/r/eurth/hub/new?attach=dir-abc"
    );
    expect(newThreadAttachHref({ key: "general" }, "a1")).toBe(
      "/thinkpages/c/general/new?attach=a1"
    );
  });

  it("encodes the slug and the id, so neither can add a parameter", () => {
    expect(realmBoardAttachHref("a b", "x&y=1")).toBe("/thinkpages/r/a%20b?attach=x%26y%3D1");
  });
});
