/**
 * Composer wiki links and embeds carry their wiki (`?source=`): the HTML names the reader path the link opens,
 * and the deserializer reads it back as the same node. A link reads back as a wiki link only when it is one the
 * composer writes; anything else (a query, an absolute URL, a namespace the reader does not read) stays a plain
 * link with its href unchanged, so editing a post never moves a link.
 */
import {
  parsoidHtmlToSlate,
  slateNodesToHtml,
  wikiLinkElement,
  type WikiLinkElement,
} from "~/components/shared/editor/SlateSerializer";
import { publicArticleUrl } from "~/lib/wiki-os/config";

const KEYS = ["NEXT_PUBLIC_BASE_PATH", "BASE_PATH", "NEXT_PUBLIC_IXWORLD_STANDALONE"] as const;
const env = process.env as Record<string, string | undefined>;
const saved = KEYS.map((key) => [key, env[key]] as const);

beforeEach(() => {
  for (const key of KEYS) delete env[key];
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

const paragraph = (...children: object[]) => [{ type: "p", children }];

/** The inline nodes of the first paragraph the deserializer returns. */
function readBack(html: string): object[] {
  const [block] = parsoidHtmlToSlate(html) as Array<{ children: object[] }>;
  return block?.children ?? [];
}

function link(target: string, source?: WikiLinkElement["source"], text = target): WikiLinkElement {
  return source === undefined
    ? { type: "wikilink", target, children: [{ text }] }
    : { type: "wikilink", target, source, children: [{ text }] };
}

describe("wikiLinkElement", () => {
  it("carries a sister wiki's source and leaves it out for IxWiki", () => {
    expect(wikiLinkElement("Gallambria", "iiwiki")).toEqual(link("Gallambria", "iiwiki"));
    expect(wikiLinkElement("Port of Ixnay", "ixwiki", "the port")).toEqual(
      link("Port of Ixnay", undefined, "the port")
    );
    expect(wikiLinkElement("Timeline", "althistory", "")).toEqual(link("Timeline", "althistory"));
  });
});

describe("composer wiki links carry the source", () => {
  it("a wiki link to an iiwiki page serializes to /wiki/X?source=iiwiki and reads back as the same node", () => {
    const node = link("Gallambria Republic", "iiwiki");
    const html = slateNodesToHtml(paragraph(node));
    expect(html).toBe(
      '<p><a href="/wiki/Gallambria_Republic?source=iiwiki">Gallambria Republic</a></p>'
    );
    expect(readBack(html)).toEqual([node]);
  });

  it("an althistory link reads back with its source", () => {
    const node = link("Pax Atomica", "althistory", "the peace");
    expect(readBack(slateNodesToHtml(paragraph(node)))).toEqual([node]);
  });

  it("an IxWiki link has no source and reads back without one", () => {
    const html = slateNodesToHtml(paragraph(link("Port of Ixnay")));
    expect(html).toBe('<p><a href="/wiki/Port_of_Ixnay">Port of Ixnay</a></p>');
    const [node] = readBack(html);
    expect(node).toEqual(link("Port of Ixnay"));
    expect(node).not.toHaveProperty("source");
    // a stored ixwiki source writes the same bare path
    expect(slateNodesToHtml(paragraph(link("Port of Ixnay", "ixwiki")))).toBe(html);
  });

  it("under the base path a link reads back by its title, not with the base path in it", () => {
    env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    expect(readBack('<a href="/projects/ixstates/wiki/Gallambria?source=iiwiki">G</a>')).toEqual([
      link("Gallambria", "iiwiki", "G"),
    ]);
    // a link stored without the base path (as the composer writes it) still reads back
    expect(readBack('<a href="/wiki/Gallambria?source=iiwiki">G</a>')).toEqual([
      link("Gallambria", "iiwiki", "G"),
    ]);
    // the composer never writes the base path: stored HTML is shared across deployments
    expect(slateNodesToHtml(paragraph(link("Gallambria", "iiwiki")))).toBe(
      '<p><a href="/wiki/Gallambria?source=iiwiki">Gallambria</a></p>'
    );
  });

  it("a title with reserved characters stays one path segment and reads back whole", () => {
    const node = link('A/B?c=1#d "e" <f>', "iiwiki");
    const html = slateNodesToHtml(paragraph(node));
    expect(html).toContain('href="/wiki/A%2FB%3Fc%3D1%23d_%22e%22_%3Cf%3E?source=iiwiki"');
    expect(readBack(html)).toEqual([node]);
  });

  it.each([
    ["a query the composer never writes", "/wiki/Foo?oldid=12"],
    ["a fragment", "/wiki/Foo#History"],
    ["an absolute link to a sister wiki", "https://iiwiki.com/wiki/Foo"],
    ["an IxStates permalink", "https://ixwiki.com/wiki/Foo"],
    ["a source the reader does not know", "/wiki/Foo?source=evil"],
    ["a path spelled otherwise", "/wiki/Foo%20Bar"],
  ])("%s stays a plain link with its href unchanged", (_label, href) => {
    expect(readBack(`<a href="${href}">x</a>`)).toEqual([
      { type: "link", url: href, children: [{ text: "x" }] },
    ]);
  });

  const EXCLUDED = [
    "Talk:Foo",
    "User talk:Kir",
    "User:Kir",
    "File:Flag.svg",
    "Special:Random",
    "Category:Nations",
    "Template:Infobox",
    "Module:Infobox",
    "MediaWiki:Common.css",
    "Alternate History talk:Foo",
  ];
  const WIKIS = ["ixwiki", "iiwiki", "althistory"] as const;

  it.each(EXCLUDED.flatMap((target) => WIKIS.map((wiki) => [target, wiki] as const)))(
    "a link to %s on %s (a page the reader does not read as an article) is written as a plain link to that wiki's own page, and saves the same every time",
    (target, wiki) => {
      const first = slateNodesToHtml(paragraph(link(target, wiki)));
      const href = publicArticleUrl(target, wiki);
      expect(first).toBe(
        `<p><a href="${href}" target="_blank" rel="noopener noreferrer">${target}</a></p>`
      );
      const [node] = readBack(first);
      expect(node).toEqual({ type: "link", url: href, children: [{ text: target }] });
      const second = slateNodesToHtml(paragraph(node!));
      expect(second).toBe(first);
      expect(slateNodesToHtml(parsoidHtmlToSlate(second))).toBe(first);
    }
  );

  it("an excluded page's title is read as the reader reads it: padding trimmed, underscores as spaces", () => {
    expect(slateNodesToHtml(paragraph(link(" User_talk:Kir ", "iiwiki", "t")))).toContain(
      `href="${publicArticleUrl("User talk:Kir", "iiwiki")}"`
    );
  });

  it("an article (not excluded) writes the same HTML on every save", () => {
    const first = slateNodesToHtml(paragraph(link("Portal:Nations", "iiwiki", "P")));
    expect(first).toBe('<p><a href="/wiki/Portal%3ANations?source=iiwiki">P</a></p>');
    expect(slateNodesToHtml(parsoidHtmlToSlate(first))).toBe(first);
  });

  it.each([
    [".."],
    ["."],
    [" .. "],
    ["a/../../api"],
    ["../api"],
    ["Foo/./Bar"],
    [""],
    ["   "],
    ["_.._"],
  ])("a crafted title %p never writes a link out of /wiki/: only its text is kept", (target) => {
    const node = link(target, "iiwiki", "click");
    expect(slateNodesToHtml(paragraph(node))).toBe("<p>click</p>");
  });

  it("a title such as Mr. Foo or ... is still a link", () => {
    expect(slateNodesToHtml(paragraph(link("Mr. Foo")))).toContain('href="/wiki/Mr._Foo"');
    expect(slateNodesToHtml(paragraph(link("...")))).toContain('href="/wiki/..."');
  });

  it("link text is escaped, never markup", () => {
    const html = slateNodesToHtml(paragraph(link("Foo", "iiwiki", '<img src=x onerror="a">')));
    expect(html).toBe('<p><a href="/wiki/Foo?source=iiwiki">&lt;img src=x onerror="a"&gt;</a></p>');
  });
});

describe("a stored node never writes raw text into a link", () => {
  it("a wiki link whose stored source the reader does not know writes IxWiki's path", () => {
    const node = {
      type: "wikilink",
      target: "Foo",
      source: 'evil"><script>',
      children: [{ text: "x" }],
    };
    expect(slateNodesToHtml(paragraph(node))).toBe('<p><a href="/wiki/Foo">x</a></p>');
  });

  it("an embed's stored source the reader does not know serializes as IxWiki's", () => {
    const embed = { type: "wikiembed", title: "X", source: 'evil" onload="a', children: [] };
    expect(slateNodesToHtml([embed])).toContain('data-source="ixwiki"');
  });
});

describe("composer embeds carry the source", () => {
  const embed = {
    type: "wikiembed",
    title: "Pax Atomica",
    summary: "A peace.",
    imageUrl: "https://static.wikia.nocookie.net/althistory/images/a/ab/Pax.png",
    source: "althistory",
    children: [{ text: "" }],
  };

  it("an althistory embed serializes and reads back with its source", () => {
    const html = slateNodesToHtml([embed]);
    expect(html).toContain('data-source="althistory"');
    expect(parsoidHtmlToSlate(html)).toEqual([embed]);
  });

  it("an embed whose data-source the reader does not know reads back as IxWiki's", () => {
    const [node] = parsoidHtmlToSlate(
      '<div data-wikiembed="true" data-title="X" data-summary="" data-imageurl="" data-source="evil"></div>'
    ) as Array<{ source: string }>;
    expect(node?.source).toBe("ixwiki");
  });
});
