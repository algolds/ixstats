/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createExportWriter, DEFAULT_SITEINFO } from "~/lib/wiki-os/xml/export-writer";
import { readExport, type ImportEvent, type ImportPage } from "~/lib/wiki-os/xml/import-reader";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";

const FIXTURE = readFileSync(
  join(__dirname, "../../../fixtures/xml/mediawiki-export-0.11.xml"),
  "utf8"
);

async function* chunks(pieces: Array<string | Buffer>): AsyncGenerator<string | Buffer> {
  for (const piece of pieces) yield piece;
}

async function collect(source: AsyncIterable<ImportEvent>): Promise<ImportEvent[]> {
  const events: ImportEvent[] = [];
  for await (const event of source) events.push(event);
  return events;
}

const read = (xml: string) => collect(readExport(chunks([xml])));

const pagesOf = (events: ImportEvent[]): ImportPage[] =>
  events.flatMap((e) => (e.type === "page" ? [e.page] : []));

describe("readExport: the hand-written export-0.11 fixture", () => {
  let events: ImportEvent[];
  beforeAll(async () => {
    events = await read(FIXTURE);
  });

  it("yields siteinfo first, then one event per page", () => {
    expect(events.map((e) => e.type)).toEqual(["siteinfo", "page", "page", "page", "page", "page"]);
    expect(pagesOf(events).map((p) => p.title)).toEqual([
      "Kingdom of Testia",
      "Testia",
      "Talk:Kingdom of Testia",
      "Template:Infobox testia",
      "File:Testia flag.png",
    ]);
  });

  it("reads siteinfo with its namespaces, the main one empty", () => {
    const first = events[0];
    expect(first?.type === "siteinfo" && first.siteinfo).toEqual({
      sitename: "IxWiki",
      dbname: "ixwiki",
      base: "https://ixwiki.com/wiki/Main_Page",
      generator: "MediaWiki 1.45.1",
      case: "first-letter",
      namespaces: [
        { key: -2, case: "first-letter", name: "Media" },
        { key: 0, case: "first-letter", name: "" },
        { key: 1, case: "first-letter", name: "Talk" },
        { key: 6, case: "first-letter", name: "File" },
        { key: 10, case: "first-letter", name: "Template" },
      ],
    });
  });

  it("reads page fields: ns, id, restrictions, redirect, upload count", () => {
    const [kingdom, redirect, talk, template, file] = pagesOf(events);
    expect(kingdom).toMatchObject({
      ns: 0,
      id: 101,
      restrictions: "edit=sysop:move=sysop",
      redirectTitle: null,
      uploads: 0,
    });
    expect(redirect).toMatchObject({ ns: 0, id: 102, redirectTitle: "Kingdom of Testia" });
    expect(talk).toMatchObject({ ns: 1, id: 103, restrictions: null });
    expect(template).toMatchObject({ ns: 10, id: 104 });
    expect(file).toMatchObject({ ns: 6, id: 105, uploads: 1 });
  });

  it("reads a named contributor, an IP, a minor flag and a summary", () => {
    const [first, second] = pagesOf(events)[0]?.revisions ?? [];
    expect(first).toEqual({
      id: 1001,
      parentId: null,
      timestamp: "2026-01-02T03:04:05Z",
      contributor: { username: "Jane", id: 7 },
      minor: false,
      comment: "Create the page",
      model: "wikitext",
      format: "text/x-wiki",
      text: "Testia is a [[kingdom]].",
      bytes: 24,
      sha1: "5m4a1twcqtk8kln29696qjq0i7jb99b",
    });
    expect(second).toMatchObject({
      id: 1002,
      parentId: 1001,
      contributor: { ip: "192.0.2.7" },
      minor: true,
      comment: "typo & <nowiki> fix",
      text: "Testia is a [[kingdom]] & <nowiki>more</nowiki>.",
    });
  });

  it("reports a deleted contributor, comment and text as hidden, keeping bytes and sha1", () => {
    const hidden = pagesOf(events)[0]?.revisions[2];
    expect(hidden).toMatchObject({
      id: 1003,
      contributor: { deleted: true },
      comment: null,
      text: null,
      bytes: 54,
      sha1: "ih14qtmq7un0xyinywzceva6okr6l5u",
    });
  });

  it("keeps text exactly: multibyte, blank lines, trailing newline, CDATA", () => {
    const [, , talk, template] = pagesOf(events);
    expect(talk?.revisions[0]?.text).toBe("Discuss é漢字 here.\n\n* one\n* two\n");
    expect(talk?.revisions[0]?.comment).toBeNull();
    expect(template?.revisions[0]?.text).toBe("<includeonly>{{{1}}}</includeonly>");
  });

  it("skips elements it does not know without failing", () => {
    // <unknownfuturething>, <logitem> at the top level and <upload>'s children are all ignored.
    const template = pagesOf(events)[3];
    expect(template?.revisions).toHaveLength(1);
    expect(pagesOf(events)[4]?.revisions).toHaveLength(1);
  });

  it("every text's sha1 and size agree with what the fixture declares", () => {
    for (const page of pagesOf(events)) {
      for (const revision of page.revisions) {
        if (revision.text === null) continue;
        expect(mwSha1Base36(revision.text)).toBe(revision.sha1);
        expect(Buffer.byteLength(revision.text, "utf8")).toBe(revision.bytes);
      }
    }
  });
});

describe("readExport: chunking", () => {
  it("gives the same events however the stream is cut, one character at a time included", async () => {
    const whole = await read(FIXTURE);
    const byChar = await collect(readExport(chunks(Array.from(FIXTURE))));
    expect(byChar).toEqual(whole);
  });

  it("reassembles multibyte characters split across byte chunks", async () => {
    const bytes = Buffer.from(FIXTURE, "utf8");
    const pieces: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += 7) pieces.push(bytes.subarray(i, i + 7));

    const events = await collect(readExport(chunks(pieces)));

    expect(pagesOf(events)[2]?.revisions[0]?.text).toBe("Discuss é漢字 here.\n\n* one\n* two\n");
    expect(events).toEqual(await read(FIXTURE));
  });

  it("reads a dump that starts with a byte-order mark", async () => {
    const events = await read(`﻿${FIXTURE}`);
    expect(pagesOf(events)).toHaveLength(5);
  });

  it("yields each page as soon as it closes, before the rest of the stream is read", async () => {
    const afterFirstPage = FIXTURE.indexOf("</page>") + "</page>".length;
    let consumedAll = false;
    async function* source(): AsyncGenerator<string> {
      yield FIXTURE.slice(0, afterFirstPage);
      consumedAll = true;
      yield FIXTURE.slice(afterFirstPage);
    }

    const seen: string[] = [];
    for await (const event of readExport(source())) {
      seen.push(event.type);
      if (event.type === "page") {
        expect(consumedAll).toBe(false);
        break;
      }
    }
    expect(seen).toEqual(["siteinfo", "page"]);
  });
});

describe("readExport: bad input", () => {
  it("throws on malformed XML", async () => {
    await expect(read("<mediawiki><page><title>x</page></mediawiki>")).rejects.toThrow();
  });

  it("throws on a document that is not a MediaWiki export", async () => {
    await expect(read("<html><body/></html>")).rejects.toThrow(/not a MediaWiki export/i);
  });

  it("throws on an empty stream", async () => {
    await expect(read("")).rejects.toThrow();
  });

  it("keeps the pages that were complete before a truncated dump fails", async () => {
    const truncated = FIXTURE.slice(0, FIXTURE.indexOf("<title>Testia</title>") + 30);
    const seen: string[] = [];
    await expect(
      (async () => {
        for await (const event of readExport(chunks([truncated]))) {
          if (event.type === "page") seen.push(event.page.title);
        }
      })()
    ).rejects.toThrow();
    expect(seen).toEqual(["Kingdom of Testia"]);
  });

  it("reads a dump with no pages", async () => {
    const events = await read(
      '<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" version="0.11"><siteinfo><sitename>X</sitename></siteinfo></mediawiki>'
    );
    expect(events.map((e) => e.type)).toEqual(["siteinfo"]);
  });

  it("tolerates missing ids, contributor and text: null/default fields, no failure", async () => {
    const events = await read(
      "<mediawiki><page><title>Bare</title><revision><timestamp>2026-01-01T00:00:00Z</timestamp></revision></page></mediawiki>"
    );
    expect(pagesOf(events)[0]).toMatchObject({
      title: "Bare",
      ns: null,
      id: null,
      revisions: [
        {
          id: null,
          parentId: null,
          contributor: { deleted: true },
          text: null,
          model: "wikitext",
          format: "text/x-wiki",
        },
      ],
    });
  });
});

describe("writer to reader round trip", () => {
  const revisions: XmlRevision[] = [
    {
      id: 10,
      parentId: null,
      timestamp: "2026-03-01T00:00:00Z",
      contributor: { username: "Jane <b>", id: 7 },
      minor: false,
      comment: 'summary with <tags> & "quotes"',
      model: "wikitext",
      format: "text/x-wiki",
      text: '<b>&"</b>\r\nsecond line ]]> é漢字🙂\n',
    },
    {
      id: 11,
      parentId: 10,
      timestamp: "2026-03-02T00:00:00Z",
      contributor: { ip: "2001:db8::1" },
      minor: true,
      comment: null,
      model: "wikitext",
      format: "text/x-wiki",
      text: "",
    },
    {
      id: 12,
      parentId: 11,
      timestamp: "2026-03-03T00:00:00Z",
      contributor: { deleted: true },
      minor: false,
      comment: null,
      model: "wikitext",
      format: "text/x-wiki",
      text: null,
      bytes: 99,
      sha1: "abc123",
    },
    {
      id: null,
      parentId: null,
      timestamp: "2026-03-04T00:00:00Z",
      contributor: { username: "Old", id: null },
      minor: false,
      comment: "no ids",
      model: "wikitext",
      format: "text/x-wiki",
      text: "kept",
    },
  ];

  it("reads back exactly what the writer was given (size and hash filled in)", async () => {
    let xml = "";
    const writer = createExportWriter((chunk) => {
      xml += chunk;
    }, DEFAULT_SITEINFO);
    await writer.start();
    await writer.page({
      title: 'Talk:Round "trip" <&>',
      ns: 1,
      pageId: 42,
      redirectTitle: "Target & <more>",
      revisions,
    });
    await writer.page({ title: "Second", ns: 0, pageId: null, revisions: [] });
    await writer.end();

    const events = await read(xml);

    expect(events[0]).toEqual({ type: "siteinfo", siteinfo: DEFAULT_SITEINFO });
    const [first, second] = pagesOf(events);
    expect(first).toEqual({
      title: 'Talk:Round "trip" <&>',
      ns: 1,
      id: 42,
      redirectTitle: "Target & <more>",
      restrictions: null,
      uploads: 0,
      revisions: revisions.map((revision) =>
        revision.text === null
          ? revision
          : {
              ...revision,
              bytes: Buffer.byteLength(revision.text, "utf8"),
              sha1: mwSha1Base36(revision.text),
            }
      ),
    });
    expect(second).toMatchObject({ title: "Second", id: null, revisions: [] });
  });
});
