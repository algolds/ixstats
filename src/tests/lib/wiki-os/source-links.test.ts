/** @jest-environment node */
import { transformArticleHtml } from "~/lib/wiki-os/transformers/html-transformer";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

/** What ixwiki's action=parse makes of another wiki's wikitext: links are resolved against ixwiki. */
const parsed = [
  '<div class="mw-parser-output">',
  '<p><a href="/wiki/Gallambria" title="Gallambria">Gallambria</a> ',
  '<a href="/wiki/Gallambria#History" title="Gallambria">history</a> ',
  '<a href="/wiki/Portal:Eurth" title="Portal:Eurth">portal</a> ',
  '<a href="/index.php?title=Aurelian_Empire&amp;action=edit&amp;redlink=1" class="new" title="Aurelian Empire (page does not exist)">Aurelian Empire</a> ',
  '<a href="/index.php?title=Special:Upload&amp;wpDestFile=Flag_of_Aurelia.png" class="new" title="File:Flag of Aurelia.png">File:Flag of Aurelia.png</a> ',
  '<a href="/wiki/File:Map.png" class="mw-file-description">map</a> ',
  '<a href="/wiki/Special:Random">random</a> ',
  '<a href="/wiki/User:Kir" title="User:Kir">Kir</a> ',
  '<a href="/wiki/Category:Eurth" title="Category:Eurth">cat</a> ',
  '<a rel="nofollow" class="external text" href="https://eurth.org/">forum</a></p>',
  "</div>",
].join("");

describe("transformArticleHtml links for another wiki's page (ruling E-l)", () => {
  const html = transformArticleHtml(parsed, "", "iiwiki").contentHtml;

  it("keeps article links in the WikiOS reader for that wiki, fragment last", () => {
    expect(html).toContain('href="/wiki/Gallambria?source=iiwiki"');
    expect(html).toContain('href="/wiki/Gallambria?source=iiwiki#History"');
    expect(html).toContain('href="/wiki/Portal:Eurth?source=iiwiki"');
  });

  it("sends red links (missing only on IxWiki) to the reader for that wiki, not to a create form", () => {
    expect(html).toContain('href="/wiki/Aurelian_Empire?source=iiwiki"');
    expect(html).not.toContain("index.php");
    expect(html).not.toContain("redlink");
    expect(html).not.toContain('class="new');
    expect(html).not.toContain("page does not exist");
  });

  it("opens files, special, user and category pages on that wiki", () => {
    expect(html).toContain(
      'href="https://iiwiki.com/wiki/File:Flag_of_Aurelia.png" rel="noreferrer"'
    );
    expect(html).toContain('href="https://iiwiki.com/wiki/File:Map.png" rel="noreferrer"');
    expect(html).toContain('href="https://iiwiki.com/wiki/Special:Random" rel="noreferrer"');
    expect(html).toContain('href="https://iiwiki.com/wiki/User:Kir" rel="noreferrer"');
    expect(html).toContain('href="https://iiwiki.com/wiki/Category:Eurth" rel="noreferrer"');
  });

  it("leaves external links alone", () => {
    expect(html).toContain('href="https://eurth.org/"');
  });

  it("carries the base path like IxWiki links do", () => {
    const withBase = transformArticleHtml(parsed, "/projects/ixstates", "althistory").contentHtml;
    expect(withBase).toContain('href="/projects/ixstates/wiki/Gallambria?source=althistory"');
    expect(withBase).toContain(
      'href="https://althistory.fandom.com/wiki/User:Kir" rel="noreferrer"'
    );
  });

  it("applies to the infobox and notices too", () => {
    const withInfobox = transformArticleHtml(
      '<div class="mw-parser-output"><table class="infobox"><tr><td><a href="/wiki/Gallambria">G</a></td></tr></table><p>Body</p></div>',
      "",
      "iiwiki"
    );
    expect(withInfobox.infoboxHtml).toContain('href="/wiki/Gallambria?source=iiwiki"');
  });
});

describe("transformArticleHtml links for an IxWiki page are unchanged", () => {
  const html = transformArticleHtml(parsed, "", "ixwiki").contentHtml;

  it("routes articles in-app, and files, special pages and red links to ixwiki", () => {
    expect(html).toContain('href="/wiki/Gallambria"');
    expect(html).toContain('href="/wiki/Gallambria#History"');
    expect(html).toContain(`href="${mediaWikiOrigin()}/wiki/File:Map.png" rel="noreferrer"`);
    expect(html).toContain(`href="${mediaWikiOrigin()}/wiki/Special:Random" rel="noreferrer"`);
    expect(html).toContain('href="/wiki/User:Kir"');
    expect(html).toContain(
      `href="${mediaWikiOrigin()}/index.php?title=Aurelian_Empire&amp;action=edit&amp;redlink=1" rel="noreferrer"`
    );
    expect(html).toContain('class="new wikios-redlink"');
    expect(html).not.toContain("source=");
  });
});
