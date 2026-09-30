/** @jest-environment node */
import { SaxesParser } from "saxes";
import {
  createExportWriter,
  DEFAULT_SITEINFO,
  escapeXmlAttribute,
  escapeXmlText,
  toXmlTimestamp,
} from "~/lib/wiki-os/xml/export-writer";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";

interface ParsedElement {
  name: string;
  attributes: Record<string, string>;
  text: string;
}

/** Parse `xml` with saxes (throws on any well-formedness error) and list its elements. */
function parseElements(xml: string): ParsedElement[] {
  const parser = new SaxesParser();
  const elements: ParsedElement[] = [];
  const open: ParsedElement[] = [];
  parser.on("opentag", (tag) => {
    const element = { name: tag.name, attributes: { ...tag.attributes }, text: "" };
    elements.push(element);
    open.push(element);
  });
  parser.on("text", (text) => {
    const current = open[open.length - 1];
    if (current) current.text += text;
  });
  parser.on("closetag", () => {
    open.pop();
  });
  parser.write(xml).close();
  return elements;
}

const byName = (elements: ParsedElement[], name: string) => elements.filter((e) => e.name === name);

async function dump(
  pages: Parameters<ReturnType<typeof createExportWriter>["page"]>[0][]
): Promise<string> {
  let out = "";
  const writer = createExportWriter((chunk) => {
    out += chunk;
  }, DEFAULT_SITEINFO);
  await writer.start();
  for (const page of pages) await writer.page(page);
  await writer.end();
  return out;
}

const revision = (overrides: Partial<XmlRevision> = {}): XmlRevision => ({
  id: 456,
  parentId: 455,
  timestamp: "2026-01-02T03:04:05Z",
  contributor: { username: "Jane", id: 7 },
  minor: false,
  comment: "edit summary",
  model: "wikitext",
  format: "text/x-wiki",
  text: "Hello",
  ...overrides,
});

describe("escaping", () => {
  it('escapes & < > in text and also " in attributes', () => {
    expect(escapeXmlText('<b>&"</b>')).toBe('&lt;b&gt;&amp;"&lt;/b&gt;');
    expect(escapeXmlAttribute('<b>&"</b>')).toBe("&lt;b&gt;&amp;&quot;&lt;/b&gt;");
  });

  it("keeps carriage returns and attribute whitespace from being normalised away", () => {
    expect(escapeXmlText("a\r\nb")).toBe("a&#13;\nb");
    expect(escapeXmlAttribute("a\nb\tc")).toBe("a&#10;b&#9;c");
  });

  it("drops characters XML 1.0 cannot carry", () => {
    expect(escapeXmlText("a\u0000b\u0008c￾d\uD800e")).toBe("abcde");
    expect(escapeXmlText("tab\there\nnew 🙂")).toBe("tab\there\nnew 🙂");
  });
});

describe("toXmlTimestamp", () => {
  it("drops the milliseconds", () => {
    expect(toXmlTimestamp(new Date("2026-01-02T03:04:05.678Z"))).toBe("2026-01-02T03:04:05Z");
  });
});

describe("createExportWriter", () => {
  it("writes a well-formed export-0.11 document for a page with two revisions", async () => {
    const xml = await dump([
      {
        title: "Talk:Foo",
        ns: 1,
        pageId: 123,
        revisions: [
          revision({ id: 455, parentId: null, text: "first" }),
          revision({ id: 456, parentId: 455, text: "second", minor: true }),
        ],
      },
    ]);

    const elements = parseElements(xml);
    const root = elements[0];
    expect(root?.name).toBe("mediawiki");
    expect(root?.attributes.xmlns).toBe("http://www.mediawiki.org/xml/export-0.11/");
    expect(root?.attributes.version).toBe("0.11");
    expect(byName(elements, "page")).toHaveLength(1);
    expect(byName(elements, "revision")).toHaveLength(2);
    expect(byName(elements, "title")[0]?.text).toBe("Talk:Foo");
    expect(byName(elements, "ns")[0]?.text).toBe("1");
    expect(byName(elements, "text").map((t) => t.text)).toEqual(["first", "second"]);
    expect(byName(elements, "minor")).toHaveLength(1);
    expect(byName(elements, "parentid").map((p) => p.text)).toEqual(["455"]);
    expect(byName(elements, "origin").map((p) => p.text)).toEqual(["455", "456"]);
  });

  it("writes IxWiki's siteinfo, the main namespace as an empty element", async () => {
    const elements = parseElements(await dump([]));

    expect(byName(elements, "sitename")[0]?.text).toBe("IxWiki");
    expect(byName(elements, "generator")[0]?.text).toBe("WikiOS 1");
    const namespaces = byName(elements, "namespace");
    expect(namespaces[0]).toMatchObject({ attributes: { key: "-2" }, text: "Media" });
    expect(namespaces.find((n) => n.attributes.key === "0")).toMatchObject({ text: "" });
    expect(namespaces.find((n) => n.attributes.key === "1")?.text).toBe("Talk");
    expect(namespaces.find((n) => n.attributes.key === "828")?.text).toBe("Module");
  });

  it('round-trips `<b>&"</b>` in text, summary, title and redirect target', async () => {
    const wikitext = '<b>&"</b> a\r\nb ]]> & &amp; &lt;';
    const xml = await dump([
      {
        title: 'Foo <&"> bar',
        ns: 0,
        pageId: 1,
        redirectTitle: 'Bar "quoted" & <more>\nline',
        revisions: [revision({ text: wikitext, comment: '<i>&"</i>' })],
      },
    ]);

    const elements = parseElements(xml);
    expect(byName(elements, "text")[0]?.text).toBe(wikitext);
    expect(byName(elements, "comment")[0]?.text).toBe('<i>&"</i>');
    expect(byName(elements, "title")[0]?.text).toBe('Foo <&"> bar');
    expect(byName(elements, "redirect")[0]?.attributes.title).toBe('Bar "quoted" & <more>\nline');
  });

  it("sizes and hashes a multibyte text by its UTF-8 bytes", async () => {
    const text = "é漢🙂 done"; // 2 + 3 + 4 + 5 bytes
    const xml = await dump([{ title: "Foo", ns: 0, pageId: 1, revisions: [revision({ text })] }]);

    const elements = parseElements(xml);
    const node = byName(elements, "text")[0];
    expect(node?.attributes.bytes).toBe("14");
    expect(node?.attributes.sha1).toBe(mwSha1Base36(text));
    expect(node?.attributes["xml:space"]).toBe("preserve");
    expect(byName(elements, "sha1")[0]?.text).toBe(mwSha1Base36(text));
  });

  it("hashes the empty text with MediaWiki's vector", async () => {
    const xml = await dump([
      { title: "Foo", ns: 0, pageId: 1, revisions: [revision({ text: "" })] },
    ]);

    expect(byName(parseElements(xml), "text")[0]?.attributes).toMatchObject({
      bytes: "0",
      sha1: "phoiac9h4m842xq45sp7s6u21eteeq1",
    });
  });

  it("describes what was written when forbidden characters were dropped", async () => {
    const xml = await dump([
      { title: "Foo", ns: 0, pageId: 1, revisions: [revision({ text: "a\u0000b" })] },
    ]);

    const node = byName(parseElements(xml), "text")[0];
    expect(node?.text).toBe("ab");
    expect(node?.attributes).toMatchObject({ bytes: "2", sha1: mwSha1Base36("ab") });
  });

  it("writes the three kinds of contributor", async () => {
    const xml = await dump([
      {
        title: "Foo",
        ns: 0,
        pageId: 1,
        revisions: [
          revision({ contributor: { username: "Jane", id: 7 } }),
          revision({ id: 457, contributor: { username: "Old", id: null } }),
          revision({ id: 458, contributor: { ip: "1.2.3.4" } }),
          revision({ id: 459, contributor: { deleted: true } }),
        ],
      },
    ]);

    const elements = parseElements(xml);
    expect(byName(elements, "username").map((e) => e.text)).toEqual(["Jane", "Old"]);
    expect(byName(elements, "ip").map((e) => e.text)).toEqual(["1.2.3.4"]);
    expect(byName(elements, "contributor").map((e) => e.attributes.deleted)).toEqual([
      undefined,
      undefined,
      undefined,
      "deleted",
    ]);
    // The "Old" account has no id, so only Jane's `<id>` is inside a contributor: 7.
    expect(byName(elements, "id").map((e) => e.text)).toEqual([
      "1",
      "456",
      "7",
      "457",
      "458",
      "459",
    ]);
  });

  it("writes an unavailable text as a deleted element with the size it had", async () => {
    const xml = await dump([
      {
        title: "Foo",
        ns: 0,
        pageId: 1,
        revisions: [revision({ text: null, comment: null, bytes: 1234, sha1: "abc" })],
      },
    ]);

    const elements = parseElements(xml);
    expect(byName(elements, "text")[0]).toMatchObject({
      attributes: { bytes: "1234", sha1: "abc", deleted: "deleted" },
      text: "",
    });
    expect(byName(elements, "comment")).toHaveLength(0);
  });

  it("omits the optional elements when there is nothing to say", async () => {
    const xml = await dump([
      {
        title: "Foo",
        ns: 0,
        pageId: null,
        revisions: [revision({ id: null, parentId: null, comment: null })],
      },
    ]);

    const names = parseElements(xml).map((e) => e.name);
    for (const absent of ["redirect", "parentid", "origin", "minor", "comment"]) {
      expect(names).not.toContain(absent);
    }
    // Only the contributor's `<id>` is left: the page and the revision have none.
    expect(byName(parseElements(xml), "id").map((e) => e.text)).toEqual(["7"]);
  });

  it("streams revisions from an async iterable, one chunk at a time", async () => {
    const chunks: string[] = [];
    async function* revisions(): AsyncGenerator<XmlRevision> {
      yield revision({ id: 1, parentId: null, text: "one" });
      yield revision({ id: 2, parentId: 1, text: "two" });
    }
    const writer = createExportWriter(async (chunk) => {
      await Promise.resolve();
      chunks.push(chunk);
    });

    await writer.start();
    await writer.page({ title: "Foo", ns: 0, pageId: 1, revisions: revisions() });
    await writer.end();

    // start, page header, two revisions, </page>, </mediawiki>
    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toContain("<siteinfo>");
    expect(chunks[2]).toContain("one");
    expect(chunks[3]).toContain("two");
    expect(() => parseElements(chunks.join(""))).not.toThrow();
  });
});
