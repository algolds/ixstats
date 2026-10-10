/** @jest-environment node */
import {
  chatMessageBody,
  FORMER_MEMBER_NAME,
  messageSourceRef,
  parseBoardHistoryArgs,
  planBoardHistory,
  summarizeBoardHistory,
  type ChatMessageRow,
} from "../../../scripts/migrations/import-realm-board-history-plan";

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 12, minute));

function msg(id: string, minute: number, overrides: Partial<ChatMessageRow> = {}): ChatMessageRow {
  return {
    id,
    userId: "clerk-1",
    content: `message ${id}`,
    createdAt: at(minute),
    deletedAt: null,
    isSystem: false,
    ...overrides,
  };
}

const userIdByClerk = new Map([
  ["clerk-1", "user-1"],
  ["clerk-2", "user-2"],
]);

function plan(
  messages: ChatMessageRow[],
  extra: { imported?: string[]; names?: Array<[string, string]> } = {}
) {
  return planBoardHistory({
    threadId: "thread-1",
    messages,
    userIdByClerk,
    nameByClerk: new Map(extra.names ?? []),
    imported: new Set((extra.imported ?? []).map(messageSourceRef)),
  });
}

describe("messageSourceRef", () => {
  it("names a post by the chat message it came from", () => {
    expect(messageSourceRef("m1")).toBe("realm_board_message:m1");
  });
});

describe("chatMessageBody", () => {
  it("escapes markup in a plain-text message", () => {
    expect(chatMessageBody("Fish & <b>chips</b>")).toEqual({
      contentHtml: "<p>Fish &amp; &lt;b&gt;chips&lt;/b&gt;</p>",
      plainText: "Fish & <b>chips</b>",
    });
  });

  it("makes a paragraph of each blank-line block and a line break of each newline", () => {
    expect(chatMessageBody("one\ntwo\r\n\r\n\nthree").contentHtml).toBe(
      "<p>one<br>two</p><p>three</p>"
    );
  });

  it("keeps the full text of a long message (the 1,000 character cap is for new messages)", () => {
    const long = "a".repeat(5000);
    expect(chatMessageBody(long).plainText).toHaveLength(5000);
  });

  it("is blank for whitespace only", () => {
    expect(chatMessageBody("  \n\t ").plainText).toBe("");
  });

  it("removes action tokens, so history never renders someone's activity as a card", () => {
    const body = chatMessageBody("see [ixaction=abc] and [ixact[ixaction=x]ion=y]");
    expect(body.contentHtml).toBe("<p>see  and</p>");
    expect(body.plainText).not.toMatch(/ixaction/);
  });

  it("skips a message that is only an action token as blank", () => {
    expect(chatMessageBody("[ixaction=abc]").plainText).toBe("");
  });
});

describe("planBoardHistory", () => {
  it("plans posts oldest first with the author, the original time and the source ref", () => {
    const result = plan([msg("b", 5, { userId: "clerk-2" }), msg("a", 1)]);
    expect(result.posts.map((p) => p.sourceRef)).toEqual([
      "realm_board_message:a",
      "realm_board_message:b",
    ]);
    expect(result.posts[0]).toEqual({
      threadId: "thread-1",
      authorUserId: "user-1",
      authorPersonaId: null,
      importedAuthorName: null,
      contentHtml: "<p>message a</p>",
      plainText: "message a",
      createdAt: at(1),
      sourceRef: "realm_board_message:a",
    });
    expect(result.posts[1]!.authorUserId).toBe("user-2");
  });

  it("breaks a tie in time by id", () => {
    const result = plan([msg("b", 1), msg("a", 1)]);
    expect(result.posts.map((p) => p.sourceRef)).toEqual([
      "realm_board_message:a",
      "realm_board_message:b",
    ]);
  });

  it("skips deleted, system, blank and already imported messages, and counts them", () => {
    const result = plan(
      [
        msg("ok", 1),
        msg("gone", 2, { deletedAt: at(3) }),
        msg("sys", 3, { isSystem: true }),
        msg("blank", 4, { content: "   " }),
        msg("done", 5),
      ],
      { imported: ["done"] }
    );
    expect(result.posts.map((p) => p.sourceRef)).toEqual(["realm_board_message:ok"]);
    expect(result.skipped).toEqual({ deleted: 1, system: 1, blank: 1, alreadyImported: 1 });
  });

  it("keeps an author with no user row under their name, else as a former member", () => {
    const result = plan([msg("a", 1, { userId: "clerk-x" }), msg("b", 2, { userId: "clerk-y" })], {
      names: [["clerk-x", "Old Name"]],
    });
    expect(result.posts[0]).toMatchObject({ authorUserId: null, importedAuthorName: "Old Name" });
    expect(result.posts[1]).toMatchObject({
      authorUserId: null,
      importedAuthorName: FORMER_MEMBER_NAME,
    });
    expect(result.unknownAuthors).toBe(2);
  });

  it("falls back to a former member for an empty or blank persona name", () => {
    const result = plan([msg("a", 1, { userId: "clerk-x" }), msg("b", 2, { userId: "clerk-y" })], {
      names: [
        ["clerk-x", ""],
        ["clerk-y", "  "],
      ],
    });
    expect(result.posts.map((p) => p.importedAuthorName)).toEqual([
      FORMER_MEMBER_NAME,
      FORMER_MEMBER_NAME,
    ]);
  });

  it("plans nothing on a second run once every message is imported", () => {
    const messages = [msg("a", 1), msg("b", 2)];
    const first = plan(messages);
    const second = plan(messages, { imported: ["a", "b"] });
    expect(first.posts).toHaveLength(2);
    expect(second.posts).toHaveLength(0);
    expect(second.skipped.alreadyImported).toBe(2);
  });
});

describe("summarizeBoardHistory", () => {
  it("prints a line per realm and a total", () => {
    const a = plan([msg("a", 1), msg("x", 2, { deletedAt: at(2) })]);
    const lines = summarizeBoardHistory([
      { realm: "Eurth (eurth)", ...a },
      { realm: "Other (other)", ...plan([]) },
    ]);
    expect(lines[0]).toBe(
      "Eurth (eurth): 1 to import; skipped 1 deleted, 0 system, 0 blank, 0 already imported; 0 authors without an account"
    );
    expect(lines[lines.length - 1]).toBe(
      "Total: 1 to import across 2 boards; skipped 1 deleted, 0 system, 0 blank, 0 already imported; 0 authors without an account"
    );
  });
});

describe("parseBoardHistoryArgs", () => {
  const local = "postgresql://u:p@localhost:5433/ixstats_wv1";

  it("defaults to a dry run and reads --apply", () => {
    expect(parseBoardHistoryArgs([], local)).toEqual({ args: { apply: false } });
    expect(parseBoardHistoryArgs(["--apply"], local)).toEqual({ args: { apply: true } });
  });

  it("lets --dry-run win over --apply", () => {
    expect(parseBoardHistoryArgs(["--apply", "--dry-run"], local)).toEqual({
      args: { apply: false },
    });
  });

  it("refuses the production database, with or without a --production flag", () => {
    const prod = "postgresql://u:p@localhost:5433/ixstats";
    expect(parseBoardHistoryArgs([], prod)).toEqual({ error: expect.stringMatching(/production/) });
    expect(parseBoardHistoryArgs(["--production"], prod)).toEqual({
      error: expect.stringMatching(/Unknown argument/),
    });
  });

  it("refuses a database that is not local", () => {
    expect(parseBoardHistoryArgs([], "postgresql://u:p@db.example.com/ixstats_wv1")).toEqual({
      error: expect.stringMatching(/not local/),
    });
  });

  it("refuses a localhost URL that a host or hostaddr parameter redirects", () => {
    for (const param of ["host=db.example.com", "hostaddr=10.0.0.5"]) {
      expect(parseBoardHistoryArgs([], `${local}?${param}`)).toEqual({
        error: expect.stringMatching(/host or hostaddr/),
      });
    }
  });

  it("refuses a missing DATABASE_URL and an unknown argument", () => {
    expect(parseBoardHistoryArgs([], undefined)).toEqual({
      error: expect.stringMatching(/DATABASE_URL/),
    });
    expect(parseBoardHistoryArgs(["--wat"], local)).toEqual({
      error: expect.stringMatching(/Unknown argument/),
    });
  });
});
