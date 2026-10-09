/** @jest-environment node */
import {
  legacyForumTarget,
  legacyRefFor,
  parseNodeLandings,
  type LegacyForumRef,
  type LegacyLookups,
} from "~/lib/thinkpages-forum/legacy-forum";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";

const NONE: LegacyLookups = { threadId: null, postId: null, category: null, handle: null };
const OTHER: LegacyForumRef = { kind: "other" };

describe("legacyRefFor", () => {
  it("builds a ref from a route segment", () => {
    expect(legacyRefFor("forum", "3")).toEqual({ kind: "forum", nodeId: 3 });
    expect(legacyRefFor("thread", "123")).toEqual({ kind: "thread", threadId: 123 });
    expect(legacyRefFor("thread", "2147483647")).toEqual({ kind: "thread", threadId: 2147483647 });
    expect(legacyRefFor("post", "9")).toEqual({ kind: "post", postId: 9 });
    expect(legacyRefFor("member", "7")).toEqual({ kind: "member", userId: 7 });
  });

  it("treats non-numeric, zero, signed, fractional, padded and out-of-range ids as other", () => {
    const routes = ["forum", "thread", "post", "member"] as const;
    for (const segment of [
      "",
      "abc",
      "slug.123",
      "0",
      "-4",
      "+4",
      "1.5",
      "1e3",
      "0x10",
      " 7",
      "7 ",
      "%2012",
      "12?x",
      "12#x",
      "12/post",
      "12/extra",
      "2147483648",
      "99999999999",
      "constructor",
      "//evil.example",
    ]) {
      for (const route of routes) expect(legacyRefFor(route, segment)).toEqual(OTHER);
    }
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
