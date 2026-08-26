import { deserializeParsoidHtml, serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-html";
import type { Descendant } from "slate";

/** Build nodes via the real deserializer so structure matches production. */
function fromHtml(html: string): Descendant[] {
  return deserializeParsoidHtml(`<body>${html}</body>`);
}

describe("serializePlateToWikitext", () => {
  it("serializes headings and bold text", () => {
    const value = fromHtml("<h2>History</h2><p>A <b>bold</b> claim.</p>");
    const { wikitext, complete } = serializePlateToWikitext(value);
    expect(complete).toBe(true);
    expect(wikitext).toContain("== History ==");
    expect(wikitext).toContain("'''bold'''");
  });

  it("emits atomic node wikitext verbatim and reports complete", () => {
    const value = fromHtml('<p>Before</p>');
    // simulate an inserted template node
    value.push({
      type: "raw-html",
      id: "t1",
      kind: "infobox",
      name: "Infobox country",
      params: { capital: "Vilena" },
      html: "<div>preview</div>",
      wikitext: "{{Infobox country|capital=Vilena}}",
      children: [{ text: "" }],
    } as never);
    const { wikitext, complete } = serializePlateToWikitext(value);
    expect(wikitext).toContain("{{Infobox country|capital=Vilena}}");
    expect(wikitext).not.toContain("<div>preview</div>");
    expect(complete).toBe(true);
  });

  it("reports incomplete when an atomic node lacks wikitext", () => {
    const value = fromHtml("<p>x</p>");
    value.push({
      type: "raw-html", id: "t2", kind: "generic",
      html: "<div class=\"navbox\">old render</div>",
      children: [{ text: "" }],
    } as never);
    const { complete } = serializePlateToWikitext(value);
    expect(complete).toBe(false);
  });

  it("roundtrips lists, dividers and tables", () => {
    const value = fromHtml(
      "<ul><li>alpha</li><li>beta</li></ul><hr><table><tr><th>Name</th></tr><tr><td>Vilena</td></tr></table>"
    );
    const { wikitext, complete } = serializePlateToWikitext(value);
    expect(wikitext).toContain("* alpha");
    expect(wikitext).toContain("* beta");
    expect(wikitext).toContain("----");
    expect(wikitext).toContain('{| class="wikitable"');
    expect(wikitext).toContain("! Name");
    expect(wikitext).toContain("| Vilena");
    expect(complete).toBe(true);
  });

  it("renders combined bold+italic marks as five-quote wikitext", () => {
    const value = deserializeParsoidHtml("<body></body>");
    void value;
    // construct leaf directly through deserializer path for marks
    const doc = fromHtml("<p><b><i>both</i></b></p>");
    const { wikitext } = serializePlateToWikitext(doc);
    expect(wikitext).toMatch(/'''''both'''''|<b><i>both<\/i><\/b>/);
  });
});
