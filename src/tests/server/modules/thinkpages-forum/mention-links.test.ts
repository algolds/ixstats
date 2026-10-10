/** @jest-environment node */
import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
import { mentionAnchorNames } from "~/server/modules/thinkpages-forum/mention-html";
import {
  resolveMentionNames,
  withMentionLinks,
} from "~/server/modules/thinkpages-forum/mention-links";

interface WhereOf<W> {
  where: W;
}

function mentionDb(
  users: Array<{ id: string; handle: string }>,
  personas: Array<{ username: string; clerkUserId: string }>
) {
  return {
    user: { findMany: jest.fn(async (_args: object) => users) },
    thinkpagesAccount: { findMany: jest.fn(async (_args: object) => personas) },
  };
}

describe("resolveMentionNames", () => {
  it("resolves a handle to its user and a persona to its owner, the handle winning a shared name", async () => {
    const db = mentionDb(
      [
        { id: "u_kir", handle: "kir" },
        { id: "u_both", handle: "both" },
      ],
      [
        { username: "Aria_V", clerkUserId: "clerk_owner" },
        { username: "both", clerkUserId: "clerk_persona_owner" },
      ]
    );
    const found = await resolveMentionNames(db as never, ["kir", "aria_v", "both", "nobody"]);
    expect(found.get("kir")).toMatchObject({ kind: "user", userId: "u_kir", href: "/id/kir" });
    expect(found.get("aria_v")).toMatchObject({
      kind: "persona",
      ownerClerkId: "clerk_owner",
      href: "/dashboard/profile/Aria_V",
    });
    expect(found.get("both")).toMatchObject({ kind: "user", userId: "u_both" });
    expect(found.has("nobody")).toBe(false);
  });

  it("asks for active members only", async () => {
    const db = mentionDb([], []);
    await resolveMentionNames(db as never, ["kir"]);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: { in: ["kir"] }, isActive: true } })
    );
  });

  it("picks one persona when two differ only by case: the exact spelling, else the oldest", async () => {
    // The rows arrive oldest first (the query orders them by createdAt, then id).
    const exact = mentionDb(
      [],
      [
        { username: "Kira", clerkUserId: "clerk_old" },
        { username: "kira", clerkUserId: "clerk_new" },
      ]
    );
    const byExact = await resolveMentionNames(exact as never, ["kira"]);
    expect(byExact.get("kira")).toMatchObject({
      ownerClerkId: "clerk_new",
      href: "/dashboard/profile/kira",
    });
    const oldest = mentionDb(
      [],
      [
        { username: "Kira", clerkUserId: "clerk_old" },
        { username: "KIRA", clerkUserId: "clerk_new" },
      ]
    );
    const byAge = await resolveMentionNames(oldest as never, ["kira"]);
    expect(byAge.get("kira")).toMatchObject({ ownerClerkId: "clerk_old" });
    expect(oldest.thinkpagesAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    );
  });

  it("looks up at most the first 50 names", async () => {
    const db = mentionDb([], []);
    const names = Array.from({ length: 60 }, (_, i) => `name${i + 100}`);
    await resolveMentionNames(db as never, names);
    const [[userArgs]] = db.user.findMany.mock.calls as never as [
      [WhereOf<{ handle: { in: string[] } }>],
    ];
    const [[personaArgs]] = db.thinkpagesAccount.findMany.mock.calls as never as [
      [WhereOf<{ OR: object[] }>],
    ];
    expect(userArgs.where.handle.in).toHaveLength(MENTION_MAX_PER_POST);
    expect(personaArgs.where.OR).toHaveLength(MENTION_MAX_PER_POST);
  });

  it("asks nothing for no names, and only for active personas that are not personal accounts", async () => {
    const db = mentionDb([], []);
    await resolveMentionNames(db as never, []);
    expect(db.user.findMany).not.toHaveBeenCalled();
    await resolveMentionNames(db as never, ["kir"]);
    const [[args]] = db.thinkpagesAccount.findMany.mock.calls as never as [
      [WhereOf<{ isActive: boolean; accountType: { not: string } }>],
    ];
    expect(args.where.isActive).toBe(true);
    // A personal persona is the member's Passport: that member is reached by handle, never by this name.
    expect(args.where.accountType).toEqual({ not: "personal" });
  });
});

describe("withMentionLinks", () => {
  const db = () => mentionDb([{ id: "u_kir", handle: "kir" }], []);

  it("links a light-editor post and sanitizes the result last", async () => {
    const body = { contentHtml: '<p style="color:red">Hi @kir</p>', plainText: "Hi @kir" };
    const out = await withMentionLinks(db() as never, body);
    expect(out.contentHtml).toBe('<p>Hi <a class="forum-mention" href="/id/kir">@kir</a></p>');
    expect(out.plainText).toBe("Hi @kir");
  });

  it("links a Canvas render and runs the Canvas sanitizer and positioning strip over it again", async () => {
    const body = {
      contentHtml:
        '<div class="mw-parser-output"><p style="color:red;position:fixed" onclick="x()">Hi @kir</p></div>',
      contentWikitext: "Hi @kir",
    };
    const out = await withMentionLinks(db() as never, body);
    expect(out.contentHtml).toBe(
      '<div class="mw-parser-output"><p style="color:red">Hi <a class="forum-mention" href="/id/kir">@kir</a></p></div>'
    );
    expect(out.contentWikitext).toBe("Hi @kir");
  });

  it("returns the body itself, with no query, when there is no @ or no name resolves", async () => {
    const fake = db();
    const plain = { contentHtml: "<p>nothing</p>" };
    await expect(withMentionLinks(fake as never, plain)).resolves.toBe(plain);
    expect(fake.user.findMany).not.toHaveBeenCalled();
    fake.user.findMany.mockResolvedValue([]);
    const nobody = { contentHtml: "<p>Hi @nobody</p>" };
    await expect(withMentionLinks(fake as never, nobody)).resolves.toBe(nobody);
  });

  it("leaves a mention inside a quote, code or a link alone", async () => {
    const body = {
      contentHtml: '<blockquote>@kir</blockquote><code>@kir</code><a href="/x">@kir</a>',
    };
    await expect(withMentionLinks(db() as never, body)).resolves.toBe(body);
  });

  it("re-links a stored mention link that an edit sends back", async () => {
    const stored = '<p>Hi <a class="forum-mention" href="/id/kir">@kir</a></p>';
    const out = await withMentionLinks(db() as never, { contentHtml: stored });
    expect(out.contentHtml).toBe(stored);
    const canvas = `<div class="mw-parser-output">${stored}</div>`;
    const again = await withMentionLinks(db() as never, {
      contentHtml: canvas,
      contentWikitext: "x",
    });
    expect(again.contentHtml).toBe(canvas);
  });

  it("unwraps a forged mention link to text: it stays text unless @name resolves, and then it is the real link", async () => {
    const forged = '<a class="forum-mention" href="/id/victim">@victim</a>';
    const light = await withMentionLinks(db() as never, { contentHtml: `<p>${forged}</p>` });
    expect(light.contentHtml).toBe("<p>@victim</p>");
    const canvas = await withMentionLinks(db() as never, {
      contentHtml: `<div class="mw-parser-output"><p>${forged}</p></div>`,
      contentWikitext: "x",
    });
    expect(canvas.contentHtml).toBe('<div class="mw-parser-output"><p>@victim</p></div>');
    const named = await withMentionLinks(db() as never, {
      contentHtml: '<p><a class="forum-mention" href="https://evil.example/">@kir</a></p>',
    });
    expect(named.contentHtml).toBe('<p><a class="forum-mention" href="/id/kir">@kir</a></p>');
    expect(mentionAnchorNames(named.contentHtml)).toEqual(["kir"]);
  });

  it("links a persona at its profile path, which mentionAnchorNames then trusts", async () => {
    const personas = mentionDb([], [{ username: "Aria_V", clerkUserId: "clerk_owner" }]);
    const out = await withMentionLinks(personas as never, { contentHtml: "<p>Hi @aria_v</p>" });
    expect(out.contentHtml).toBe(
      '<p>Hi <a class="forum-mention" href="/dashboard/profile/Aria_V">@aria_v</a></p>'
    );
    expect(mentionAnchorNames(out.contentHtml)).toEqual(["aria_v"]);
  });

  it("changes nothing in a body past the nesting ceiling, and queries no name", async () => {
    const fake = db();
    const body = {
      contentHtml:
        "<div>".repeat(500) +
        '@kir <a class="forum-mention" href="/id/victim">@victim</a>' +
        "</div>".repeat(500),
    };
    await expect(withMentionLinks(fake as never, body)).resolves.toBe(body);
    expect(fake.user.findMany).not.toHaveBeenCalled();
    expect(mentionAnchorNames(body.contentHtml)).toEqual([]);
  });

  it("keeps a TemplateStyles block of a Canvas render as the first sanitize left it", async () => {
    const style =
      '<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .foo{color:red}</style>';
    const out = await withMentionLinks(db() as never, {
      contentHtml: `<div class="mw-parser-output">${style}<p class="foo">Hi @kir</p></div>`,
      contentWikitext: "x",
    });
    expect(out.contentHtml).toBe(
      `<div class="mw-parser-output">${style}<p class="foo">Hi <a class="forum-mention" href="/id/kir">@kir</a></p></div>`
    );
  });

  it("sanitizes a body whose noscript hides markup from the linker's parser but not from a browser's", async () => {
    // With scripting on, a browser ends the noscript at the first </noscript> and the img is live.
    const trap = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">x</p></noscript>';
    const light = await withMentionLinks(db() as never, { contentHtml: `<p>@kir</p>${trap}` });
    expect(light.contentHtml).not.toMatch(/<noscript/i);
    expect(light.contentHtml).toContain('<a class="forum-mention" href="/id/kir">@kir</a>');
    expect(light.contentHtml).not.toMatch(/<img[^>]*onerror/i);
    const canvas = await withMentionLinks(db() as never, {
      contentHtml: `<div class="mw-parser-output"><p>@kir</p>${trap}</div>`,
      contentWikitext: "x",
    });
    expect(canvas.contentHtml).not.toMatch(/<noscript/i);
    expect(canvas.contentHtml).not.toMatch(/<img[^>]*onerror/i);
  });
});
