/** @jest-environment node */
/**
 * Plan 408: exporting WikiOS pages as XML, and the whole loop: XML dump -> WikiOS tables -> XML dump -> WikiOS tables
 * (an export is a dump WikiOS itself can import without loss). Published pages only, never a parked or deleted
 * revision as the head, deleted text written as deleted; and the writer's escaping and streaming.
 */
jest.mock("~/server/db", () => jest.requireActual("./fake-wiki-db").createFakeDbModule());
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeExport } from "~/lib/wiki-os/xml/exporter";
import { type ImportEvent, type ImportPage, readExport } from "~/lib/wiki-os/xml/import-reader";
import { importExport } from "~/lib/wiki-os/xml/importer";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { type ArticleRow, resetStore, type RevisionRow, store } from "./fake-wiki-db";
import { SaxesParser } from "saxes";
import { createExportWriter, DEFAULT_SITEINFO, escapeXmlAttribute, escapeXmlText } from "~/lib/wiki-os/xml/export-writer";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";

const FIXTURE = readFileSync(
  join(__dirname, "../../../fixtures/xml/mediawiki-export-0.11.xml"),
  "utf8"
);

async function* chunks(text: string): AsyncGenerator<string> {
  yield text;
}

async function collect(source: AsyncIterable<ImportEvent>): Promise<ImportPage[]> {
  const pages: ImportPage[] = [];
  for await (const event of source) if (event.type === "page") pages.push(event.page);
  return pages;
}

async function exportXml(selection: Parameters<typeof writeExport>[1]): Promise<string> {
  let xml = "";
  await writeExport((chunk) => {
    xml += chunk;
  }, selection);
  return xml;
}

const readXml = (xml: string) => collect(readExport(chunks(xml)));

/** The stored tables without generated ids and bookkeeping timestamps, for before/after comparison. */
function tables() {
  const titleOf = (id: string) => store.articles.find((a) => a.id === id)?.title;
  return {
    articles: store.articles
      .map(({ id: _id, updatedAt: _updatedAt, protectionLevel: _protection, ...rest }) => rest)
      .sort((a, b) => a.title.localeCompare(b.title)),
    revisions: store.revisions
      .map(({ id: _id, articleId, ...rest }) => ({ page: titleOf(articleId), ...rest }))
      .sort((a, b) =>
        `${a.page}${a.createdAt.toISOString()}`.localeCompare(
          `${b.page}${b.createdAt.toISOString()}`
        )
      ),
  };
}

const seedPage = (overrides: Partial<ArticleRow>, revisions: Array<Partial<RevisionRow>> = []) => {
  const article: ArticleRow = {
    id: `a${store.articles.length + 1}`,
    source: "ixwiki",
    title: "Page",
    slug: "page",
    status: "PUBLISHED",
    format: "WIKITEXT",
    namespace: 0,
    namespacePrefix: null,
    wikitext: "head text",
    contentHtml: null,
    htmlSyncedAt: null,
    summary: null,
    wordCount: 2,
    readingTime: 1,
    mwPageId: null,
    mwLatestRevId: null,
    redirectTargetSlug: null,
    redirectTargetFragment: null,
    protectionLevel: "ALL",
    updatedAt: new Date("2026-05-05T05:05:05Z"),
    ...overrides,
  };
  store.articles.push(article);
  revisions.forEach((revision, index) =>
    store.revisions.push({
      id: `r${store.revisions.length + 1}`,
      articleId: article.id,
      source: "ixwiki",
      mwRevId: null,
      author: "Jane",
      authorId: null,
      summary: null,
      minor: false,
      textDeleted: false,
      commentDeleted: false,
      userDeleted: false,
      byteSize: 9,
      byteDelta: 9,
      sha1: null,
      createdAt: new Date(Date.UTC(2026, 0, 1 + index)),
      wikitext: "head text",
      format: "WIKITEXT",
      ...revision,
    })
  );
  return article;
};

beforeEach(() => {
  resetStore();
});
describe("writeExport", () => {
  it("writes only PUBLISHED pages, selected by canonical title", async () => {
    seedPage({ title: "Alpha" }, [{}]);
    seedPage({ title: "Beta", status: "DRAFT" }, [{}]);
    seedPage({ title: "Gamma", source: "iiwiki" }, [{}]);

    const pages = await readXml(
      await exportXml({
        source: "ixwiki",
        titles: ["alpha", "Beta", "Gamma", "not a page|"],
        history: false,
      })
    );

    expect(pages.map((p) => p.title)).toEqual(["Alpha"]);
  });

  it("exports a page's head with the attribution of the revision it came from", async () => {
    seedPage({ title: "Alpha", wikitext: "new text", mwPageId: 9, namespace: 0 }, [
      { mwRevId: 1, wikitext: "old text", author: "Old" },
      { mwRevId: 2, wikitext: "new text", author: "192.0.2.1", summary: "tweak", minor: true },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page).toMatchObject({ title: "Alpha", id: 9, ns: 0 });
    expect(page?.revisions).toHaveLength(1);
    expect(page?.revisions[0]).toMatchObject({
      id: 2,
      contributor: { ip: "192.0.2.1" },
      comment: "tweak",
      minor: true,
      text: "new text",
    });
  });
  it("never takes a parked revision (a MediaWiki edit that did not go live) for the head, and leaves it out of the history (plan 406)", async () => {
    seedPage({ title: "Alpha", wikitext: "WikiOS text" }, [
      { mwRevId: 1, wikitext: "WikiOS text", author: "Jane" },
      { mwRevId: 2, wikitext: "A conflicting edit", author: "Bob", parked: true },
    ]);

    const [current] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );
    const [full] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(current?.revisions[0]).toMatchObject({ id: 1, text: "WikiOS text" });
    expect(full?.revisions.map((r) => r.id)).toEqual([1]);
  });

  it("skips a newer unfilled placeholder when choosing the head's revision", async () => {
    seedPage({ title: "Alpha", wikitext: "real text" }, [
      { mwRevId: 1, wikitext: "real text", author: "Jane" },
      { mwRevId: 2, wikitext: "", byteSize: 500, author: "Bob" },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page?.revisions[0]).toMatchObject({
      id: 1,
      contributor: { username: "Jane", id: null },
    });
  });

  it("exports a page with no revision rows from its own fields", async () => {
    seedPage({
      title: "Alpha",
      wikitext: "only text",
      updatedAt: new Date("2026-05-05T05:05:05.900Z"),
    });

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page?.revisions[0]).toMatchObject({
      id: null,
      timestamp: "2026-05-05T05:05:05Z",
      contributor: { deleted: true },
      text: "only text",
    });
  });

  it("exports full history oldest first, chaining parent ids and writing placeholders as unavailable text", async () => {
    seedPage({ title: "Alpha" }, [
      { mwRevId: 10, wikitext: "v1" },
      { mwRevId: 11, wikitext: "", byteSize: 123, sha1: "abc" },
      { mwRevId: null, wikitext: "v3" },
      { mwRevId: 13, wikitext: "", byteSize: 0 },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(page?.revisions.map((r) => [r.id, r.parentId, r.text, r.bytes])).toEqual([
      [10, null, "v1", 2],
      [11, 10, null, 123],
      [null, 11, "v3", 2],
      [13, null, "", 0],
    ]);
    expect(page?.revisions[1]?.sha1).toBe("abc");
  });
  it("never exports a redirect the wikitext does not make, whatever stale columns say", async () => {
    seedPage(
      {
        title: "Was redirect",
        wikitext: "now an article",
        redirectTargetSlug: "Old target",
        redirectTargetFragment: "x",
      },
      [{ wikitext: "now an article" }]
    );

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Was redirect"], history: false })
    );

    expect(page?.redirectTitle).toBeNull();
  });

  it("pages through histories longer than one batch", async () => {
    seedPage(
      { title: "Alpha" },
      Array.from({ length: 450 }, (_, i) => ({ mwRevId: i + 1, wikitext: `text ${i}` }))
    );

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(page?.revisions).toHaveLength(450);
    expect(page?.revisions.map((r) => r.id)).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
  });

  it("writes deleted text, summaries and authors back as deleted, and unfetched history as unavailable", async () => {
    seedPage({ title: "Alpha" }, [
      { mwRevId: 1, wikitext: "visible" },
      { mwRevId: 2, wikitext: "", textDeleted: true, byteSize: 0, sha1: "gone" },
      {
        mwRevId: 3,
        wikitext: "t",
        commentDeleted: true,
        summary: "never exported",
        userDeleted: true,
        author: "(deleted)",
      },
      { mwRevId: 4, wikitext: "", byteSize: 4096 },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    const [visible, deleted, hiddenMeta, unfetched] = page?.revisions ?? [];
    expect(visible).toMatchObject({ text: "visible", textDeleted: false });
    // A deleted text with size 0 is still deleted: never a visible empty revision.
    expect(deleted).toMatchObject({ text: null, textDeleted: true, bytes: 0, sha1: "gone" });
    expect(hiddenMeta).toMatchObject({
      text: "t",
      comment: null,
      commentDeleted: true,
      contributor: { deleted: true },
    });
    expect(unfetched).toMatchObject({ text: null, textDeleted: false, bytes: 4096 });
  });

  it("a current-only export never takes a revision with deleted text as the head's", async () => {
    seedPage({ title: "Alpha", wikitext: "real" }, [
      { mwRevId: 1, wikitext: "real", author: "Jane" },
      { mwRevId: 2, wikitext: "", textDeleted: true, byteSize: 0, author: "Bob" },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page?.revisions[0]).toMatchObject({
      id: 1,
      contributor: { username: "Jane", id: null },
    });
  });
  it("without titles, exports every published page of the namespaces asked for, in batches", async () => {
    for (let i = 0; i < 450; i++) seedPage({ title: `Page ${i}` }, [{}]);
    seedPage({ title: "Talk:Page 0", namespace: 1, namespacePrefix: "Talk" }, [{}]);

    const all = await readXml(await exportXml({ source: "ixwiki", history: false }));
    const talk = await readXml(
      await exportXml({ source: "ixwiki", namespaces: [1], history: false })
    );

    expect(all).toHaveLength(451);
    expect(new Set(all.map((p) => p.title)).size).toBe(451);
    expect(talk.map((p) => p.title)).toEqual(["Talk:Page 0"]);
  });
});

describe("the loop: import, export, import again", () => {
  it("an export of imported history re-imports to exactly the same pages and revisions", async () => {
    await importExport(readExport(chunks(FIXTURE)));
    const first = tables();
    expect(first.articles).toHaveLength(5);
    expect(first.revisions).toHaveLength(7);
    const xml = await exportXml({ source: "ixwiki", history: true });

    resetStore();
    const summary = await importExport(readExport(chunks(xml)));

    expect(summary.errors).toEqual([]);
    expect(summary).toMatchObject({ pages: 5, pagesCreated: 5, revisionsImported: 7 });
    expect(tables()).toEqual(first);
  });

  it("keeps deleted and never-fetched revisions exactly as they were through export and import", async () => {
    seedPage({ title: "Alpha", wikitext: "visible", mwPageId: 5 }, [
      { mwRevId: 1, wikitext: "visible", sha1: mwSha1Base36("visible"), byteSize: 7 },
      { mwRevId: 2, wikitext: "", textDeleted: true, byteSize: 0 },
      {
        mwRevId: 3,
        wikitext: "x",
        commentDeleted: true,
        summary: null,
        userDeleted: true,
        author: "(deleted)",
        byteSize: 1,
      },
      { mwRevId: 4, wikitext: "", byteSize: 4096 },
    ]);
    const before = tables();
    const xml = await exportXml({ source: "ixwiki", history: true });

    resetStore();
    const summary = await importExport(readExport(chunks(xml)));

    expect(summary).toMatchObject({ revisionsImported: 4, errors: [] });
    const rows = tables().revisions;
    expect(
      rows.map((r) => [
        r.mwRevId,
        r.textDeleted,
        r.commentDeleted,
        r.userDeleted,
        r.wikitext,
        r.byteSize,
      ])
    ).toEqual(
      before.revisions.map((r) => [
        r.mwRevId,
        r.textDeleted,
        r.commentDeleted,
        r.userDeleted,
        r.wikitext,
        r.byteSize,
      ])
    );
    expect(rows.map((r) => [r.mwRevId, r.textDeleted, r.byteSize])).toEqual([
      [1, false, 7],
      [2, true, 0],
      [3, false, 1],
      [4, false, 4096],
    ]);
  });
});

describe("the export writer", () => {
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
    textDeleted: false,
    commentDeleted: false,
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
  describe("createExportWriter", () => {
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
});
