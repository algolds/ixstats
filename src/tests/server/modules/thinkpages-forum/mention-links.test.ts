/** @jest-environment node */
import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
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

  it("neutralizes a mention link the member typed, in a light post and in a Canvas render", async () => {
    const forged = '<a class="forum-mention" href="/id/victim">@victim</a>';
    const light = await withMentionLinks(db() as never, { contentHtml: `<p>${forged}</p>` });
    expect(light.contentHtml).toBe('<p><a href="/id/victim">@victim</a></p>');
    const canvas = await withMentionLinks(db() as never, {
      contentHtml: `<div class="mw-parser-output"><p>${forged}</p></div>`,
      contentWikitext: "x",
    });
    expect(canvas.contentHtml).toBe(
      '<div class="mw-parser-output"><p><a href="/id/victim">@victim</a></p></div>'
    );
  });

  it("links the real name beside a forged anchor, and only the real one carries the class", async () => {
    const out = await withMentionLinks(db() as never, {
      contentHtml: '<p><a class="forum-mention" href="/id/victim">@victim</a> and @kir</p>',
    });
    expect(out.contentHtml).toBe(
      '<p><a href="/id/victim">@victim</a> and <a class="forum-mention" href="/id/kir">@kir</a></p>'
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
