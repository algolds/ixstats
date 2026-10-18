/** @jest-environment node */
import {
  classifyForumHref,
  FORUM_LINK_MARKERS,
  forumHrefRefs,
  forumRefTarget,
  nodeLandings,
  rewriteForumHrefs,
  rewriteNotificationHref,
  xenforoId,
  type ForumLookups,
  type ForumRef,
} from "~/lib/thinkpages-forum/import/forum-links";
import { stripHtml } from "~/lib/utils/sanitize-html";

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

  it("sends the old forum's front page to the forum home", () => {
    expect(forumRefTarget({ kind: "home" }, NONE)).toBe("/thinkpages");
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

const HOME: ForumRef = { kind: "home" };
const thread = (threadId: number): ForumRef => ({ kind: "thread", threadId });
const post = (postId: number): ForumRef => ({ kind: "post", postId });
const node = (nodeId: number): ForumRef => ({ kind: "forum", nodeId });
const member = (userId: number): ForumRef => ({ kind: "member", userId });
const XF = "https://forum.ixwiki.com";

const XENFORO_LINKS: Array<[string, ForumRef[]]> = [
  [`${XF}/threads/welcome.100/`, [thread(100)]],
  [`${XF}/threads/12/`, [thread(12)]],
  [`${XF}/threads/v1.5-notes.12`, [thread(12)]],
  ["http://forum.ixwiki.com/threads/x.12/", [thread(12)]],
  ["//forum.ixwiki.com/threads/x.12/", [thread(12)]],
  ["https://www.forum.ixwiki.com/threads/x.12/", [thread(12)]],
  ["HTTPS://Forum.IxWiki.com/threads/x.12/", [thread(12)]],
  ["https://forum.ixwiki.com:443/threads/x.12/", [thread(12)]],
  [`${XF}/threads/x.12/page-3`, [thread(12)]],
  [`${XF}/threads/x.12/unread`, [thread(12)]],
  [`${XF}/threads/x.12/latest/`, [thread(12)]],
  [`${XF}/threads/x.12/?order=new#replies`, [thread(12)]],
  [`${XF}/threads/x.12/post-55`, [post(55), thread(12)]],
  [`${XF}/threads/x.12/page-2#post-55`, [post(55), thread(12)]],
  [`${XF}/threads/x.12/post-2147483648`, [thread(12)]],
  [`${XF}/threads/x.2147483647/`, [thread(2_147_483_647)]],
  [`${XF}/posts/123/`, [post(123)]],
  [`${XF}/posts/123#post-123`, [post(123)]],
  [`${XF}/goto/post?id=77`, [post(77)]],
  [`${XF}/goto/post?x=1&id=77#post-77`, [post(77)]],
  [`${XF}/forums/general-discussion.12/`, [node(12)]],
  [`${XF}/forums/12/page-2`, [node(12)]],
  [`${XF}/categories/community.1/`, [node(1)]],
  [`${XF}/members/jane.7/`, [member(7)]],
  [`${XF}/members/7/#about`, [member(7)]],
  [XF, [HOME]],
  [`${XF}/`, [HOME]],
  [`${XF}/forums/`, [HOME]],
  [`${XF}/index.php`, [HOME]],
  [`${XF}/?tab=new`, [HOME]],
  [`${XF}/index.php?threads/welcome.100/`, [thread(100)]],
  [`${XF}/index.php?threads/x.12/&page=2#post-5`, [post(5), thread(12)]],
  [`${XF}/index.php?goto/post&id=9`, [post(9)]],
  [`${XF}/index.php?members/jane.7/`, [member(7)]],
  [`${XF}/index.php?`, [HOME]],
];

const BRIDGE_LINKS: Array<[string, ForumRef[]]> = [
  ["/forum/thread/12", [thread(12)]],
  ["/forum/thread/12/", [thread(12)]],
  ["/forum/thread/12#post-55", [post(55), thread(12)]],
  ["/forum/post/55", [post(55)]],
  ["/forum/post/2147483647", [post(2_147_483_647)]],
  ["/forum/members/7", [member(7)]],
  ["/forum/12", [node(12)]],
  ["/forum", [HOME]],
  ["/forum/", [HOME]],
  ["/projects/ixstates/forum/thread/12", [thread(12)]],
  ["/projects/ixstats/forum/12", [node(12)]],
  ["https://ixwiki.com/projects/ixstats/forum/thread/12#post-5", [post(5), thread(12)]],
  ["https://www.ixwiki.com/projects/ixstates/forum/post/5", [post(5)]],
  ["http://ixwiki.com/forum/members/7", [member(7)]],
];

/** XenForo paths written without the host (relative to forum.ixwiki.com); no IxStates route starts with them. */
const ROOT_RELATIVE_LINKS: Array<[string, ForumRef[]]> = [
  ["/threads/x.12/", [thread(12)]],
  ["/threads/12/post-55", [post(55), thread(12)]],
  ["/posts/5/", [post(5)]],
  ["/goto/post?id=9", [post(9)]],
  ["/forums/general.12/", [node(12)]],
  ["/forums/", [HOME]],
  ["/categories/community.1/", [node(1)]],
  ["/members/jane.7/", [member(7)]],
];

const DEAD_LINKS = [
  `${XF}/whats-new/`,
  `${XF}/threads/x.12/reply`,
  `${XF}/threads/welcome/`,
  `${XF}/members/jane/`,
  `${XF}/posts/0/`,
  `${XF}/posts/-3/`,
  `${XF}/threads/x.2147483648/`,
  `${XF}/posts/99999999999/`,
  `${XF}/goto/post?id=2147483648`,
  `${XF}/goto/post`,
  `${XF}/forums/2147483648/`,
  "/forum/thread/2147483648",
  "/forum/members/99999999999",
  "/forum/thread/abc",
  "/forum/conversations",
  "/projects/ixstates/forum/search?q=x",
  "/threads/x.12/reply",
  "/members/jane/",
  "/goto/post?id=2147483648",
];

describe("classifyForumHref", () => {
  it.each(XENFORO_LINKS)("reads the XenForo link %s", (href, refs) => {
    expect(classifyForumHref(href)).toEqual(refs);
  });

  it.each(BRIDGE_LINKS)("reads the IxStates bridge link %s", (href, refs) => {
    expect(classifyForumHref(href)).toEqual(refs);
  });

  it.each(ROOT_RELATIVE_LINKS)("reads the root-relative XenForo path %s", (href, refs) => {
    expect(classifyForumHref(href)).toEqual(refs);
  });

  it.each(DEAD_LINKS)("is a dead link (no native counterpart) for %s", (href) => {
    expect(classifyForumHref(href)).toEqual([]);
  });

  it.each([
    "https://forum.ixwiki.com.evil/threads/x.12/",
    "https://forum.ixwiki.com.evil.example/",
    "https://forum.ixwiki.com@evil.example/threads/1/",
    "https://notforum.ixwiki.com/threads/1/",
    "https://evil.example/forum/thread/12",
    "https://ixwiki.com.evil/forum/thread/12",
    "https://evil.example/?u=https://forum.ixwiki.com/threads/1/",
    "/thinkpages/forum",
    "/projects/ixstates/thinkpages/forum",
    "/images/uploads/forum/55.png",
    "/forums-of-old",
    "/forumx/1",
    "/Forum/thread/12",
    "https://ixwiki.com/wiki/Forum",
    "https://ixwiki.com/projects/ixstates/thinkpages/t/abc",
    "/thinkpages/t/abc",
    "/thinkpages/c/members",
    "/projects/ixstates/threads/x.12/",
    "/images/threads/1.png",
    "/wiki/Threads/1",
    "/threadsx/12/",
    "/members",
    "/index.php?title=Main_Page",
    "https://example.com/threads/x.12/",
    "#post-5",
    "mailto:admin@ixwiki.com",
    "",
  ])("is not an old forum link: %s", (href) => {
    expect(classifyForumHref(href)).toBeNull();
  });
});

describe("FORUM_LINK_MARKERS", () => {
  it.each([
    ...[...XENFORO_LINKS, ...BRIDGE_LINKS, ...ROOT_RELATIVE_LINKS].map(([href]) => href),
    ...DEAD_LINKS,
  ])("finds %s, so the passes scan every row holding an old link (any case)", (href) => {
    const text = href.toLowerCase();
    expect(FORUM_LINK_MARKERS.some((marker) => text.includes(marker.toLowerCase()))).toBe(true);
  });
});

const a = (href: string, text = "go") =>
  `<a href="${href}" class="forum-link" rel="noopener">${text}</a>`;
const TARGETS = new Map<string, string>([
  [JSON.stringify(thread(100)), "/thinkpages/t/t100"],
  [JSON.stringify(post(55)), "/thinkpages/post/p55"],
  [JSON.stringify(HOME), "/thinkpages"],
]);
const targetOf = (ref: ForumRef) => TARGETS.get(JSON.stringify(ref)) ?? null;

describe("forumHrefRefs", () => {
  it("lists every ref the anchors' old forum links could resolve through, in order", () => {
    const html = `<p>${a(`${XF}/threads/x.12/post-55`)} ${a("/forum/members/7")} ${a(XF)}</p>`;
    expect(forumHrefRefs(html)).toEqual([post(55), thread(12), member(7), HOME]);
  });

  it("reads only anchors' href, decoded, and skips links that are not old forum links", () => {
    const html = [
      `<img src="${XF}/threads/x.1/">`,
      `<p>${XF}/threads/x.2/</p>`,
      `<a title="${XF}/threads/x.3/" href="https://example.com">e</a>`,
      `<abbr title="x" href="${XF}/threads/x.4/">x</abbr>`,
      a(`${XF}/goto/post?x=1&amp;id=5`),
    ].join("");
    expect(forumHrefRefs(html)).toEqual([post(5)]);
  });
});

describe("rewriteForumHrefs", () => {
  it("points a resolved link at its native page, keeping the other attributes and the text", () => {
    const html = `<p>Thanks! ${a(`${XF}/threads/welcome.100/`, "again")}</p>`;
    expect(rewriteForumHrefs(html, targetOf, "drop")).toEqual({
      html: `<p>Thanks! ${a("/thinkpages/t/t100", "again")}</p>`,
      mapped: 1,
      unwrapped: 0,
    });
  });

  it("falls back from the post to its thread, and maps the front page and bridge links", () => {
    const html = [
      a(`${XF}/threads/x.100/post-9`),
      a("/projects/ixstates/forum/thread/100#post-55"),
      a(`${XF}/forums/`),
    ].join(" ");
    expect(rewriteForumHrefs(html, targetOf, "keep")).toEqual({
      html: [a("/thinkpages/t/t100"), a("/thinkpages/post/p55"), a("/thinkpages")].join(" "),
      mapped: 3,
      unwrapped: 0,
    });
  });

  it("in drop mode unwraps an unresolved or dead link: the tags go, the inner text and markup stay", () => {
    const html = `<p>See ${a(`${XF}/threads/x.404/`, "this <b>thread</b>")} and ${a(`${XF}/whats-new/`, "news")}.</p>`;
    expect(rewriteForumHrefs(html, targetOf, "drop")).toEqual({
      html: "<p>See this <b>thread</b> and news.</p>",
      mapped: 0,
      unwrapped: 2,
    });
  });

  it("in keep mode leaves an unresolved link as written, for a later run", () => {
    const html = `<p>${a(`${XF}/threads/x.404/`)} ${a(`${XF}/threads/x.100/`)}</p>`;
    expect(rewriteForumHrefs(html, targetOf, "keep")).toEqual({
      html: `<p>${a(`${XF}/threads/x.404/`)} ${a("/thinkpages/t/t100")}</p>`,
      mapped: 1,
      unwrapped: 0,
    });
  });

  it("closes only the unwrapped anchor: other links, their ends and other tags stay", () => {
    const html = `${a(`${XF}/threads/x.404/`, "dead")}<a href="https://example.com">kept</a><span>s</span>`;
    expect(rewriteForumHrefs(html, targetOf, "drop").html).toBe(
      'dead<a href="https://example.com">kept</a><span>s</span>'
    );
  });

  it("decodes &amp; in the href before matching", () => {
    const html = a(`${XF}/goto/post?x=1&amp;id=55`);
    expect(rewriteForumHrefs(html, targetOf, "drop").html).toBe(a("/thinkpages/post/p55"));
  });

  it("reads only <a> itself, never a custom element whose name starts with a-", () => {
    const html = `<a-x href="${XF}/threads/x.100/">c</a-x><a-x href="${XF}/threads/x.404/">d</a-x>`;
    expect(forumHrefRefs(html)).toEqual([]);
    expect(rewriteForumHrefs(html, targetOf, "drop")).toEqual({ html, mapped: 0, unwrapped: 0 });
  });

  it("rewrites only an anchor's href: text, other attributes, images and other links stay", () => {
    const html = [
      `<p>${XF}/threads/x.100/ and /forum/thread/100</p>`,
      `<img src="${XF}/threads/x.100/" alt="${XF}/threads/x.100/">`,
      `<a title="${XF}/threads/x.100/" href="https://example.com/forum/thread/100">e</a>`,
      a("/images/uploads/forum/55.png"),
      a("/thinkpages/forum"),
    ].join("");
    expect(rewriteForumHrefs(html, () => "/thinkpages/t/x", "drop")).toEqual({
      html,
      mapped: 0,
      unwrapped: 0,
    });
  });

  it("is idempotent, and keeps the post's plain text", () => {
    const html = `<p>A ${a(`${XF}/threads/x.100/`, "one")} B ${a(`${XF}/threads/x.404/`, "two")} C</p>`;
    const once = rewriteForumHrefs(html, targetOf, "drop").html;
    expect(rewriteForumHrefs(once, targetOf, "drop")).toEqual({
      html: once,
      mapped: 0,
      unwrapped: 0,
    });
    expect(stripHtml(once)).toBe(stripHtml(html));
  });
});

describe("rewriteNotificationHref", () => {
  /** Thread 100 and post 1001 resolve; post 1002 (hidden) and thread 999 (never imported) do not. */
  const targetOf = (ref: ForumRef): string | null => {
    if (ref.kind === "thread" && ref.threadId === 100) return "/thinkpages/t/t100";
    if (ref.kind === "post" && ref.postId === 1001) return "/thinkpages/post/p1001";
    return ref.kind === "home" ? "/thinkpages" : null;
  };

  it.each([
    ["/forum/thread/100", "/thinkpages/t/t100"],
    ["/forum/thread/100?page=2", "/thinkpages/t/t100"],
    ["/projects/ixstates/forum/thread/100#post-1001", "/projects/ixstates/thinkpages/post/p1001"],
    ["/projects/ixstates/forum/thread/100#post-1002", "/projects/ixstates/thinkpages/t/t100"],
    ["/projects/ixstats/forum/thread/100", "/thinkpages/t/t100"],
    ["/projects/ixstats/forum/thread/100#post-1001", "/thinkpages/post/p1001"],
    ["https://ixwiki.com/projects/ixstates/forum/thread/100", "/thinkpages/t/t100"],
    ["/projects/ixstates/forum/", "/projects/ixstates/thinkpages"],
  ])("points %s at %s, keeping only the current base path", (href, expected) => {
    for (const unresolved of ["drop", "keep"] as const) {
      expect(rewriteNotificationHref(href, targetOf, unresolved)).toEqual({
        href: expected,
        mapped: true,
      });
    }
  });

  it.each([
    ["/forum/thread/999", "/thinkpages"],
    ["/projects/ixstates/forum/thread/999#post-1002", "/projects/ixstates/thinkpages"],
    ["/projects/ixstats/forum/thread/999", "/thinkpages"],
    ["/forum/whats-new/", "/thinkpages"],
  ])("sends %s, with nothing public to point at, to the forum home in drop mode", (href, home) => {
    expect(rewriteNotificationHref(href, targetOf, "drop")).toEqual({ href: home, mapped: false });
    expect(rewriteNotificationHref(href, targetOf, "keep")).toBeNull();
  });

  it.each([
    "/thinkpages/t/t100",
    "/projects/ixstates/thinkpages",
    "/messages",
    "/thinkpages/forum/x",
    "https://evil.example/forum/thread/100",
    "",
  ])("leaves %p alone: it is not an old forum link", (href) => {
    expect(rewriteNotificationHref(href, targetOf, "drop")).toBeNull();
  });
});

describe("xenforoId", () => {
  it("reads a positive Int4 id from its digits", () => {
    expect(xenforoId("77")).toBe(77);
    expect(xenforoId("2147483647")).toBe(2_147_483_647);
  });

  it.each([
    undefined,
    "",
    "0",
    "abc",
    "7a",
    "-3",
    "2147483648",
    "99999999999",
    "1e3",
    "0x10",
    " 7",
    "+4",
    "1.0",
  ])("is null for %p", (digits) => {
    expect(xenforoId(digits)).toBeNull();
  });
});
