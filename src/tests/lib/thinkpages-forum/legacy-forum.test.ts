/** @jest-environment node */
import {
  legacyForumTarget,
  legacyRefFor,
  parseLegacyForumPath,
  parseNodeLandings,
  type LegacyForumRef,
  type LegacyLookups,
} from "~/lib/thinkpages-forum/legacy-forum";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";

const NONE: LegacyLookups = { threadId: null, postId: null, category: null, handle: null };
const OTHER: LegacyForumRef = { kind: "other" };

describe("parseLegacyForumPath", () => {
  it("reads the home, with or without a trailing slash, query or hash", () => {
    for (const path of [
      "/forum",
      "/forum/",
      "/forum?sort=new",
      "/forum/?sort=trending",
      "/forum#top",
    ]) {
      expect(parseLegacyForumPath(path)).toEqual({ kind: "home" });
    }
  });

  it("reads a forum node", () => {
    expect(parseLegacyForumPath("/forum/12")).toEqual({ kind: "forum", nodeId: 12 });
    expect(parseLegacyForumPath("/forum/12/?page=2")).toEqual({ kind: "forum", nodeId: 12 });
  });

  it("reads threads, posts and members", () => {
    expect(parseLegacyForumPath("/forum/thread/123")).toEqual({ kind: "thread", threadId: 123 });
    expect(parseLegacyForumPath("/forum/thread/123/")).toEqual({ kind: "thread", threadId: 123 });
    expect(parseLegacyForumPath("/forum/post/456?x=1")).toEqual({ kind: "post", postId: 456 });
    expect(parseLegacyForumPath("/forum/members/7//")).toEqual({ kind: "member", userId: 7 });
  });

  it("treats the bridge's other pages as other", () => {
    for (const path of [
      "/forum/search?q=x",
      "/forum/bookmarks",
      "/forum/new-thread?forum=3",
      "/forum/conversations",
      "/forum/conversations/9",
      "/forum/cards/someone",
    ]) {
      expect(parseLegacyForumPath(path)).toEqual(OTHER);
    }
  });

  it("treats non-numeric, zero, signed, fractional and out-of-range ids as other", () => {
    for (const path of [
      "/forum/abc",
      "/forum/thread/abc",
      "/forum/thread/slug.123",
      "/forum/thread/0",
      "/forum/thread/-4",
      "/forum/thread/1.5",
      "/forum/thread/1e3",
      "/forum/thread/0x10",
      "/forum/thread/%2012",
      "/forum/post/2147483648",
      "/forum/members/99999999999",
      "/forum/thread/12/extra",
      "/forum/constructor",
    ]) {
      expect(parseLegacyForumPath(path)).toEqual(OTHER);
    }
  });

  it("ignores paths outside /forum", () => {
    for (const path of [
      "",
      "/",
      "/forums/12",
      "/thinkpages/forum",
      "forum/12",
      "//evil.example/forum/12",
    ]) {
      expect(parseLegacyForumPath(path)).toEqual(OTHER);
    }
  });
});

describe("legacyRefFor", () => {
  it("builds a ref from a route segment, and other for a bad id", () => {
    expect(legacyRefFor("forum", "3")).toEqual({ kind: "forum", nodeId: 3 });
    expect(legacyRefFor("thread", "2147483647")).toEqual({ kind: "thread", threadId: 2147483647 });
    expect(legacyRefFor("post", "9")).toEqual({ kind: "post", postId: 9 });
    expect(legacyRefFor("member", "7")).toEqual({ kind: "member", userId: 7 });
    expect(legacyRefFor("thread", "12?x")).toEqual(OTHER);
    expect(legacyRefFor("thread", "12/post")).toEqual(OTHER);
    expect(legacyRefFor("member", " 7")).toEqual(OTHER);
  });
});

describe("legacyForumTarget", () => {
  it("sends a found thread or post to its native page", () => {
    expect(legacyForumTarget({ kind: "thread", threadId: 1 }, { ...NONE, threadId: "t1" })).toBe(
      "/thinkpages/t/t1"
    );
    expect(legacyForumTarget({ kind: "post", postId: 1 }, { ...NONE, postId: "p1" })).toBe(
      "/thinkpages/post/p1"
    );
  });

  it("sends a forum node to its sitewide or realm category", () => {
    const site = { ...NONE, category: { key: "general", realmSlug: null } };
    const realm = { ...NONE, category: { key: "hub", realmSlug: "eurth" } };
    expect(legacyForumTarget({ kind: "forum", nodeId: 1 }, site)).toBe("/thinkpages/c/general");
    expect(legacyForumTarget({ kind: "forum", nodeId: 1 }, realm)).toBe("/thinkpages/r/eurth/hub");
  });

  it("sends a member to their profile by handle", () => {
    expect(legacyForumTarget({ kind: "member", userId: 7 }, { ...NONE, handle: "jane_doe" })).toBe(
      "/@jane_doe"
    );
  });

  it("falls back to the forum home when nothing was found", () => {
    const refs: LegacyForumRef[] = [
      { kind: "home" },
      { kind: "other" },
      { kind: "thread", threadId: 1 },
      { kind: "post", postId: 1 },
      { kind: "forum", nodeId: 1 },
      { kind: "member", userId: 1 },
    ];
    for (const ref of refs) expect(legacyForumTarget(ref, NONE)).toBe(FORUM_HOME);
  });

  it("only reads the lookup that matches the ref", () => {
    const all: LegacyLookups = {
      threadId: "t1",
      postId: "p1",
      category: { key: "general", realmSlug: null },
      handle: "jane",
    };
    expect(legacyForumTarget({ kind: "home" }, all)).toBe(FORUM_HOME);
    expect(legacyForumTarget({ kind: "other" }, all)).toBe(FORUM_HOME);
    expect(legacyForumTarget({ kind: "post", postId: 1 }, all)).toBe("/thinkpages/post/p1");
  });

  it("never builds anything but a same-site app path", () => {
    const hostile = "//evil.example/x?y=1#z\\..";
    const cases: Array<[LegacyForumRef, LegacyLookups]> = [
      [
        { kind: "thread", threadId: 1 },
        { ...NONE, threadId: hostile },
      ],
      [
        { kind: "post", postId: 1 },
        { ...NONE, postId: hostile },
      ],
      [
        { kind: "forum", nodeId: 1 },
        { ...NONE, category: { key: hostile, realmSlug: hostile } },
      ],
      [
        { kind: "forum", nodeId: 1 },
        { ...NONE, category: { key: hostile, realmSlug: null } },
      ],
      [
        { kind: "member", userId: 1 },
        { ...NONE, handle: hostile },
      ],
      [
        { kind: "member", userId: 1 },
        { ...NONE, handle: "https://evil.example" },
      ],
    ];
    for (const [ref, found] of cases) {
      const to = legacyForumTarget(ref, found);
      expect(to).toMatch(/^\/[^/\\]/);
      expect(to).not.toMatch(/[?#\\]/);
      expect(to).not.toContain("//");
      expect(to.split("/").filter(Boolean).length).toBeLessThanOrEqual(4);
    }
  });
});

describe("parseNodeLandings", () => {
  it("reads a node id → target map, keeping only site and realm targets", () => {
    const landings = parseNodeLandings(
      JSON.stringify({
        "12": { scope: "site", key: "general" },
        "13": { scope: "realm", realm: "eurth", key: "hub" },
        "14": { archive: true, visibility: "staff" },
        "15": { skip: true },
      })
    );
    expect([...landings.entries()]).toEqual([
      [12, { scope: "site", key: "general" }],
      [13, { scope: "realm", realm: "eurth", key: "hub" }],
    ]);
  });

  it("reads the node map file shape too", () => {
    const landings = parseNodeLandings(
      JSON.stringify({ nodes: { "3": { scope: "site", key: "rules" } } })
    );
    expect(landings.get(3)).toEqual({ scope: "site", key: "rules" });
  });

  it("drops malformed entries and keeps the rest", () => {
    const landings = parseNodeLandings(
      JSON.stringify({
        "1": { scope: "site", key: "general" },
        "2": { scope: "site" },
        "3": { scope: "realm", key: "hub" },
        "4": { scope: "site", key: "../../evil" },
        "5": "general",
        "6": null,
      })
    );
    expect([...landings.keys()]).toEqual([1]);
  });

  it("is empty for an absent row, bad JSON, or a non-map value", () => {
    for (const value of [
      null,
      "",
      "not json",
      "[]",
      "42",
      '"x"',
      "null",
      '{"abc":{"scope":"site","key":"general"}}',
    ]) {
      expect(parseNodeLandings(value).size).toBe(0);
    }
  });
});
