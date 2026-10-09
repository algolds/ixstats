/** @jest-environment node */
import { JSDOM } from "jsdom";
import { countActionTokens, countTextActionTokens } from "~/lib/action-links";
import {
  ARCHIVE_TITLE,
  archiveDatabaseRefusal,
  boardPostBody,
  planBoardArchive,
  postSourceRef,
  summarizeArchive,
  threadSourceRef,
  type BoardPostRow,
} from "../../../scripts/migrations/realm-board-archive-plan";

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 12, minute));

function row(id: string, minute: number, overrides: Partial<BoardPostRow> = {}): BoardPostRow {
  return {
    id,
    content: `post ${id}`,
    createdAt: at(minute),
    visibility: "thinktank",
    account: {
      id: "acct-gov",
      clerkUserId: "clerk-1",
      accountType: "government",
      displayName: "Gov",
    },
    media: [],
    ...overrides,
  };
}

const users = new Map([
  ["clerk-1", "user-1"],
  ["clerk-2", "user-2"],
]);

function plan(posts: BoardPostRow[], migrated: string[] = []) {
  return planBoardArchive({
    groupId: "g1",
    posts,
    userIdByClerk: users,
    migrated: new Set(migrated),
  });
}

describe("source refs", () => {
  it("names the thread by board group and each post by ThinkPages post", () => {
    expect(threadSourceRef("g1")).toBe("realm_board:g1");
    expect(postSourceRef("p1")).toBe("thinkpages_post:p1");
    expect(ARCHIVE_TITLE).toBe("Realm Board archive");
  });
});

describe("boardPostBody", () => {
  it("escapes & and < in plain text", () => {
    const body = boardPostBody({ content: "Fish & chips <b>bold</b>", media: [] });
    expect(body.contentHtml).toBe("<p>Fish &amp; chips &lt;b&gt;bold&lt;/b&gt;</p>");
    expect(body.plainText).toBe("Fish & chips <b>bold</b>");
  });

  it("makes two paragraphs from a blank line and a <br> from a single newline", () => {
    const body = boardPostBody({ content: "one\ntwo\n\nthree", media: [] });
    expect(body.contentHtml).toBe("<p>one<br>two</p><p>three</p>");
    expect(body.plainText).toBe("one two three");
  });

  it("reads Windows line endings the same way", () => {
    expect(boardPostBody({ content: "one\r\ntwo\r\n\r\nthree", media: [] }).contentHtml).toBe(
      "<p>one<br>two</p><p>three</p>"
    );
  });

  it("never lets <script> or onerror= through as markup", () => {
    const body = boardPostBody({
      content: '<script>alert(1)</script><img src=x onerror="alert(2)">',
      media: [{ url: 'https://x.test/a.png" onerror="alert(3)', type: "image" }],
    });
    const doc = new JSDOM(body.contentHtml).window.document;
    expect(doc.querySelector("script")).toBeNull();
    const handlers = [...doc.body.querySelectorAll("*")].flatMap((el) =>
      el.getAttributeNames().filter((name) => name.startsWith("on"))
    );
    expect(handlers).toEqual([]);
    expect(body.contentHtml).not.toMatch(/<script/i);
    // The text survives only escaped, as text.
    expect(body.plainText).toContain("<script>alert(1)</script>");
  });

  it("appends an image attachment as an <img> and another attachment as a link", () => {
    const body = boardPostBody({
      content: "look",
      media: [
        { url: "https://cdn.test/map.png", type: "image" },
        { url: "/uploads/file.pdf", type: "document" },
      ],
    });
    expect(body.contentHtml).toBe(
      '<p>look</p><p><img src="https://cdn.test/map.png" alt=""></p><p><a href="/uploads/file.pdf">Attachment</a></p>'
    );
  });

  it("drops javascript:, http:, protocol-relative and token-bearing attachment URLs", () => {
    const body = boardPostBody({
      content: "text",
      media: [
        { url: "javascript:alert(1)", type: "image" },
        { url: "JavaScript:alert(1)", type: "document" },
        { url: "http://plain.test/a.png", type: "image" },
        { url: "//evil.test/a.png", type: "image" },
        { url: "/\\evil.test/a.png", type: "image" },
        { url: "https://cdn.test/[ixaction=act1].png", type: "image" },
      ],
    });
    expect(body.contentHtml).toBe("<p>text</p>");
  });

  it("keeps an action token only in text, where it renders, never inside a tag", () => {
    const body = boardPostBody({ content: "see [ixaction=act1]", media: [] });
    expect(countTextActionTokens(body.contentHtml)).toBe(1);
    expect(countActionTokens(body.contentHtml)).toBe(1);
    expect(countActionTokens(body.plainText)).toBe(1);
  });

  it("is empty for blank text with no usable attachment", () => {
    expect(
      boardPostBody({ content: "  \n\n ", media: [{ url: "javascript:x", type: "image" }] })
    ).toEqual({
      contentHtml: "",
      plainText: "",
    });
  });
});

describe("planBoardArchive", () => {
  it("plans posts oldest first (then by id), keeping each post's timestamp", () => {
    const result = plan([row("c", 3), row("b", 1), row("a", 1)]);
    expect(result.posts.map((p) => p.sourceRef)).toEqual([
      "thinkpages_post:a",
      "thinkpages_post:b",
      "thinkpages_post:c",
    ]);
    expect(result.posts.map((p) => p.createdAt)).toEqual([at(1), at(1), at(3)]);
    expect(result.posts[0]).toMatchObject({ contentHtml: "<p>post a</p>", plainText: "post a" });
  });

  it("builds the thread from the first and last planned posts", () => {
    const result = plan([
      row("late", 9, {
        account: { id: "acct-2", clerkUserId: "clerk-2", accountType: "media", displayName: "M" },
      }),
      row("early", 2),
    ]);
    expect(result.thread).toEqual({
      sourceRef: "realm_board:g1",
      title: "Realm Board archive",
      authorUserId: "user-1",
      authorPersonaId: "acct-gov",
      createdAt: at(2),
      lastPostAt: at(9),
      postCount: 2,
    });
  });

  it("posts under the persona, except a personal persona, which posts as the user alone (D12)", () => {
    const result = plan([
      row("p1", 1),
      row("p2", 2, {
        account: {
          id: "acct-me",
          clerkUserId: "clerk-2",
          accountType: "personal",
          displayName: "Me",
        },
      }),
    ]);
    expect(result.posts.map((p) => [p.authorUserId, p.authorPersonaId])).toEqual([
      ["user-1", "acct-gov"],
      ["user-2", null],
    ]);
  });

  it("skips and counts removed posts", () => {
    const result = plan([row("gone", 1, { visibility: "removed" }), row("kept", 2)]);
    expect(result.posts).toHaveLength(1);
    expect(result.skipped).toMatchObject({ removed: 1, noUser: 0, alreadyMigrated: 0 });
  });

  it("skips and counts posts whose account has no User row (D11)", () => {
    const result = plan([
      row("orphan", 1, {
        account: {
          id: "acct-x",
          clerkUserId: "clerk-gone",
          accountType: "government",
          displayName: "X",
        },
      }),
      row("kept", 2),
    ]);
    expect(result.posts.map((p) => p.sourceRef)).toEqual(["thinkpages_post:kept"]);
    expect(result.skipped.noUser).toBe(1);
    expect(result.thread?.createdAt).toEqual(at(2));
  });

  it("skips and counts posts already migrated", () => {
    const result = plan([row("old", 1), row("new", 2)], ["thinkpages_post:old"]);
    expect(result.posts.map((p) => p.sourceRef)).toEqual(["thinkpages_post:new"]);
    expect(result.skipped.alreadyMigrated).toBe(1);
  });

  it("skips and counts posts with nothing to show", () => {
    const result = plan([row("blank", 1, { content: " ", media: [] }), row("kept", 2)]);
    expect(result.posts).toHaveLength(1);
    expect(result.skipped.blank).toBe(1);
  });

  it("plans no thread and marks the board empty when nothing is left and nothing was migrated", () => {
    const result = plan([row("gone", 1, { visibility: "removed" })]);
    expect(result.thread).toBeNull();
    expect(result.posts).toEqual([]);
    expect(result.skipped).toEqual({
      removed: 1,
      noUser: 0,
      alreadyMigrated: 0,
      blank: 0,
      empty: 1,
    });
  });

  it("plans nothing, without marking the board empty, on a rerun after everything was migrated", () => {
    const result = plan([row("a", 1)], ["thinkpages_post:a"]);
    expect(result.thread).toBeNull();
    expect(result.skipped).toEqual({
      removed: 0,
      noUser: 0,
      alreadyMigrated: 1,
      blank: 0,
      empty: 0,
    });
  });
});

describe("summarizeArchive", () => {
  it("reports each realm and the totals", () => {
    const a = { realm: "Eurth", ...plan([row("a", 1), row("r", 2, { visibility: "removed" })]) };
    const b = { realm: "IxWorld", ...plan([]) };
    expect(summarizeArchive([a, b])).toEqual([
      "Eurth: 1 to create; skipped 1 removed, 0 no user, 0 already migrated, 0 blank",
      "IxWorld: 0 to create; skipped 0 removed, 0 no user, 0 already migrated, 0 blank; empty board",
      "Total: 1 to create across 2 boards; skipped 1 removed, 0 no user, 0 already migrated, 0 blank; 1 empty board",
    ]);
  });
});

describe("summarizeArchive with one board", () => {
  it("names one board in the singular", () => {
    const only = { realm: "Eurth", ...plan([row("a", 1)]) };
    expect(summarizeArchive([only]).at(-1)).toBe(
      "Total: 1 to create across 1 board; skipped 0 removed, 0 no user, 0 already migrated, 0 blank; 0 empty boards"
    );
  });
});

describe("archiveDatabaseRefusal", () => {
  const url = (db: string) => `postgresql://u:p@localhost:5433/${db}?schema=public`;

  it("reads a percent-encoded database name", () => {
    expect(archiveDatabaseRefusal(url("ix%73tats"), false)).toMatch(/--production/);
  });

  it("allows a clone", () => {
    expect(archiveDatabaseRefusal(url("ixstats_wv1"), false)).toBeNull();
  });

  it("refuses the production database without --production, and allows it with", () => {
    expect(archiveDatabaseRefusal(url("ixstats"), false)).toMatch(/--production/);
    expect(archiveDatabaseRefusal(url("ixstats"), true)).toBeNull();
  });

  it("refuses a missing or unusable DATABASE_URL", () => {
    expect(archiveDatabaseRefusal(undefined, true)).toMatch(/DATABASE_URL/);
    expect(archiveDatabaseRefusal("not a url", true)).toMatch(/DATABASE_URL/);
  });
});
