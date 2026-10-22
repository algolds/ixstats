/** @jest-environment node */
/**
 * Plan 408: what comes in before the importer: the export reader (hidden and unfetched text, exact text, any chunking,
 * truncated and malformed dumps, nesting and unknown blocks bounded), the upload stream (a byte limit and a gzip bomb
 * bounded by the bytes sent and by what they expand to), the command line's dump input, the hash MediaWiki uses and the
 * XML-forbidden characters a save strips (never joining two lone surrogates).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createExportWriter, DEFAULT_SITEINFO } from "~/lib/wiki-os/xml/export-writer";
import { type ImportEvent, type ImportPage, MAX_DEPTH, readExport } from "~/lib/wiki-os/xml/import-reader";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";
import { gzipSync } from "node:zlib";
import { byteLimit, openUpload, PayloadTooLargeError } from "~/lib/wiki-os/xml/upload-stream";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { openDumpInput } from "~/lib/wiki-os/xml/dump-input";
import { stripXmlForbiddenControlChars } from "~/lib/wiki-os/xml/control-chars";

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
  it("reports a deleted contributor, comment and text as hidden, keeping bytes and sha1", () => {
    const hidden = pagesOf(events)[0]?.revisions[2];
    expect(hidden).toMatchObject({
      id: 1003,
      contributor: { deleted: true },
      comment: null,
      commentDeleted: true,
      text: null,
      textDeleted: true,
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
  it("tells deleted text from text that was never fetched and from a blank page", async () => {
    const events = await read(
      "<mediawiki><page><title>Foo</title><ns>0</ns>" +
        '<revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text bytes="9" sha1="x" deleted="deleted" /></revision>' +
        '<revision><id>2</id><timestamp>2026-01-02T00:00:00Z</timestamp><text bytes="9" sha1="x" xml:space="preserve"></text></revision>' +
        '<revision><id>3</id><timestamp>2026-01-03T00:00:00Z</timestamp><text bytes="0" sha1="phoiac9h4m842xq45sp7s6u21eteeq1" xml:space="preserve"></text></revision>' +
        "<revision><id>4</id><timestamp>2026-01-04T00:00:00Z</timestamp><text /></revision>" +
        "<revision><id>5</id><timestamp>2026-01-05T00:00:00Z</timestamp></revision>" +
        "</page></mediawiki>"
    );

    expect(pagesOf(events)[0]?.revisions.map((r) => [r.id, r.text, r.textDeleted])).toEqual([
      [1, null, true], // deleted by an administrator
      [2, null, false], // a size but no content: never fetched
      [3, "", false], // really blank
      [4, "", false], // no claim about content
      [5, null, false], // no <text> at all
    ]);
  });
});

describe("readExport: hostile structure", () => {
  const revision =
    "<revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text>kept</text></revision>";

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "prototype"])(
    "skips an element called <%s> anywhere without failing or changing the page",
    async (name) => {
      const xml =
        `<mediawiki><${name}>top</${name}><page><${name}><${name}>x</${name}></${name}>` +
        `<title>Foo</title><ns>0</ns>${revision.replace("<text>", `<${name}>y</${name}><text>`)}` +
        `</page></mediawiki>`;

      const events = await read(xml);

      expect(pagesOf(events)).toHaveLength(1);
      expect(pagesOf(events)[0]).toMatchObject({ title: "Foo", ns: 0 });
      expect(pagesOf(events)[0]?.revisions[0]).toMatchObject({ id: 1, text: "kept" });
    }
  );
  const nested = (levels: number) => `${"<a>".repeat(levels)}deep${"</a>".repeat(levels)}`;

  it("accepts nesting up to the limit", async () => {
    // <mediawiki> is level 1, so MAX_DEPTH - 1 more elements fit.
    const xml = `<mediawiki>${nested(MAX_DEPTH - 1)}</mediawiki>`;

    await expect(read(xml)).resolves.toEqual([]);
  });

  it("refuses nesting past the limit", async () => {
    const xml = `<mediawiki>${nested(MAX_DEPTH)}</mediawiki>`;

    await expect(read(xml)).rejects.toThrow(/deeper than 64 levels/);
  });

  it("refuses hostile nesting before buffering it, however deep it goes", async () => {
    const xml = `<mediawiki>${"<a>".repeat(100_000)}`;

    await expect(read(xml)).rejects.toThrow(/deeper than 64 levels/);
  });

  it("reads a dump with a large unknown block inside a page without keeping its text", async () => {
    const big = "x".repeat(5_000_000);
    const xml = `<mediawiki><page><title>Foo</title><ns>0</ns><blob>${big}</blob>${revision}</page></mediawiki>`;

    const events = await read(xml);

    expect(pagesOf(events)[0]?.revisions[0]?.text).toBe("kept");
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
      commentDeleted: false,
      model: "wikitext",
      format: "text/x-wiki",
      text: '<b>&"</b>\r\nsecond line ]]> é漢字🙂\n',
      textDeleted: false,
    },
    {
      id: 11,
      parentId: 10,
      timestamp: "2026-03-02T00:00:00Z",
      contributor: { ip: "2001:db8::1" },
      minor: true,
      comment: null,
      commentDeleted: false,
      model: "wikitext",
      format: "text/x-wiki",
      text: "",
      textDeleted: false,
    },
    {
      id: 12,
      parentId: 11,
      timestamp: "2026-03-03T00:00:00Z",
      contributor: { deleted: true },
      minor: false,
      comment: null,
      commentDeleted: true,
      model: "wikitext",
      format: "text/x-wiki",
      text: null,
      textDeleted: true,
      bytes: 99,
      sha1: "abc123",
    },
    {
      id: 14,
      parentId: 13,
      timestamp: "2026-03-03T12:00:00Z",
      contributor: { username: "Jane", id: 7 },
      minor: false,
      comment: "history that was never fetched",
      commentDeleted: false,
      model: "wikitext",
      format: "text/x-wiki",
      text: null,
      textDeleted: false,
      bytes: 4096,
      sha1: "abc456",
    },
    {
      id: null,
      parentId: null,
      timestamp: "2026-03-04T00:00:00Z",
      contributor: { username: "Old", id: null },
      minor: false,
      comment: "no ids",
      commentDeleted: false,
      model: "wikitext",
      format: "text/x-wiki",
      text: "kept",
      textDeleted: false,
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

describe("the upload stream", () => {
  const streamOf = (chunks: Uint8Array[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });

  async function collect(source: AsyncIterable<Uint8Array>): Promise<Buffer> {
    const parts: Buffer[] = [];
    for await (const chunk of source) parts.push(Buffer.from(chunk));
    return Buffer.concat(parts);
  }

  const limits = { maxBytes: 100, maxExpandedBytes: 1000 };

  describe("byteLimit", () => {
    async function through(chunks: Uint8Array[], limit: number) {
      const out: Uint8Array[] = [];
      const reader = streamOf(chunks).pipeThrough(byteLimit(limit, "The thing")).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return out;
        out.push(value);
      }
    }

    it("passes exactly `limit` bytes and fails on the byte after", async () => {
      await expect(through([new Uint8Array(60), new Uint8Array(40)], 100)).resolves.toHaveLength(2);
      await expect(through([new Uint8Array(60), new Uint8Array(41)], 100)).rejects.toThrow(
        PayloadTooLargeError
      );
    });
  });

  describe("openUpload", () => {
    it("bounds a gzip body by the bytes sent, not by what they expand to", async () => {
      const archive = gzipSync(Buffer.alloc(10, 1));
      const small = { maxBytes: archive.length - 1, maxExpandedBytes: 1000 };

      await expect(
        collect(openUpload(streamOf([archive]), { ...small, gzip: true }))
      ).rejects.toThrow("The upload is larger than");
    });

    it("bounds what a small archive expands to (a gzip bomb)", async () => {
      const bomb = gzipSync(Buffer.alloc(5_000_000));
      expect(bomb.length).toBeLessThan(10_000);

      await expect(
        collect(
          openUpload(streamOf([bomb]), { maxBytes: 100_000, maxExpandedBytes: 50_000, gzip: true })
        )
      ).rejects.toThrow("The decompressed dump is larger than 50000 bytes");
    });

    it("fails on a corrupt or truncated archive", async () => {
      const archive = gzipSync("x".repeat(1000));

      await expect(
        collect(openUpload(streamOf([Buffer.from("not gzip at all")]), { ...limits, gzip: true }))
      ).rejects.toThrow();
      await expect(
        collect(openUpload(streamOf([archive.subarray(0, 10)]), { ...limits, gzip: true }))
      ).rejects.toThrow();
    });
  });
});

describe("the command line's dump input", () => {
  const XML =
    "<mediawiki><page><title>Foo</title><ns>0</ns><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text>hi</text></revision></page></mediawiki>";

  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "dump-input-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  async function titles(stream: Readable): Promise<string[]> {
    const found: string[] = [];
    for await (const event of readExport(stream) as AsyncIterable<ImportEvent>) {
      if (event.type === "page") found.push(event.page.title);
    }
    return found;
  }

  describe("openDumpInput", () => {
    it("reports a missing .gz file as an error of the stream, not an unhandled crash or a hang", async () => {
      await expect(
        titles(openDumpInput(join(dir, "missing.xml.gz"), Readable.from([])))
      ).rejects.toThrow(/ENOENT/);
    });

    it("reports a .gz file that is not gzip, and a truncated one", async () => {
      const fake = join(dir, "fake.xml.gz");
      const cut = join(dir, "cut.xml.gz");
      writeFileSync(fake, XML);
      writeFileSync(cut, gzipSync(XML).subarray(0, 12));

      await expect(titles(openDumpInput(fake, Readable.from([])))).rejects.toThrow(/header|gzip/i);
      await expect(titles(openDumpInput(cut, Readable.from([])))).rejects.toThrow(/unexpected end/i);
    });
  });
});

describe("MediaWiki's text hash", () => {
  // Reference values computed independently (hashlib + a hand-written base-36 conversion).
  describe("mwSha1Base36", () => {
    it.each([
      ["a", "frkhg3ewxov0h1g2eh87fri7z1g12ns"],
      ["Hello, world!", "hbbvduyzg9rvcn7s9tgwxvh7c4u19y1"],
    ])("hashes %j", (text, expected) => {
      expect(mwSha1Base36(text)).toBe(expected);
    });
    it("left-pads a small digest with zeros to 31 characters", () => {
      expect(mwSha1Base36("pad10")).toBe("0xppfai6ugrm8kqtj77un9sv64fkg0z");
    });
  });
});

describe("the characters XML cannot carry", () => {
  describe("lone surrogates (PostgreSQL cannot store them: a save of one was a 500)", () => {
    it("never joins two lone surrogates into a pair by removing a control between them", () => {
      expect(stripXmlForbiddenControlChars("\uD800\u0001\uDC00")).toBe("\uFFFD\uFFFD");
    });

    it("gives text PostgreSQL and the export can carry: what it returns survives a UTF-8 round trip", () => {
      const stripped = stripXmlForbiddenControlChars("x\uD800y\uDC00z\u0000\uFFFE\uD83D");

      expect(Buffer.from(stripped, "utf8").toString("utf8")).toBe(stripped);
      expect(stripped).toBe("x\uFFFDy\uFFFDz\uFFFD");
    });
  });

  describe("the strip is a fixed point (stripping stripped text changes nothing)", () => {
    it("holds for every pair of the interesting characters", () => {
      const parts = ["a", "\u0000", "\u0001", "\t", "\uFFFE", "\uFFFF", "\uFFFD", "\uD800", "\uDC00", "\u{1F600}", "\uDE00", "\uD83D"];
      for (const left of parts) {
        for (const middle of parts) {
          for (const right of parts) {
            const once = stripXmlForbiddenControlChars(`${left}${middle}${right}`);
            expect(stripXmlForbiddenControlChars(once)).toBe(once);
          }
        }
      }
    });
  });
});
