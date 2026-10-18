/** @jest-environment node */
import {
  forumRefTarget,
  nodeLandings,
  type ForumLookups,
  type ForumRef,
} from "~/lib/thinkpages-forum/import/forum-links";

const NONE: ForumLookups = { threadId: null, postId: null, category: null, handle: null };

describe("forumRefTarget", () => {
  it("sends a found thread or post to its native page", () => {
    expect(forumRefTarget({ kind: "thread", threadId: 1 }, { ...NONE, threadId: "t1" })).toBe(
      "/thinkpages/t/t1"
    );
    expect(forumRefTarget({ kind: "post", postId: 1 }, { ...NONE, postId: "p1" })).toBe(
      "/thinkpages/post/p1"
    );
  });

  it("sends a forum node to its sitewide or realm category", () => {
    const site = { ...NONE, category: { key: "general", realmSlug: null } };
    const realm = { ...NONE, category: { key: "hub", realmSlug: "eurth" } };
    expect(forumRefTarget({ kind: "forum", nodeId: 1 }, site)).toBe("/thinkpages/c/general");
    expect(forumRefTarget({ kind: "forum", nodeId: 1 }, realm)).toBe("/thinkpages/r/eurth/hub");
  });

  it("sends a member to their profile by handle", () => {
    expect(forumRefTarget({ kind: "member", userId: 7 }, { ...NONE, handle: "jane_doe" })).toBe(
      "/@jane_doe"
    );
  });

  it("is null when nothing was found", () => {
    const refs: ForumRef[] = [
      { kind: "thread", threadId: 1 },
      { kind: "post", postId: 1 },
      { kind: "forum", nodeId: 1 },
      { kind: "member", userId: 1 },
    ];
    for (const ref of refs) expect(forumRefTarget(ref, NONE)).toBeNull();
  });

  it("only reads the lookup that matches the ref", () => {
    const all: ForumLookups = {
      threadId: "t1",
      postId: "p1",
      category: { key: "general", realmSlug: null },
      handle: "jane",
    };
    expect(forumRefTarget({ kind: "post", postId: 1 }, all)).toBe("/thinkpages/post/p1");
    expect(forumRefTarget({ kind: "thread", threadId: 1 }, all)).toBe("/thinkpages/t/t1");
    expect(forumRefTarget({ kind: "post", postId: 1 }, { ...all, postId: null })).toBeNull();
  });

  it("never builds anything but a same-site app path", () => {
    const hostile = "//evil.example/x?y=1#z\\..";
    const cases: Array<[ForumRef, ForumLookups]> = [
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
      const to = forumRefTarget(ref, found);
      expect(to).toMatch(/^\/[^/\\]/);
      expect(to).not.toMatch(/[?#\\]/);
      expect(to).not.toContain("//");
      expect(to?.split("/").filter(Boolean).length).toBeLessThanOrEqual(4);
    }
  });
});

describe("nodeLandings", () => {
  it("keeps each node's site or realm target, and none for archive and skip entries", () => {
    const landings = nodeLandings({
      nodes: {
        "12": { scope: "site", key: "general" },
        "13": { scope: "realm", realm: "eurth", key: "hub" },
        "14": { archive: true, visibility: "staff" },
        "15": { skip: true },
        "16": { archive: true },
      },
    });
    expect([...landings.entries()]).toEqual([
      [12, { scope: "site", key: "general" }],
      [13, { scope: "realm", realm: "eurth", key: "hub" }],
    ]);
  });

  it("keys each landing by its numeric node id", () => {
    const landings = nodeLandings({ nodes: { "3": { scope: "site", key: "rules" } } });
    expect(landings.get(3)).toEqual({ scope: "site", key: "rules" });
    expect([...landings.keys()]).toEqual([3]);
  });

  it("is empty for a map with no nodes", () => {
    expect(nodeLandings({ nodes: {} }).size).toBe(0);
  });
});
