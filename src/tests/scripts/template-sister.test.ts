/**
 * `Template:Sister` (scripts/ops/mediawiki/Template-Sister.wikitext, created on classic by runbook step 3d): the
 * extension point of WikiOS's live sister embeds (plan 2026-10-25 sister wikis, C4). Classic renders a small link box;
 * the box carries `data-sister-wiki`, `-title`, `-mode` and `-section`, and the WikiOS reader mounts a live embed over
 * it from exactly those four attributes (`sisterEmbedRequestOf`). This pins the contract between the template's
 * output and what the reader reads: the opening tag is expanded here as MediaWiki would (positional and named
 * parameters, `{{lc:}}`, `{{#if:}}`, `{{urlencode:…|PATH}}`) and handed to `sisterEmbedRequestOf`. The title and the
 * section are written percent-encoded, so a quote, an ampersand or a percent sign in them round-trips exactly.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { sisterEmbedRequestOf, SISTER_EMBED_SELECTOR } from "~/lib/wiki-os/sister-embed";
import { SISTER_READER_IDS, SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";

const TEMPLATE = fs.readFileSync(
  path.join(process.cwd(), "scripts/ops/mediawiki/Template-Sister.wikitext"),
  "utf8"
);

const includeOnly = (): string => {
  const match = /<includeonly>([\s\S]*)<\/includeonly>/.exec(TEMPLATE);
  if (!match?.[1]) throw new Error("Template:Sister has no includeonly part");
  return match[1];
};

/** The box's opening tag, as written in the template. */
const openingTag = (): string => {
  const match = /^<div [^>]*>/.exec(includeOnly());
  if (!match) throw new Error("the includeonly part does not open with the box");
  return match[0];
};

type Params = Record<string, string>;

/** PHP's `rawurlencode`, which `{{urlencode:…|PATH}}` is: every byte but `A-Z a-z 0-9 - _ . ~` escaped. */
const rawUrlEncode = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );

/**
 * What MediaWiki makes of `text` with `params`: parameters with an empty default, `{{lc:}}`, `{{#if:}}` and
 * `{{urlencode:…|PATH}}`. A parameter's value goes in as a placeholder until the end, so a quote or a brace in it is
 * never read as markup.
 */
function expand(text: string, params: Params): string {
  const values: string[] = [];
  let out = text.replace(/\{\{\{([^{}|]+)\|\}\}\}/g, (_, name: string) => {
    values.push(params[name] ?? "");
    return `\u0000${values.length - 1}\u0000`;
  });
  const real = (placeheld: string) =>
    placeheld.replace(/\u0000(\d+)\u0000/g, (_, i: string) => values[Number(i)] ?? "");
  const innermost =
    /\{\{(?:lc:([^{}|]*)|urlencode:([^{}|]*)\|PATH|#if:([^{}|]*)\|([^{}|]*)\|([^{}|]*))\}\}/;
  for (let match = innermost.exec(out); match; match = innermost.exec(out)) {
    const [whole, lower, encode, condition, then = "", otherwise = ""] = match;
    let value: string;
    if (lower !== undefined) value = real(lower).trim().toLowerCase();
    else if (encode !== undefined) value = rawUrlEncode(real(encode));
    else value = real(condition ?? "").trim() !== "" ? then : otherwise;
    out = out.replace(whole, () => value);
  }
  return real(out);
}

/** The box classic renders for `params`, parsed. */
function renderedBox(params: Params): Element {
  const holder = document.createElement("div");
  holder.innerHTML = `${expand(openingTag(), params)}</div>`;
  const box = holder.querySelector(SISTER_EMBED_SELECTOR);
  if (!box) throw new Error("the rendered box is not found by SISTER_EMBED_SELECTOR");
  return box;
}

describe("Template:Sister", () => {
  it("the box carries data-sister-wiki, -title, -mode and -section inside includeonly", () => {
    const tag = openingTag();
    expect(tag).toContain('class="sister-link"');
    expect(tag).toContain('data-sister-wiki="{{lc:{{{1|}}}}}"');
    expect(tag).toContain('data-sister-title="{{urlencode:{{{2|}}}|PATH}}"');
    expect(tag).toMatch(/data-sister-mode="\{\{#if:/);
    expect(tag).toContain('data-sister-section="{{urlencode:{{{section|}}}|PATH}}"');
    expect(TEMPLATE.indexOf("data-sister-")).toBeGreaterThan(TEMPLATE.indexOf("<includeonly>"));
    expect(TEMPLATE.lastIndexOf("data-sister-")).toBeLessThan(TEMPLATE.indexOf("</includeonly>"));
    expect([...tag.matchAll(/data-sister-[a-z]+/g)].map((m) => m[0])).toEqual([
      "data-sister-wiki",
      "data-sister-title",
      "data-sister-mode",
      "data-sister-section",
    ]);
  });

  it("every reader sister wiki has its name and origin in both switches", () => {
    const body = includeOnly();
    for (const id of SISTER_READER_IDS) {
      const { name, origin } = SISTER_WIKI_HOSTS[id];
      expect(body).toContain(`|${id}=${name}: [${origin}/wiki/{{urlencode:{{{2|}}}|WIKI}}`);
    }
    expect(body).toContain("|#default={{{1|}}}: {{{2|}}}");
  });

  it.each([
    [{ card: "yes", infobox: "yes", section: "History" }, "card"],
    [{ infobox: "yes", section: "History" }, "infobox"],
    [{ section: "History" }, "section"],
    [{}, "page"],
  ])("card wins over infobox, infobox over section, section over page (%j)", (named, mode) => {
    const box = renderedBox({ "1": "iiwiki", "2": "Caphiria", ...named });
    expect(box.getAttribute("data-sister-mode")).toBe(mode);
  });

  it("the box classic renders is the request the reader reads, for each mode", () => {
    expect(sisterEmbedRequestOf(renderedBox({ "1": "IIWiki", "2": "Caphiria" }))).toEqual({
      wiki: "iiwiki",
      title: "Caphiria",
      mode: "page",
      section: null,
    });
    expect(
      sisterEmbedRequestOf(renderedBox({ "1": "iiwiki", "2": "Caphiria", section: "History" }))
    ).toEqual({ wiki: "iiwiki", title: "Caphiria", mode: "section", section: "History" });
    expect(
      sisterEmbedRequestOf(renderedBox({ "1": "althistory", "2": "Main Page", infobox: "yes" }))
    ).toEqual({ wiki: "althistory", title: "Main Page", mode: "infobox", section: null });
    expect(
      sisterEmbedRequestOf(renderedBox({ "1": "iiwiki", "2": "Caphiria", card: "yes" }))
    ).toEqual({ wiki: "iiwiki", title: "Caphiria", mode: "card", section: null });
  });

  it.each([
    [`The "Red" Army`, `War of "1922"`],
    ["Fish & Chips", "Salt & vinegar"],
    ["100% Club", "Growth of 100%"],
    ["Rome's Fall", "Rome's legacy"],
    ["Kingdom of  Urcea (1850–1900)", "Early  period"],
    [`It's "50%" & more`, `"Q&A" 'quoted'`],
  ])("the title %j and the section %j round-trip exactly", (title, section) => {
    expect(sisterEmbedRequestOf(renderedBox({ "1": "iiwiki", "2": title, section }))).toEqual({
      wiki: "iiwiki",
      title,
      mode: "section",
      section,
    });
  });

  it("a box for a wiki WikiOS does not read is no request", () => {
    expect(sisterEmbedRequestOf(renderedBox({ "1": "Wikipedia", "2": "Rome" }))).toBeNull();
  });
});
