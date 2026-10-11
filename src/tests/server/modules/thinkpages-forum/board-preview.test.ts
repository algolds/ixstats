/** @jest-environment node */
import { realmBoardPreview, realmPanel } from "~/server/modules/thinkpages-forum/board-preview";
import {
  admin,
  boardPost,
  boardStore,
  countries,
  member,
  plain,
  seed,
  visitor,
} from "~/tests/helpers/forum-board-fake";

const longText = `${"alpha ".repeat(40)}omega`;

const posts = [
  boardPost("p1", 1),
  boardPost("p2", 2, {
    authorUserId: "u_visitor",
    plainText: "From Aurora",
    contentHtml: "<p>From Aurora</p>",
  }),
  boardPost("p4", 4, {
    authorUserId: "u_member",
    authorPersonaId: "pa_news",
    plainText: "News flash [ixaction=a1] tonight",
    contentHtml: "<p>News flash</p>",
  }),
  boardPost("p5", 5, {
    continuedThreadId: "t_long",
    plainText: "Continued in a thread",
    contentHtml: "<p>Continued in a thread</p>",
  }),
  boardPost("p6", 6, { plainText: longText, contentHtml: `<p>${longText}</p>` }),
  // Newer than every visible message: a query that forgot `hidden: false` would put it first.
  boardPost("p8", 8, { hidden: true, plainText: "Hidden one", contentHtml: "<p>Hidden one</p>" }),
  boardPost("p7", 7, {
    plainText: "",
    contentHtml: '<p><img src="https://img.example/a.png"></p>',
  }),
];

const store = (extra: Parameters<typeof boardStore>[1] = {}) => boardStore(seed({ posts }), extra);

describe("realmBoardPreview", () => {
  it("lists the newest three visible messages, skipping hidden ones and continued placeholders", async () => {
    const out = await realmBoardPreview(store().db as never, null, "eurth");
    expect(out!.realm).toEqual({
      slug: "eurth",
      name: "Eurth",
      emblemUrl: "https://img.example/eurth.png",
      thumbnail: "https://img.example/eurth-thumb.png",
    });
    expect(out!.messages.map((m) => m.id)).toEqual(["p7", "p6", "p4"]);
  });

  it("cuts an excerpt at about 90 characters of whole words, reads an image as one, strips tokens", async () => {
    const out = await realmBoardPreview(store().db as never, null, "eurth");
    const [image, long, persona] = out!.messages;
    expect(image!.excerpt).toBe("[1 image]");
    expect([...long!.excerpt].length).toBeLessThanOrEqual(90);
    expect(long!.excerpt.endsWith("…")).toBe(true);
    expect(
      long!.excerpt
        .slice(0, -1)
        .split(" ")
        .every((w) => w === "alpha")
    ).toBe(true);
    expect(persona!.excerpt).toBe("News flash tonight");
  });

  it("links each message to its anchor on the live board", async () => {
    const out = await realmBoardPreview(store().db as never, null, "eurth");
    expect(out!.messages[0]!.href).toBe("/thinkpages/r/eurth#post-p7");
  });

  it("shows a persona's message by the persona only, never its player", async () => {
    const out = await realmBoardPreview(store().db as never, member as never, "eurth");
    const persona = out!.messages.find((m) => m.id === "p4")!;
    expect(persona.author).toEqual({
      name: "Eurth Daily",
      avatarUrl: "https://img.example/daily.png",
      flagUrl: null,
      persona: true,
    });
    expect(Object.keys(persona).sort()).toEqual(["author", "createdAt", "excerpt", "href", "id"]);
    // The player also wrote p6 and p7 as themselves: only the persona's own message is held to the rule.
    const text = JSON.stringify(persona);
    expect(text).not.toContain("u_member");
    expect(text).not.toContain("flags.example");
    expect(text).not.toContain("eurthdaily");
    for (const message of out!.messages) {
      expect(Object.keys(message).sort()).toEqual(["author", "createdAt", "excerpt", "href", "id"]);
    }
  });

  it("keeps a persona masked for a site admin too, and hides hidden messages from them", async () => {
    // The admin owns the persona's player account: even its owner is shown the persona only.
    const siteAdmin = { ...member, role: admin.role };
    const out = await realmBoardPreview(store().db as never, siteAdmin as never, "eurth");
    expect(out!.messages.map((m) => m.id)).toEqual(["p7", "p6", "p4"]);
    const persona = out!.messages.find((m) => m.id === "p4")!;
    expect(persona.author).toEqual({
      name: "Eurth Daily",
      avatarUrl: "https://img.example/daily.png",
      flagUrl: null,
      persona: true,
    });
    expect(JSON.stringify(persona)).not.toContain("u_member");
  });

  it("shows a player by public name, picture and flag", async () => {
    const only = boardStore(seed({ posts: [boardPost("p1", 1)] }));
    const out = await realmBoardPreview(only.db as never, null, "eurth");
    expect(out!.messages[0]!.author).toEqual({
      name: "member",
      avatarUrl: null,
      flagUrl: "https://flags.example/u_member.png",
      persona: false,
    });
  });

  it("gives null for an unknown realm and for a realm hidden from the viewer", async () => {
    await expect(
      realmBoardPreview(store().db as never, member as never, "nope")
    ).resolves.toBeNull();
    await expect(
      realmBoardPreview(store().db as never, member as never, "draft")
    ).resolves.toBeNull();
    await expect(realmBoardPreview(store().db as never, null, "draft")).resolves.toBeNull();
  });

  it("shows a draft realm to its founder and to a site admin, and not to a member", async () => {
    const founder = { ...plain, id: "u_draft_founder", clerkUserId: "draft_founder" };
    for (const viewer of [founder, admin]) {
      const out = await realmBoardPreview(store().db as never, viewer as never, "draft");
      expect(out).toMatchObject({ realm: { slug: "draft", name: "Draft" }, messages: [] });
    }
    await expect(
      realmBoardPreview(store().db as never, member as never, "draft")
    ).resolves.toBeNull();
  });

  it("loads no user for persona-only messages, and not a persona's player for mixed ones", async () => {
    const personaOnly = boardStore(
      seed({ posts: [boardPost("p1", 1, { authorPersonaId: "pa_news" })] })
    );
    await realmBoardPreview(personaOnly.db as never, null, "eurth");
    expect(personaOnly.db.user.findMany).not.toHaveBeenCalled();

    const mixed = boardStore(
      seed({
        posts: [
          boardPost("p1", 1, { authorPersonaId: "pa_news" }),
          boardPost("p2", 2, { authorUserId: "u_visitor" }),
        ],
      })
    );
    await realmBoardPreview(mixed.db as never, null, "eurth");
    expect(mixed.db.user.findMany).toHaveBeenCalledTimes(1);
    expect(mixed.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["u_visitor"] } } })
    );
  });

  it("reads the realm once, with its images", async () => {
    const s = store();
    await realmBoardPreview(s.db as never, null, "eurth");
    expect(s.db.realm.findUnique).toHaveBeenCalledTimes(1);
  });

  it("gives an empty list for a realm whose board has no messages, and does not seed one", async () => {
    const empty = boardStore(seed({ posts: [] }));
    const out = await realmBoardPreview(empty.db as never, null, "eurth");
    expect(out!.messages).toEqual([]);
    const noBoard = boardStore({ ...seed({ posts: [] }), threads: [] });
    const none = await realmBoardPreview(noBoard.db as never, null, "eurth");
    expect(none!.messages).toEqual([]);
  });

  it("reads nothing but the visible, uncontinued posts of the board thread", async () => {
    const s = store();
    await realmBoardPreview(s.db as never, null, "eurth");
    const [[call]] = s.db.forumPost.findMany.mock.calls as never as [
      [{ where: { threadId: string; hidden: boolean; continuedThreadId: null }; take: number }],
    ];
    expect(call.where).toEqual({
      threadId: "t_board_r_eurth",
      hidden: false,
      continuedThreadId: null,
    });
    expect(call.take).toBe(3);
    expect(s.db.forumThread.create).not.toHaveBeenCalled();
  });

  it("works for IxWorld, which has no realm row and no board yet", async () => {
    const out = await realmBoardPreview(store().db as never, null, "ixworld");
    expect(out).toEqual({
      realm: { slug: "ixworld", name: "IxWorld", emblemUrl: null, thumbnail: null },
      messages: [],
    });
  });
});

describe("realmPanel", () => {
  it("gives the viewer's own realm", async () => {
    const out = await realmPanel(store().db as never, member as never);
    expect(out!.realm.slug).toBe("eurth");
    expect(out!.messages.map((m) => m.id)).toEqual(["p7", "p6", "p4"]);
  });

  it("gives a viewer in another realm that realm, whose empty board is an empty list", async () => {
    const out = await realmPanel(store().db as never, visitor as never);
    expect(out!.realm.slug).toBe("aurora");
    expect(out!.messages).toEqual([]);
  });

  it("gives null to a viewer who holds no nation", async () => {
    await expect(realmPanel(store().db as never, plain as never)).resolves.toBeNull();
  });

  it("gives null when the viewer's realm is hidden from them", async () => {
    const held = [
      ...countries,
      { id: "c_draft", ownerUserId: "u_plain", realmId: "r_draft", currentTotalGdp: 1 },
    ];
    await expect(
      realmPanel(store({ countries: held }).db as never, plain as never)
    ).resolves.toBeNull();
  });

  it("follows the current country when the viewer holds nations in two realms", async () => {
    const held = [
      ...countries,
      { id: "c_second", ownerUserId: "u_member", realmId: "r_aurora", currentTotalGdp: 99 },
    ];
    const current = await realmPanel(
      store({ countries: held }).db as never,
      { ...member, countryId: "c_eurth" } as never
    );
    expect(current!.realm.slug).toBe("eurth");
    const other = await realmPanel(
      store({ countries: held }).db as never,
      { ...member, countryId: "c_second" } as never
    );
    expect(other!.realm.slug).toBe("aurora");
  });
});
