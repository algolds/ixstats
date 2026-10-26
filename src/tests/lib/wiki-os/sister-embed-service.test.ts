/** @jest-environment node */
/**
 * `getSisterEmbed` (sister-embed-service.ts): the live embed behind a `Template:Sister` box. It reads the page's
 * wikitext on its wiki (a missing page is `missing`), renders it there (sister-render-service.ts) and slices the part
 * asked for: the whole page (infobox and body), one section, the infobox, or a card (lead paragraph and first image).
 * HTML is sanitized for embedding (no `<style>`, no `id`) and size-capped. One embed is asked for once an hour (a
 * missing page every 10 minutes), two readers at once share one read, and a wiki that cannot be reached throws
 * WikiUnavailableError and is never cached (Review Focus 5). A page its wiki answers for but cannot render is
 * `unrenderable`, kept 10 minutes like a missing one. Every spelling of one title, and of one section, is one entry,
 * and a render's headings are read once however many sections are asked of it.
 *
 * The reads are real (bridge, http-reader, upstream guard, render service); only `fetch` is spied, answering by the
 * request's `action`.
 */
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { getArticleBySlug: jest.fn() },
}));
jest.mock("~/lib/wiki-os/transformers/server-dom", () => {
  const actual = jest.requireActual<typeof import("~/lib/wiki-os/transformers/server-dom")>(
    "~/lib/wiki-os/transformers/server-dom"
  );
  return { __esModule: true, parseInertOnServer: jest.fn(actual.parseInertOnServer) };
});

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { getSisterEmbed, MAX_EMBED_HTML_CHARS } from "~/lib/wiki-os/services/sister-embed-service";
import { cardOf, renderSectionOf, trimHtml } from "~/lib/wiki-os/sister-embed-parts";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import type { SisterEmbedRequest } from "~/lib/wiki-os/sister-embed";
import { parseInertOnServer } from "~/lib/wiki-os/transformers/server-dom";

const INFOBOX =
  '<table class="infobox"><tr><td><img src="/images/a/ab/Flag_of_Caphiria.png" width="100" height="60"> Caphiria</td></tr></table>';
const LEAD =
  '<p><b>Caphiria</b>, officially the Imperium of Caphiria, is a country in Sarpedon.<sup class="reference"><a href="#cite_note-1">[1]</a></sup></p>';
const SECTIONS =
  '<div class="mw-heading mw-heading2"><h2 id="History">History</h2></div>' +
  "<p>History body.</p>" +
  '<div class="mw-heading mw-heading3"><h3 id="Early_period">Early period</h3></div>' +
  "<p>Early body.</p>" +
  '<div class="mw-heading mw-heading2"><h2 id="Geography">Geography</h2></div>' +
  "<p>Geography body.</p>";
const STYLE = '<style data-mw-deduplicate="TemplateStyles:r1">.lead{color:red}</style>';
const PAGE = `<div class="mw-parser-output">${STYLE}${INFOBOX}${LEAD}${SECTIONS}</div>`;

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let dateSpy: jest.SpiedFunction<typeof Date.now>;
/** An hour on per test: past any breaker cooldown an earlier test left on a host. */
let now = 1_000_000;

/** What the wiki answers this test: the page (or none), its parsed HTML, or an outage. */
let page: { title: string; revId: number } | null;
let parsedHtml = PAGE;
let down = false;
/** The wiki answers the parse with no parse result (it cannot render the page). */
let unrenderable = false;
/** The wiki answers the parse with this API error in a 200, or none. */
let apiError: string | null = null;

let counter = 0;
/** A request for a title of its own, so the module-level caches never link two tests. */
function request(over: Partial<SisterEmbedRequest> = {}): SisterEmbedRequest {
  counter += 1;
  const title = `Caphiria ${counter}`;
  page = { title, revId: 5000 + counter };
  return { wiki: "iiwiki", title, mode: "page", section: null, ...over };
}

function answer(url: URL): Response {
  if (down) {
    return new Response("<html>502 Bad Gateway</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });
  }
  const action = url.searchParams.get("action");
  if (action === "query") {
    if (!page) return Response.json({ query: { pages: { "-1": { missing: "" } } } });
    return Response.json({
      query: {
        pages: {
          "41": {
            pageid: 41,
            title: page.title,
            revisions: [{ revid: page.revId, slots: { main: { "*": "'''Caphiria'''" } } }],
          },
        },
      },
    });
  }
  if (action === "parse" && apiError)
    return Response.json({ error: { code: apiError, info: "x" } });
  if (action === "parse" && unrenderable) return Response.json({ parse: { title: page?.title } });
  if (action === "parse") return Response.json({ parse: { title: page?.title, text: parsedHtml } });
  throw new Error(`unexpected fetch of ${url.href}`);
}

const calls = () => fetchSpy.mock.calls.length;

beforeEach(() => {
  now += 3_600_000;
  down = false;
  unrenderable = false;
  apiError = null;
  parsedHtml = PAGE;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (input) => answer(new URL(String(input))));
});

afterEach(() => {
  fetchSpy.mockRestore();
  dateSpy.mockRestore();
  jest.restoreAllMocks();
});

const htmlOf = async (req: SisterEmbedRequest): Promise<string> => {
  const embed = await getSisterEmbed(req);
  if (embed.status !== "ok" || embed.kind !== "html") throw new Error(JSON.stringify(embed));
  return embed.html;
};

describe("getSisterEmbed: the parts", () => {
  it("the whole page is its infobox and body, sanitized for embedding (no style element, no id)", async () => {
    const req = request();
    const embed = await getSisterEmbed(req);

    expect(embed).toMatchObject({ status: "ok", kind: "html", title: req.title, truncated: false });
    const html = embed.status === "ok" && embed.kind === "html" ? embed.html : "";
    expect(html.indexOf('class="infobox"')).toBeLessThan(html.indexOf("officially the Imperium"));
    expect(html).toContain("Geography body.");
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/\sid=/);
    expect(html).toContain('src="/api/mediawiki/iiwiki/images/a/ab/Flag_of_Caphiria.png"');
  });

  it("the whole page leaves out its table of contents, and an in-page link keeps only its text (an embed has no ids)", async () => {
    parsedHtml = PAGE.replace(
      SECTIONS,
      '<div class="mw-toc"><ul><li><a href="#History">History</a></li></ul></div>' +
        '<div class="toc">Contents</div>' +
        SECTIONS
    );
    const html = await htmlOf(request());

    expect(html).not.toMatch(/toc|Contents/);
    expect(html).not.toMatch(/href="#/);
    expect(html).toContain("[1]");
    expect(html).toContain("Geography body.");
  });

  it("the title is the page's own, after its redirect", async () => {
    const req = request();
    page = { title: "Imperium of Caphiria", revId: 99_000 + counter };
    expect(await getSisterEmbed(req)).toMatchObject({ title: "Imperium of Caphiria" });
  });

  it("section=History is that heading and what follows up to the next heading of its level; a subsection stays inside", async () => {
    const html = await htmlOf(request({ mode: "section", section: "History" }));

    expect(html).toContain("History body.");
    expect(html).toContain("Early period");
    expect(html).toContain("Early body.");
    expect(html).not.toContain("Geography");
    expect(html).not.toContain("officially the Imperium");
    expect(html).not.toContain('class="infobox"');
    expect(html).not.toMatch(/\sid=/);
  });

  it("a section is found by its anchor too, in any case, with underscores", async () => {
    const html = await htmlOf(request({ mode: "section", section: "early_PERIOD" }));
    expect(html).toContain("Early body.");
    expect(html).not.toContain("Geography");
  });

  it("a section that is not there is no-part; an absent infobox too", async () => {
    expect(await getSisterEmbed(request({ mode: "section", section: "Economy" }))).toEqual({
      status: "no-part",
      part: "section",
    });
    parsedHtml = `<div class="mw-parser-output">${LEAD}${SECTIONS}</div>`;
    expect(await getSisterEmbed(request({ mode: "infobox" }))).toEqual({
      status: "no-part",
      part: "infobox",
    });
  });

  it("infobox=yes is the infobox alone", async () => {
    const html = await htmlOf(request({ mode: "infobox" }));
    expect(html).toContain('class="infobox"');
    expect(html).not.toContain("officially the Imperium");
  });

  it("card=yes is the lead paragraph (300 characters at most) and the first image through the proxy", async () => {
    const long = `${"Caphiria is a country with a long and storied past ".repeat(10)}end.`;
    parsedHtml = `<div class="mw-parser-output">${INFOBOX}<p>  </p><p>${long}</p>${SECTIONS}</div>`;
    const req = request({ mode: "card" });
    const embed = await getSisterEmbed(req);

    expect(embed).toMatchObject({
      status: "ok",
      kind: "card",
      title: req.title,
      imageUrl: "/api/mediawiki/iiwiki/images/a/ab/Flag_of_Caphiria.png",
    });
    const summary = embed.status === "ok" && embed.kind === "card" ? embed.summary : "";
    expect(summary.length).toBeLessThanOrEqual(300);
    expect(summary.length).toBeGreaterThan(250);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).toMatch(/^Caphiria is a country/);
    expect(summary).not.toMatch(/\s…$/);
    // cut at a word: what precedes the ellipsis is the text up to a space
    const kept = summary.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long[kept.length]).toBe(" ");
  });

  it("a page that does not exist is missing", async () => {
    const req = request();
    page = null;
    expect(await getSisterEmbed(req)).toEqual({ status: "missing" });
    expect(calls()).toBe(1);
  });

  it("a page its wiki cannot render is unrenderable, asked about again after ten minutes, not before", async () => {
    const req = request();
    unrenderable = true;
    expect(await getSisterEmbed(req)).toEqual({ status: "unrenderable" });
    expect(calls()).toBe(2);

    now += 599_000;
    expect(await getSisterEmbed(req)).toEqual({ status: "unrenderable" });
    expect(calls()).toBe(2);

    now += 2_000;
    unrenderable = false;
    expect(await getSisterEmbed(req)).toMatchObject({ status: "ok" });
    expect(calls()).toBe(4);
  });

  it("an embed over the size cap keeps its first blocks, under the cap", async () => {
    const block = `<p>${"word ".repeat(200)}</p>`;
    parsedHtml = `<div class="mw-parser-output">${block.repeat(200)}</div>`;
    const embed = await getSisterEmbed(request());
    expect(embed).toMatchObject({ status: "ok", kind: "html", truncated: true });
    const html = embed.status === "ok" && embed.kind === "html" ? embed.html : "";

    expect(html.length).toBeLessThanOrEqual(MAX_EMBED_HTML_CHARS);
    expect(html.length).toBeGreaterThan(MAX_EMBED_HTML_CHARS - block.length * 2);
    expect(html.startsWith("<p>")).toBe(true);
  });
});

describe("getSisterEmbed: the wiki is asked rarely", () => {
  it("an unreachable wiki throws WikiUnavailableError and nothing is cached: the next call asks again", async () => {
    const req = request();
    down = true;
    await expect(getSisterEmbed(req)).rejects.toThrow(WikiUnavailableError);
    const asked = calls();
    expect(asked).toBeGreaterThan(0);

    down = false;
    expect(await getSisterEmbed(req)).toMatchObject({ status: "ok" });
    expect(calls()).toBeGreaterThan(asked);
  });

  it("an API error in the parse answer that is not the page's (maxlag) is busy, and nothing is cached", async () => {
    const req = request();
    apiError = "maxlag";
    await expect(getSisterEmbed(req)).rejects.toMatchObject({ reason: "busy" });
    const asked = calls();

    apiError = null;
    expect(await getSisterEmbed(req)).toMatchObject({ status: "ok" });
    expect(calls()).toBeGreaterThan(asked);
  });

  it("one embed is fetched once an hour: a second call within the hour sends no request; after an hour it asks again", async () => {
    const req = request();
    const first = await getSisterEmbed(req);
    const asked = calls();
    expect(asked).toBe(2);

    now += 3_599_000;
    expect(await getSisterEmbed(req)).toBe(first);
    expect(calls()).toBe(asked);

    now += 2_000;
    await getSisterEmbed(req);
    expect(calls()).toBeGreaterThan(asked);
  });

  it("a page that does not exist is asked about again after ten minutes, not before", async () => {
    const req = request();
    page = null;
    await getSisterEmbed(req);
    expect(calls()).toBe(1);

    now += 599_000;
    await getSisterEmbed(req);
    expect(calls()).toBe(1);

    now += 2_000;
    await getSisterEmbed(req);
    expect(calls()).toBe(2);
  });

  it("the cache tells the modes and sections of one page apart", async () => {
    const req = request();
    const whole = await getSisterEmbed(req);
    const section = await getSisterEmbed({ ...req, mode: "section", section: "History" });
    const geography = await getSisterEmbed({ ...req, mode: "section", section: "Geography" });

    expect(section).not.toEqual(whole);
    expect(geography).not.toEqual(section);
  });

  it("every spelling of one title is one entry, and the wiki is asked for its canonical title", async () => {
    const req = request();
    const first = await getSisterEmbed({
      ...req,
      title: `${req.title.toLowerCase().replace(" ", "_")}`,
    });
    expect(new URL(String(fetchSpy.mock.calls[0]![0])).searchParams.get("titles")).toBe(req.title);

    for (const title of [
      req.title,
      `${req.title}_`,
      ` ${req.title}`,
      req.title.replace(" ", "  "),
    ]) {
      expect(await getSisterEmbed({ ...req, title })).toBe(first);
    }
    expect(calls()).toBe(2);
  });

  it("every spelling of one section is one entry", async () => {
    const req = request({ mode: "section", section: "Early period" });
    const first = await getSisterEmbed(req);
    for (const section of ["early period", "EARLY_PERIOD", " Early  period "]) {
      expect(await getSisterEmbed({ ...req, section })).toBe(first);
    }
    expect(calls()).toBe(2);
  });

  it("several section misses on one render parse it once", async () => {
    const req = request();
    await getSisterEmbed(req);
    const parse = jest.mocked(parseInertOnServer);
    parse.mockClear();

    for (const section of ["Economy", "Culture", "Military", "History"]) {
      await getSisterEmbed({ ...req, mode: "section", section });
    }
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("two readers at once cost one request", async () => {
    const req = request();
    const [a, b] = await Promise.all([getSisterEmbed(req), getSisterEmbed({ ...req })]);

    expect(a).toBe(b);
    expect(calls()).toBe(2);
  });
});

describe("the part slicers", () => {
  /** The section of a render whose body is `html` (a fresh render each time, so its headings are read afresh). */
  const sectionOf = (html: string, heading: string) =>
    renderSectionOf({ contentHtml: html, infoboxHtml: null, noticesHtml: null, toc: [] }, heading);

  it("sectionOf finds a bare heading, and stops at a higher one", () => {
    const html = '<h3 id="sister-A">A</h3><p>a</p><h4>B</h4><p>b</p><h2>C</h2><p>c</p>';
    expect(sectionOf(html, "A")).toBe('<h3 id="sister-A">A</h3><p>a</p><h4>B</h4><p>b</p>');
    expect(sectionOf(html, "C")).toBe("<h2>C</h2><p>c</p>");
    expect(sectionOf(html, "Z")).toBeNull();
  });

  it("sectionOf matches a prefixed anchor and an encoded one", () => {
    const html = '<h2 id="sister-%C3%89cole">Old</h2><p>x</p>';
    expect(sectionOf(html, "école")).toBe(html);
  });

  it("sectionOf reads a heading that is not percent-encoding as written", () => {
    expect(sectionOf("<h2>Growth of 100%</h2><p>x</p>", "Growth of 100%")).toBe(
      "<h2>Growth of 100%</h2><p>x</p>"
    );
  });

  it("sectionOf serializes top-level text and comments as they were", () => {
    const html = "<h2>A</h2>a &lt;b&gt; &amp;&nbsp;c<!-- note --><p>x</p><h2>B</h2>";
    expect(sectionOf(html, "A")).toBe("<h2>A</h2>a &lt;b&gt; &amp;&nbsp;c<!-- note --><p>x</p>");
  });

  it("trimHtml counts text and comments as they serialize, so it never goes over", () => {
    const html = `${"&lt;&amp;&nbsp;".repeat(20)}<!--${"c".repeat(40)}--><p>${"y".repeat(30)}</p>`;
    for (const max of [50, 100, 120, 150]) {
      expect(trimHtml(html, max).length).toBeLessThanOrEqual(max);
    }
  });

  it("sectionOf never matches a blank heading, even a heading with no text", () => {
    expect(sectionOf("<h2></h2><p>x</p>", "  ")).toBeNull();
    expect(sectionOf("<h2></h2><p>x</p>", "")).toBeNull();
    expect(sectionOf('<h2 id="sister-"> </h2><p>x</p>', "_")).toBeNull();
  });

  it("sectionOf reads an underscore as a space in the text too", () => {
    expect(sectionOf("<h2>Early period</h2><p>x</p>", "early_period")).toBe(
      "<h2>Early period</h2><p>x</p>"
    );
  });

  it("cardOf cuts a lead with no space in its first 300 characters hard, at 300 with the ellipsis", () => {
    const { summary } = cardOf(
      { contentHtml: `<p>${"a".repeat(300)} b</p>`, infoboxHtml: null, noticesHtml: null, toc: [] },
      "iiwiki"
    );
    expect(summary).toBe(`${"a".repeat(299)}…`);
  });

  it("cardOf reads a short lead whole (no footnote mark), skips a paragraph in a table, and drops an image off the proxy", () => {
    const card = cardOf(
      {
        contentHtml:
          '<table><tr><td><p>In a table</p></td></tr></table><p>Short   lead.<sup class="reference"><a href="#n">[1]</a></sup></p><img src="https://evil.example/x.png"><img src="/api/mediawiki/iiwiki/images/b/bc/Map.png">',
        infoboxHtml:
          '<table class="infobox"><tr><td><img src="https://evil.example/y.png"></td></tr></table>',
        noticesHtml: null,
        toc: [],
      },
      "iiwiki"
    );
    expect(card).toEqual({
      summary: "Short lead.",
      imageUrl: "/api/mediawiki/iiwiki/images/b/bc/Map.png",
    });
  });

  it("cardOf takes the infobox's image before the body's", () => {
    const image = (name: string) => `<img src="/api/mediawiki/iiwiki/images/a/ab/${name}.png">`;
    expect(
      cardOf(
        { contentHtml: image("Body"), infoboxHtml: image("Infobox"), noticesHtml: null, toc: [] },
        "iiwiki"
      ).imageUrl
    ).toBe("/api/mediawiki/iiwiki/images/a/ab/Infobox.png");
  });

  it("cardOf of a page with no paragraph or image is an empty summary and no image", () => {
    expect(
      cardOf(
        { contentHtml: "<ul><li>x</li></ul>", infoboxHtml: null, noticesHtml: null, toc: [] },
        "iiwiki"
      )
    ).toEqual({ summary: "", imageUrl: null });
  });

  it("trimHtml leaves a short page alone and goes into a single wrapper to cut it", () => {
    expect(trimHtml("<p class='a'>a<br/></p><p>b</p>", 100)).toBe(
      "<p class='a'>a<br/></p><p>b</p>"
    );
    const rows = Array.from({ length: 50 }, (_, i) => `<tr><td>${i}</td></tr>`).join("");
    const trimmed = trimHtml(`<table><tbody>${rows}</tbody></table>`, 200);
    expect(trimmed.length).toBeLessThanOrEqual(200);
    expect(trimmed).toMatch(/^<table><tbody><tr><td>0<\/td><\/tr>/);
    expect(trimmed.endsWith("</tbody></table>")).toBe(true);
  });
});
