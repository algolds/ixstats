/** @jest-environment node */
import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
import { mentionAnchorNames } from "~/server/modules/thinkpages-forum/mention-html";
import {
  resolveMentionNames,
  withMentionLinks,
} from "~/server/modules/thinkpages-forum/mention-links";
import {
  linkMentionsInHtml,
  mentionNamesInHtml,
  unwrapMentionAnchors,
} from "~/server/modules/thinkpages-forum/mention-html";
import { mentionSuggestions } from "~/server/modules/thinkpages-forum/mention-suggest";

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

describe("mentions in the stored html", () => {
  const KNOWN = new Set(["kir", "aria_v", "bob"]);
  const hrefOf = (name: string) => (KNOWN.has(name) ? `/id/${name}` : null);
  const link = (name: string, text = `@${name}`) =>
    `<a class="forum-mention" href="/id/${name}">${text}</a>`;
  describe("mentionNamesInHtml", () => {
    it("reads names from text, not from quotes, code, links, attributes, styles or scripts", () => {
      const html =
        "<p>Hi @Kir</p><blockquote>@quoted said</blockquote><code>@incode</code><pre>@inpre</pre>" +
        '<a href="/x">@inlink</a><img alt="@inalt" src="/a.png"><style>@instyle{}</style>' +
        "<script>@inscript</script>";
      expect(mentionNamesInHtml(html)).toEqual(["kir"]);
    });
    it("ignores a body nested past the parser ceiling, however the tags are spelled", () => {
      const deep = "<div>".repeat(500) + "@kir" + "</div>".repeat(500);
      expect(mentionNamesInHtml(deep)).toEqual([]);
      // Few tags, but the parser keeps the formatting elements open: it nests far deeper than the tags say.
      const adopted = "<i><b>".repeat(300) + "</i>".repeat(300) + "@kir";
      expect(mentionNamesInHtml(adopted)).toEqual([]);
    });
    it("reads the contents of a noscript as the sanitizer's parser does, as elements nobody is mentioned in", () => {
      expect(mentionNamesInHtml("<noscript><p>@kir</p></noscript>")).toEqual([]);
      expect(mentionNamesInHtml('<noscript><p title="</noscript>@kir">x</p></noscript>')).toEqual(
        []
      );
    });
  });
  describe("linkMentionsInHtml", () => {
    it("keeps escaped characters escaped, so markup in the text cannot become markup", () => {
      expect(linkMentionsInHtml("<p>1 &lt; 2 &lt;b&gt;@kir&lt;/b&gt;</p>", hrefOf)).toBe(
        `<p>1 &lt; 2 &lt;b&gt;${link("kir")}&lt;/b&gt;</p>`
      );
    });
    it("leaves a noscript as it was written and links the text beside it (parser differential)", () => {
      const trap =
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">@kir</p></noscript>';
      expect(linkMentionsInHtml(`<p>@kir</p>${trap}`, hrefOf)).toBe(`<p>${link("kir")}</p>${trap}`);
    });
  });
  describe("unwrapMentionAnchors", () => {
    it("replaces a mention link by its text, and drops the class from any other element", () => {
      expect(
        unwrapMentionAnchors(
          '<p><a class="forum-mention" href="/id/victim">@kir</a> <a class="x Forum-Mention y" href="/z">z <b>b</b></a><span class="forum-mention a">s</span></p>'
        )
      ).toBe('<p>@kir z b<span class="a">s</span></p>');
    });
  });
  describe("mentionAnchorNames", () => {
    it("reads the names of the mention links, not other links, and not forged ones in a quote", () => {
      const html =
        `<p>${link("kir")} <a href="/x">@bob</a></p>` +
        `<blockquote>${link("aria_v")}</blockquote><p>${link("bob")}</p>`;
      expect(mentionAnchorNames(html)).toEqual(["kir", "bob"]);
    });
    it("does not trust a forged anchor: another href, another name, other text, or not the whole text", () => {
      const forged = [
        '<a class="forum-mention" href="/id/victim">@kir</a>',
        '<a class="forum-mention" href="https://evil.example/id/kir">@kir</a>',
        '<a class="forum-mention" href="/id/kir">@bob</a>',
        '<a class="forum-mention" href="/id/kir">hello @kir</a>',
        '<a class="forum-mention" href="/id/kir"><b>@kir</b></a>',
        '<a class="forum-mention">@kir</a>',
        '<a class="other" href="/id/kir">@kir</a>',
        '<a class="Forum-Mention" href="/id/kir">@kir</a>',
      ];
      for (const anchor of forged) expect(mentionAnchorNames(`<p>${anchor}</p>`)).toEqual([]);
    });
  });
});

describe("mention suggestions", () => {
  interface PersonaArgs {
    where: { clerkUserId?: object; accountType?: { not: string } };
  }
  function suggestDb(
    users: Array<{ handle: string | null; clerkUserId: string }> = [],
    personas: Array<{ username: string; displayName: string; profileImageUrl: string | null }> = [],
    avatars: Array<{ clerkUserId: string; profileImageUrl: string | null }> = []
  ) {
    return {
      user: { findMany: jest.fn(async (_args: object) => users) },
      // personalAvatars and the persona search share this table
      thinkpagesAccount: {
        findMany: jest.fn(async (args: PersonaArgs) =>
          args.where.clerkUserId ? avatars : personas
        ),
      },
    };
  }
  describe("mentionSuggestions", () => {
    it("never suggests a personal persona: the persona search excludes personal accounts", async () => {
      const db = suggestDb([], [{ username: "AriaV", displayName: "Aria", profileImageUrl: null }]);
      await mentionSuggestions(db as never, "ar");
      const searches = db.thinkpagesAccount.findMany.mock.calls
        .map(([args]) => args)
        .filter((args) => !args.where.clerkUserId);
      expect(searches).toHaveLength(1);
      expect(searches[0]!.where).toMatchObject({
        isActive: true,
        accountType: { not: "personal" },
      });
    });
    it("gives a handle suggestion exactly its four fields", async () => {
      const db = suggestDb([{ handle: "kirsten", clerkUserId: "clerk_k" }]);
      const [only] = await mentionSuggestions(db as never, "ki");
      expect(Object.keys(only!).sort()).toEqual(["avatarUrl", "kind", "label", "name"]);
    });

    it("never carries a player behind a persona: a persona suggestion has only its own data", async () => {
      const db = suggestDb(
        [],
        [{ username: "aria", displayName: "Aria Vance", profileImageUrl: null }]
      );
      const [only] = await mentionSuggestions(db as never, "ar");
      expect(Object.keys(only!).sort()).toEqual(["avatarUrl", "kind", "label", "name"]);
    });
  });
});
