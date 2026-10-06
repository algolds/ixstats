/** @jest-environment node */
// Plan 415 (F16): MediaWiki's red links point at `https://<host>/index.php?title=X&action=edit&redlink=1` with a
// `title="X (page does not exist)"` tooltip: about 190 bytes a link, 30% of a large article's bundle, and a trip to
// the classic wiki. WikiOS is primary, so a red link opens WikiOS's own editor as a relative link and keeps the
// `new` class; the tooltip repeats what the red says and goes.
import { transformArticleHtml } from "~/lib/wiki-os/transformers/html-transformer";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const redLink = (title: string, label = title.replace(/_/g, " ")) =>
  `<a href="/index.php?title=${title}&amp;action=edit&amp;redlink=1" class="new" title="${label} (page does not exist)">${label}</a>`;

const content = (body: string) => `<div class="mw-parser-output"><p>${body}</p></div>`;
const transform = (body: string, basePath = "") => transformArticleHtml(content(body), basePath, "ixwiki");

describe("red links of an IxWiki page", () => {
  it("open WikiOS's editor as a relative /wiki link, keep the red class and lose the tooltip", () => {
    const out = transform(redLink("Aurelian_Empire")).contentHtml;

    expect(out).toContain(
      '<a href="/wiki/Aurelian_Empire?action=edit&amp;redlink=1" class="new wikios-redlink">Aurelian Empire</a>'
    );
    expect(out).not.toContain("index.php");
    expect(out).not.toContain(mediaWikiOrigin());
    expect(out).not.toContain("page does not exist");
    expect(out).not.toContain("noreferrer");
  });

  it("read the title through the canonical title helper: namespaces, accents, percent escapes, case", () => {
    const out = transform(
      [
        redLink("Template%3AInfobox_x", "Template:Infobox x"),
        redLink("Caf%C3%A9_Royale"),
        redLink("aurelia"),
        redLink("User_talk:Kir"),
        redLink("A%26B", "A&amp;B"),
      ].join(" ")
    ).contentHtml;

    expect(out).toContain('href="/wiki/Template:Infobox_x?action=edit&amp;redlink=1"');
    expect(out).toContain('href="/wiki/Caf%C3%A9_Royale?action=edit&amp;redlink=1"');
    expect(out).toContain('href="/wiki/Aurelia?action=edit&amp;redlink=1"');
    expect(out).toContain('href="/wiki/User_talk:Kir?action=edit&amp;redlink=1"');
    expect(out).toContain('href="/wiki/A%26B?action=edit&amp;redlink=1"');
  });

  it("carry the base path like every other WikiOS link", () => {
    const out = transform(redLink("Aurelian_Empire"), "/projects/ixstates").contentHtml;

    expect(out).toContain('href="/projects/ixstates/wiki/Aurelian_Empire?action=edit&amp;redlink=1"');
  });

  it("do not depend on the order of the anchor's attributes", () => {
    const out = transform(
      '<a class="new" title="Foo (page does not exist)" href="/index.php?title=Foo&amp;action=edit&amp;redlink=1">Foo</a>'
    ).contentHtml;

    expect(out).toContain('<a class="new wikios-redlink" href="/wiki/Foo?action=edit&amp;redlink=1">Foo</a>');
  });

  it("drop only the red link's own tooltip", () => {
    const out = transform(
      `${redLink("Foo")} <a href="/wiki/Bar" title="Bar">Bar</a> <abbr title="Baz (page does not exist)">Baz</abbr>`
    ).contentHtml;

    expect(out).toContain('<a href="/wiki/Bar" title="Bar">Bar</a>');
    expect(out).toContain('<abbr title="Baz (page does not exist)">');
    expect(out).not.toContain('title="Foo (page does not exist)"');
  });

  it("work in the infobox and notices too", () => {
    const out = transformArticleHtml(
      `<div class="mw-parser-output"><div class="hatnote">See ${redLink("Hat")}</div><table class="infobox"><tr><td>${redLink("Box")}</td></tr></table><p>Body</p></div>`,
      "",
      "ixwiki"
    );

    expect(out.infoboxHtml).toContain('href="/wiki/Box?action=edit&amp;redlink=1"');
    expect(out.noticesHtml).toContain('href="/wiki/Hat?action=edit&amp;redlink=1"');
    expect(`${out.infoboxHtml}${out.noticesHtml}`).not.toContain("index.php");
  });

  it("leave every other index.php link on the wiki, as before", () => {
    const out = transform(
      [
        '<a href="/index.php?title=Foo&amp;action=history">history</a>',
        '<a href="/index.php?title=Foo&amp;oldid=12">old</a>',
        '<a href="/index.php?title=Foo&amp;action=edit">edit</a>',
        '<a href="/index.php?title=Special:Upload&amp;wpDestFile=Flag.png" class="new" title="File:Flag.png">File:Flag.png</a>',
        '<a href="/index.php?title=Foo&amp;action=edit&amp;redlink=1">no class</a>',
      ].join(" ")
    ).contentHtml;

    for (const query of [
      "title=Foo&amp;action=history",
      "title=Foo&amp;oldid=12",
      "title=Foo&amp;action=edit",
      "title=Special:Upload&amp;wpDestFile=Flag.png",
    ]) {
      expect(out).toContain(`href="${mediaWikiOrigin()}/index.php?${query}" rel="noreferrer"`);
    }
    // a red link whose anchor lacks the class is still a red link to a missing page
    expect(out).toContain('href="/wiki/Foo?action=edit&amp;redlink=1"');
  });

  it("stay on the wiki when the title is not one WikiOS can read", () => {
    const out = transform(
      '<a href="/index.php?title=Foo%7CBar&amp;action=edit&amp;redlink=1" class="new" title="Foo|Bar (page does not exist)">x</a>' +
        '<a href="/index.php?action=edit&amp;redlink=1" class="new">y</a>'
    ).contentHtml;

    expect(out).toContain(`href="${mediaWikiOrigin()}/index.php?title=Foo%7CBar&amp;action=edit&amp;redlink=1" rel="noreferrer"`);
    expect(out).toContain(`href="${mediaWikiOrigin()}/index.php?action=edit&amp;redlink=1" rel="noreferrer"`);
  });

  it("are shorter: each red link loses about 40% of its bytes (the old form is spelled out here)", () => {
    const titles = Array.from({ length: 200 }, (_, i) => `Missing_Article_Number_${i}`);
    const after = transform(titles.map((title) => redLink(title)).join(" ")).contentHtml;
    const before = titles
      .map((title) => {
        const label = title.replace(/_/g, " ");
        return (
          `<a href="${mediaWikiOrigin()}/index.php?title=${title}&amp;action=edit&amp;redlink=1" rel="noreferrer" ` +
          `class="new wikios-redlink" title="${label} (page does not exist)">${label}</a>`
        );
      })
      .join(" ");

    expect(after.length).toBeLessThan(before.length * 0.65);
  });
});
